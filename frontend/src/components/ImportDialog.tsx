import { useState } from 'react'
import {
  CheckCircle2,
  ChevronUp,
  Folder,
  FolderOpen,
  HardDrive,
  Images,
} from 'lucide-react'
import { useFsListing } from '../api/fs.ts'
import { useImportImages, useImportPreview } from '../api/images.ts'
import type { ImportPreview } from '../api/types.ts'
import { useToast } from '../stores/toast.ts'
import {
  Button,
  Dialog,
  Field,
  Input,
  Spinner,
  Switch,
} from './ui.tsx'
import { formatBytes } from '../lib/format.ts'
import { cx } from '../lib/cx.ts'

interface ImportDialogProps {
  open: boolean
  projectId: number
  onClose: () => void
  onImported: () => void
}

export function ImportDialog({ open, projectId, onClose, onImported }: ImportDialogProps) {
  const previewMutation = useImportPreview(projectId)
  const importMutation = useImportImages(projectId)
  const toast = useToast()

  const [folderPath, setFolderPath] = useState('')
  const [mode, setMode] = useState<'copy' | 'reference'>('copy')
  const [recursive, setRecursive] = useState(true)
  const [browserOpen, setBrowserOpen] = useState(false)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [result, setResult] = useState<{ imported: number; skipped: number; failed: number } | null>(
    null,
  )

  const reset = () => {
    setFolderPath('')
    setMode('copy')
    setRecursive(true)
    setPreview(null)
    setResult(null)
    setBrowserOpen(false)
  }

  const close = () => {
    reset()
    onClose()
  }

  const changeFolder = (path: string) => {
    setFolderPath(path)
    setPreview(null)
    setResult(null)
  }

  const runPreview = () => {
    if (!folderPath.trim()) {
      toast('请先选择图片文件夹', 'error')
      return
    }
    previewMutation.mutate(
      { folder_path: folderPath.trim(), mode, recursive },
      {
        onSuccess: (data) => {
          setPreview(data)
          if (data.limit_exceeded) {
            toast('图片数量超过 5000 张，请分批导入', 'error')
          }
        },
        onError: (error) => toast(error.message, 'error'),
      },
    )
  }

  const startImport = () => {
    if (!folderPath.trim()) {
      toast('请先选择图片文件夹', 'error')
      return
    }
    importMutation.mutate(
      { folder_path: folderPath.trim(), mode, recursive },
      {
        onSuccess: (data) => {
          setResult({
            imported: data.imported,
            skipped: data.skipped_duplicates,
            failed: data.failed,
          })
          toast(`导入完成：新增 ${data.imported} 张图片`, 'success')
          onImported()
        },
        onError: (error) => toast(error.message, 'error'),
      },
    )
  }

  return (
    <>
      <Dialog
        open={open}
        title="导入图片"
        description="选择一个包含图片的文件夹。支持 jpg、jpeg、png、bmp、webp，单次最多 5000 张。"
        width="max-w-xl"
        onClose={close}
        footer={
          result ? (
            <Button variant="primary" onClick={close}>
              完成
            </Button>
          ) : (
            <>
              <Button onClick={close}>取消</Button>
              <Button
                loading={previewMutation.isPending}
                disabled={!folderPath}
                onClick={runPreview}
              >
                预览
              </Button>
              <Button
                variant="primary"
                loading={importMutation.isPending}
                disabled={!folderPath || preview?.limit_exceeded === true}
                onClick={startImport}
              >
                开始导入
              </Button>
            </>
          )
        }
      >
        {result ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 size={36} className="text-success" />
            <div className="text-sm font-medium text-ink">导入完成</div>
            <div className="text-xs text-muted">
              新增 {result.imported} 张，跳过重复 {result.skipped} 张，失败 {result.failed} 张。
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Field label="图片文件夹">
              <div className="flex gap-2">
                <Input
                  value={folderPath}
                  placeholder="例如：D:\\datasets\\armor\\images"
                  onChange={(event) => changeFolder(event.target.value)}
                />
                <Button className="shrink-0" onClick={() => setBrowserOpen(true)}>
                  <FolderOpen size={15} />
                  浏览
                </Button>
              </div>
            </Field>

            <div>
              <div className="mb-2 text-xs font-medium text-muted">文件处理方式</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('copy')
                    setPreview(null)
                  }}
                  className={cx(
                    'rounded-xl border p-3 text-left transition-colors',
                    mode === 'copy'
                      ? 'border-accent/50 bg-accent-soft/40'
                      : 'border-border bg-panel hover:bg-panel-2',
                  )}
                >
                  <div className="text-xs font-medium text-ink">复制到项目目录</div>
                  <div className="mt-1 text-[11px] leading-relaxed text-muted">
                    数据自包含，便于备份迁移；会额外占用一份磁盘空间。
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('reference')
                    setPreview(null)
                  }}
                  className={cx(
                    'rounded-xl border p-3 text-left transition-colors',
                    mode === 'reference'
                      ? 'border-accent/50 bg-accent-soft/40'
                      : 'border-border bg-panel hover:bg-panel-2',
                  )}
                >
                  <div className="text-xs font-medium text-ink">引用原路径</div>
                  <div className="mt-1 text-[11px] leading-relaxed text-muted">
                    不复制文件、节省空间；原文件夹移动或删除后图片会断链。
                  </div>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border bg-panel px-3.5 py-3">
              <div>
                <div className="text-xs font-medium text-ink">包含子文件夹</div>
                <div className="mt-0.5 text-[11px] text-muted">
                  递归扫描所有子目录中的图片。
                </div>
              </div>
              <Switch
                checked={recursive}
                label="包含子文件夹"
                onChange={(checked) => {
                  setRecursive(checked)
                  setPreview(null)
                }}
              />
            </div>

            {preview ? (
              <div
                className={cx(
                  'rounded-xl border px-4 py-3 text-xs',
                  preview.limit_exceeded
                    ? 'border-danger/30 bg-danger/5 text-danger'
                    : 'border-border bg-panel-2/60 text-muted',
                )}
              >
                {preview.limit_exceeded ? (
                  <>发现超过 5000 张图片，请分批导入。</>
                ) : (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span>
                      发现 <span className="font-medium text-ink">{preview.found}</span> 张图片
                    </span>
                    <span>
                      重复 <span className="text-warn">{preview.duplicates}</span> 张（将跳过）
                    </span>
                    <span>共 {formatBytes(preview.total_bytes)}</span>
                    {preview.unreadable > 0 ? (
                      <span className="text-danger">无法读取 {preview.unreadable} 张</span>
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </Dialog>

      {browserOpen ? (
        <FolderBrowser
          open={browserOpen}
          onClose={() => setBrowserOpen(false)}
          onSelect={(path) => {
            changeFolder(path)
            setBrowserOpen(false)
          }}
        />
      ) : null}
    </>
  )
}

function FolderBrowser({
  open,
  onClose,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  onSelect: (path: string) => void
}) {
  const [currentPath, setCurrentPath] = useState<string | null>(null)
  const listing = useFsListing(currentPath)

  return (
    <Dialog
      open={open}
      title="选择图片文件夹"
      description="选择一个包含图片的目录，然后点击「选择此文件夹」。"
      width="max-w-xl"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button
            variant="primary"
            disabled={!listing.data}
            onClick={() => {
              if (listing.data) onSelect(listing.data.path)
            }}
          >
            选择此文件夹
          </Button>
        </>
      }
    >
      {listing.isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Spinner />
        </div>
      ) : listing.isError ? (
        <div className="py-6 text-center text-xs text-danger">
          无法读取目录：{listing.error.message}
        </div>
      ) : listing.data ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-panel px-3 py-2">
            <HardDrive size={14} className="shrink-0 text-faint" />
            <div className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink">
              {listing.data.path}
            </div>
            <span className="shrink-0 text-[11px] text-faint">
              {listing.data.image_count} 张图片
            </span>
          </div>

          <div className="max-h-[46vh] overflow-y-auto rounded-xl border border-border">
            {listing.data.parent ? (
              <button
                type="button"
                onClick={() => setCurrentPath(listing.data!.parent)}
                className="flex w-full items-center gap-2 border-b border-border px-3 py-2.5 text-left text-xs text-muted transition-colors hover:bg-panel-2 hover:text-ink"
              >
                <ChevronUp size={15} />
                返回上一级
              </button>
            ) : null}

            {listing.data.dirs.length === 0 ? (
              <div className="px-3 py-5 text-center text-xs text-faint">
                当前目录下没有子文件夹
              </div>
            ) : (
              listing.data.dirs.map((dir) => (
                <button
                  key={dir.path}
                  type="button"
                  onClick={() => setCurrentPath(dir.path)}
                  className="flex w-full items-center gap-2 border-b border-border/60 px-3 py-2.5 text-left text-xs text-muted transition-colors last:border-b-0 hover:bg-panel-2 hover:text-ink"
                >
                  <Folder size={15} className="shrink-0 text-accent/80" />
                  <span className="truncate">{dir.name}</span>
                </button>
              ))
            )}
          </div>

          {listing.data.images.length > 0 ? (
            <div className="flex items-center gap-2 text-[11px] text-faint">
              <Images size={13} />
              当前目录包含 {listing.data.images.length} 个图片文件，点「选择此文件夹」导入
              {listing.data.truncated ? '（目录内容较多，仅显示部分）' : ''}
            </div>
          ) : null}
        </div>
      ) : null}
    </Dialog>
  )
}
