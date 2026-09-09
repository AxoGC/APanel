import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { Folder } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { apiFetch } from '@/lib/api'
import { apiWsUrl } from '@/lib/apiBase'
import { useI18n } from '@/lib/i18n'

type Shell = string
type ThemeMode = 'light' | 'dark' | 'app'

interface TerminalDirectory {
  name: string
  path: string
}

interface TerminalDirectoriesResponse {
  cwd: string
  directories: TerminalDirectory[]
}

interface MultiplexerSession {
  name: string
}

interface MultiplexerInfo {
  available: boolean
  name?: string
  sessions: MultiplexerSession[]
}

interface MultiplexerWindow {
  index: string
  name: string
}

// Selecting either "add" sentinel doesn't switch the terminal itself — it
// kicks off a create call whose result becomes the new session/window.
// TEMPORARY is a stand-in for session === '' since Radix's Select.Item
// rejects an empty-string value outright.
const ADD_SESSION = '__add_session__'
const ADD_WINDOW = '__add_window__'
const TEMPORARY = '__temporary__'

function nextSessionName(existing: string[]): string {
  let n = 1
  while (existing.includes(`session-${n}`)) n++
  return `session-${n}`
}

function terminalSocketURL(shell: Shell, session: string, win: string) {
  const params = new URLSearchParams()
  if (session) {
    params.set('session', session)
    if (win) params.set('window', win)
  } else {
    params.set('shell', shell)
  }
  return apiWsUrl(`/terminal?${params.toString()}`)
}

function terminalTheme(mode: ThemeMode) {
  // In follow-app mode the terminal canvas should disappear into the page
  // rather than introducing a competing white/near-black surface. Reading
  // the computed body colors also follows the runtime theme variables.
  if (mode === 'app') {
    const page = getComputedStyle(document.body)
    const foreground = page.color
    return {
      background: page.backgroundColor,
      foreground,
      cursor: foreground,
      selectionBackground: document.documentElement.dataset.theme === 'dark' ? '#374151' : '#d1d5db',
    }
  }

  const dark = mode === 'dark'
  return dark
    ? { background: '#030712', foreground: '#f3f4f6', cursor: '#f3f4f6', selectionBackground: '#374151' }
    : { background: '#ffffff', foreground: '#1f2937', cursor: '#1f2937', selectionBackground: '#d1d5db' }
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`
}

export default function TerminalPage() {
  const { t } = useI18n()
  const containerRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const [terminalInstance, setTerminalInstance] = useState<Terminal | null>(null)
  const [shells, setShells] = useState<Shell[] | null>(null)
  const [shell, setShell] = useState<Shell>('')
  const [themeMode, setThemeMode] = useState<ThemeMode>('app')
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const [cwd, setCwd] = useState('')
  const [directories, setDirectories] = useState<TerminalDirectory[] | null>(null)
  const [multiplexerAvailable, setMultiplexerAvailable] = useState(false)
  const [sessions, setSessions] = useState<string[]>([])
  const [session, setSession] = useState('')
  const [windows, setWindows] = useState<MultiplexerWindow[]>([])
  const [win, setWin] = useState('')

  // Probe once on entry for which shells are actually installed on this
  // system, then default to whichever one it lists first — the terminal
  // connection effect below waits for that before opening its socket, so
  // it never tries to spawn a shell the backend won't find.
  useEffect(() => {
    let cancelled = false
    void apiFetch<Shell[]>('/terminal/shells')
      .then((available) => {
        if (cancelled) return
        setShells(available)
        setShell((current) => current || available[0] || 'bash')
      })
      .catch(() => {
        if (!cancelled) {
          setShells([])
          setShell((current) => current || 'bash')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Probe once on entry for a terminal multiplexer (tmux today) on the
  // backend — its session list drives the session select below, and its
  // absence means falling back to the plain-shell mode above entirely (no
  // session/window selects at all).
  useEffect(() => {
    let cancelled = false
    void apiFetch<MultiplexerInfo>('/terminal/multiplexer/sessions')
      .then((info) => {
        if (cancelled) return
        setMultiplexerAvailable(info.available)
        setSessions(info.sessions.map((s) => s.name))
      })
      .catch(() => {
        if (!cancelled) setMultiplexerAvailable(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Refresh the window list whenever the selected session changes — an
  // empty session (temporary mode) has no windows to list.
  useEffect(() => {
    if (!session) {
      setWindows([])
      setWin('')
      return
    }
    let cancelled = false
    void apiFetch<MultiplexerWindow[]>(`/terminal/multiplexer/windows?session=${encodeURIComponent(session)}`)
      .then((list) => {
        if (cancelled) return
        setWindows(list)
        setWin((current) => (list.some((w) => w.index === current) ? current : (list[0]?.index ?? ''))
        )
      })
      .catch(() => {
        if (!cancelled) setWindows([])
      })
    return () => {
      cancelled = true
    }
  }, [session])

  function selectSession(value: string) {
    if (value === TEMPORARY) {
      setSession('')
      return
    }
    if (value !== ADD_SESSION) {
      setSession(value)
      return
    }
    const name = nextSessionName(sessions)
    void apiFetch('/terminal/multiplexer/sessions', { method: 'POST', body: JSON.stringify({ name }) })
      .then(() => {
        setSessions((current) => [...current, name])
        setSession(name)
      })
      .catch(() => {})
  }

  function selectWindow(value: string) {
    if (value !== ADD_WINDOW) {
      setWin(value)
      return
    }
    void apiFetch<MultiplexerWindow>('/terminal/multiplexer/windows', {
      method: 'POST',
      body: JSON.stringify({ session }),
    })
      .then((created) => {
        setWindows((current) => [...current, created])
        setWin(created.index)
      })
      .catch(() => {})
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container || (!session && !shell)) return

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

    const socket = new WebSocket(terminalSocketURL(shell, session, win))
    socketRef.current = socket
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
      // On phones, focusing xterm on entry opens the virtual keyboard and
      // obscures the screen before the operator has chosen to type.
      if (window.matchMedia('(min-width: 768px)').matches) terminal.focus()
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
      socketRef.current = null
      terminal.dispose()
      setTerminalInstance(null)
    }
  }, [shell, session, win])

  useEffect(() => {
    let cancelled = false
    const path = cwd ? `?cwd=${encodeURIComponent(cwd)}` : ''
    void apiFetch<TerminalDirectoriesResponse>(`/terminal/directories${path}`)
      .then((response) => {
        if (cancelled) return
        setCwd(response.cwd)
        setDirectories(response.directories)
      })
      .catch(() => {
        if (!cancelled) setDirectories([])
      })
    return () => {
      cancelled = true
    }
  }, [cwd])

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

  const changeDirectory = (directory: TerminalDirectory) => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    socket.send(JSON.stringify({ type: 'input', data: `cd -- ${shellQuote(directory.path)}\r` }))
    setCwd(directory.path)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-3 border-b border-gray-200 p-4 sm:p-6 dark:border-gray-800">
        <div className="flex flex-wrap items-center gap-3">
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {multiplexerAvailable && (
              <>
                <span className="hidden text-xs text-gray-500 md:inline">{t('terminal.session')}</span>
                <Select value={session || TEMPORARY} onValueChange={selectSession}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TEMPORARY}>{t('terminal.session.temporary')}</SelectItem>
                    {sessions.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                    <SelectItem value={ADD_SESSION}>{t('terminal.session.add')}</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}
            {session && (
              <>
                <span className="hidden text-xs text-gray-500 md:inline">{t('terminal.window')}</span>
                <Select value={win} onValueChange={selectWindow}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {windows.map((w) => (
                      <SelectItem key={w.index} value={w.index}>
                        {w.name || w.index}
                      </SelectItem>
                    ))}
                    <SelectItem value={ADD_WINDOW}>{t('terminal.window.add')}</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}
            {!session && (
              <>
                <span className="hidden text-xs text-gray-500 md:inline">{t('terminal.shell')}</span>
                <Select
                  value={shell}
                  disabled={!shell}
                  onValueChange={(value) => {
                    setCwd('')
                    setDirectories(null)
                    setShell(value)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {shells?.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
            <span className="hidden text-xs text-gray-500 md:inline">{t('terminal.theme')}</span>
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
        <ScrollArea orientation="horizontal" className="min-w-0" viewportClassName="pb-2">
          <div className="flex w-max gap-2">
            {directories?.map((directory) => (
              <button
                key={directory.path}
                type="button"
                disabled={connectionState !== 'connected'}
                onClick={() => changeDirectory(directory)}
                className="flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <Folder className="size-3.5" />
                {directory.name}
              </button>
            ))}
            {directories?.length === 0 && <span className="text-xs text-gray-500">{t('terminal.directories.empty')}</span>}
          </div>
        </ScrollArea>
      </div>
      <div className="min-h-0 grow">
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  )
}
