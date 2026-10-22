import { useState } from 'react'
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Cpu, Settings } from 'lucide-react'
import { useModelConfigs } from '../api/models.ts'
import {
  useDeleteProject,
  useProject,
  useUpdateProject,
} from '../api/projects.ts'
import type { Project } from '../api/types.ts'
import { Button, ConfirmDialog, Dialog, Field, Input, Select, Textarea } from '../components/ui.tsx'
import { cx } from '../lib/cx.ts'
import { useToast } from '../stores/toast.ts'

const TABS = [
  { to: '', label: '数据集', end: true },
  { to: 'classes', label: '类别与提示词', end: false },
  { to: 'export', label: '导出', end: false },
]

export function ProjectLayout() {
  const params = useParams()
  const projectId = params.projectId ? Number(params.projectId) : undefined
  const project = useProject(projectId)
  const navigate = useNavigate()
  const [settingsOpen, setSettingsOpen] = useState(false)

  if (project.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-16 animate-pulse rounded-2xl border border-border bg-panel" />
        <div className="h-72 animate-pulse rounded-2xl border border-border bg-panel" />
      </div>
    )
  }

  if (project.isError || !project.data) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <div className="text-sm text-ink">项目加载失败</div>
        <div className="text-xs text-muted">{project.error?.message ?? '项目不存在'}</div>
        <Button onClick={() => navigate('/')}>返回项目列表</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-4">
        <NavLink
          to="/"
          className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-ink"
        >
          <ChevronLeft size={15} />
          项目列表
        </NavLink>
        <div className="h-4 w-px bg-border" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-ink">{project.data.name}</h1>
          {project.data.description ? (
            <p className="mt-0.5 truncate text-xs text-muted">{project.data.description}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-panel px-3 py-1.5 text-[11px] text-muted">
          <Cpu size={13} className="text-accent" />
          {project.data.model_name ? (
            <span>
              模型：<span className="text-ink">{project.data.model_name}</span>
            </span>
          ) : (
            <span className="text-warn">尚未选择模型</span>
          )}
        </div>
        <Button size="sm" onClick={() => setSettingsOpen(true)}>
          <Settings size={14} />
          项目设置
        </Button>
      </div>

      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to ? `/projects/${project.data!.id}/${tab.to}` : `/projects/${project.data!.id}`}
            end={tab.end}
            className={({ isActive }) =>
              cx(
                'relative -mb-px px-4 py-2.5 text-xs font-medium transition-colors',
                isActive
                  ? 'border-b-2 border-accent text-ink'
                  : 'border-b-2 border-transparent text-muted hover:text-ink',
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      <Outlet context={project.data} />

      {settingsOpen ? (
        <ProjectSettingsDialog
          project={project.data}
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
        <div className="flex flex-col gap-4">
          <Field label="项目名称">
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="描述">
            <Textarea
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
          <Field
            label="预标注模型"
            hint="预标注任务会使用这里选择的模型配置；可在「模型设置」中管理多套配置。"
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
            <p className="text-[11px] text-warn">
              还没有模型配置，请先到「模型设置」创建一套，或使用模拟模型体验流程。
            </p>
          ) : null}

          <div className="mt-2 rounded-xl border border-danger/25 bg-danger/5 p-3.5">
            <div className="text-xs font-medium text-danger">危险操作</div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              删除项目会永久删除全部标注、任务记录与复制到项目目录的图片。
            </p>
            <Button
              size="sm"
              variant="danger"
              className="mt-2.5"
              onClick={() => setDeleteOpen(true)}
            >
              删除项目
            </Button>
          </div>
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
