#!/usr/bin/env bash
# One-click installer for apanel: downloads the latest release binary and a
# minimal systemd unit, then starts the service. apanel needs no config
# file — its login password is generated on first start and stored
# (bcrypt-hashed) in its own sqlite database, which this script only points
# a service unit at. Only ever performs a fresh install — if apanel already
# looks installed (binary, unit, or DB present) it refuses to touch
# anything, so it never overwrites an existing setup.
#
# All user-facing messages are looked up from the MSG_EN/MSG_ZH dictionaries
# below and picked at startup based on the system locale (LC_ALL/LC_MESSAGES/
# LANG) — see detect_lang/t.
#
# Usage: sudo ./install.sh
set -euo pipefail

# --- 0. Message dictionary and locale detection -------------------------
declare -A MSG_EN=(
  [err_must_root]="must be run as root (try: sudo %s)"
  [err_missing_cmds]="missing required command(s): %s"
  [err_already_installed]="apanel already appears to be installed, refusing to continue: %s"
  [err_unsupported_arch]="unsupported architecture: %s"
  [err_download_failed]="download failed (repo may not be public / have releases yet): %s"
  [err_not_running]="installation finished but the service is not running"
  [log_downloading]="downloading %s"
  [log_installed_binary]="installed binary to %s"
  [log_wrote_service]="wrote %s"
  [log_running]="apanel is running (systemctl status apanel)"
  [warn_not_started]="apanel did not start; recent logs:"
  [warn_no_password]="couldn't read the generated password from the journal; run: journalctl -u apanel -b | grep 'generated one'"
  [banner_installed]="apanel installed"
  [banner_listening]="listening on: :8123 (plain HTTP by default)"
  [banner_password]="password:     %s"
  [banner_https_1]="This is plain HTTP. Put apanel behind HTTPS (a reverse proxy,"
  [banner_https_2]="or APANEL_TLS_CERT/APANEL_TLS_KEY in %s) before"
  [banner_https_3]="exposing it beyond localhost. See the README's install guide."
  [banner_login]="Log in with the password above, then change it from Settings."
  [optional_header]="Optional features:"
  [optional_ok]="[ok]      %-8s installed  -> %s available\n"
  [optional_missing]="[missing] %-8s not found  -> %s unavailable. %s\n"
  [optional_footer]="Missing ones just mean the corresponding nav item stays hidden in apanel; install and restart apanel (or just the underlying service) whenever you want them."
  [feature_ufw]="firewall management"
  [hint_ufw]="Install with: apt install ufw (then: ufw enable)."
  [feature_docker]="container/image management"
  [hint_docker]="Install with: curl -fsSL https://get.docker.com | sh."
  [feature_sysstat]="historical CPU/memory stats"
  [hint_sysstat]="Install with: apt install sysstat (then enable collection in /etc/default/sysstat)."
)
declare -A MSG_ZH=(
  [err_must_root]="必须以 root 权限运行（请尝试：sudo %s）"
  [err_missing_cmds]="缺少必需的命令：%s"
  [err_already_installed]="apanel 似乎已经安装，拒绝继续操作：%s"
  [err_unsupported_arch]="不支持的架构：%s"
  [err_download_failed]="下载失败（仓库可能尚未公开发布 / 没有 release）：%s"
  [err_not_running]="安装已完成，但服务未在运行"
  [log_downloading]="正在下载 %s"
  [log_installed_binary]="已将二进制文件安装到 %s"
  [log_wrote_service]="已写入 %s"
  [log_running]="apanel 正在运行（systemctl status apanel）"
  [warn_not_started]="apanel 未能启动，最近日志如下："
  [warn_no_password]="未能从日志中读取生成的密码，请运行：journalctl -u apanel -b | grep 'generated one'"
  [banner_installed]="apanel 安装完成"
  [banner_listening]="监听地址：:8123（默认使用明文 HTTP）"
  [banner_password]="密码：       %s"
  [banner_https_1]="当前为明文 HTTP。在将 apanel 暴露到本机以外之前，"
  [banner_https_2]="请为其加上 HTTPS（反向代理，或在 %s 中配置"
  [banner_https_3]="APANEL_TLS_CERT/APANEL_TLS_KEY）。详见 README 的安装指南。"
  [banner_login]="请使用上面的密码登录，然后在“设置”中修改密码。"
  [optional_header]="可选功能："
  [optional_ok]="[已安装]  %-8s 已安装      -> %s 可用\n"
  [optional_missing]="[未安装]  %-8s 未找到      -> %s 不可用。%s\n"
  [optional_footer]="缺少的功能只会导致 apanel 中对应的导航项被隐藏；安装后重启 apanel（或对应的底层服务）即可启用。"
  [feature_ufw]="防火墙管理"
  [hint_ufw]="安装方式：apt install ufw（然后执行：ufw enable）。"
  [feature_docker]="容器/镜像管理"
  [hint_docker]="安装方式：curl -fsSL https://get.docker.com | sh。"
  [feature_sysstat]="历史 CPU/内存统计"
  [hint_sysstat]="安装方式：apt install sysstat（然后在 /etc/default/sysstat 中启用采集）。"
)

# detect_lang reads the standard POSIX locale precedence (LC_ALL overrides
# LC_MESSAGES overrides LANG) and maps any zh* locale to "zh", everything
# else (including an unset/C locale) to "en".
detect_lang() {
  local locale="${LC_ALL:-${LC_MESSAGES:-${LANG:-}}}"
  case "$locale" in
    zh*) echo zh ;;
    *) echo en ;;
  esac
}
LANG_CODE="$(detect_lang)"

# tpl prints the raw (unsubstituted) template for a message key in the
# active language, falling back to English if a translation is missing.
tpl() {
  local key="$1"
  if [ "$LANG_CODE" = "zh" ] && [ -n "${MSG_ZH[$key]+x}" ]; then
    printf '%s' "${MSG_ZH[$key]}"
  else
    printf '%s' "${MSG_EN[$key]}"
  fi
}

# t looks up a message key and printf-substitutes the remaining arguments
# into it — the general-purpose "give me this message, translated" call.
t() {
  local key="$1"
  shift
  local template
  template="$(tpl "$key")"
  # shellcheck disable=SC2059
  printf -- "$template" "$@"
}

BIN_PATH=/usr/local/bin/apanel
DATA_DIR=/var/lib/apanel
DB_FILE="$DATA_DIR/apanel.db"
SERVICE_FILE=/etc/systemd/system/apanel.service

log()  { printf '==> %s\n' "$*"; }
warn() { printf 'warn: %s\n' "$*" >&2; }
die()  { printf 'error: %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "$(t err_must_root "$0")"

# --- 1. Precheck: required commands -----------------------------------
missing_cmds=()
for cmd in curl gunzip install systemctl mktemp; do
  command -v "$cmd" >/dev/null 2>&1 || missing_cmds+=("$cmd")
done
if [ "${#missing_cmds[@]}" -gt 0 ]; then
  die "$(t err_missing_cmds "${missing_cmds[*]}")"
fi

# --- 2. Precheck: nothing already installed at the target locations ---
existing=()
[ -e "$BIN_PATH" ] && existing+=("$BIN_PATH")
[ -e "$SERVICE_FILE" ] && existing+=("$SERVICE_FILE")
[ -e "$DB_FILE" ] && existing+=("$DB_FILE")
if [ "${#existing[@]}" -gt 0 ]; then
  die "$(t err_already_installed "${existing[*]}")"
fi

# --- 3. Resolve architecture and download URL --------------------------
# TODO: the apanel GitHub repo isn't public yet — this is a placeholder.
# Once releases exist at github.com/<owner>/<repo>/releases, update REPO
# below (or export APANEL_INSTALL_REPO before running this script).
REPO="${APANEL_INSTALL_REPO:-axogc/apanel}"

case "$(uname -m)" in
  x86_64|amd64) arch=amd64 ;;
  aarch64|arm64) arch=arm64 ;;
  *) die "$(t err_unsupported_arch "$(uname -m)")" ;;
esac
download_url="https://github.com/${REPO}/releases/latest/download/apanel-linux-${arch}.gz"

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

# --- 4. Download and unpack the binary ----------------------------------
log "$(t log_downloading "$download_url")"
curl -fL "$download_url" -o "$tmpdir/apanel.gz" \
  || die "$(t err_download_failed "$download_url")"
gunzip "$tmpdir/apanel.gz"
install -m 0755 -o root -g root "$tmpdir/apanel" "$BIN_PATH"
log "$(t log_installed_binary "$BIN_PATH")"

# --- 5. Minimal systemd unit ---------------------------------------------
# No EnvironmentFile=, no config file at all: apanel's only state is its
# own sqlite database at $DB_FILE. To change the listen port or terminate
# TLS directly, add Environment= lines here (see the commented examples)
# and run `systemctl daemon-reload && systemctl restart apanel`.
cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=apanel
After=network.target

[Service]
ExecStart=$BIN_PATH
#Environment=APANEL_LISTEN_ADDR=:8080
#Environment=APANEL_TLS_CERT=/etc/apanel/tls/fullchain.pem
#Environment=APANEL_TLS_KEY=/etc/apanel/tls/privkey.pem
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF
log "$(t log_wrote_service "$SERVICE_FILE")"

# --- 6. Start the service -------------------------------------------------
systemctl daemon-reload
systemctl enable --now apanel

if ! systemctl is-active --quiet apanel; then
  warn "$(t warn_not_started)"
  journalctl -u apanel -n 30 --no-pager || true
  die "$(t err_not_running)"
fi
log "$(t log_running)"

# --- 7. Read back the password apanel generated on first start ------------
# apanel prints this exactly once, the very first time it finds no password
# stored yet, so it's only recoverable from this boot's logs.
password="$(journalctl -u apanel -b --no-pager | grep -o 'generated one: .*' | tail -1 | sed 's/^generated one: //')"

echo
echo "============================================================"
echo " $(t banner_installed)"
echo "   $(t banner_listening)"
if [ -n "$password" ]; then
  echo "   $(t banner_password "$password")"
else
  warn "$(t warn_no_password)"
fi
echo "============================================================"
echo "$(t banner_https_1)"
echo "$(t banner_https_2 "$SERVICE_FILE")"
echo "$(t banner_https_3)"
echo "$(t banner_login)"
echo

# --- 8. Optional dependencies: report what's usable ------------------------
report_optional() {
  local name="$1" check_cmd="$2" feature_key="$3" hint_key="$4"
  local feature hint
  feature="$(t "$feature_key")"
  hint="$(t "$hint_key")"
  if command -v "$check_cmd" >/dev/null 2>&1; then
    printf "$(tpl optional_ok)" "$name" "$feature"
  else
    printf "$(tpl optional_missing)" "$name" "$feature" "$hint"
  fi
}

echo "$(t optional_header)"
report_optional "ufw" "ufw" "feature_ufw" "hint_ufw"
report_optional "docker" "docker" "feature_docker" "hint_docker"
report_optional "sysstat" "sadf" "feature_sysstat" "hint_sysstat"

echo
echo "$(t optional_footer)"
