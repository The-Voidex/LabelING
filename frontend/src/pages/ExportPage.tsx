import { useState } from 'react'
import type { ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { Archive, Check, Download, FileJson, FileText, Info } from 'lucide-react'
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
        <h2 className="text-base font-semibold text-ink">导出数据集</h2>
        <p className="mt-1 text-xs text-muted">
          将标注转换为训练格式。导出包内含清单文件与中文说明，缺失图片会跳过并记录。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FormatCard
          active={format === 'yolo'}
          onClick={() => setFormat('yolo')}
          icon={<FileText size={20} />}
          title="YOLO txt"
          description="每张图片一个 txt，坐标归一化为中心点与宽高，适合 YOLO 系列训练。"
          structure={['images/', 'labels/', 'data.yaml', 'classes.txt', 'manifest.json']}
        />
        <FormatCard
          active={format === 'coco'}
          onClick={() => setFormat('coco')}
          icon={<FileJson size={20} />}
          title="COCO JSON"
          description="单个 annotations.json 描述全部图片与框，兼容 mmdetection、Detectron2 等。"
          structure={['annotations.json', 'images/', 'manifest.json', 'README.txt']}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-panel p-5">
          <div>
            <div className="text-xs font-medium text-muted">导出范围</div>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
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
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border bg-panel-2/60 px-3.5 py-3">
            <div>
              <div className="text-xs font-medium text-ink">包含图片文件</div>
              <div className="mt-0.5 text-[11px] text-muted">
                关闭后只导出标注与配置文件，包体积更小。
              </div>
            </div>
            <Switch
              checked={includeImages}
              label="包含图片文件"
              onChange={setIncludeImages}
            />
          </div>

          <div className="mt-auto flex items-center gap-3">
            <Button variant="primary" onClick={download} disabled={available === 0}>
              <Download size={15} />
              导出并下载
            </Button>
            <span className="text-[11px] text-faint">
              {available === 0
                ? '当前范围没有可导出的图片'
                : `将导出 ${formatNumber(available)} 张图片`}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="rounded-2xl border border-border bg-panel p-5">
            <div className="flex items-center gap-2 text-xs font-medium text-ink">
              <Archive size={15} className="text-accent" />
              类别映射
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {classes.data?.length ? (
                classes.data.map((item, index) => (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-panel-2 px-2.5 py-1 text-[11px] text-muted"
                  >
                    <span className="font-mono text-faint">{index}</span>
                    <span
                      className="h-2 w-2 rounded-[2px]"
                      style={{ backgroundColor: item.color }}
                    />
                    {item.name}
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-faint">还没有类别</span>
              )}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-faint">
              导出时按类别顺序生成类别索引。YOLO 写入 data.yaml 与 classes.txt，COCO 写入
              categories 数组。
            </p>
          </div>

          <div className="rounded-2xl border border-accent/20 bg-accent/5 p-5">
            <div className="flex items-center gap-2 text-xs font-medium text-accent">
              <Info size={15} />
              导出提示
            </div>
            <ul className="mt-2 list-disc space-y-1.5 pl-4 text-[11px] leading-relaxed text-muted">
              <li>预标注但未人工确认的图片也会包含在「全部有标注」范围内。</li>
              <li>AI 框与人工框都会导出，导出不区分来源。</li>
              <li>引用模式的原图若已移动，导出时会跳过并记录在 manifest.json。</li>
              <li>重名图片会自动加 ID 后缀，映射关系写在 manifest.json。</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-faint">
        <Check size={13} className="text-success" />
        当前项目：{project.data?.name ?? '加载中'} · 已确认 {formatNumber(confirmed)} 张 · 待审核{' '}
        {formatNumber(stats.data?.labeled ?? 0)} 张
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
        'rounded-2xl border p-5 text-left transition-colors',
        active
          ? 'border-accent/55 bg-accent-soft/30 ring-1 ring-accent/20'
          : 'border-border bg-panel hover:border-border-strong hover:bg-panel-2/50',
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cx(
            'flex h-10 w-10 items-center justify-center rounded-xl border',
            active
              ? 'border-accent/30 bg-accent/15 text-accent'
              : 'border-border bg-panel-2 text-muted',
          )}
        >
          {icon}
        </div>
        <div>
          <div className="text-sm font-semibold text-ink">{title}</div>
          <div className="mt-0.5 text-[11px] text-muted">{description}</div>
        </div>
        {active ? (
          <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white">
            <Check size={12} strokeWidth={3} />
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {structure.map((item) => (
          <span
            key={item}
            className="rounded-md border border-border bg-bg/60 px-1.5 py-0.5 font-mono text-[10px] text-faint"
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
          ? 'border-accent/50 bg-accent-soft/40'
          : 'border-border bg-panel hover:bg-panel-2',
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
      <div className="mt-1 pl-5.5 text-[11px] text-muted">{detail}</div>
    </button>
  )
}
