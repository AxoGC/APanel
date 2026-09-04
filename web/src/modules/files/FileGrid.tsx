import { Download, File, Folder, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { useState, type ComponentType } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { formatBytes } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { useLayout } from '@/lib/layout'
import { cn } from '@/lib/utils'
import { downloadUrl, type FileEntry } from './api'

interface RowAction {
  key: string
  icon: ComponentType<{ className?: string }>
  label: string
  destructive?: boolean
  href?: string
  download?: string
  onSelect?: () => void
}

function formatModTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function FileRow({
  entry,
  selected,
  onToggleSelect,
  onOpen,
  onRename,
  onDeleteOne,
}: {
  entry: FileEntry
  selected: boolean
  onToggleSelect: (path: string) => void
  onOpen: (entry: FileEntry) => void
  onRename: (entry: FileEntry) => void
  onDeleteOne: (path: string) => void
}) {
  const { t } = useI18n()
  const { shell } = useLayout()
  const [actionsOpen, setActionsOpen] = useState(false)
  const Icon = entry.isDir ? Folder : File

  const actions: RowAction[] = [
    { key: 'rename', icon: Pencil, label: t('files.rename'), onSelect: () => onRename(entry) },
    ...(!entry.isDir
      ? [{ key: 'download', icon: Download, label: t('files.download'), href: downloadUrl(entry.path), download: entry.name }]
      : []),
    { key: 'delete', icon: Trash2, label: t('files.delete'), destructive: true, onSelect: () => onDeleteOne(entry.path) },
  ]

  return (
    <div className="flex items-center gap-3 border-b border-gray-100 px-2 py-2 last:border-b-0 hover:bg-gray-100 dark:border-gray-900 dark:hover:bg-gray-800">
      <Checkbox checked={selected} onCheckedChange={() => onToggleSelect(entry.path)} aria-label={entry.name} />
      <Icon className={entry.isDir ? 'size-4 shrink-0 text-theme-500' : 'size-4 shrink-0 text-gray-400'} />
      <button
        type="button"
        onClick={() => onOpen(entry)}
        className="min-w-0 flex-1 cursor-pointer truncate text-left text-sm text-gray-900 hover:underline dark:text-gray-100"
      >
        {entry.name}
      </button>
      <span className="hidden w-20 shrink-0 text-right text-xs text-gray-500 sm:block">
        {entry.isDir ? '' : formatBytes(entry.size)}
      </span>
      <span className="hidden w-36 shrink-0 text-right text-xs text-gray-500 md:block">
        {formatModTime(entry.modTime)}
      </span>
      {shell === 'mobile' ? (
        <>
          <Button variant="ghost" size="icon-sm" aria-label={t('files.actions')} onClick={() => setActionsOpen(true)}>
            <MoreVertical />
          </Button>
          <Sheet open={actionsOpen} onOpenChange={setActionsOpen}>
            <SheetContent className="gap-0.5 p-2">
              <SheetTitle className="sr-only">{t('files.actions')}</SheetTitle>
              {actions.map(({ key, icon: ActionIcon, label, destructive, href, download, onSelect }) =>
                href ? (
                  <a
                    key={key}
                    href={href}
                    download={download}
                    onClick={() => setActionsOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-gray-900 active:bg-gray-100 dark:text-gray-100 dark:active:bg-gray-800"
                  >
                    <ActionIcon className="size-4 shrink-0 text-gray-400" />
                    {label}
                  </a>
                ) : (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setActionsOpen(false)
                      onSelect?.()
                    }}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm',
                      destructive
                        ? 'text-destructive active:bg-destructive/10'
                        : 'text-gray-900 active:bg-gray-100 dark:text-gray-100 dark:active:bg-gray-800',
                    )}
                  >
                    <ActionIcon className={cn('size-4 shrink-0', destructive ? 'text-destructive' : 'text-gray-400')} />
                    {label}
                  </button>
                ),
              )}
            </SheetContent>
          </Sheet>
        </>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t('files.actions')}>
              <MoreVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {actions.map(({ key, icon: ActionIcon, label, destructive, href, download, onSelect }) =>
              href ? (
                <DropdownMenuItem key={key} asChild>
                  <a href={href} download={download}>
                    <ActionIcon />
                    {label}
                  </a>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem key={key} variant={destructive ? 'destructive' : 'default'} onSelect={onSelect}>
                  <ActionIcon />
                  {label}
                </DropdownMenuItem>
              ),
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

export function FileGrid({
  entries,
  selected,
  onToggleSelect,
  onToggleSelectAll,
  onOpen,
  onRename,
  onDeleteOne,
  hideHeader = false,
}: {
  entries: FileEntry[]
  selected: ReadonlySet<string>
  onToggleSelect: (path: string) => void
  onToggleSelectAll: () => void
  onOpen: (entry: FileEntry) => void
  onRename: (entry: FileEntry) => void
  onDeleteOne: (path: string) => void
  hideHeader?: boolean
}) {
  return (
    <div className="flex flex-col">
      {!hideHeader && <FileGridHeader entries={entries} selected={selected} onToggleSelectAll={onToggleSelectAll} />}
      {entries.map((entry) => (
        <FileRow
          key={entry.path}
          entry={entry}
          selected={selected.has(entry.path)}
          onToggleSelect={onToggleSelect}
          onOpen={onOpen}
          onRename={onRename}
          onDeleteOne={onDeleteOne}
        />
      ))}
    </div>
  )
}

export function FileGridHeader({
  entries,
  selected,
  onToggleSelectAll,
}: {
  entries: FileEntry[]
  selected: ReadonlySet<string>
  onToggleSelectAll: () => void
}) {
  const { t } = useI18n()
  const allSelected = entries.length > 0 && entries.every((entry) => selected.has(entry.path))

  return (
    <div className="flex items-center gap-3 border-b border-gray-200 pb-2 text-xs text-gray-500 dark:border-gray-800">
      <Checkbox checked={allSelected} onCheckedChange={onToggleSelectAll} aria-label={t('files.selectAll')} />
      <span className="flex-1">{t('files.name')}</span>
      <span className="hidden w-20 shrink-0 text-right sm:block">{t('files.size')}</span>
      <span className="hidden w-36 shrink-0 text-right md:block">{t('files.modified')}</span>
      <span className="w-7 shrink-0" />
    </div>
  )
}
