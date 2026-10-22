import { useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useCreateJob, useCancelJob, useJob } from '../api/jobs.ts'
import type { LabelClass, PrelabelJob } from '../api/types.ts'
import { useToast } from '../stores/toast.ts'
import { JobProgress } from './JobProgress.tsx'
import { Button, Dialog } from './ui.tsx'
import { cx } from '../lib/cx.ts'

interface PrelabelDialogProps {
  open: boolean
  projectId: number
  imageIds: number[]
  classes: LabelClass[]
  modelName: string | null
  onClose: () => void
  onComplete: (job: PrelabelJob) => void
}

export function PrelabelDialog({
  open,
  projectId,
  imageIds,
  classes,
  modelName,
  onClose,
  onComplete,
}: PrelabelDialogProps) {
  const createJob = useCreateJob(projectId)
  const [jobId, setJobId] = useState<number | null>(null)
  const jobQuery = useJob(jobId)
  const cancelJob = useCancelJob(jobId)
  const toast = useToast()
  const [selectedClasses, setSelectedClasses] = useState<Set<number>>(new Set())
  const completedRef = useRef(false)
  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setJobId(null)
      setSelectedClasses(new Set(classes.map((item) => item.id)))
      completedRef.current = false
    }
    wasOpenRef.current = open
  }, [open, classes])

  const job = jobQuery.data

  useEffect(() => {
    if (!job || completedRef.current) return
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      completedRef.current = true
      onComplete(job)
      if (job.status === 'completed') {
        toast(
          `预标注完成：成功 ${job.succeeded} 张${job.failed ? `，失败 ${job.failed} 张` : ''}`,
          job.failed ? 'info' : 'success',
        )
      } else if (job.status === 'cancelled') {
        toast('预标注任务已取消', 'info')
      } else {
        toast(`预标注失败：${job.error_summary || '全部图片处理失败'}`, 'error')
      }
    }
  }, [job, onComplete, toast])

  const running = job?.status === 'queued' || job?.status === 'running'
  const finished = job
    ? job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled'
    : false

  const close = () => {
    if (running) return
    onClose()
  }

  const toggleClass = (classId: number) => {
    setSelectedClasses((previous) => {
      const next = new Set(previous)
      if (next.has(classId)) next.delete(classId)
      else next.add(classId)
      return next
    })
  }

  const start = () => {
    if (selectedClasses.size === 0) {
      toast('请至少选择一个类别', 'error')
      return
    }
    const allSelected = selectedClasses.size === classes.length
    createJob.mutate(
      {
        image_ids: imageIds,
        class_ids: allSelected ? null : Array.from(selectedClasses),
      },
      {
        onSuccess: (created) => setJobId(created.id),
        onError: (error) => toast(error.message, 'error'),
      },
    )
  }

  return (
    <Dialog
      open={open}
      title="模型预标注"
      description={`使用模型「${modelName ?? '未选择'}」为选中的图片生成初始标注框，随后可以人工审核修正。`}
      width="max-w-xl"
      onClose={close}
      footer={
        finished ? (
          <Button variant="primary" onClick={onClose}>
            完成
          </Button>
        ) : running ? (
          <Button
            variant="danger"
            loading={cancelJob.isPending}
            onClick={() => {
              if (jobId) cancelJob.mutate()
            }}
          >
            取消任务
          </Button>
        ) : (
          <>
            <Button onClick={onClose}>取消</Button>
            <Button
              variant="primary"
              loading={createJob.isPending}
              onClick={start}
            >
              <Sparkles size={15} />
              开始预标注
            </Button>
          </>
        )
      }
    >
      {job ? (
        <JobProgress
          job={job}
          cancelling={cancelJob.isPending}
          onCancel={() => {
            if (jobId) cancelJob.mutate()
          }}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 text-xs leading-relaxed text-muted">
            本次将为 <span className="font-medium text-ink">{imageIds.length}</span> 张图片各发送
            1 次模型请求，按类别筛选后会更省调用次数。已有 AI 预标框会被本次结果替换，人工标注框会保留。
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-muted">参与预标注的类别</span>
              <button
                type="button"
                className="text-[11px] text-accent hover:text-[#7ea6ff]"
                onClick={() =>
                  setSelectedClasses(
                    selectedClasses.size === classes.length
                      ? new Set()
                      : new Set(classes.map((item) => item.id)),
                  )
                }
              >
                {selectedClasses.size === classes.length ? '取消全选' : '全选'}
              </button>
            </div>
            <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto pr-1">
              {classes.map((item) => {
                const checked = selectedClasses.has(item.id)
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleClass(item.id)}
                    className={cx(
                      'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors',
                      checked
                        ? 'border-accent/50 bg-accent-soft/50 text-ink'
                        : 'border-border bg-panel text-muted hover:bg-panel-2',
                    )}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="truncate">{item.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {classes.length === 0 ? (
            <div className="rounded-lg border border-warn/25 bg-warn/5 px-3 py-2 text-xs text-warn">
              项目还没有类别。请先到「类别与提示词」页添加类别，再运行预标注。
            </div>
          ) : null}
        </div>
      )}
    </Dialog>
  )
}
