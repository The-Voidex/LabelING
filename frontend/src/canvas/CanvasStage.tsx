import type Konva from 'konva'
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

const MIN_SCALE = 0.05
const MAX_SCALE = 12

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
  const autoFitRef = useRef(true)

  const [size, setSize] = useState({ width: 0, height: 0 })
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [imageFailed, setImageFailed] = useState(false)
  const [view, setView] = useState<ViewState>({ scale: 1, x: 0, y: 0 })
  const [draft, setDraft] = useState<DraftRect | null>(null)
  const [spacePressed, setSpacePressed] = useState(false)

  const classMap = new Map(classes.map((item) => [item.id, item]))
  const activeColor = activeClassId ? classMap.get(activeClassId)?.color : undefined
  const accent = activeColor ?? '#5b8cff'

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
    const node =
      tool === 'select' && selectedKey ? nodeRefs.current.get(selectedKey) : undefined
    transformer.nodes(node ? [node] : [])
    transformer.getLayer()?.batchDraw()
  }, [selectedKey, boxes, view.scale, tool])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !isTypingTarget(event.target)) {
        event.preventDefault()
        setSpacePressed(true)
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') setSpacePressed(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
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

  const handleMouseDown = (event: Konva.KonvaEventObject<MouseEvent>) => {
    if (spacePressed) return
    const stage = stageRef.current
    if (!stage) return
    if (tool === 'draw') {
      const pointer = stage.getRelativePointerPosition()
      if (!pointer) return
      if (
        pointer.x < 0 ||
        pointer.y < 0 ||
        pointer.x > imageWidth ||
        pointer.y > imageHeight
      ) {
        return
      }
      const start = {
        x: clampToImage(pointer.x, imageWidth),
        y: clampToImage(pointer.y, imageHeight),
      }
      draftStartRef.current = start
      const rect = { x: start.x, y: start.y, width: 0, height: 0 }
      draftRectRef.current = rect
      setDraft(rect)
      onSelect(null)
      return
    }
    if (event.target === stage || event.target.name() === 'background-image') {
      onSelect(null)
    }
  }

  const handleMouseMove = () => {
    const start = draftStartRef.current
    const stage = stageRef.current
    if (!start || !stage) return
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

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-[#0b0d11]"
      style={{
        cursor: spacePressed ? 'grab' : tool === 'draw' ? 'crosshair' : 'default',
      }}
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
          draggable={spacePressed}
          onDragEnd={(event) =>
            setView((previous) => ({
              ...previous,
              x: event.target.x(),
              y: event.target.y(),
            }))
          }
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={finishDraft}
          onMouseLeave={cancelDraft}
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

            {boxes.map((box) => {
              const labelClass = classMap.get(box.class_id)
              const color = labelClass?.color ?? '#5b8cff'
              const pixels = boxToPixels(box, imageWidth, imageHeight)
              const isSelected = box.key === selectedKey
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
                  strokeWidth={isSelected ? 2.4 : 1.4}
                  strokeScaleEnabled={false}
                  dash={box.source === 'ai' ? [6, 4] : undefined}
                  fill={`${color}14`}
                  draggable={tool === 'select' && !spacePressed}
                  onMouseDown={(event) => {
                    if (tool !== 'select' || spacePressed) return
                    event.cancelBubble = true
                    onSelect(box.key)
                  }}
                  onDragEnd={(event) => handleDragEnd(box, event)}
                  onTransformEnd={(event) => handleTransformEnd(box, event)}
                />
              )
            })}

            {boxes.map((box) => {
              const labelClass = classMap.get(box.class_id)
              const color = labelClass?.color ?? '#5b8cff'
              const pixels = boxToPixels(box, imageWidth, imageHeight)
              const labelText =
                (labelClass?.name ?? `类别 ${box.class_id}`) +
                (box.source === 'ai' && box.confidence !== null
                  ? ` · AI ${Math.round(box.confidence * 100)}%`
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
                  <Tag fill="rgba(10, 12, 16, 0.78)" cornerRadius={3} />
                  <Text
                    text={labelText}
                    fontSize={11 / view.scale}
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
                fill={`${accent}1F`}
                listening={false}
              />
            ) : null}

            <Transformer
              ref={transformerRef}
              rotateEnabled={false}
              flipEnabled={false}
              borderStroke="#5b8cff"
              borderStrokeWidth={1.4 / view.scale}
              anchorStroke="#5b8cff"
              anchorFill="#0e1014"
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

      <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-lg border border-border bg-panel/90 p-1 shadow-panel backdrop-blur">
        <button
          type="button"
          aria-label="缩小"
          title="缩小"
          onClick={() => zoomBy(1 / 1.2)}
          className="rounded-md p-1.5 text-muted transition-colors hover:bg-panel-3 hover:text-ink"
        >
          <Minus size={14} />
        </button>
        <span className="w-12 text-center font-mono text-[11px] text-muted">
          {Math.round(view.scale * 100)}%
        </span>
        <button
          type="button"
          aria-label="放大"
          title="放大"
          onClick={() => zoomBy(1.2)}
          className="rounded-md p-1.5 text-muted transition-colors hover:bg-panel-3 hover:text-ink"
        >
          <Plus size={14} />
        </button>
        <div className="mx-0.5 h-4 w-px bg-border" />
        <button
          type="button"
          aria-label="适应窗口"
          title="适应窗口"
          onClick={fitToScreen}
          className="rounded-md p-1.5 text-muted transition-colors hover:bg-panel-3 hover:text-ink"
        >
          <Maximize2 size={14} />
        </button>
        <button
          type="button"
          aria-label="实际大小"
          title="实际大小（1:1）"
          onClick={actualSize}
          className="rounded-md p-1.5 text-muted transition-colors hover:bg-panel-3 hover:text-ink"
        >
          <ScanLine size={14} />
        </button>
      </div>

      {!image && !imageFailed ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
        </div>
      ) : null}

      {draft === null ? null : (
        <div className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-black/55 px-2 py-1 font-mono text-[10px] text-muted">
          {Math.round(draft.width)} × {Math.round(draft.height)} px
        </div>
      )}
    </div>
  )
}
