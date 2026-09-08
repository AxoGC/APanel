import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { XIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  containerAttachSocketUrl,
  containerLogsStreamUrl,
  getContainerDetail,
  getContainerLogs,
  type ContainerLogsTarget,
} from './api'

const LINE_OPTIONS = [100, 500, 1000, 2000]

// Plain-text log lines are rendered as-is, not through xterm (that's only
// the interactive "attach" mode) — so a program that colors its own output
// (logrus etc.) leaves raw ANSI escape/CSI sequences sitting in the text
// instead of being interpreted, e.g. literal "\x1b[37mDEBU\x1b[0m[0000]".
// Matches any CSI sequence, not just color (SGR/"m") ones, so cursor-control
// codes get consumed too instead of leaking through as text.
// eslint-disable-next-line no-control-regex
const ANSI_CSI_RE = /\x1b\[([0-9;]*)([a-zA-Z])/g

// Standard 16-color ANSI foreground codes, mapped to Tailwind classes that
// already carry their own dark-mode variant — consistent with how every
// other color in this codebase is themed, rather than picking one fixed hex
// per code that only reads well against one background.
const ANSI_FG_CLASS: Record<number, string> = {
  30: 'text-gray-500 dark:text-gray-400',
  31: 'text-red-600 dark:text-red-400',
  32: 'text-green-600 dark:text-green-400',
  33: 'text-yellow-600 dark:text-yellow-400',
  34: 'text-blue-600 dark:text-blue-400',
  35: 'text-purple-600 dark:text-purple-400',
  36: 'text-cyan-600 dark:text-cyan-400',
  37: 'text-gray-700 dark:text-gray-300',
  90: 'text-gray-400 dark:text-gray-500',
  91: 'text-red-500 dark:text-red-400',
  92: 'text-green-500 dark:text-green-400',
  93: 'text-yellow-500 dark:text-yellow-400',
  94: 'text-blue-500 dark:text-blue-400',
  95: 'text-purple-500 dark:text-purple-400',
  96: 'text-cyan-500 dark:text-cyan-400',
  97: 'text-gray-900 dark:text-white',
}

interface AnsiSegment {
  text: string
  fg?: number
  bold?: boolean
}

// Splits one log line into runs of text tagged with whatever SGR (color/
// bold) state was active when they were printed. Only foreground color and
// bold are tracked — background colors are dropped since a log line's own
// background would fight the dialog's; every other CSI sequence (cursor
// moves, line clears, ...) is consumed with no visual effect, same as a
// real terminal ignores them for a static, already-flushed log.
function parseAnsiLine(line: string): AnsiSegment[] {
  const segments: AnsiSegment[] = []
  let fg: number | undefined
  let bold = false
  let lastIndex = 0

  ANSI_CSI_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = ANSI_CSI_RE.exec(line))) {
    if (match.index > lastIndex) {
      segments.push({ text: line.slice(lastIndex, match.index), fg, bold })
    }
    lastIndex = ANSI_CSI_RE.lastIndex

    if (match[2] === 'm') {
      const codes = match[1] === '' ? [0] : match[1].split(';').map(Number)
      for (const code of codes) {
        if (code === 0) {
          fg = undefined
          bold = false
        } else if (code === 1) {
          bold = true
        } else if (code === 22) {
          bold = false
        } else if (code === 39) {
          fg = undefined
        } else if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) {
          fg = code
        }
      }
    }
  }
  if (lastIndex < line.length) segments.push({ text: line.slice(lastIndex), fg, bold })
  return segments
}

function AnsiLine({ line }: { line: string }) {
  if (!line.includes('\x1b')) return <>{line}</>
  return (
    <>
      {parseAnsiLine(line).map((seg, i) => (
        <span key={i} className={cn(seg.fg != null && ANSI_FG_CLASS[seg.fg], seg.bold && 'font-semibold')}>
          {seg.text}
        </span>
      ))}
    </>
  )
}

type ViewMode = 'logs' | 'attach'
type AttachState = 'connecting' | 'connected' | 'disconnected'

interface AttachInfo {
  tty: boolean
  stdin: boolean
  stdinOnce: boolean
}

function attachTerminalTheme() {
  const dark = document.documentElement.dataset.theme === 'dark'
  return dark
    ? { background: '#030712', foreground: '#f3f4f6', cursor: '#f3f4f6', selectionBackground: '#374151' }
    : { background: '#ffffff', foreground: '#1f2937', cursor: '#1f2937', selectionBackground: '#d1d5db' }
}

// Container logs and Docker attach deliberately live in their own dialog:
// service logs remain a read-only journal stream, while this component also
// owns the bidirectional WebSocket, TTY sizing, and stdin capability state.
export function ContainerLogsDialog({
  open,
  onOpenChange,
  container,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  container: ContainerLogsTarget | null
}) {
  const { t } = useI18n()
  const [mode, setMode] = useState<ViewMode>('logs')
  const [lines, setLines] = useState(500)
  const [follow, setFollow] = useState(true)
  const [content, setContent] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [attachState, setAttachState] = useState<AttachState>('disconnected')
  const [attachInfo, setAttachInfo] = useState<AttachInfo | null>(null)
  const [openStdin, setOpenStdin] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef(content)

  const id = container?.id ?? ''
  const canAttach = container?.state === 'running'

  // Whether to offer Attach mode at all depends on stdin being open on the
  // container, which the list view doesn't carry — fetched once per open so
  // the logs/attach segmented control can be hidden up front instead of
  // only after a failed or read-only attach.
  useEffect(() => {
    if (!open || !container) return
    setOpenStdin(false)
    getContainerDetail(container.id)
      .then((detail) => setOpenStdin(detail.openStdin))
      .catch(() => {})
  }, [open, container])

  useEffect(() => {
    contentRef.current = content
  }, [content])

  useEffect(() => {
    if (!open || mode !== 'logs' || follow) return
    let cancelled = false
    setError(null)
    getContainerLogs(id, lines)
      .then((result) => {
        if (!cancelled) setContent(result)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [open, mode, follow, id, lines])

  useEffect(() => {
    if (!open || mode !== 'logs' || !follow) return
    setContent([])
    setError(null)
    const source = new EventSource(containerLogsStreamUrl(id, lines))
    source.onmessage = (event) => {
      setContent((previous) => [...previous, event.data as string])
    }
    source.onerror = () => {
      setError(t('logs.error'))
      source.close()
    }
    return () => source.close()
  }, [open, mode, follow, id, lines, t])

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [content])

  useEffect(() => {
    const target = terminalRef.current
    if (!open || mode !== 'attach' || !canAttach || !target) return

    let disposed = false
    let tty = false
    let stdin = false
    setAttachState('connecting')
    setAttachInfo(null)
    setError(null)

    const terminal = new Terminal({
      convertEol: true,
      cursorBlink: true,
      disableStdin: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: 13,
      scrollback: 5000,
      theme: attachTerminalTheme(),
    })
    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(target)

    const previous = contentRef.current
    if (previous.length > 0) terminal.write(`${previous.join('\r\n')}\r\n`)

    const socket = new WebSocket(containerAttachSocketUrl(id))
    socket.binaryType = 'arraybuffer'

    const resize = () => {
      fitAddon.fit()
      if (tty && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows }))
      }
    }

    socket.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        terminal.write(new Uint8Array(event.data))
        return
      }
      try {
        const message = JSON.parse(event.data as string) as { type?: string } & AttachInfo
        if (message.type !== 'ready') return
        tty = message.tty
        stdin = message.stdin
        terminal.options.disableStdin = !stdin
        setAttachInfo({ tty: message.tty, stdin: message.stdin, stdinOnce: message.stdinOnce })
        setAttachState('connected')
        resize()
      } catch {
        // Text frames are reserved for control messages; malformed control
        // data is ignored without disturbing the live output stream.
      }
    }
    socket.onerror = () => {
      if (!disposed) {
        setAttachState('disconnected')
        setError(t('logs.attach.error'))
      }
    }
    socket.onclose = () => {
      if (!disposed) setAttachState('disconnected')
    }

    const inputSubscription = terminal.onData((data) => {
      if (stdin && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'input', data }))
      }
    })
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(target)
    const frame = requestAnimationFrame(resize)

    const themeObserver = new MutationObserver(() => {
      terminal.options.theme = attachTerminalTheme()
    })
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      themeObserver.disconnect()
      resizeObserver.disconnect()
      inputSubscription.dispose()
      socket.close()
      terminal.dispose()
    }
  }, [open, mode, canAttach, id, t])

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setMode('logs')
      setAttachInfo(null)
      setAttachState('disconnected')
    }
    onOpenChange(nextOpen)
  }

  const attachStateLabel =
    attachState === 'connecting'
      ? t('logs.attach.connecting')
      : attachState === 'connected'
        ? t('logs.attach.connected')
        : t('logs.attach.disconnected')

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-w-2xl flex-col gap-0 p-0 lg:max-w-4xl" height="85vh" showCloseButton={false} drawer>
        <div className="flex items-center justify-between gap-2 p-4 pt-6 pb-3 sm:pt-4">
          <DialogTitle className="truncate">
            {container ? `${container.name} — ${t('containers.logs')}` : ''}
          </DialogTitle>
          <DialogClose className="shrink-0 cursor-pointer rounded-sm text-gray-500 outline-none hover:text-gray-700 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:text-gray-300">
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
          {canAttach && openStdin && (
            <SegmentedControl
              options={[
                { value: 'logs', label: t('logs.mode.logs') },
                { value: 'attach', label: t('logs.mode.attach') },
              ]}
              value={mode}
              onChange={setMode}
            />
          )}

          {mode === 'logs' ? (
            <>
              <SegmentedControl
                options={LINE_OPTIONS.map((lineCount) => ({ value: String(lineCount), label: String(lineCount) }))}
                value={String(lines)}
                onChange={(value) => setLines(Number(value))}
              />
              <label className="ml-auto flex items-center gap-2 text-xs text-gray-500">
                {t('logs.follow')}
                <Switch checked={follow} onCheckedChange={setFollow} />
              </label>
            </>
          ) : (
            <span className="ml-auto text-xs text-gray-500">{attachStateLabel}</span>
          )}
        </div>

        {mode === 'attach' && attachInfo && (
          <p className="px-4 pb-3 text-xs text-gray-500">
            {t('logs.attach.stdin')}
            {attachInfo.stdinOnce && ` ${t('logs.attach.stdinOnce')}`}
          </p>
        )}

        {error && <p className="px-4 pb-3 text-xs text-red-600">{error}</p>}

        <div className="border-t border-gray-200 dark:border-gray-800" />

        {mode === 'logs' ? (
          <ScrollArea className="min-h-0 grow" viewportRef={bodyRef}>
            <div className="p-4 font-mono text-xs text-gray-700 dark:text-gray-300">
              {content.length === 0 ? (
                <p className="text-gray-500">{t('logs.empty')}</p>
              ) : (
                content.map((line, index) => (
                  <div key={index} className="whitespace-pre-wrap break-all">
                    <AnsiLine line={line} />
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        ) : (
          <div ref={terminalRef} className="h-[60vh] min-h-64 w-full p-4" />
        )}
      </DialogContent>
    </Dialog>
  )
}
