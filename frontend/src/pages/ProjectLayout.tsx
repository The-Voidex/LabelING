import { useState } from 'react'
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import {
  ChevronLeft,
  Cpu,
  Download,
  FolderKanban,
  Images,
  Settings,
  Tags,
} from 'lucide-react'
import { useModelConfigs } from '../api/models.ts'
import {
  useDeleteProject,
  useProject,
  useUpdateProject,
} from '../api/projects.ts'
import type { Project } from '../api/types.ts'
import {
  Button,
  ConfirmDialog,
  Dialog,
  Field,
  Input,
  Select,
  Textarea,
} from '../components/ui.tsx'
import { cx } from '../lib/cx.ts'
import { formatNumber } from '../lib/format.ts'
import { useToast } from '../stores/toast.ts'

const TABS = [
  { to: '', label: '数据集', icon: Images, end: true },
  { to: 'classes', label: '类别与提示词', icon: Tags, end: false },
  { to: 'export', label: '导出', icon: Download, end: false },
]

export function ProjectLayout() {
  const params = useParams()
  const projectId = params.projectId ? Number(params.projectId) : undefined
  const project = useProject(projectId)
  const navigate = useNavigate()
  const [settingsOpen, setSettingsOpen] = useState(false)

  if (project.isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <div className="h-28 animate-pulse rounded-2xl border border-border bg-panel/70" />
        <div className="h-10 w-96 animate-pulse rounded-xl border border-border bg-panel/60" />
        <div className="h-72 animate-pulse rounded-2xl border border-border bg-panel/70" />
      </div>
    )
  }

  if (project.isError || !project.data) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <div className="text-sm font-medium text-ink">项目加载失败</div>
        <div className="text-xs text-muted">{project.error?.message ?? '项目不存在'}</div>
        <Button onClick={() => navigate('/')}>返回项目列表</Button>
      </div>
    )
  }

  const current = project.data

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-5">
        <NavLink
          to="/"
          className="flex w-fit items-center gap-1 text-[11px] text-muted transition-colors hover:text-ink"
        >
          <ChevronLeft size={14} />
          全部项目
        </NavLink>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-accent/15 bg-accent-soft text-accent shadow-card">
              <FolderKanban size={22} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-[25px] font-semibold tracking-[-0.03em] text-ink">
                  {current.name}
                </h1>
                <span className="rounded-full border border-border bg-panel px-2 py-0.5 text-[10px] text-muted">
                  {formatNumber(current.image_count)} 张图片
                </span>
                <span className="rounded-full border border-border bg-panel px-2 py-0.5 text-[10px] text-muted">
                  {current.class_count} 个类别
                </span>
              </div>
              <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-muted">
                {current.description || '暂无描述，可在项目设置中补充来源或标注要求。'}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[10px]">
                <span
                  className={cx(
                    'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5',
                    current.model_name
                      ? 'bg-success/8 text-success'
                      : 'bg-warn/8 text-warn',
                  )}
                >
                  <Cpu size={11} />
                  {current.model_name
                    ? `预标注模型：${current.model_name}`
                    : '尚未选择预标注模型'}
                </span>
              </div>
            </div>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setSettingsOpen(true)}>
            <Settings size={14} />
            项目设置
          </Button>
        </div>
      </div>

      <div className="flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-border bg-panel/55 p-1 shadow-card">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <NavLink
              key={tab.to}
              to={
                tab.to
                  ? `/projects/${current.id}/${tab.to}`
                  : `/projects/${current.id}`
              }
              end={tab.end}
              className={({ isActive }) =>
                cx(
                  'flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-[11px] font-medium transition-colors',
                  isActive
                    ? 'bg-panel text-ink shadow-[0_1px_2px_rgba(39,35,29,0.06)] ring-1 ring-border'
                    : 'text-muted hover:bg-panel/70 hover:text-ink',
                )
              }
            >
              <Icon size={13} />
              {tab.label}
            </NavLink>
          )
        })}
      </div>

      <Outlet context={current} />

      {settingsOpen ? (
        <ProjectSettingsDialog
          project={current}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </div>
  )
}

function ProjectSettingsDialog({
  project,
  onClose,
}: {
  project: Project
  onClose: () => void
}) {
  const models = useModelConfigs()
  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()
  const navigate = useNavigate()
  const toast = useToast()

  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description)
  const [modelId, setModelId] = useState<string>(
    project.model_config_id ? String(project.model_config_id) : '',
  )
  const [deleteOpen, setDeleteOpen] = useState(false)

  const save = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast('项目名称不能为空', 'error')
      return
    }
    updateProject.mutate(
      {
        projectId: project.id,
        data: {
          name: trimmed,
          description: description.trim(),
          model_config_id: modelId ? Number(modelId) : null,
        },
      },
      {
        onSuccess: () => {
          toast('项目设置已保存', 'success')
          onClose()
        },
        onError: (error) => toast(error.message, 'error'),
      },
    )
  }

  const confirmDelete = () => {
    deleteProject.mutate(project.id, {
      onSuccess: () => {
        toast('项目已删除', 'success')
        navigate('/')
      },
      onError: (error) => toast(error.message, 'error'),
    })
  }

  return (
    <>
      <Dialog
        open
        title="项目设置"
        description="修改项目信息与预标注模型。"
        onClose={onClose}
        footer={
          <>
            <Button onClick={onClose}>取消</Button>
            <Button variant="primary" loading={updateProject.isPending} onClick={save}>
              保存设置
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-3.5">
            <div className="text-[10px] font-medium tracking-[0.12em] text-faint">基本信息</div>
            <Field label="项目名称">
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field label="描述">
              <Textarea
                rows={3}
                value={description}
                placeholder="记录数据集来源、采集场景或标注要求"
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
          </section>

          <section className="flex flex-col gap-3.5 border-t border-border/80 pt-5">
            <div className="text-[10px] font-medium tracking-[0.12em] text-faint">
              预标注模型
            </div>
            <Field
              label="使用的模型配置"
              hint="预标注任务会使用这里选择的模型；可在「模型设置」中管理多套配置。"
            >
              <Select value={modelId} onChange={(event) => setModelId(event.target.value)}>
                <option value="">不使用模型（仅人工标注）</option>
                {models.data?.map((config) => (
                  <option key={config.id} value={config.id}>
                    {config.name}
                    {config.provider_type === 'mock' ? '（模拟）' : ` · ${config.model_name}`}
                  </option>
                ))}
              </Select>
            </Field>
            {models.data && models.data.length === 0 ? (
              <p className="rounded-lg border border-warn/20 bg-warn/5 px-3 py-2 text-[11px] text-warn">
                还没有模型配置，请先到「模型设置」创建一套，或使用模拟模型体验流程。
              </p>
            ) : null}
          </section>

          <section className="mt-1 rounded-xl border border-danger/20 bg-danger/5 p-4">
            <div className="text-xs font-medium text-danger">危险操作</div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              删除项目会永久删除全部标注、任务记录与复制到项目目录的图片，且无法恢复。
            </p>
            <Button
              size="sm"
              variant="danger"
              className="mt-3"
              onClick={() => setDeleteOpen(true)}
            >
              删除项目
            </Button>
          </section>
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        title="删除项目"
        message={`确定删除项目「${project.name}」吗？此操作无法恢复。引用模式的原始图片不会被删除。`}
        confirmText="删除项目"
        danger
        loading={deleteProject.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  )
}
