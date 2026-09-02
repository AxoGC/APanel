import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Locale = 'en' | 'zh'

const STORAGE_KEY = 'apanel:locale'

const dictionaries: Record<Locale, Record<string, string>> = {
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.services': 'Services',
    'nav.containers': 'Containers',
    'nav.history': 'History',
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
    'dashboard.processes': 'Processes',
    'services.search': 'Search services…',
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
    'placeholder.comingSoon': 'Coming soon.',
  },
  zh: {
    'nav.dashboard': '仪表盘',
    'nav.services': '服务管理',
    'nav.containers': '容器管理',
    'nav.history': '历史状态',
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
    'dashboard.processes': '进程',
    'services.search': '搜索服务…',
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
    'placeholder.comingSoon': '即将推出。',
  },
}

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: keyof (typeof dictionaries)['en']) => string
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
