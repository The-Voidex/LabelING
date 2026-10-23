import type Konva from 'konva'
import type { CSSProperties, ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Image as KonvaImage,
  Label,
  Layer,
  Rect,
  Stage,
  Tag,
  Text,
  Transformer,
} from 'react-konva'
import { Maximize2, Minus, Plus, ScanLine } from 'lucide-react'
import type { LabelClass } from '../api/types.ts'
import type { BoxDraft } from '../stores/editor.ts'
import { boxToPixels, fitScale, pixelsToBox } from './geometry.ts'
import { isTypingTarget } from '../lib/dom.ts'
import { sourceLabel } from '../lib/status.ts'

interface CanvasStageProps {
  imageUrl: string
  imageWidth: number
  imageHeight: number
  boxes: BoxDraft[]
  classes: LabelClass[]
  activeClassId: number | null
  tool: 'select' | 'draw'
  selectedKey: string | null
  onCreate: (box: { x1: number; y1: number; x2: number; y2: number }) => void
  onUpdate: (
    key: string,
    patch: Partial<Pick<BoxDraft, 'x1' | 'y1' | 'x2' | 'y2'>>,
  ) => void
  onSelect: (key: string | null) => void
}

interface ViewState {
  scale: number
  x: number
  y: number
}

interface DraftRect {
  x: number
  y: number
  width: number
  height: number
}

interface HoverState {
  key: string
  x: number
  y: number
}

const MIN_SCALE = 0.05
const MAX_SCALE = 12
const FALLBACK_COLOR = '#F2B95B'

export function CanvasStage({
  imageUrl,
  imageWidth,
  imageHeight,
  boxes,
  classes,
  activeClassId,
  tool,
  selectedKey,
  onCreate,
  onUpdate,
  onSelect,
}: CanvasStageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const nodeRefs = useRef(new Map<string, Konva.Rect>())
  const draftStartRef = useRef<{ x: number; y: number } | null>(null)
  const draftRectRef = useRef<DraftRect | null>(null)
  const panRef = useRef<{
    startX: number
    startY: number
    viewX: number
    viewY: number
    background: boolean
    moved: boolean
  } | null>(null)
  const autoFitRef = useRef(true)

  const [size, setSize] = useState({ width: 0, height: 0 })
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [imageFailed, setImageFailed] = useState(false)
  const [view, setView] = useState<ViewState>({ scale: 1, x: 0, y: 0 })
  const [draft, setDraft] = useState<DraftRect | null>(null)
  const [spacePressed, setSpacePressed] = useState(false)
  const [panning, setPanning] = useState(false)
  const [hover, setHover] = useState<HoverState | null>(null)

  const classMap = new Map(classes.map((item) => [item.id, item]))
  const activeColor = activeClassId ? classMap.get(activeClassId)?.color : undefined
  const accent = activeColor ?? FALLBACK_COLOR
  const hoveredBox =
    tool === 'select' && hover
      ? boxes.find((box) => box.key === hover.key) ?? null
      : null

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const update = () => {
      setSize({ width: element.clientWidth, height: element.clientHeight })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const element = new window.Image()
    element.onload = () => setImage(element)
    element.onerror = () => setImageFailed(true)
    element.src = imageUrl
    return () => {
      element.onload = null
      element.onerror = null
    }
  }, [imageUrl])

  const fitToScreen = useCallback(() => {
    if (!image || size.width <= 0 || size.height <= 0) return
    const scale = fitScale(image, size)
    setView({
      scale,
      x: (size.width - image.width * scale) / 2,
      y: (size.height - image.height * scale) / 2,
    })
  }, [image, size])

  useEffect(() => {
    if (!image || size.width <= 0 || size.height <= 0 || !autoFitRef.current) return
    autoFitRef.current = false
    fitToScreen()
  }, [image, size, fitToScreen])

  useEffect(() => {
    const transformer = transformerRef.current
    if (!transformer) return
    const node = tool === 'draw' && selectedKey ? nodeRefs.current.get(selectedKey) : undefined
    transformer.nodes(node ? [node] : [])
    transformer.getLayer()?.batchDraw()
  }, [selectedKey, boxes, view.scale, tool])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return
      const target = event.target
      const onControl =
        target instanceof HTMLElement &&
        Boolean(target.closest('button, a, [role="button"]'))
      if (event.code === 'Space' && !onControl) {
        event.preventDefault()
        setSpacePressed(true)
      }
      if (event.key === 'Escape') {
        draftStartRef.current = null
        draftRectRef.current = null
        panRef.current = null
        setDraft(null)
        setPanning(false)
        setHover(null)
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') setSpacePressed(false)
    }
    const onBlur = () => {
      setSpacePressed(false)
      draftStartRef.current = null
      draftRectRef.current = null
      panRef.current = null
      setDraft(null)
      setPanning(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  const zoomAt = (point: { x: number; y: number }, factor: number) => {
    setView((previous) => {
      const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, previous.scale * factor))
      const mx = (point.x - previous.x) / previous.scale
      const my = (point.y - previous.y) / previous.scale
      return {
        scale,
        x: point.x - mx * scale,
        y: point.y - my * scale,
      }
    })
  }

  const zoomBy = (factor: number) => {
    zoomAt({ x: size.width / 2, y: size.height / 2 }, factor)
  }

  const actualSize = () => {
    if (!image) return
    setView({
      scale: 1,
      x: (size.width - image.width) / 2,
      y: (size.height - image.height) / 2,
    })
  }

  const handleWheel = (event: Konva.KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault()
    const stage = stageRef.current
    if (!stage) return
    const pointer = stage.getPointerPosition()
    if (!pointer) return
    zoomAt(pointer, event.evt.deltaY < 0 ? 1.12 : 1 / 1.12)
  }

  const clampToImage = (value: number, max: number) => Math.max(0, Math.min(max, value))

  const updateHover = (box: BoxDraft, event: Konva.KonvaEventObject<MouseEvent>) => {
    if (tool !== 'select' || spacePressed || panRef.current) return
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    setHover({
      key: box.key,
      x: event.evt.clientX - rect.left,
      y: event.evt.clientY - rect.top,
    })
  }

  const handleMouseDown = (event: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current
    if (!stage) return
    const pointer = stage.getPointerPosition()
    if (!pointer) return
    const background =
      event.target === stage || event.target.name() === 'background-image'
    const wantsPan =
      spacePressed ||
      event.evt.button === 1 ||
      (tool === 'select' && background)

    if (wantsPan) {
      event.evt.preventDefault()
      panRef.current = {
        startX: pointer.x,
        startY: pointer.y,
        viewX: view.x,
        viewY: view.y,
        background,
        moved: false,
      }
      setPanning(true)
      setHover(null)
      return
    }

    if (tool === 'draw') {
      const relative = stage.getRelativePointerPosition()
      if (!relative) return
      if (
        relative.x < 0 ||
        relative.y < 0 ||
        relative.x > imageWidth ||
        relative.y > imageHeight
      ) {
        return
      }
      const start = {
        x: clampToImage(relative.x, imageWidth),
        y: clampToImage(relative.y, imageHeight),
      }
      draftStartRef.current = start
      const rect = { x: start.x, y: start.y, width: 0, height: 0 }
      draftRectRef.current = rect
      setDraft(rect)
      setHover(null)
      onSelect(null)
      return
    }

    if (background) onSelect(null)
  }

  const handleMouseMove = () => {
    const stage = stageRef.current
    if (!stage) return
    const pan = panRef.current
    if (pan) {
      const pointer = stage.getPointerPosition()
      if (!pointer) return
      const dx = pointer.x - pan.startX
      const dy = pointer.y - pan.startY
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) pan.moved = true
      setView((previous) => ({
        ...previous,
        x: pan.viewX + dx,
        y: pan.viewY + dy,
      }))
      return
    }

    const start = draftStartRef.current
    if (!start) return
    const pointer = stage.getRelativePointerPosition()
    if (!pointer) return
    const currentX = clampToImage(pointer.x, imageWidth)
    const currentY = clampToImage(pointer.y, imageHeight)
    const rect = {
      x: Math.min(start.x, currentX),
      y: Math.min(start.y, currentY),
      width: Math.abs(currentX - start.x),
      height: Math.abs(currentY - start.y),
    }
    draftRectRef.current = rect
    setDraft(rect)
  }

  const finishDraft = () => {
    const rect = draftRectRef.current
    draftStartRef.current = null
    draftRectRef.current = null
    setDraft(null)
    if (!rect || rect.width < 3 || rect.height < 3) return
    onCreate(pixelsToBox(rect.x, rect.y, rect.width, rect.height, imageWidth, imageHeight))
  }

  const cancelDraft = () => {
    draftStartRef.current = null
    draftRectRef.current = null
    setDraft(null)
  }

  const handleMouseUp = () => {
    const pan = panRef.current
    if (pan) {
      panRef.current = null
      setPanning(false)
      if (!pan.moved && pan.background && tool === 'select') onSelect(null)
      return
    }
    finishDraft()
  }

  const handleMouseLeave = () => {
    if (panRef.current) {
      panRef.current = null
      setPanning(false)
    }
    cancelDraft()
    setHover(null)
  }

  const handleDragEnd = (box: BoxDraft, event: Konva.KonvaEventObject<DragEvent>) => {
    const node = event.target as Konva.Rect
    const x = clampToImage(node.x(), imageWidth - node.width())
    const y = clampToImage(node.y(), imageHeight - node.height())
    node.position({ x, y })
    onUpdate(box.key, pixelsToBox(x, y, node.width(), node.height(), imageWidth, imageHeight))
  }

  const handleTransformEnd = (
    box: BoxDraft,
    event: Konva.KonvaEventObject<Event>,
  ) => {
    const node = event.target as Konva.Rect
    const width = Math.max(3, node.width() * node.scaleX())
    const height = Math.max(3, node.height() * node.scaleY())
    const x = clampToImage(node.x(), imageWidth - width)
    const y = clampToImage(node.y(), imageHeight - height)
    node.scaleX(1)
    node.scaleY(1)
    node.width(width)
    node.height(height)
    node.position({ x, y })
    onUpdate(box.key, pixelsToBox(x, y, width, height, imageWidth, imageHeight))
  }

  const cursor = spacePressed
    ? panning
      ? 'grabbing'
      : 'grab'
    : tool === 'draw'
      ? 'crosshair'
      : hoveredBox
        ? 'pointer'
        : panning
          ? 'grabbing'
          : 'grab'

  const tooltipStyle = (() => {
    if (!hover) return undefined
    const width = 214
    const height = 104
    return {
      left: Math.max(10, Math.min(hover.x + 18, size.width - width - 10)),
      top: Math.max(10, Math.min(hover.y + 18, size.height - height - 10)),
    }
  })()

  return (
    <div
      ref={containerRef}
      className="canvas-grid relative h-full w-full overflow-hidden"
      style={{ cursor }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {size.width > 0 && size.height > 0 ? (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          scaleX={view.scale}
          scaleY={view.scale}
          x={view.x}
          y={view.y}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onDblClick={(event) => {
            const background =
              event.target === stageRef.current ||
              event.target.name() === 'background-image'
            if (background && tool === 'select') fitToScreen()
          }}
        >
          <Layer>
            {image ? (
              <KonvaImage
                image={image}
                name="background-image"
                width={imageWidth}
                height={imageHeight}
              />
            ) : null}
            <Rect
              x={-0.75}
              y={-0.75}
              width={imageWidth + 1.5}
              height={imageHeight + 1.5}
              stroke="rgba(255,246,226,0.15)"
              strokeWidth={1.5}
              listening={false}
            />

            {boxes.map((box) => {
              const labelClass = classMap.get(box.class_id)
              const color = labelClass?.color ?? FALLBACK_COLOR
              const pixels = boxToPixels(box, imageWidth, imageHeight)
              const isSelected = box.key === selectedKey
              const isHovered = box.key === hover?.key
              return (
                <Rect
                  key={box.key}
                  ref={(node) => {
                    if (node) nodeRefs.current.set(box.key, node)
                    else nodeRefs.current.delete(box.key)
                  }}
                  x={pixels.x}
                  y={pixels.y}
                  width={pixels.width}
                  height={pixels.height}
                  stroke={color}
                  strokeWidth={isSelected ? 2.4 : isHovered ? 2.2 : 1.35}
                  strokeScaleEnabled={false}
                  dash={box.source === 'ai' ? [6, 4] : undefined}
                  fill={isHovered ? `${color}24` : `${color}12`}
                  draggable={tool === 'draw' && !spacePressed}
                  onMouseDown={(event) => {
                    if (spacePressed || event.evt.button === 1) return
                    event.cancelBubble = true
                    onSelect(box.key)
                  }}
                  onMouseMove={(event) => updateHover(box, event)}
                  onMouseEnter={(event) => updateHover(box, event)}
                  onMouseLeave={() => {
                    setHover((current) => (current?.key === box.key ? null : current))
                  }}
                  onDragEnd={(event) => handleDragEnd(box, event)}
                  onTransformEnd={(event) => handleTransformEnd(box, event)}
                />
              )
            })}

            {boxes.map((box) => {
              const labelClass = classMap.get(box.class_id)
              const color = labelClass?.color ?? FALLBACK_COLOR
              const pixels = boxToPixels(box, imageWidth, imageHeight)
              const labelText =
                (labelClass?.name ?? `类别 ${box.class_id}`) +
                (box.source === 'ai' && box.confidence !== null
                  ? ` · 模型 ${Math.round(box.confidence * 100)}%`
                  : '')
              const labelY =
                pixels.y > 18 / view.scale
                  ? pixels.y - 18 / view.scale
                  : pixels.y + 2 / view.scale
              return (
                <Label
                  key={`label-${box.key}`}
                  x={pixels.x}
                  y={labelY}
                  listening={false}
                  opacity={0.95}
                >
                  <Tag fill="rgba(18, 16, 13, 0.82)" cornerRadius={3} />
                  <Text
                    text={labelText}
                    fontSize={10.5 / view.scale}
                    padding={3}
                    fill={color}
                    fontFamily="Microsoft YaHei, sans-serif"
                  />
                </Label>
              )
            })}

            {draft ? (
              <Rect
                x={draft.x}
                y={draft.y}
                width={draft.width}
                height={draft.height}
                stroke={accent}
                strokeWidth={1.5}
                strokeScaleEnabled={false}
                dash={[5, 4]}
                fill={`${accent}26`}
                listening={false}
              />
            ) : null}

            <Transformer
              ref={transformerRef}
              rotateEnabled={false}
              flipEnabled={false}
              borderStroke={FALLBACK_COLOR}
              borderStrokeWidth={1.4 / view.scale}
              anchorStroke={FALLBACK_COLOR}
              anchorFill="#1E1B18"
              anchorSize={8 / view.scale}
              anchorCornerRadius={2 / view.scale}
              enabledAnchors={[
                'top-left',
                'top-center',
                'top-right',
                'middle-right',
                'bottom-right',
                'bottom-center',
                'bottom-left',
                'middle-left',
              ]}
              boundBoxFunc={(oldBox, newBox) =>
                newBox.width < 4 || newBox.height < 4 ? oldBox : newBox
              }
            />
          </Layer>
        </Stage>
      ) : null}

      {imageFailed ? (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-danger">
          图片加载失败，请检查文件是否仍然存在。
        </div>
      ) : null}

      {hoveredBox && tooltipStyle ? (
        <HoverCard
          box={hoveredBox}
          labelClass={classMap.get(hoveredBox.class_id)}
          imageWidth={imageWidth}
          imageHeight={imageHeight}
          style={tooltipStyle}
        />
      ) : null}

      <div className="pointer-events-none absolute bottom-4 left-1/2 hidden -translate-x-1/2 md:block">
        <div className="rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-[10px] tracking-wide text-white/45 backdrop-blur-md">
          {tool === 'draw'
            ? '拖拽空白处画框 · 拖动框调整 · Q 切换浏览'
            : '拖拽平移 · 悬停查看框信息 · W 切换标注'}
        </div>
      </div>

      <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-xl border border-white/10 bg-black/45 p-1 shadow-float backdrop-blur-md">
        <ToolbarIcon label="缩小" onClick={() => zoomBy(1 / 1.2)}>
          <Minus size={14} />
        </ToolbarIcon>
        <span className="w-11 text-center font-mono text-[11px] text-white/55">
          {Math.round(view.scale * 100)}%
        </span>
        <ToolbarIcon label="放大" onClick={() => zoomBy(1.2)}>
          <Plus size={14} />
        </ToolbarIcon>
        <div className="mx-0.5 h-4 w-px bg-white/10" />
        <ToolbarIcon label="适应窗口" onClick={fitToScreen}>
          <Maximize2 size={14} />
        </ToolbarIcon>
        <ToolbarIcon label="实际大小" onClick={actualSize}>
          <ScanLine size={14} />
        </ToolbarIcon>
      </div>

      {draft ? (
        <div className="pointer-events-none absolute bottom-3 right-3 rounded-lg border border-white/10 bg-black/55 px-2.5 py-1.5 font-mono text-[10px] text-white/60 backdrop-blur">
          {Math.round(draft.width)} × {Math.round(draft.height)} 像素
        </div>
      ) : null}

      {!image && !imageFailed ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/15 border-t-[#F2B95B]" />
        </div>
      ) : null}
    </div>
  )
}

function ToolbarIcon({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="rounded-md p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white/90"
    >
      {children}
    </button>
  )
}

function HoverCard({
  box,
  labelClass,
  imageWidth,
  imageHeight,
  style,
}: {
  box: BoxDraft
  labelClass: LabelClass | undefined
  imageWidth: number
  imageHeight: number
  style: CSSProperties
}) {
  const color = labelClass?.color ?? FALLBACK_COLOR
  const width = Math.round((box.x2 - box.x1) * imageWidth)
  const height = Math.round((box.y2 - box.y1) * imageHeight)
  return (
    <div
      className="pointer-events-none absolute z-20 w-[214px] rounded-xl border border-white/10 bg-[#1B1815]/95 px-3 py-2.5 shadow-float backdrop-blur-md"
      style={style}
    >
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: color }} />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-white/90">
          {labelClass?.name ?? `类别 ${box.class_id}`}
        </span>
        <span
          className={
            box.source === 'ai'
              ? 'shrink-0 rounded bg-[#E8A33C]/15 px-1.5 py-0.5 text-[9px] text-[#F2C56B]'
              : 'shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[9px] text-white/55'
          }
        >
          {sourceLabel(box.source)}
        </span>
      </div>
      {box.confidence !== null ? (
        <div className="mt-2 flex items-center justify-between text-[10px] text-white/40">
          <span>置信度</span>
          <span className="font-mono text-white/75">
            {Math.round(box.confidence * 100)}%
          </span>
        </div>
      ) : null}
      <div className="mt-1 flex items-center justify-between text-[10px] text-white/40">
        <span>框尺寸</span>
        <span className="font-mono text-white/70">
          {width} × {height} 像素
        </span>
      </div>
      <div className="mt-2 border-t border-white/8 pt-1.5 text-[9px] text-white/30">
        单击选中，按 W 可移动或缩放
      </div>
    </div>
  )
}
