import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { useToastStore } from '../stores/toast.ts'
import type { ToastKind } from '../stores/toast.ts'
import { cx } from '../lib/cx.ts'

const TONE: Record<ToastKind, string> = {
  success: 'border-success/35 bg-success/10 text-success',
  error: 'border-danger/35 bg-danger/10 text-danger',
  info: 'border-accent/35 bg-accent/10 text-accent',
}

const ICON = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
}

export function ToastHost() {
  const items = useToastStore((state) => state.items)
  const remove = useToastStore((state) => state.remove)

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(360px,calc(100vw-32px))] flex-col gap-2"
    >
      {items.map((item) => {
        const Icon = ICON[item.kind]
        return (
          <div
            key={item.id}
            className={cx(
              'toast-in pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-panel/95 px-3.5 py-3 shadow-panel backdrop-blur',
              TONE[item.kind],
            )}
          >
            <Icon size={17} className="mt-0.5 shrink-0" />
            <div className="flex-1 text-xs leading-relaxed text-ink">{item.message}</div>
            <button
              type="button"
              aria-label="关闭提示"
              onClick={() => remove(item.id)}
              className="rounded p-0.5 text-faint transition-colors hover:text-ink"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
