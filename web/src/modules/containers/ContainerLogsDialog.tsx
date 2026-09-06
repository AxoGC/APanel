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
import {
  containerAttachSocketUrl,
  containerLogsStreamUrl,
  getContainerLogs,
  type ContainerInfo,
} from './api'

const LINE_OPTIONS = [100, 500, 1000, 2000]

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
  container: ContainerInfo | null
}) {
  const { t } = useI18n()
  const [mode, setMode] = useState<ViewMode>('logs')
  const [lines, setLines] = useState(500)
  const [follow, setFollow] = useState(true)
  const [content, setContent] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [attachState, setAttachState] = useState<AttachState>('disconnected')
  const [attachInfo, setAttachInfo] = useState<AttachInfo | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef(content)

  const id = container?.id ?? ''
  const canAttach = container?.state === 'running'

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
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-0 p-0" showCloseButton={false}>
        <div className="flex items-center justify-between gap-2 p-4 pb-3">
          <DialogTitle className="truncate">
            {container ? `${container.name} — ${t('containers.logs')}` : ''}
          </DialogTitle>
          <DialogClose className="shrink-0 cursor-pointer rounded-sm text-gray-500 outline-none hover:text-gray-700 focus-visible:ring-3 focus-visible:ring-ring/50 dark:hover:text-gray-300">
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
          {canAttach && (
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
            {attachInfo.stdin ? t('logs.attach.stdin') : t('logs.attach.readOnly')}
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
                    {line}
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
