import { Link } from 'react-router-dom'
import { Save, Trash2 } from 'lucide-react'
import type { LabelClass } from '../api/types.ts'
import type { BoxDraft } from '../stores/editor.ts'
import { sourceLabel } from '../lib/status.ts'
import { Kbd, Select } from './ui.tsx'
import { cx } from '../lib/cx.ts'

interface AnnotationPanelProps {
  classes: LabelClass[]
  classesHref: string
  activeClassId: number | null
  boxes: BoxDraft[]
  selectedKey: string | null
  imageWidth: number
  imageHeight: number
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
  imageWidth,
  imageHeight,
  onSelectClass,
  onSelectBox,
  onUpdateBox,
  onRemoveBox,
}: AnnotationPanelProps) {
  const classMap = new Map(classes.map((item) => [item.id, item]))
  const selectedBox = boxes.find((box) => box.key === selectedKey) ?? null
  const activeClass = activeClassId ? classMap.get(activeClassId) : undefined
  const aiCount = boxes.filter((box) => box.source === 'ai').length
  const humanCount = boxes.length - aiCount

  return (
    <aside className="hidden w-[312px] shrink-0 flex-col border-l border-border bg-panel/60 backdrop-blur-xl lg:flex">
      <section className="flex min-h-0 flex-col border-b border-border/80" style={{ maxHeight: '46%' }}>
        <div className="flex items-center justify-between px-4 pb-2.5 pt-4">
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] font-medium tracking-[0.1em] text-faint">类别</span>
            <span className="font-mono text-[10px] text-faint">{classes.length}</span>
          </div>
          <Link
            to={classesHref}
            className="text-[10px] text-muted transition-colors hover:text-accent"
          >
            管理类别
          </Link>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {classes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-3 py-5 text-center text-[11px] leading-relaxed text-faint">
              还没有类别。
              <Link to={classesHref} className="ml-1 text-accent hover:underline">
                去添加类别
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {classes.map((item, index) => {
                const active = item.id === activeClassId
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectClass(item.id)}
                    title={item.prompt || '未填写提示词'}
                    className={cx(
                      'group flex min-w-0 items-center gap-2 rounded-lg border px-2 py-2 text-left transition-colors',
                      active
                        ? 'border-accent/35 bg-accent-soft/70 shadow-card'
                        : 'border-transparent bg-panel-2/45 hover:border-border hover:bg-panel-2',
                    )}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                      style={{ backgroundColor: item.color }}
                    />
                    <span
                      className={cx(
                        'min-w-0 flex-1 truncate text-[11px]',
                        active ? 'font-medium text-ink' : 'text-muted group-hover:text-ink',
                      )}
                    >
                      {item.name}
                    </span>
                    <span className="shrink-0 font-mono text-[9px] text-faint">
                      {index < 9 ? index + 1 : ''}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {activeClass ? (
          <div className="border-t border-border/70 px-4 py-3">
            <div className="flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: activeClass.color }}
              />
              <span className="text-[10px] font-medium text-muted">
                {activeClass.name} · 提示词
              </span>
            </div>
            <p className="mt-1.5 line-clamp-3 text-[11px] leading-relaxed text-faint">
              {activeClass.prompt || '未填写提示词，将使用类别名称作为描述。'}
            </p>
          </div>
        ) : null}
      </section>

      <section className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-4 pb-2.5 pt-4">
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] font-medium tracking-[0.1em] text-faint">标注框</span>
            <span className="font-mono text-[10px] text-faint">{boxes.length}</span>
          </div>
          {boxes.length > 0 ? (
            <span className="text-[10px] text-faint">
              人工 {humanCount}
              {aiCount > 0 ? ` · 预标 ${aiCount}` : ''}
            </span>
          ) : null}
        </div>

        {selectedBox ? (
          <div className="mx-3 mb-3 rounded-xl border border-border bg-panel p-3 shadow-card">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[10px] font-medium text-muted">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: classMap.get(selectedBox.class_id)?.color }}
                />
                当前选中
              </span>
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
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <div className="rounded-lg bg-panel-2/60 px-2 py-1.5">
                <div className="text-[9px] text-faint">尺寸</div>
                <div className="mt-0.5 font-mono text-[10px] text-ink">
                  {Math.round((selectedBox.x2 - selectedBox.x1) * imageWidth)} ×{' '}
                  {Math.round((selectedBox.y2 - selectedBox.y1) * imageHeight)} 像素
                </div>
              </div>
              <div className="rounded-lg bg-panel-2/60 px-2 py-1.5">
                <div className="text-[9px] text-faint">来源</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-ink">
                  {sourceLabel(selectedBox.source)}
                  {selectedBox.confidence !== null ? (
                    <span className="font-mono text-faint">
                      {Math.round(selectedBox.confidence * 100)}%
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="mt-1.5 font-mono text-[9px] leading-relaxed text-faint">
              位置 {(selectedBox.x1 * 100).toFixed(1)}%, {(selectedBox.y1 * 100).toFixed(1)}%
              {' — '}
              {(selectedBox.x2 * 100).toFixed(1)}%, {(selectedBox.y2 * 100).toFixed(1)}%
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {boxes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center">
              <p className="text-[11px] leading-relaxed text-faint">
                还没有标注框。
                <br />
                按 <Kbd className="mx-1">W</Kbd> 后在图片上拖拽即可添加。
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {boxes.map((box, index) => {
                const labelClass = classMap.get(box.class_id)
                const active = box.key === selectedKey
                return (
                  <div
                    key={box.key}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectBox(box.key)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onSelectBox(box.key)
                      }
                    }}
                    className={cx(
                      'group flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-2 text-left transition-colors',
                      active
                        ? 'border-accent/35 bg-accent-soft/55'
                        : 'border-transparent hover:border-border hover:bg-panel-2/60',
                    )}
                  >
                    <span className="w-4 shrink-0 text-center font-mono text-[9px] text-faint">
                      {index + 1 < 10 ? `0${index + 1}` : index + 1}
                    </span>
                    <span
                      className="h-5 w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: labelClass?.color ?? '#F2B95B' }}
                    />
                    <span className="min-w-0 flex-1 truncate text-[11px] text-ink">
                      {labelClass?.name ?? `类别 ${box.class_id}`}
                    </span>
                    {box.source === 'ai' ? (
                      <span className="shrink-0 rounded bg-[#E8A33C]/15 px-1 py-0.5 text-[9px] text-warn">
                        预标
                      </span>
                    ) : null}
                    {box.confidence !== null ? (
                      <span className="shrink-0 font-mono text-[9px] text-faint">
                        {Math.round(box.confidence * 100)}%
                      </span>
                    ) : null}
                    <button
                      type="button"
                      aria-label="删除这个标注框"
                      onClick={(event) => {
                        event.stopPropagation()
                        onRemoveBox(box.key)
                      }}
                      className="shrink-0 rounded p-1 text-transparent transition-colors hover:bg-danger/10 hover:text-danger group-hover:text-faint"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="border-t border-border/80 px-4 py-2.5">
          <div className="flex items-center justify-between text-[9px] text-faint">
            <span className="flex items-center gap-1">
              <Kbd>Q</Kbd> 浏览
              <span className="mx-0.5 text-border-strong">·</span>
              <Kbd>W</Kbd> 框选
            </span>
            <span className="flex items-center gap-1">
              <Save size={10} />
              自动保存
            </span>
          </div>
        </div>
      </section>
    </aside>
  )
}
