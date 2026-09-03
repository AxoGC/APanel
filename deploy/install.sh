#!/usr/bin/env bash
# One-click installer for apanel: downloads the latest release binary,
# generates a random login password, writes a minimal config + systemd
# unit, and starts the service. Only ever performs a fresh install — if
# apanel already looks installed (binary, unit, or DB present) it refuses
# to touch anything, so it never overwrites an existing setup.
#
# Usage: sudo ./install.sh
set -euo pipefail

# TODO: the apanel GitHub repo isn't public yet — this is a placeholder.
# Once releases exist at github.com/<owner>/<repo>/releases, update REPO
# below (or export APANEL_INSTALL_REPO before running this script).
REPO="${APANEL_INSTALL_REPO:-axogc/apanel}"

BIN_PATH=/usr/local/bin/apanel
CONFIG_DIR=/etc/apanel
CONFIG_FILE="$CONFIG_DIR/config.env"
DATA_DIR=/var/lib/apanel
DB_FILE="$DATA_DIR/apanel.db"
SERVICE_FILE=/etc/systemd/system/apanel.service
LISTEN_ADDR=":8080"

log()  { printf '==> %s\n' "$*"; }
warn() { printf 'warn: %s\n' "$*" >&2; }
die()  { printf 'error: %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "must be run as root (try: sudo $0)"

# --- 1. Precheck: required commands -----------------------------------
missing_cmds=()
for cmd in curl gunzip install systemctl mktemp; do
  command -v "$cmd" >/dev/null 2>&1 || missing_cmds+=("$cmd")
done
if [ "${#missing_cmds[@]}" -gt 0 ]; then
  die "missing required command(s): ${missing_cmds[*]}"
fi

# --- 2. Precheck: nothing already installed at the target locations ---
existing=()
[ -e "$BIN_PATH" ] && existing+=("$BIN_PATH")
[ -e "$SERVICE_FILE" ] && existing+=("$SERVICE_FILE")
[ -e "$DB_FILE" ] && existing+=("$DB_FILE")
if [ "${#existing[@]}" -gt 0 ]; then
  die "apanel already appears to be installed, refusing to continue: ${existing[*]}"
fi

# --- 3. Resolve architecture and download URL --------------------------
case "$(uname -m)" in
  x86_64|amd64) arch=amd64 ;;
  aarch64|arm64) arch=arm64 ;;
  *) die "unsupported architecture: $(uname -m)" ;;
esac
download_url="https://github.com/${REPO}/releases/latest/download/apanel-linux-${arch}.gz"

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

# --- 4. Download and unpack the binary ----------------------------------
log "downloading $download_url"
curl -fL "$download_url" -o "$tmpdir/apanel.gz" \
  || die "download failed (repo may not be public / have releases yet): $download_url"
gunzip "$tmpdir/apanel.gz"
install -m 0755 -o root -g root "$tmpdir/apanel" "$BIN_PATH"
log "installed binary to $BIN_PATH"

# --- 5. Config + data directories ---------------------------------------
mkdir -p "$CONFIG_DIR"
mkdir -p "$DATA_DIR"
chmod 700 "$CONFIG_DIR" "$DATA_DIR"

password="$(tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 12)"
[ "${#password}" -eq 12 ] || die "failed to generate a 12-character password"

cat > "$CONFIG_FILE" <<EOF
APANEL_PASSWORD=$password
APANEL_LISTEN_ADDR=$LISTEN_ADDR
APANEL_DSN=sqlite://$DB_FILE
EOF
chmod 600 "$CONFIG_FILE"
log "wrote $CONFIG_FILE"

# --- 6. Minimal systemd unit ---------------------------------------------
cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=apanel
After=network.target

[Service]
ExecStart=$BIN_PATH
EnvironmentFile=$CONFIG_FILE
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF
log "wrote $SERVICE_FILE"

# --- 7. Start the service -------------------------------------------------
systemctl daemon-reload
systemctl enable --now apanel

if ! systemctl is-active --quiet apanel; then
  warn "apanel did not start; recent logs:"
  journalctl -u apanel -n 30 --no-pager || true
  die "installation finished but the service is not running"
fi
log "apanel is running (systemctl status apanel)"

# --- 8. Print the generated password --------------------------------------
cat <<EOF

============================================================
 apanel installed
   listening on: $LISTEN_ADDR (plain HTTP)
   password:     $password
============================================================
This is plain HTTP. Put apanel behind HTTPS (a reverse proxy,
or APANEL_TLS_CERT/APANEL_TLS_KEY in $CONFIG_FILE) before
exposing it beyond localhost. See the README's install guide.

EOF

# --- 9. Optional dependencies: report what's usable ------------------------
report_optional() {
  local name="$1" check_cmd="$2" feature="$3" install_hint="$4"
  if command -v "$check_cmd" >/dev/null 2>&1; then
    printf '[ok]      %-8s installed  -> %s available\n' "$name" "$feature"
  else
    printf '[missing] %-8s not found  -> %s unavailable. %s\n' "$name" "$feature" "$install_hint"
  fi
}

echo "Optional features:"
report_optional "ufw" "ufw" "firewall management" \
  "Install with: apt install ufw (then: ufw enable)."
report_optional "docker" "docker" "container/image management" \
  "Install with: curl -fsSL https://get.docker.com | sh."
report_optional "sysstat" "sadf" "historical CPU/memory stats" \
  "Install with: apt install sysstat (then enable collection in /etc/default/sysstat)."

echo
echo "Missing ones just mean the corresponding nav item stays hidden in apanel; install and restart apanel (or just the underlying service) whenever you want them."
