import { useEffect, useRef } from 'react'
import { ImageOff } from 'lucide-react'
import type { ImageNavItem } from '../api/types.ts'
import { cx } from '../lib/cx.ts'

interface ThumbnailRailProps {
  items: ImageNavItem[]
  currentId: number
  onGo: (imageId: number) => void
}

export function ThumbnailRail({ items, currentId, onGo }: ThumbnailRailProps) {
  const activeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [currentId])

  const currentIndex = items.findIndex((item) => item.id === currentId)

  return (
    <aside className="hidden w-[176px] shrink-0 flex-col border-r border-border bg-panel/50 md:flex">
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <span className="text-[11px] font-medium text-muted">图片列表</span>
        <span className="font-mono text-[10px] text-faint">
          {currentIndex >= 0 ? currentIndex + 1 : '-'} / {items.length}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <div className="flex flex-col gap-1.5">
          {items.map((item) => {
            const active = item.id === currentId
            return (
              <button
                key={item.id}
                ref={active ? activeRef : undefined}
                type="button"
                onClick={() => onGo(item.id)}
                className={cx(
                  'group relative overflow-hidden rounded-lg border text-left transition-colors',
                  active
                    ? 'border-accent/70 ring-1 ring-accent/30'
                    : 'border-border hover:border-border-strong',
                )}
              >
                <div className="checkerboard relative aspect-[4/3]">
                  {item.missing ? (
                    <div className="flex h-full items-center justify-center text-faint">
                      <ImageOff size={16} />
                    </div>
                  ) : (
                    <img
                      src={`/api/images/${item.id}/thumbnail?v=${item.sha256.slice(0, 12)}`}
                      alt={item.file_name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  )}
                  <span
                    className={cx(
                      'absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full ring-1 ring-black/40',
                      item.status === 'confirmed' && 'bg-success',
                      item.status === 'labeled' && 'bg-warn',
                      item.status === 'unlabeled' && 'bg-faint',
                    )}
                  />
                </div>
                <div className="truncate px-1.5 py-1 text-[10px] text-muted">{item.file_name}</div>
              </button>
            )
          })}
        </div>
      </div>
    </aside>
  )
}
