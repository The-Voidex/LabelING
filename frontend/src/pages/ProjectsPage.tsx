import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Cpu, FolderKanban, Plus, Trash2 } from 'lucide-react'
import { useCreateProject, useDeleteProject, useProjects } from '../api/projects.ts'
import type { Project } from '../api/types.ts'
import {
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  Input,
  Textarea,
} from '../components/ui.tsx'
import { formatDateTime } from '../lib/format.ts'
import { useToast } from '../stores/toast.ts'

export function ProjectsPage() {
  const projects = useProjects()
  const createProject = useCreateProject()
  const deleteProject = useDeleteProject()
  const navigate = useNavigate()
  const toast = useToast()

  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)

  const resetForm = () => {
    setName('')
    setDescription('')
  }

  const submitCreate = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast('请填写项目名称', 'error')
      return
    }
    createProject.mutate(
      { name: trimmed, description: description.trim() },
      {
        onSuccess: (project) => {
          toast('项目已创建', 'success')
          setCreateOpen(false)
          resetForm()
          navigate(`/projects/${project.id}`)
        },
        onError: (error) => toast(error.message, 'error'),
      },
    )
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    deleteProject.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast('项目已删除', 'success')
        setDeleteTarget(null)
      },
      onError: (error) => toast(error.message, 'error'),
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink">项目</h1>
          <p className="mt-1 text-xs text-muted">
            导入图片数据集，用模型预标注，人工审核后导出 YOLO / COCO。
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          <Plus size={15} />
          新建项目
        </Button>
      </div>

      {projects.isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-44 animate-pulse rounded-2xl border border-border bg-panel"
            />
          ))}
        </div>
      ) : projects.isError ? (
        <EmptyState
          title="项目列表加载失败"
          description={projects.error.message}
          action={<Button onClick={() => projects.refetch()}>重新加载</Button>}
        />
      ) : projects.data && projects.data.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.data.map((project) => (
            <div
              key={project.id}
              role="link"
              tabIndex={0}
              onClick={() => navigate(`/projects/${project.id}`)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  navigate(`/projects/${project.id}`)
                }
              }}
              className="group relative cursor-pointer rounded-2xl border border-border bg-panel p-5 transition-colors hover:border-border-strong hover:bg-panel-2/60"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-accent/20 bg-accent-soft/60 text-accent">
                  <FolderKanban size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-semibold text-ink">{project.name}</h2>
                  <p className="mt-1 line-clamp-2 min-h-8 text-xs leading-relaxed text-muted">
                    {project.description || '暂无描述'}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`删除项目 ${project.name}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    setDeleteTarget(project)
                  }}
                  className="rounded-lg p-1.5 text-faint opacity-0 transition-all hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-[11px] text-muted">
                <div className="rounded-lg bg-panel-2 px-2.5 py-2">
                  <div className="text-ink">{project.image_count}</div>
                  <div>图片</div>
                </div>
                <div className="rounded-lg bg-panel-2 px-2.5 py-2">
                  <div className="text-ink">{project.class_count}</div>
                  <div>类别</div>
                </div>
                <div className="truncate rounded-lg bg-panel-2 px-2.5 py-2">
                  <div className="truncate text-ink">
                    {project.model_name ?? '未选择模型'}
                  </div>
                  <div>模型</div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-faint">
                <span className="inline-flex items-center gap-1">
                  <Cpu size={12} />
                  {project.model_name ? '已接入模型' : '尚未接入模型'}
                </span>
                <span>更新于 {formatDateTime(project.updated_at)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<FolderKanban size={34} />}
          title="还没有项目"
          description="创建第一个项目，把图片数据集变成可训练的标注。"
          action={
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus size={15} />
              新建项目
            </Button>
          }
        />
      )}

      <Dialog
        open={createOpen}
        title="新建项目"
        description="一个项目对应一份数据集与一套类别配置。"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <Button onClick={() => setCreateOpen(false)}>取消</Button>
            <Button
              variant="primary"
              loading={createProject.isPending}
              onClick={submitCreate}
            >
              创建项目
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="项目名称">
            <Input
              autoFocus
              value={name}
              maxLength={200}
              placeholder="例如：RoboMaster 装甲板检测"
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submitCreate()
              }}
            />
          </Field>
          <Field label="描述（可选）">
            <Textarea
              rows={3}
              value={description}
              placeholder="记录数据集来源、采集场景或标注要求"
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除项目"
        message={
          <>
            确定删除项目「{deleteTarget?.name}」吗？
            <br />
            项目内的标注、任务记录和复制到项目目录的图片将永久删除，无法恢复。引用模式的原始图片不会被删除。
          </>
        }
        confirmText="删除项目"
        danger
        loading={deleteProject.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}
