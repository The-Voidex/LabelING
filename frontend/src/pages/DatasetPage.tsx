import { useMemo, useState } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  CheckCheck,
  Image as ImageIcon,
  Search,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react'
import { useBatchConfirm, useBatchUnconfirm } from '../api/annotations.ts'
import { useClasses } from '../api/classes.ts'
import { useBatchDeleteImages, useImages } from '../api/images.ts'
import { useProjectStats } from '../api/projects.ts'
import type { ImageStatus, PrelabelJob, Project } from '../api/types.ts'
import { useToast } from '../stores/toast.ts'
import { ImageGrid } from '../components/ImageGrid.tsx'
import { ImportDialog } from '../components/ImportDialog.tsx'
import { PrelabelDialog } from '../components/PrelabelDialog.tsx'
import { StatusBadge } from '../components/StatusBadge.tsx'
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  Select,
  Spinner,
} from '../components/ui.tsx'
import { cx } from '../lib/cx.ts'
import { formatNumber } from '../lib/format.ts'

const PAGE_SIZE = 60

const STAT_CARDS: Array<{
  key: string
  label: string
  tone: string
}> = [
  { key: '', label: '全部图片', tone: 'text-ink' },
  { key: 'unlabeled', label: '未标注', tone: 'text-muted' },
  { key: 'labeled', label: '待审核', tone: 'text-warn' },
  { key: 'confirmed', label: '已确认', tone: 'text-success' },
  { key: 'missing', label: '文件缺失', tone: 'text-danger' },
]

export function DatasetPage() {
  const project = useOutletContext<Project>()
  const params = useParams()
  const projectId = Number(params.projectId)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()

  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [importOpen, setImportOpen] = useState(false)
  const [prelabelOpen, setPrelabelOpen] = useState(false)
  const [prelabelIds, setPrelabelIds] = useState<number[]>([])
  const [deleteOpen, setDeleteOpen] = useState(false)

  const images = useImages(projectId, {
    page,
    pageSize: PAGE_SIZE,
    status: statusFilter || undefined,
    q: search || undefined,
  })
  const stats = useProjectStats(projectId)
  const classes = useClasses(projectId)
  const batchConfirm = useBatchConfirm(projectId)
  const batchUnconfirm = useBatchUnconfirm(projectId)
  const batchDelete = useBatchDeleteImages(projectId)

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((images.data?.total ?? 0) / PAGE_SIZE)),
    [images.data?.total],
  )
  const items = images.data?.items ?? []
  const allSelected = items.length > 0 && items.every((item) => selected.has(item.id))
  const selectedIds = Array.from(selected)

  const clearSelection = () => setSelected(new Set())

  const toggleSelect = (imageId: number) => {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(imageId)) next.delete(imageId)
      else next.add(imageId)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelected((previous) => {
      if (allSelected) {
        const next = new Set(previous)
        items.forEach((item) => next.delete(item.id))
        return next
      }
      return new Set([...previous, ...items.map((item) => item.id)])
    })
  }

  const changeFilter = (value: string) => {
    setStatusFilter(value)
    setPage(1)
    clearSelection()
  }

  const submitSearch = () => {
    setSearch(searchInput.trim())
    setPage(1)
    clearSelection()
  }

  const openPrelabel = () => {
    if (!project.model_config_id) {
      toast('请先在项目设置中选择模型', 'error')
      return
    }
    if (!classes.data || classes.data.length === 0) {
      toast('请先添加类别与提示词', 'error')
      return
    }
    setPrelabelIds(selectedIds.length > 0 ? selectedIds : items.map((item) => item.id))
    setPrelabelOpen(true)
  }

  const handleJobComplete = (_job: PrelabelJob) => {
    void queryClient.invalidateQueries({ queryKey: ['images', projectId] })
    void queryClient.invalidateQueries({ queryKey: ['image-nav', projectId] })
    void queryClient.invalidateQueries({ queryKey: ['project-stats', projectId] })
    clearSelection()
  }

  const confirmBatch = () => {
    batchConfirm.mutate(selectedIds, {
      onSuccess: (result) => {
        toast(
          `已确认 ${result.confirmed} 张${result.skipped ? `，跳过 ${result.skipped} 张` : ''}`,
          'success',
        )
        clearSelection()
      },
      onError: (error) => toast(error.message, 'error'),
    })
  }

  const unconfirmBatch = () => {
    batchUnconfirm.mutate(selectedIds, {
      onSuccess: (result) => {
        toast(
          `已撤销确认 ${result.unconfirmed} 张${result.skipped ? `，跳过 ${result.skipped} 张` : ''}`,
          'success',
        )
        clearSelection()
      },
      onError: (error) => toast(error.message, 'error'),
    })
  }

  const confirmDelete = () => {
    batchDelete.mutate(selectedIds, {
      onSuccess: (result) => {
        toast(`已删除 ${result.deleted} 张图片`, 'success')
        setDeleteOpen(false)
        clearSelection()
      },
      onError: (error) => toast(error.message, 'error'),
    })
  }

  const statValues: Record<string, number> = {
    '': stats.data?.total ?? 0,
    unlabeled: stats.data?.unlabeled ?? 0,
    labeled: stats.data?.labeled ?? 0,
    confirmed: stats.data?.confirmed ?? 0,
    missing: stats.data?.missing ?? 0,
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {STAT_CARDS.map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => changeFilter(card.key)}
            className={cx(
              'rounded-xl border px-4 py-3 text-left transition-colors',
              statusFilter === card.key
                ? 'border-accent/50 bg-accent-soft/40'
                : 'border-border bg-panel hover:border-border-strong hover:bg-panel-2/60',
            )}
          >
            <div className={cx('text-lg font-semibold', card.tone)}>
              {formatNumber(statValues[card.key] ?? 0)}
            </div>
            <div className="mt-0.5 text-[11px] text-muted">{card.label}</div>
          </button>
        ))}
      </div>

      {!project.model_config_id ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-warn/25 bg-warn/5 px-4 py-3 text-xs text-warn">
          当前项目还没有选择模型，无法使用预标注。请点击右上角「项目设置」选择模型，或先到
          <Link to="/models" className="underline underline-offset-2">
            模型设置
          </Link>
          创建一套配置。
        </div>
      ) : null}

      {classes.data && classes.data.length === 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 text-xs text-muted">
          还没有类别与提示词。预标注需要每个类别的名称和描述，
          <Link
            to={`/projects/${projectId}/classes`}
            className="text-accent underline underline-offset-2"
          >
            去添加类别
          </Link>
          。
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => setImportOpen(true)}>
          <Upload size={15} />
          导入图片
        </Button>
        <div className="relative w-64">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
          />
          <Input
            className="pl-8"
            value={searchInput}
            placeholder="搜索文件名或路径"
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitSearch()
            }}
          />
        </div>
        <div className="w-36 shrink-0">
          <Select
            value={statusFilter}
            onChange={(event) => changeFilter(event.target.value)}
          >
            <option value="">全部状态</option>
            <option value="unlabeled">未标注</option>
            <option value="labeled">待审核</option>
            <option value="confirmed">已确认</option>
            <option value="missing">文件缺失</option>
          </Select>
        </div>
        <div className="ml-auto flex items-center gap-2 text-[11px] text-faint">
          <button
            type="button"
            onClick={toggleSelectAll}
            className="rounded-md border border-border bg-panel px-2 py-1 text-muted transition-colors hover:text-ink"
          >
            {allSelected ? '取消本页全选' : '全选本页'}
          </button>
          <span>共 {formatNumber(images.data?.total ?? 0)} 张</span>
        </div>
      </div>

      {selected.size > 0 ? (
        <div className="fade-in sticky top-14 z-30 flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-panel/95 px-4 py-2.5 shadow-panel backdrop-blur">
          <span className="text-xs text-ink">已选 {selected.size} 张</span>
          <div className="ml-2 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="primary" onClick={openPrelabel}>
              <Sparkles size={14} />
              预标注
            </Button>
            <Button
              size="sm"
              loading={batchConfirm.isPending}
              onClick={confirmBatch}
            >
              <CheckCheck size={14} />
              批量接受
            </Button>
            <Button
              size="sm"
              loading={batchUnconfirm.isPending}
              onClick={unconfirmBatch}
            >
              <Undo2 size={14} />
              撤销确认
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-danger hover:text-danger"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 size={14} />
              删除
            </Button>
          </div>
          <button
            type="button"
            className="ml-auto text-[11px] text-faint hover:text-ink"
            onClick={clearSelection}
          >
            取消选择
          </button>
        </div>
      ) : null}

      {images.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner />
        </div>
      ) : images.isError ? (
        <EmptyState
          title="图片加载失败"
          description={images.error.message}
          action={<Button onClick={() => images.refetch()}>重新加载</Button>}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ImageIcon size={34} />}
          title={statusFilter || search ? '没有符合条件的图片' : '还没有图片'}
          description={
            statusFilter || search
              ? '试试切换状态筛选或清空搜索关键词。'
              : '从本地文件夹导入未标注的图片，开始构建数据集。'
          }
          action={
            statusFilter || search ? (
              <Button
                onClick={() => {
                  setSearchInput('')
                  setSearch('')
                  changeFilter('')
                }}
              >
                清除筛选
              </Button>
            ) : (
              <Button variant="primary" onClick={() => setImportOpen(true)}>
                <Upload size={15} />
                导入图片
              </Button>
            )
          }
        />
      ) : (
        <>
          <ImageGrid
            items={items}
            selected={selected}
            onToggle={toggleSelect}
            onOpen={(imageId) => navigate(`/projects/${projectId}/annotate/${imageId}`)}
          />

          {totalPages > 1 ? (
            <div className="flex items-center justify-center gap-3 pt-1">
              <Button
                size="sm"
                disabled={page <= 1}
                onClick={() => {
                  setPage((previous) => Math.max(1, previous - 1))
                  clearSelection()
                }}
              >
                <ArrowLeft size={14} />
                上一页
              </Button>
              <span className="text-[11px] text-muted">
                第 {page} / {totalPages} 页
              </span>
              <Button
                size="sm"
                disabled={page >= totalPages}
                onClick={() => {
                  setPage((previous) => Math.min(totalPages, previous + 1))
                  clearSelection()
                }}
              >
                下一页
                <ArrowRight size={14} />
              </Button>
            </div>
          ) : null}
        </>
      )}

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-faint">
        <span className="inline-flex items-center gap-1">
          <StatusBadge status={'unlabeled' as ImageStatus} /> 尚未标注
        </span>
        <span className="inline-flex items-center gap-1">
          <StatusBadge status={'labeled' as ImageStatus} /> 有框但未确认
        </span>
        <span className="inline-flex items-center gap-1">
          <StatusBadge status={'confirmed' as ImageStatus} /> 审核通过
        </span>
        <span className="ml-auto">
          点击图片进入标注台；勾选后可批量预标注、接受或删除。
        </span>
      </div>

      <ImportDialog
        open={importOpen}
        projectId={projectId}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          void images.refetch()
        }}
      />

      <PrelabelDialog
        open={prelabelOpen}
        projectId={projectId}
        imageIds={prelabelIds}
        classes={classes.data ?? []}
        modelName={project.model_name}
        onClose={() => setPrelabelOpen(false)}
        onComplete={handleJobComplete}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="删除图片"
        message={`确定删除选中的 ${selected.size} 张图片吗？标注会一并删除；复制模式的项目副本会被删除，引用模式的原始文件不受影响。`}
        confirmText="删除图片"
        danger
        loading={batchDelete.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleteOpen(false)}
      />
    </div>
  )
}
