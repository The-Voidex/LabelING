import { Loader2, Square, TriangleAlert } from 'lucide-react'
import type { PrelabelJob } from '../api/types.ts'
import { JOB_STATUS_LABELS } from '../lib/status.ts'
import { Button } from './ui.tsx'
import { cx } from '../lib/cx.ts'

export function JobProgress({
  job,
  onCancel,
  cancelling = false,
}: {
  job: PrelabelJob
  onCancel?: () => void
  cancelling?: boolean
}) {
  const running = job.status === 'queued' || job.status === 'running'
  const percent = job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0

  return (
    <div className="rounded-xl border border-border bg-panel-2/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {running ? (
            <Loader2 size={15} className="animate-spin text-accent" />
          ) : (
            <span
              className={cx(
                'h-2 w-2 rounded-full',
                job.status === 'completed' && 'bg-success',
                job.status === 'failed' && 'bg-danger',
                job.status === 'cancelled' && 'bg-warn',
              )}
            />
          )}
          <span className="text-xs font-medium text-ink">
            预标注任务 #{job.id} · {JOB_STATUS_LABELS[job.status] ?? job.status}
          </span>
        </div>
        {running && onCancel ? (
          <Button size="sm" variant="danger" loading={cancelling} onClick={onCancel}>
            <Square size={12} />
            取消任务
          </Button>
        ) : null}
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-panel-3">
        <div
          className={cx(
            'h-full rounded-full transition-all duration-500',
            job.status === 'failed' ? 'bg-danger' : 'bg-accent',
          )}
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
        <span>
          已处理 {job.processed} / {job.total}
        </span>
        <span className="text-success">成功 {job.succeeded}</span>
        <span className={job.failed > 0 ? 'text-danger' : ''}>失败 {job.failed}</span>
        {job.prompt_tokens + job.completion_tokens > 0 ? (
          <span className="ml-auto font-mono text-faint">
            tokens：输入 {job.prompt_tokens} · 输出 {job.completion_tokens}
          </span>
        ) : null}
      </div>

      {job.error_summary ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-warn/25 bg-warn/5 px-3 py-2 text-[11px] leading-relaxed text-warn">
          <TriangleAlert size={13} className="mt-0.5 shrink-0" />
          {job.error_summary}
        </div>
      ) : null}

      {job.errors.length > 0 ? (
        <details className="mt-2 text-[11px] text-muted">
          <summary className="cursor-pointer select-none text-faint hover:text-muted">
            查看失败详情（{job.errors.length}）
          </summary>
          <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto pr-1">
            {job.errors.map((error, index) => (
              <li
                key={`${error.image_id}-${index}`}
                className="rounded-lg border border-border bg-panel px-2.5 py-2"
              >
                <div className="text-ink">图片 ID {error.image_id}</div>
                <div className="mt-0.5 text-danger">{error.error_message}</div>
                {error.raw_excerpt ? (
                  <pre className="mt-1 max-h-16 overflow-hidden whitespace-pre-wrap break-all text-[10px] text-faint">
                    {error.raw_excerpt}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}
