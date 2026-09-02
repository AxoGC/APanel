import { Download, File, Folder, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatBytes } from '@/lib/format'
import { useI18n } from '@/lib/i18n'
import { downloadUrl, type FileEntry } from './api'

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
  const Icon = entry.isDir ? Folder : File

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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={t('files.actions')}>
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onRename(entry)}>
            <Pencil />
            {t('files.rename')}
          </DropdownMenuItem>
          {!entry.isDir && (
            <DropdownMenuItem asChild>
              <a href={downloadUrl(entry.path)} download={entry.name}>
                <Download />
                {t('files.download')}
              </a>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem variant="destructive" onSelect={() => onDeleteOne(entry.path)}>
            <Trash2 />
            {t('files.delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
}: {
  entries: FileEntry[]
  selected: ReadonlySet<string>
  onToggleSelect: (path: string) => void
  onToggleSelectAll: () => void
  onOpen: (entry: FileEntry) => void
  onRename: (entry: FileEntry) => void
  onDeleteOne: (path: string) => void
}) {
  const { t } = useI18n()
  const allSelected = entries.length > 0 && entries.every((e) => selected.has(e.path))

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 border-b border-gray-200 pb-2 text-xs text-gray-500 dark:border-gray-800">
        <Checkbox checked={allSelected} onCheckedChange={onToggleSelectAll} aria-label={t('files.selectAll')} />
        <span className="flex-1">{t('files.name')}</span>
        <span className="hidden w-20 shrink-0 text-right sm:block">{t('files.size')}</span>
        <span className="hidden w-36 shrink-0 text-right md:block">{t('files.modified')}</span>
        <span className="w-7 shrink-0" />
      </div>
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
