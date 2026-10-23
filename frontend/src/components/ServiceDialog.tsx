import { useState } from 'react'
import {
  Check,
  Copy,
  FolderOpen,
  Loader2,
  Power,
  Server,
  TriangleAlert,
} from 'lucide-react'
import {
  useOpenDataDir,
  useShutdownService,
  useSystemStatus,
} from '../api/system.ts'
import { useToast } from '../stores/toast.ts'
import { BrandMark } from './BrandMark.tsx'
import {
  Button,
  ConfirmDialog,
  Dialog,
} from './ui.tsx'
import { cx } from '../lib/cx.ts'

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds} 秒`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest > 0 ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`
}

export function ServiceDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const statusQuery = useSystemStatus(open)
  const shutdown = useShutdownService()
  const openDataDir = useOpenDataDir()
  const toast = useToast()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [closed, setClosed] = useState(false)

  const status = statusQuery.data

  const copyUrl = async () => {
    if (!status) return
    try {
      await navigator.clipboard.writeText(status.url)
      toast('访问地址已复制', 'success')
    } catch {
      toast('复制失败，请手动选择地址', 'error')
    }
  }

  const confirmShutdown = () => {
    shutdown.mutate(undefined, {
      onSuccess: () => {
        setConfirmOpen(false)
        setClosed(true)
      },
      onError: (error) => toast(error.message, 'error'),
    })
  }

  return (
    <>
      <Dialog
        open={open}
        title="本地服务"
        description="LabelING 只在本机运行，数据和密钥不会离开这台电脑。"
        width="max-w-xl"
        onClose={onClose}
        footer={
          closed ? (
            <Button variant="primary" onClick={onClose}>
              关闭窗口
            </Button>
          ) : (
            <>
              <Button
                variant="danger"
                className="mr-auto"
                disabled={!status}
                onClick={() => setConfirmOpen(true)}
              >
                <Power size={15} />
                关闭服务
              </Button>
              <Button onClick={onClose}>完成</Button>
            </>
          )
        }
      >
        {closed ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-panel-2/60 px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/10 text-success">
              <Check size={24} />
            </span>
            <div className="text-sm font-semibold text-ink">服务已关闭</div>
            <p className="max-w-sm text-xs leading-relaxed text-muted">
              现在可以关闭此页面。下次使用请运行项目目录下的启动脚本，托盘图标也会重新出现。
            </p>
            <code className="mt-1 rounded-lg border border-border bg-panel px-3 py-2 font-mono text-[11px] text-ink">
              powershell -ExecutionPolicy Bypass -File scripts/start.ps1
            </code>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4 rounded-2xl border border-border bg-gradient-to-br from-panel to-panel-2/70 p-4">
              <BrandMark className="h-12 w-12 drop-shadow-[0_8px_18px_rgba(39,35,29,0.18)]" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-ink">LabelING 本地服务</span>
                  {status ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-success/25 bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                      <span className="soft-pulse h-1.5 w-1.5 rounded-full bg-success" />
                      运行中
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-warn/30 bg-warn/10 px-2 py-0.5 text-[10px] font-medium text-warn">
                      <Loader2 size={10} className="animate-spin" />
                      检查中
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">
                  关闭服务会中断正在运行的预标注任务，请先确认任务已经完成。
                </p>
              </div>
            </div>

            {statusQuery.isError ? (
              <div className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/5 px-3.5 py-3 text-xs text-danger">
                <TriangleAlert size={15} className="mt-0.5 shrink-0" />
                <div className="flex-1">
                  无法获取服务状态，服务可能已经停止。
                  <button
                    type="button"
                    className="ml-2 underline underline-offset-2"
                    onClick={() => void statusQuery.refetch()}
                  >
                    重新检查
                  </button>
                </div>
              </div>
            ) : null}

            {status ? (
              <>
                <div className="overflow-hidden rounded-2xl border border-border bg-panel">
                  <div className="flex items-center gap-3 border-b border-border/80 px-4 py-3">
                    <Server size={15} className="shrink-0 text-accent" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] text-faint">访问地址</div>
                      <div className="mt-0.5 truncate font-mono text-xs text-ink">
                        {status.url}
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label="复制访问地址"
                      onClick={() => void copyUrl()}
                      className="rounded-lg p-2 text-muted transition-colors hover:bg-panel-2 hover:text-ink"
                    >
                      <Copy size={14} />
                    </button>
                  </div>

                  <div className="flex items-center gap-3 border-b border-border/80 px-4 py-3">
                    <FolderOpen size={15} className="shrink-0 text-accent" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] text-faint">数据目录</div>
                      <div className="mt-0.5 break-all font-mono text-[11px] leading-relaxed text-ink">
                        {status.data_dir}
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label="在资源管理器中打开数据目录"
                      disabled={openDataDir.isPending}
                      onClick={() =>
                        openDataDir.mutate(undefined, {
                          onSuccess: () => toast('已打开数据目录', 'success'),
                          onError: (error) => toast(error.message, 'error'),
                        })
                      }
                      className="rounded-lg p-2 text-muted transition-colors hover:bg-panel-2 hover:text-ink disabled:opacity-40"
                    >
                      {openDataDir.isPending ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <FolderOpen size={14} />
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-3 divide-x divide-border/80">
                    <div className="px-4 py-3">
                      <div className="text-[10px] text-faint">进程号</div>
                      <div className="mt-0.5 font-mono text-xs text-ink">{status.pid}</div>
                    </div>
                    <div className="px-4 py-3">
                      <div className="text-[10px] text-faint">已运行</div>
                      <div className="mt-0.5 text-xs text-ink">
                        {formatUptime(status.uptime_seconds)}
                      </div>
                    </div>
                    <div className="px-4 py-3">
                      <div className="text-[10px] text-faint">版本</div>
                      <div className="mt-0.5 font-mono text-xs text-ink">
                        {status.version}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2 rounded-xl border border-warn/25 bg-warn/5 px-3.5 py-3 text-[11px] leading-relaxed text-warn">
                  <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                  <span>
                    也可以右键点击任务栏托盘中的 LabelING 图标来打开界面、打开数据目录或关闭服务。
                  </span>
                </div>
              </>
            ) : statusQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted">
                <Loader2 size={15} className="animate-spin" />
                正在读取服务信息…
              </div>
            ) : null}

          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        title="关闭本地服务"
        message="关闭后当前页面将无法继续使用，正在运行的预标注任务会被中断。确定关闭吗？"
        confirmText="确定关闭"
        danger
        loading={shutdown.isPending}
        onConfirm={confirmShutdown}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  )
}

export function ServiceStatusButton({ compact = false }: { compact?: boolean }) {
  const statusQuery = useSystemStatus()
  const [open, setOpen] = useState(false)
  const online = statusQuery.isSuccess

  const label = statusQuery.isLoading
    ? '正在连接'
    : statusQuery.isError
      ? '服务已断开'
      : `本地服务 · ${statusQuery.data?.port ?? 8000}`

  return (
    <>
      {compact ? (
        <button
          type="button"
          aria-label="本地服务状态"
          title={label}
          onClick={() => setOpen(true)}
          className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-panel-2 hover:text-ink"
        >
          <Server size={16} />
          <span
            className={cx(
              'absolute right-1 top-1 h-1.5 w-1.5 rounded-full ring-2 ring-panel',
              online ? 'bg-success' : 'bg-danger',
            )}
          />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group flex w-full items-center gap-2.5 rounded-xl border border-border/90 bg-panel/75 px-3 py-2.5 text-left transition-colors hover:border-border-strong hover:bg-panel"
        >
          <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-panel-2 text-muted">
            <Server size={14} />
            <span
              className={cx(
                'absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ring-2 ring-panel',
                online ? 'soft-pulse bg-success' : 'bg-danger',
              )}
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-medium text-ink">本地服务</span>
            <span className="mt-0.5 block text-[10px] text-muted">
              {statusQuery.isLoading ? '正在连接…' : statusQuery.isError ? '已断开' : label}
            </span>
          </span>
          <Power size={13} className="text-faint group-hover:text-ink" />
        </button>
      )}

      {open ? <ServiceDialog open onClose={() => setOpen(false)} /> : null}
    </>
  )
}
