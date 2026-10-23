import type { ImageStatus } from '../api/types.ts'
import { STATUS_LABELS } from '../lib/status.ts'
import { cx } from '../lib/cx.ts'

const TONE: Record<ImageStatus, string> = {
  unlabeled: 'border-border-strong/55 bg-panel/85 text-muted',
  labeled: 'border-warn/25 bg-[#fff7e6]/90 text-warn',
  confirmed: 'border-success/25 bg-[#eef7f0]/90 text-success',
}

const DOT: Record<ImageStatus, string> = {
  unlabeled: 'bg-faint',
  labeled: 'bg-warn',
  confirmed: 'bg-success',
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
          'inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-danger/25 bg-[#fdf0ed]/90 px-2 py-0.5 text-[10px] font-medium text-danger backdrop-blur-sm',
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
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm',
        TONE[status],
        className,
      )}
    >
      <span className={cx('h-1 w-1 rounded-full', DOT[status])} />
      {STATUS_LABELS[status]}
    </span>
  )
}
