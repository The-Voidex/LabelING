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
  const confirmed = items.filter((item) => item.status === 'confirmed').length
  const progress = items.length > 0 ? Math.round((confirmed / items.length) * 100) : 0

  return (
    <aside className="hidden w-[188px] shrink-0 flex-col border-r border-border/80 bg-panel/55 backdrop-blur-xl md:flex">
      <div className="border-b border-border/80 px-3 pb-2.5 pt-3.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium tracking-[0.08em] text-faint">图片</span>
          <span className="font-mono text-[10px] text-faint">
            {currentIndex >= 0 ? currentIndex + 1 : '-'} / {items.length}
          </span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-panel-3">
          <div
            className="h-full rounded-full bg-success/70 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[9px] text-faint">
          <span>确认进度</span>
          <span>{progress}%</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
        <div className="flex flex-col gap-2">
          {items.map((item, index) => {
            const active = item.id === currentId
            return (
              <button
                key={item.id}
                ref={active ? activeRef : undefined}
                type="button"
                onClick={() => onGo(item.id)}
                className={cx(
                  'group relative overflow-hidden rounded-xl border text-left transition-[border-color,box-shadow,background-color]',
                  active
                    ? 'border-accent/50 bg-panel shadow-card ring-1 ring-accent/20'
                    : 'border-transparent bg-transparent hover:border-border hover:bg-panel/70',
                )}
              >
                <div className="checkerboard relative m-1 overflow-hidden rounded-lg">
                  <div className="aspect-[4/3]">
                    {item.missing ? (
                      <div className="flex h-full items-center justify-center text-faint">
                        <ImageOff size={17} />
                      </div>
                    ) : (
                      <img
                        src={`/api/images/${item.id}/thumbnail?v=${item.sha256.slice(0, 12)}`}
                        alt={item.file_name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                    )}
                  </div>
                  <span
                    className="absolute left-1 top-1 rounded bg-black/45 px-1 py-px font-mono text-[9px] text-white/75 backdrop-blur-sm"
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span
                    className={cx(
                      'absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full ring-2 ring-black/25',
                      item.status === 'confirmed' && 'bg-success',
                      item.status === 'labeled' && 'bg-[#E8A33C]',
                      item.status === 'unlabeled' && 'bg-faint',
                    )}
                  />
                  {active ? (
                    <span className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" />
                  ) : null}
                </div>
                <div
                  className={cx(
                    'truncate px-2 pb-1.5 pt-0.5 text-[10px]',
                    active ? 'text-ink' : 'text-muted',
                  )}
                >
                  {item.file_name}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="border-t border-border/80 px-3 py-2.5 text-[9px] text-faint">
        用 ← → 切换图片
      </div>
    </aside>
  )
}
