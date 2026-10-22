import type { ImageStatus } from '../api/types.ts'
import { STATUS_LABELS } from '../lib/status.ts'
import { cx } from '../lib/cx.ts'

const TONE: Record<ImageStatus, string> = {
  unlabeled: 'border-border-strong bg-panel-3 text-muted',
  labeled: 'border-warn/30 bg-warn/10 text-warn',
  confirmed: 'border-success/30 bg-success/10 text-success',
}

export function StatusBadge({
  status,
  missing = false,
  className,
}: {
  status: ImageStatus
  missing?: boolean
  className?: string
}) {
  if (missing) {
    return (
      <span
        className={cx(
          'inline-flex items-center gap-1 rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-[11px] font-medium text-danger',
          className,
        )}
      >
        <span className="h-1 w-1 rounded-full bg-danger" />
        文件缺失
      </span>
    )
  }
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        TONE[status],
        className,
      )}
    >
      <span
        className={cx(
          'h-1 w-1 rounded-full',
          status === 'unlabeled' && 'bg-faint',
          status === 'labeled' && 'bg-warn',
          status === 'confirmed' && 'bg-success',
        )}
      />
      {STATUS_LABELS[status]}
    </span>
  )
}
