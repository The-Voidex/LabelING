import { useState } from 'react'
import type { ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import {
  Archive,
  Check,
  Download,
  FileJson,
  FileText,
  Images,
  Info,
} from 'lucide-react'
import { useClasses } from '../api/classes.ts'
import { useProject, useProjectStats } from '../api/projects.ts'
import { useToast } from '../stores/toast.ts'
import { Button, Switch } from '../components/ui.tsx'
import { cx } from '../lib/cx.ts'
import { formatNumber } from '../lib/format.ts'

type Format = 'yolo' | 'coco'
type Scope = 'annotated' | 'confirmed'

export function ExportPage() {
  const params = useParams()
  const projectId = Number(params.projectId)
  const project = useProject(projectId)
  const stats = useProjectStats(projectId)
  const classes = useClasses(projectId)
  const toast = useToast()

  const [format, setFormat] = useState<Format>('yolo')
  const [scope, setScope] = useState<Scope>('annotated')
  const [includeImages, setIncludeImages] = useState(true)

  const annotated = (stats.data?.labeled ?? 0) + (stats.data?.confirmed ?? 0)
  const confirmed = stats.data?.confirmed ?? 0
  const available = scope === 'confirmed' ? confirmed : annotated

  const download = () => {
    if (available === 0) {
      toast('当前范围没有可导出的图片，请先完成标注或确认', 'error')
      return
    }
    const query = new URLSearchParams({
      format,
      scope,
      include_images: String(includeImages),
    })
    const link = document.createElement('a')
    link.href = `/api/projects/${projectId}/export?${query.toString()}`
    link.download = `labeling_${projectId}_${format}.zip`
    document.body.appendChild(link)
    link.click()
    link.remove()
    toast('已开始生成导出包，浏览器将自动下载', 'success')
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-[19px] font-semibold tracking-[-0.02em] text-ink">导出数据集</h2>
        <p className="mt-1 text-xs text-muted">
          将标注转换为训练格式。导出包内含清单文件与中文说明，缺失图片会跳过并记录。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.9fr)]">
        <div className="flex flex-col gap-4">
          <section className="rounded-2xl border border-border bg-panel/75 p-5 shadow-card">
            <StepHeading
              step="01"
              title="选择导出格式"
              description="两种格式包含相同的标注内容，按训练框架选择即可。"
            />
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <FormatCard
                active={format === 'yolo'}
                onClick={() => setFormat('yolo')}
                icon={<FileText size={19} />}
                title="YOLO txt"
                description="每张图片一个标签文件，归一化中心点与宽高，适合 YOLO 系列训练。"
                structure={['images/', 'labels/', 'data.yaml', 'classes.txt', 'manifest.json']}
              />
              <FormatCard
                active={format === 'coco'}
                onClick={() => setFormat('coco')}
                icon={<FileJson size={19} />}
                title="COCO JSON"
                description="单个标注文件描述全部图片与框，兼容 mmdetection、Detectron2 等。"
                structure={['annotations.json', 'images/', 'manifest.json', 'README.txt']}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-panel/75 p-5 shadow-card">
            <StepHeading
              step="02"
              title="确定导出范围"
              description="未确认的预标框也可以导出，适合先训练一版基线模型。"
            />
            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <ScopeCard
                active={scope === 'annotated'}
                onClick={() => setScope('annotated')}
                title="全部有标注的图片"
                detail={`待审核 + 已确认，共 ${formatNumber(annotated)} 张`}
              />
              <ScopeCard
                active={scope === 'confirmed'}
                onClick={() => setScope('confirmed')}
                title="仅已确认"
                detail={`只导出审核通过的图片，共 ${formatNumber(confirmed)} 张`}
              />
            </div>

            <div className="mt-3 flex items-center justify-between gap-4 rounded-xl border border-border/80 bg-panel-2/45 px-4 py-3.5">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-panel text-muted">
                  <Images size={14} />
                </span>
                <div>
                  <div className="text-xs font-medium text-ink">包含图片文件</div>
                  <div className="mt-0.5 text-[10px] leading-relaxed text-muted">
                    关闭后只导出标注与配置文件，压缩包体积更小。
                  </div>
                </div>
              </div>
              <Switch
                checked={includeImages}
                label="包含图片文件"
                onChange={setIncludeImages}
              />
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-3 lg:sticky lg:top-6 lg:self-start">
          <section className="overflow-hidden rounded-2xl border border-accent/20 bg-accent-soft/30 shadow-card">
            <div className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium tracking-[0.12em] text-accent">
                  导出摘要
                </span>
                <span className="rounded-full border border-accent/20 bg-panel/60 px-2 py-0.5 font-mono text-[9px] text-accent">
                  {format === 'yolo' ? 'YOLO' : 'COCO'}
                </span>
              </div>
              <div className="mt-3 flex items-end gap-2">
                <span className="text-[34px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-ink">
                  {formatNumber(available)}
                </span>
                <span className="pb-1 text-[11px] text-muted">张图片</span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted">
                {scope === 'confirmed' ? '仅导出已审核确认的图片' : '导出全部有标注的图片'}
                ，类别按当前顺序生成索引。
              </p>
              <Button
                variant="primary"
                className="mt-4 w-full"
                onClick={download}
                disabled={available === 0}
              >
                <Download size={15} />
                导出并下载
              </Button>
              <p className="mt-2 text-center text-[9px] text-faint">
                {available === 0 ? '当前范围还没有可导出的图片' : '生成完成后浏览器会自动下载'}
              </p>
            </div>
            <div className="flex items-center gap-2 border-t border-accent/15 bg-panel/35 px-5 py-3 text-[10px] text-muted">
              <Check size={12} className="text-success" />
              {project.data?.name ?? '加载中'} · 待审核{' '}
              {formatNumber(stats.data?.labeled ?? 0)} 张 · 已确认{' '}
              {formatNumber(confirmed)} 张
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-panel/70 p-4">
            <div className="flex items-center gap-2 text-[11px] font-medium text-ink">
              <Archive size={14} className="text-accent" />
              类别映射
              <span className="ml-auto font-mono text-[9px] text-faint">
                {classes.data?.length ?? 0}
              </span>
            </div>
            <div className="mt-2.5 flex flex-col gap-1">
              {classes.data?.length ? (
                classes.data.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 odd:bg-panel-2/40"
                  >
                    <span className="w-4 font-mono text-[9px] text-faint">{index}</span>
                    <span
                      className="h-2 w-2 shrink-0 rounded-[2px]"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="truncate text-[11px] text-ink">{item.name}</span>
                  </div>
                ))
              ) : (
                <span className="px-2 py-2 text-[10px] text-faint">还没有类别</span>
              )}
            </div>
            <p className="mt-2 px-2 text-[9px] leading-relaxed text-faint">
              导出时按以上顺序生成类别编号，直接对应标签文件中的类别索引。
            </p>
          </section>

          <section className="rounded-2xl border border-border bg-panel/70 p-4">
            <div className="flex items-center gap-2 text-[11px] font-medium text-ink">
              <Info size={14} className="text-muted" />
              导出提示
            </div>
            <ul className="mt-2 list-disc space-y-1.5 pl-4 text-[10px] leading-relaxed text-muted">
              <li>预标注但未人工确认的图片也会包含在「全部有标注」范围内。</li>
              <li>模型预标框与人工框都会导出，导出不区分来源。</li>
              <li>引用模式的原图若已移动，导出时会跳过并记录在 manifest.json。</li>
              <li>重名图片会自动加编号后缀，映射关系写在 manifest.json。</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}

function StepHeading({
  step,
  title,
  description,
}: {
  step: string
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 font-mono text-[10px] font-medium text-accent">{step}</span>
      <div>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <p className="mt-0.5 text-[10px] leading-relaxed text-muted">{description}</p>
      </div>
    </div>
  )
}

function FormatCard({
  active,
  onClick,
  icon,
  title,
  description,
  structure,
}: {
  active: boolean
  onClick: () => void
  icon: ReactNode
  title: string
  description: string
  structure: string[]
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'rounded-xl border p-4 text-left transition-[border-color,background-color,box-shadow]',
        active
          ? 'border-accent/40 bg-accent-soft/30 shadow-card ring-1 ring-accent/10'
          : 'border-border bg-panel hover:border-border-strong hover:bg-panel-2/45',
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cx(
            'flex h-9 w-9 items-center justify-center rounded-lg border',
            active
              ? 'border-accent/20 bg-panel text-accent'
              : 'border-border bg-panel-2/60 text-muted',
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-ink">{title}</div>
          <div className="mt-0.5 text-[10px] leading-relaxed text-muted">
            {description}
          </div>
        </div>
        <span
          className={cx(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
            active ? 'border-accent bg-accent text-white' : 'border-border-strong',
          )}
        >
          {active ? <Check size={11} strokeWidth={3} /> : null}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {structure.map((item) => (
          <span
            key={item}
            className="rounded border border-border bg-panel/80 px-1.5 py-0.5 font-mono text-[9px] text-faint"
          >
            {item}
          </span>
        ))}
      </div>
    </button>
  )
}

function ScopeCard({
  active,
  onClick,
  title,
  detail,
}: {
  active: boolean
  onClick: () => void
  title: string
  detail: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'rounded-xl border px-3.5 py-3 text-left transition-colors',
        active
          ? 'border-accent/40 bg-accent-soft/45'
          : 'border-border bg-panel hover:bg-panel-2/50',
      )}
    >
      <div className="flex items-center gap-2 text-xs font-medium text-ink">
        <span
          className={cx(
            'flex h-3.5 w-3.5 items-center justify-center rounded-full border',
            active ? 'border-accent bg-accent' : 'border-border-strong',
          )}
        >
          {active ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
        </span>
        {title}
      </div>
      <div className="mt-1 pl-5.5 text-[10px] text-muted">{detail}</div>
    </button>
  )
}
