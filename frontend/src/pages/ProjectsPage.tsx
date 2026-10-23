import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowUpRight,
  Cpu,
  FolderKanban,
  FolderPlus,
  Plus,
  Trash2,
} from 'lucide-react'
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
import { formatDateTime, formatNumber } from '../lib/format.ts'
import { useToast } from '../stores/toast.ts'
import { cx } from '../lib/cx.ts'

const PROJECT_TONES = [
  'bg-[#F8E6DE] text-accent',
  'bg-[#E7F0E9] text-success',
  'bg-[#F8EFDC] text-warn',
  'bg-[#E6EBF5] text-[#385C91]',
  'bg-[#EFE8F4] text-[#7A4E8E]',
  'bg-[#F4E8EC] text-[#9C4B63]',
]

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

  const projectList = projects.data ?? []
  const totalImages = projectList.reduce((sum, project) => sum + project.image_count, 0)

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
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-panel/60 px-2.5 py-1 text-[10px] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {formatNumber(projectList.length)} 个项目
            <span className="text-border-strong">·</span>
            {formatNumber(totalImages)} 张图片
          </div>
          <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.035em] text-ink">
            项目
          </h1>
          <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-muted">
            导入未标注图片，用模型生成初稿，人工审核修正后导出 YOLO 或 COCO 数据集。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => navigate('/models')}>
            <Cpu size={15} />
            模型设置
          </Button>
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus size={15} />
            新建项目
          </Button>
        </div>
      </div>

      {projects.isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-52 animate-pulse rounded-2xl border border-border bg-panel/70"
            />
          ))}
        </div>
      ) : projects.isError ? (
        <EmptyState
          title="项目列表加载失败"
          description={projects.error.message}
          action={<Button onClick={() => projects.refetch()}>重新加载</Button>}
        />
      ) : projectList.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projectList.map((project, index) => {
            const tone = PROJECT_TONES[index % PROJECT_TONES.length]
            return (
              <div
                key={project.id}
                role="link"
                tabIndex={0}
                onClick={() => navigate(`/projects/${project.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    navigate(`/projects/${project.id}`)
                  }
                }}
                className="group relative flex cursor-pointer flex-col rounded-2xl border border-border bg-panel/80 p-5 shadow-card transition-[border-color,background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:bg-panel hover:shadow-panel"
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={cx(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                      tone,
                    )}
                  >
                    <FolderKanban size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-ink">
                      {project.name}
                    </h2>
                    <p className="mt-1 line-clamp-2 min-h-8 text-[11px] leading-relaxed text-muted">
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
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="mt-auto pt-5">
                  <div className="flex items-end justify-between gap-3 border-t border-border/70 pt-4">
                    <div className="flex items-center gap-5">
                      <div>
                        <div className="text-[19px] font-semibold leading-none tracking-tight tabular-nums text-ink">
                          {formatNumber(project.image_count)}
                        </div>
                        <div className="mt-1 text-[9px] text-faint">图片</div>
                      </div>
                      <span className="h-6 w-px bg-border" />
                      <div>
                        <div className="text-[19px] font-semibold leading-none tracking-tight tabular-nums text-ink">
                          {formatNumber(project.class_count)}
                        </div>
                        <div className="mt-1 text-[9px] text-faint">类别</div>
                      </div>
                    </div>
                    <span
                      className={cx(
                        'inline-flex max-w-[45%] items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px]',
                        project.model_name
                          ? 'border-border bg-panel-2/60 text-muted'
                          : 'border-warn/20 bg-warn/5 text-warn',
                      )}
                    >
                      <Cpu size={10} className="shrink-0" />
                      <span className="truncate">
                        {project.model_name ?? '未选择模型'}
                      </span>
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[9px] text-faint">
                    <span>更新于 {formatDateTime(project.updated_at)}</span>
                    <span className="flex items-center gap-1 text-muted opacity-0 transition-opacity group-hover:opacity-100">
                      打开项目
                      <ArrowUpRight size={11} />
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <EmptyState
            icon={<FolderPlus size={28} />}
            title="还没有项目"
            description="创建第一个项目，把一堆未标注图片变成可训练的检测数据集。"
            action={
              <Button variant="primary" onClick={() => setCreateOpen(true)}>
                <Plus size={15} />
                新建项目
              </Button>
            }
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              ['01', '新建项目', '一个项目对应一份数据集和一套类别配置。'],
              ['02', '写类别提示词', '描述目标外观，帮模型找准需要标注的内容。'],
              ['03', '导入并审核', '预标注后逐张确认，随时导出训练格式。'],
            ].map(([index, title, detail]) => (
              <div
                key={index}
                className="rounded-2xl border border-border bg-panel/55 px-4 py-4"
              >
                <div className="font-mono text-[10px] text-accent">{index}</div>
                <div className="mt-1.5 text-xs font-medium text-ink">{title}</div>
                <p className="mt-1 text-[10px] leading-relaxed text-faint">{detail}</p>
              </div>
            ))}
          </div>
        </div>
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
