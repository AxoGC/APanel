import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Locale = 'en' | 'zh'

const STORAGE_KEY = 'apanel:locale'

const dictionaries: Record<Locale, Record<string, string>> = {
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.services': 'Services',
    'nav.containers': 'Containers',
    'nav.history': 'History',
    'nav.firewall': 'Firewall',
    'nav.settings': 'Settings',
    'nav.logout': 'Sign out',
    'nav.menu': 'Menu',
    'login.title': 'Sign in',
    'login.password': 'Password',
    'login.submit': 'Sign in',
    'login.httpsRequired':
      'apanel requires HTTPS. Set up TLS — directly or via a reverse proxy — before signing in.',
    'login.invalid': 'Incorrect password.',
    'login.error': 'Something went wrong. Try again.',
    'dashboard.title': 'Dashboard',
    'dashboard.cpu': 'CPU',
    'dashboard.memory': 'Memory',
    'dashboard.swap': 'Swap',
    'dashboard.processes': 'Processes',
    'dashboard.sort': 'Sort',
    'services.search': 'Search services…',
    'services.search.label': 'Search',
    'services.filter.running': 'Running',
    'services.filter.failed': 'Failed',
    'services.filter.stopped': 'Stopped',
    'services.filter.all': 'All',
    'services.empty': 'No services match.',
    'services.name': 'Name',
    'services.enablement': 'Enablement',
    'services.status': 'Status',
    'services.actions': 'Actions',
    'services.start': 'Start',
    'services.stop': 'Stop',
    'services.restart': 'Restart',
    'services.unitFileState.enabled': 'Enabled',
    'services.unitFileState.static': 'Static',
    'services.unitFileState.alias': 'Alias',
    'services.unitFileState.disabled': 'Disabled',
    'services.unitFileState.masked': 'Masked',
    'services.unitFileState.enabledRuntime': 'Enabled (runtime)',
    'services.unitFileState.bad': 'Bad',
    'containers.search': 'Search containers…',
    'containers.search.label': 'Search',
    'containers.status': 'Status',
    'containers.filter.all': 'All',
    'containers.empty': 'No containers match.',
    'containers.name': 'Name',
    'containers.image': 'Image',
    'containers.actions': 'Actions',
    'containers.start': 'Start',
    'containers.stop': 'Stop',
    'containers.restart': 'Restart',
    'containers.state.created': 'Created',
    'containers.state.running': 'Running',
    'containers.state.paused': 'Paused',
    'containers.state.restarting': 'Restarting',
    'containers.state.removing': 'Removing',
    'containers.state.exited': 'Exited',
    'containers.state.dead': 'Dead',
    'history.day': 'Day',
    'history.today': 'Today',
    'history.yesterday': 'Yesterday',
    'history.cpu': 'CPU',
    'history.memory': 'Memory',
    'history.empty': 'No data for this day.',
    'firewall.active': 'Active',
    'firewall.inactive': 'Inactive',
    'firewall.from': 'From',
    'firewall.empty': 'No rules.',
    'settings.account': 'Account',
    'settings.signOut': 'Sign out',
    'placeholder.comingSoon': 'Coming soon.',
  },
  zh: {
    'nav.dashboard': '仪表盘',
    'nav.services': '服务管理',
    'nav.containers': '容器管理',
    'nav.history': '历史状态',
    'nav.firewall': '防火墙',
    'nav.settings': '设置',
    'nav.logout': '退出登录',
    'nav.menu': '菜单',
    'login.title': '登录',
    'login.password': '密码',
    'login.submit': '登录',
    'login.httpsRequired': 'apanel 需要 HTTPS。请先配置好 TLS（直接配置或通过反向代理），再登录。',
    'login.invalid': '密码错误。',
    'login.error': '出了点问题，请重试。',
    'dashboard.title': '仪表盘',
    'dashboard.cpu': 'CPU',
    'dashboard.memory': '内存',
    'dashboard.swap': '交换',
    'dashboard.processes': '进程',
    'dashboard.sort': '排序',
    'services.search': '搜索服务…',
    'services.search.label': '搜索',
    'services.filter.running': '运行中',
    'services.filter.failed': '失败',
    'services.filter.stopped': '已停止',
    'services.filter.all': '全部',
    'services.empty': '没有匹配的服务。',
    'services.name': '名称',
    'services.enablement': '开机自启',
    'services.status': '状态',
    'services.actions': '操作',
    'services.start': '启动',
    'services.stop': '停止',
    'services.restart': '重启',
    'services.unitFileState.enabled': '已启用',
    'services.unitFileState.static': '静态',
    'services.unitFileState.alias': '别名',
    'services.unitFileState.disabled': '未启用',
    'services.unitFileState.masked': '已屏蔽',
    'services.unitFileState.enabledRuntime': '临时启用',
    'services.unitFileState.bad': '异常',
    'containers.search': '搜索容器…',
    'containers.search.label': '搜索',
    'containers.status': '状态',
    'containers.filter.all': '全部',
    'containers.empty': '没有匹配的容器。',
    'containers.name': '名称',
    'containers.image': '镜像',
    'containers.actions': '操作',
    'containers.start': '启动',
    'containers.stop': '停止',
    'containers.restart': '重启',
    'containers.state.created': '已创建',
    'containers.state.running': '运行中',
    'containers.state.paused': '已暂停',
    'containers.state.restarting': '重启中',
    'containers.state.removing': '删除中',
    'containers.state.exited': '已停止',
    'containers.state.dead': '异常',
    'history.day': '日期',
    'history.today': '今天',
    'history.yesterday': '昨天',
    'history.cpu': 'CPU',
    'history.memory': '内存',
    'history.empty': '这一天没有数据。',
    'firewall.active': '已启用',
    'firewall.inactive': '未启用',
    'firewall.from': '来源',
    'firewall.empty': '没有规则。',
    'settings.account': '账户',
    'settings.signOut': '退出登录',
    'placeholder.comingSoon': '即将推出。',
  },
}

export type TranslationKey = keyof (typeof dictionaries)['en']

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: TranslationKey) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

function detectDefaultLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'en' || stored === 'zh') return stored
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectDefaultLocale)

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = (locale: Locale) => {
    localStorage.setItem(STORAGE_KEY, locale)
    setLocaleState(locale)
  }

  const t = useMemo(() => {
    const dict = dictionaries[locale]
    return (key: keyof (typeof dictionaries)['en']) => dict[key] ?? key
  }, [locale])

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
