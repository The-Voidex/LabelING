import { Check, ImageOff } from 'lucide-react'
import type { ImageAsset } from '../api/types.ts'
import { StatusBadge } from './StatusBadge.tsx'
import { cx } from '../lib/cx.ts'

interface ImageGridProps {
  items: ImageAsset[]
  selected: Set<number>
  onToggle: (imageId: number) => void
  onOpen: (imageId: number) => void
}

export function ImageGrid({ items, selected, onToggle, onOpen }: ImageGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {items.map((item) => {
        const isSelected = selected.has(item.id)
        return (
          <div
            key={item.id}
            className={cx(
              'group relative overflow-hidden rounded-xl border bg-panel transition-colors',
              isSelected
                ? 'border-accent/60 ring-1 ring-accent/25'
                : 'border-border hover:border-border-strong',
            )}
          >
            <button
              type="button"
              onClick={() => onOpen(item.id)}
              className="block w-full text-left"
              aria-label={`打开图片 ${item.file_name}`}
            >
              <div className="checkerboard relative aspect-[4/3] overflow-hidden">
                {item.missing ? (
                  <div className="flex h-full flex-col items-center justify-center gap-1.5 text-faint">
                    <ImageOff size={22} />
                    <span className="text-[11px]">文件缺失</span>
                  </div>
                ) : (
                  <img
                    src={`${item.thumbnail_url}?v=${item.sha256.slice(0, 12)}`}
                    alt={item.file_name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/55 to-transparent" />
                <div className="absolute bottom-1.5 left-2">
                  <StatusBadge status={item.status} missing={item.missing} />
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-2">
                <span className="min-w-0 flex-1 truncate text-[11px] text-muted">
                  {item.file_name}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-faint">
                  {item.width}×{item.height}
                </span>
              </div>
            </button>

            <button
              type="button"
              aria-label={isSelected ? '取消选择' : '选择图片'}
              onClick={(event) => {
                event.stopPropagation()
                onToggle(item.id)
              }}
              className={cx(
                'absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-md border transition-colors',
                isSelected
                  ? 'border-accent bg-accent text-white'
                  : 'border-white/30 bg-black/35 text-transparent opacity-0 backdrop-blur-sm group-hover:opacity-100 hover:border-white/60',
              )}
            >
              <Check size={12} strokeWidth={3} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
