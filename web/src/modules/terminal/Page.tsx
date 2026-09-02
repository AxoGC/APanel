import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { useEffect, useRef, useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useI18n } from '@/lib/i18n'

type Shell = 'bash' | 'sh' | 'zsh' | 'fish'
type ThemeMode = 'light' | 'dark' | 'app'

const SHELLS: Shell[] = ['bash', 'sh', 'zsh', 'fish']

function terminalSocketURL(shell: Shell) {
  const scheme = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${scheme}//${window.location.host}/api/terminal?shell=${shell}`
}

function terminalTheme(mode: ThemeMode) {
  const dark = mode === 'dark' || (mode === 'app' && document.documentElement.dataset.theme === 'dark')
  return dark
    ? { background: '#030712', foreground: '#f3f4f6', cursor: '#f3f4f6', selectionBackground: '#374151' }
    : { background: '#ffffff', foreground: '#1f2937', cursor: '#1f2937', selectionBackground: '#d1d5db' }
}

export default function TerminalPage() {
  const { t } = useI18n()
  const containerRef = useRef<HTMLDivElement>(null)
  const [terminalInstance, setTerminalInstance] = useState<Terminal | null>(null)
  const [shell, setShell] = useState<Shell>('bash')
  const [themeMode, setThemeMode] = useState<ThemeMode>('app')
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: 14,
      theme: terminalTheme(themeMode),
    })
    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(container)
    fitAddon.fit()
    setTerminalInstance(terminal)
    setConnectionState('connecting')

    const socket = new WebSocket(terminalSocketURL(shell))
    socket.binaryType = 'arraybuffer'

    const resize = () => {
      fitAddon.fit()
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows }))
      }
    }

    socket.onopen = () => {
      setConnectionState('connected')
      resize()
      terminal.focus()
    }
    socket.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) terminal.write(new Uint8Array(event.data))
      else terminal.write(event.data)
    }
    socket.onclose = () => setConnectionState('disconnected')
    socket.onerror = () => setConnectionState('disconnected')

    const inputSubscription = terminal.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'input', data }))
    })
    const observer = new ResizeObserver(resize)
    observer.observe(container)

    return () => {
      observer.disconnect()
      inputSubscription.dispose()
      socket.close()
      terminal.dispose()
      setTerminalInstance(null)
    }
  }, [shell])

  useEffect(() => {
    if (!terminalInstance) return
    const applyTheme = () => {
      terminalInstance.options.theme = terminalTheme(themeMode)
    }
    applyTheme()

    if (themeMode !== 'app') return
    const observer = new MutationObserver(applyTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [terminalInstance, themeMode])

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-base text-gray-900 dark:text-gray-100">{t('terminal.title')}</h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">{t('terminal.shell')}</span>
          <Select value={shell} onValueChange={(value) => setShell(value as Shell)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SHELLS.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-gray-500">{t('terminal.theme')}</span>
          <Select value={themeMode} onValueChange={(value) => setThemeMode(value as ThemeMode)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">{t('terminal.theme.light')}</SelectItem>
              <SelectItem value="dark">{t('terminal.theme.dark')}</SelectItem>
              <SelectItem value="app">{t('terminal.theme.app')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {connectionState !== 'connected' && (
        <span className="text-xs text-gray-500">
          {connectionState === 'connecting' ? t('terminal.connecting') : t('terminal.disconnected')}
        </span>
      )}
      <div className="min-h-0 grow rounded-lg border border-gray-200 p-3 dark:border-gray-800">
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  )
}
