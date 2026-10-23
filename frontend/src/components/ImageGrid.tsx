import { ArrowUpRight, Check, ImageOff } from 'lucide-react'
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
    <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {items.map((item) => {
        const isSelected = selected.has(item.id)
        return (
          <div
            key={item.id}
            className={cx(
              'group relative overflow-hidden rounded-[14px] border bg-panel shadow-card transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5',
              isSelected
                ? 'border-accent/50 ring-1 ring-accent/20'
                : 'border-border hover:border-border-strong',
            )}
          >
            <button
              type="button"
              onClick={() => onOpen(item.id)}
              className="block w-full text-left"
              aria-label={`打开图片 ${item.file_name}`}
            >
              <div className="relative overflow-hidden bg-panel-2">
                <div className="aspect-[4/3]">
                  {item.missing ? (
                    <div className="flex h-full flex-col items-center justify-center gap-1.5 bg-panel-2 text-faint">
                      <ImageOff size={22} />
                      <span className="text-[10px]">文件缺失</span>
                    </div>
                  ) : (
                    <img
                      src={`${item.thumbnail_url}?v=${item.sha256.slice(0, 12)}`}
                      alt={item.file_name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  )}
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
                <div className="absolute bottom-2 left-2">
                  <StatusBadge status={item.status} missing={item.missing} />
                </div>
                <div className="absolute bottom-2 right-2 translate-y-1 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
                  <span className="flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[9px] text-white backdrop-blur-sm">
                    开始标注
                    <ArrowUpRight size={10} />
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 px-2.5 py-2.5">
                <span className="min-w-0 flex-1 truncate text-[11px] text-ink/80">
                  {item.file_name}
                </span>
                <span className="shrink-0 font-mono text-[9px] text-faint">
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
                'absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-md border transition-all',
                isSelected
                  ? 'border-accent bg-accent text-white shadow-[0_2px_8px_rgba(193,79,46,0.35)]'
                  : 'border-white/50 bg-black/25 text-transparent opacity-0 backdrop-blur-sm group-hover:opacity-100 hover:border-white hover:bg-black/40',
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
