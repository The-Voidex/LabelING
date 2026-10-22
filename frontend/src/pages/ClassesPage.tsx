import { useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  ArrowDown,
  ArrowUp,
  Pencil,
  Plus,
  Tags,
  Trash2,
} from 'lucide-react'
import {
  useClasses,
  useCreateClass,
  useDeleteClass,
  useReorderClasses,
  useUpdateClass,
} from '../api/classes.ts'
import type { LabelClass } from '../api/types.ts'
import {
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  Input,
  Textarea,
} from '../components/ui.tsx'
import { cx } from '../lib/cx.ts'
import { useToast } from '../stores/toast.ts'

const PALETTE = [
  '#5b8cff',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#a855f7',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
  '#f97316',
  '#14b8a6',
]

export function ClassesPage() {
  const params = useParams()
  const projectId = Number(params.projectId)
  const classes = useClasses(projectId)
  const createClass = useCreateClass(projectId)
  const updateClass = useUpdateClass(projectId)
  const deleteClass = useDeleteClass(projectId)
  const reorderClasses = useReorderClasses(projectId)
  const toast = useToast()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<LabelClass | null>(null)
  const [name, setName] = useState('')
  const [prompt, setPrompt] = useState('')
  const [color, setColor] = useState(PALETTE[0])
  const [deleteTarget, setDeleteTarget] = useState<LabelClass | null>(null)

  const openCreate = () => {
    setEditing(null)
    setName('')
    setPrompt('')
    const used = new Set(classes.data?.map((item) => item.color))
    setColor(PALETTE.find((item) => !used.has(item)) ?? PALETTE[0])
    setDialogOpen(true)
  }

  const openEdit = (labelClass: LabelClass) => {
    setEditing(labelClass)
    setName(labelClass.name)
    setPrompt(labelClass.prompt)
    setColor(labelClass.color)
    setDialogOpen(true)
  }

  const save = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast('类别名称不能为空', 'error')
      return
    }
    const data = { name: trimmed, prompt: prompt.trim(), color }
    if (editing) {
      updateClass.mutate(
        { classId: editing.id, data },
        {
          onSuccess: () => {
            toast('类别已更新', 'success')
            setDialogOpen(false)
          },
          onError: (error) => toast(error.message, 'error'),
        },
      )
    } else {
      createClass.mutate(data, {
        onSuccess: () => {
          toast('类别已添加', 'success')
          setDialogOpen(false)
        },
        onError: (error) => toast(error.message, 'error'),
      })
    }
  }

  const move = (index: number, direction: -1 | 1) => {
    if (!classes.data) return
    const next = [...classes.data]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    reorderClasses.mutate(next.map((item) => item.id), {
      onError: (error) => toast(error.message, 'error'),
    })
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    deleteClass.mutate(
      { classId: deleteTarget.id, force: deleteTarget.annotation_count > 0 },
      {
        onSuccess: () => {
          toast('类别已删除', 'success')
          setDeleteTarget(null)
        },
        onError: (error) => toast(error.message, 'error'),
      },
    )
  }

  const saving = createClass.isPending || updateClass.isPending

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-ink">类别与提示词</h2>
          <p className="mt-1 text-xs text-muted">
            提示词描述目标的外观特征，会随类别名称一起发送给模型，用于预标注。
          </p>
        </div>
        <Button variant="primary" onClick={openCreate}>
          <Plus size={15} />
          添加类别
        </Button>
      </div>

      {classes.isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-20 animate-pulse rounded-xl border border-border bg-panel"
            />
          ))}
        </div>
      ) : classes.data && classes.data.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-panel">
          {classes.data.map((item, index) => (
            <div
              key={item.id}
              className={cx(
                'flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-panel-2/60',
                index !== classes.data!.length - 1 && 'border-b border-border',
              )}
            >
              <div className="flex items-center gap-2 pt-0.5">
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-[4px] border border-white/15"
                  style={{ backgroundColor: item.color }}
                />
                <span className="w-5 text-center font-mono text-[11px] text-faint">
                  {index < 9 ? index + 1 : '·'}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-ink">{item.name}</span>
                  <span className="rounded-full border border-border bg-panel-2 px-2 py-0.5 text-[10px] text-muted">
                    {item.annotation_count} 个标注
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
                  {item.prompt || '未填写提示词，将使用类别名称作为描述。'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label="上移类别"
                  disabled={index === 0 || reorderClasses.isPending}
                  onClick={() => move(index, -1)}
                  className="rounded-lg p-1.5 text-faint transition-colors hover:bg-panel-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  type="button"
                  aria-label="下移类别"
                  disabled={index === classes.data!.length - 1 || reorderClasses.isPending}
                  onClick={() => move(index, 1)}
                  className="rounded-lg p-1.5 text-faint transition-colors hover:bg-panel-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ArrowDown size={15} />
                </button>
                <button
                  type="button"
                  aria-label="编辑类别"
                  onClick={() => openEdit(item)}
                  className="rounded-lg p-1.5 text-faint transition-colors hover:bg-panel-3 hover:text-ink"
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  aria-label="删除类别"
                  onClick={() => setDeleteTarget(item)}
                  className="rounded-lg p-1.5 text-faint transition-colors hover:bg-danger/10 hover:text-danger"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Tags size={34} />}
          title="还没有类别"
          description="先添加类别并写清目标外观。预标注时每个类别都会携带自己的提示词描述。"
          action={
            <Button variant="primary" onClick={openCreate}>
              <Plus size={15} />
              添加类别
            </Button>
          }
        />
      )}

      <Dialog
        open={dialogOpen}
        title={editing ? '编辑类别' : '添加类别'}
        description="类别名称会出现在标注与导出结果中；提示词只用于模型预标注。"
        onClose={() => setDialogOpen(false)}
        footer={
          <>
            <Button onClick={() => setDialogOpen(false)}>取消</Button>
            <Button variant="primary" loading={saving} onClick={save}>
              {editing ? '保存修改' : '添加类别'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="类别名称">
            <Input
              autoFocus
              value={name}
              maxLength={200}
              placeholder="例如：装甲板"
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field label="颜色">
            <div className="flex flex-wrap items-center gap-2">
              {PALETTE.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-label={`选择颜色 ${item}`}
                  onClick={() => setColor(item)}
                  className={cx(
                    'h-7 w-7 rounded-lg border transition-transform',
                    color === item
                      ? 'scale-110 border-white/70 ring-2 ring-white/20'
                      : 'border-white/10 hover:scale-105',
                  )}
                  style={{ backgroundColor: item }}
                />
              ))}
              <input
                type="color"
                aria-label="自定义颜色"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="h-7 w-9 cursor-pointer rounded-lg border border-border bg-panel p-0.5"
              />
            </div>
          </Field>
          <Field
            label="提示词描述"
            hint="建议写清颜色、形状、材质、朝向、与周围目标的关系。留空时使用类别名称。"
          >
            <Textarea
              rows={4}
              value={prompt}
              placeholder="例如：机器人底盘上的矩形装甲板，通常带 LED 灯条，可能倾斜安装，颜色为红或蓝。"
              onChange={(event) => setPrompt(event.target.value)}
            />
          </Field>
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除类别"
        message={
          deleteTarget?.annotation_count
            ? `类别「${deleteTarget.name}」已有 ${deleteTarget.annotation_count} 个标注。删除类别会同时删除这些标注，并将相关图片状态退回为未确认。确定继续吗？`
            : `确定删除类别「${deleteTarget?.name}」吗？`
        }
        confirmText="删除类别"
        danger
        loading={deleteClass.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}
