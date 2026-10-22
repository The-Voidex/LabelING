import { Link } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import type { LabelClass } from '../api/types.ts'
import type { BoxDraft } from '../stores/editor.ts'
import { sourceLabel } from '../lib/status.ts'
import { Select } from './ui.tsx'
import { cx } from '../lib/cx.ts'

interface AnnotationPanelProps {
  classes: LabelClass[]
  classesHref: string
  activeClassId: number | null
  boxes: BoxDraft[]
  selectedKey: string | null
  onSelectClass: (classId: number) => void
  onSelectBox: (key: string | null) => void
  onUpdateBox: (
    key: string,
    patch: Partial<Pick<BoxDraft, 'x1' | 'y1' | 'x2' | 'y2' | 'class_id'>>,
  ) => void
  onRemoveBox: (key: string) => void
}

export function AnnotationPanel({
  classes,
  classesHref,
  activeClassId,
  boxes,
  selectedKey,
  onSelectClass,
  onSelectBox,
  onUpdateBox,
  onRemoveBox,
}: AnnotationPanelProps) {
  const classMap = new Map(classes.map((item) => [item.id, item]))
  const selectedBox = boxes.find((box) => box.key === selectedKey) ?? null
  const activeClass = activeClassId ? classMap.get(activeClassId) : undefined

  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-l border-border bg-panel/50">
      <div className="flex min-h-0 flex-col border-b border-border" style={{ maxHeight: '48%' }}>
        <div className="flex items-center justify-between px-3 py-2.5">
          <span className="text-[11px] font-medium text-muted">类别</span>
          <Link
            to={classesHref}
            className="text-[10px] text-accent transition-colors hover:text-[#7ea6ff]"
          >
            管理类别
          </Link>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {classes.length === 0 ? (
            <div className="px-2 py-4 text-center text-[11px] leading-relaxed text-faint">
              还没有类别。
              <Link to={classesHref} className="text-accent">
                去添加类别
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {classes.map((item, index) => {
                const active = item.id === activeClassId
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectClass(item.id)}
                    title={item.prompt || '未填写提示词'}
                    className={cx(
                      'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors',
                      active
                        ? 'border-accent/50 bg-accent-soft/45'
                        : 'border-transparent hover:bg-panel-2',
                    )}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-[3px] border border-white/10"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="min-w-0 flex-1 truncate text-xs text-ink">{item.name}</span>
                    <span className="shrink-0 font-mono text-[10px] text-faint">
                      {index < 9 ? index + 1 : ''}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
        {activeClass ? (
          <div className="border-t border-border/70 px-3 py-2">
            <div className="text-[10px] text-faint">当前类别提示词</div>
            <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-muted">
              {activeClass.prompt || '未填写，将使用类别名称作为描述。'}
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-3 py-2.5">
          <span className="text-[11px] font-medium text-muted">标注框</span>
          <span className="font-mono text-[10px] text-faint">{boxes.length}</span>
        </div>

        {selectedBox ? (
          <div className="mx-2 mb-2 rounded-xl border border-border bg-panel p-2.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] text-faint">当前选中</span>
              <button
                type="button"
                aria-label="删除选中的标注框"
                onClick={() => onRemoveBox(selectedBox.key)}
                className="rounded-md p-1 text-faint transition-colors hover:bg-danger/10 hover:text-danger"
              >
                <Trash2 size={13} />
              </button>
            </div>
            <Select
              className="h-8 text-xs"
              value={selectedBox.class_id}
              onChange={(event) =>
                onUpdateBox(selectedBox.key, { class_id: Number(event.target.value) })
              }
            >
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
            <div className="mt-2 grid grid-cols-2 gap-1 font-mono text-[10px] text-faint">
              <span>
                x1 {(selectedBox.x1 * 100).toFixed(1)}% · y1{' '}
                {(selectedBox.y1 * 100).toFixed(1)}%
              </span>
              <span>
                x2 {(selectedBox.x2 * 100).toFixed(1)}% · y2{' '}
                {(selectedBox.y2 * 100).toFixed(1)}%
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-[10px]">
              <span
                className={cx(
                  'rounded px-1.5 py-0.5',
                  selectedBox.source === 'ai'
                    ? 'bg-accent/10 text-accent'
                    : 'bg-panel-3 text-muted',
                )}
              >
                {sourceLabel(selectedBox.source)}
              </span>
              {selectedBox.confidence !== null ? (
                <span className="text-faint">
                  置信度 {Math.round(selectedBox.confidence * 100)}%
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {boxes.length === 0 ? (
            <div className="px-2 py-5 text-center text-[11px] leading-relaxed text-faint">
              还没有标注框。按 B 切换到画框工具，在图片上拖拽即可添加。
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {boxes.map((box) => {
                const labelClass = classMap.get(box.class_id)
                const active = box.key === selectedKey
                return (
                  <button
                    key={box.key}
                    type="button"
                    onClick={() => onSelectBox(box.key)}
                    className={cx(
                      'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors',
                      active
                        ? 'border-accent/50 bg-accent-soft/35'
                        : 'border-transparent hover:bg-panel-2',
                    )}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                      style={{ backgroundColor: labelClass?.color ?? '#5b8cff' }}
                    />
                    <span className="min-w-0 flex-1 truncate text-xs text-ink">
                      {labelClass?.name ?? `类别 ${box.class_id}`}
                    </span>
                    {box.source === 'ai' ? (
                      <span className="shrink-0 rounded bg-accent/10 px-1 py-0.5 text-[9px] text-accent">
                        AI
                      </span>
                    ) : null}
                    {box.confidence !== null ? (
                      <span className="shrink-0 font-mono text-[10px] text-faint">
                        {Math.round(box.confidence * 100)}%
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
