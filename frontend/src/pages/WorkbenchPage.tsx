import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  ImageOff,
  Loader2,
  MousePointer2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Redo2,
  Sparkles,
  SquareDashed,
  Undo2,
} from 'lucide-react'
import {
  useAnnotations,
  useConfirmImage,
  useSaveAnnotations,
  useUnconfirmImage,
} from '../api/annotations.ts'
import { useClasses } from '../api/classes.ts'
import {
  useImage,
  useImageNav,
  useRelocateImage,
} from '../api/images.ts'
import { useProject } from '../api/projects.ts'
import type { AnnotationInput } from '../api/annotations.ts'
import type { ImageNavItem, ImageStatus } from '../api/types.ts'
import { AnnotationPanel } from '../components/AnnotationPanel.tsx'
import { BrandMark } from '../components/BrandMark.tsx'
import { PrelabelDialog } from '../components/PrelabelDialog.tsx'
import { StatusBadge } from '../components/StatusBadge.tsx'
import { ThumbnailRail } from '../components/ThumbnailRail.tsx'
import {
  Button,
  Dialog,
  Field,
  Input,
  Kbd,
} from '../components/ui.tsx'
import { CanvasStage } from '../canvas/CanvasStage.tsx'
import { useEditor } from '../stores/editor.ts'
import { useToast } from '../stores/toast.ts'
import { isTypingTarget } from '../lib/dom.ts'
import { cx } from '../lib/cx.ts'

const SHORTCUT_GROUPS: Array<{
  title: string
  items: Array<[string, string]>
}> = [
  {
    title: '工具',
    items: [
      ['Q', '浏览模式，悬停查看框信息'],
      ['W', '框选模式，拖拽画框、移动和缩放'],
      ['Esc', '取消选中或正在绘制的框'],
    ],
  },
  {
    title: '编辑',
    items: [
      ['1 – 9', '切换当前类别'],
      ['Delete', '删除选中的框'],
      ['Ctrl + Z', '撤销'],
      ['Ctrl + Shift + Z', '重做'],
      ['Ctrl + Y', '重做'],
    ],
  },
  {
    title: '图片',
    items: [
      ['← / →', '上一张 / 下一张图片'],
      ['空格 + 拖拽', '平移画布'],
      ['滚轮', '以鼠标位置为中心缩放'],
      ['?', '打开快捷键说明'],
    ],
  },
  {
    title: '保存与审核',
    items: [
      ['Ctrl + S', '立即保存'],
      ['Ctrl + Enter', '确认当前图片'],
    ],
  },
]

export function WorkbenchPage() {
  const params = useParams()
  const projectId = Number(params.projectId)
  const imageId = Number(params.imageId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()

  const projectQuery = useProject(projectId)
  const classesQuery = useClasses(projectId)
  const navQuery = useImageNav(projectId)
  const imageQuery = useImage(imageId)
  const annotationsQuery = useAnnotations(imageId)
  const saveMutation = useSaveAnnotations(imageId)
  const confirmMutation = useConfirmImage(projectId)
  const unconfirmMutation = useUnconfirmImage(projectId)
  const relocateMutation = useRelocateImage(projectId)

  const boxes = useEditor((state) => state.boxes)
  const selectedKey = useEditor((state) => state.selectedKey)
  const activeClassId = useEditor((state) => state.activeClassId)
  const tool = useEditor((state) => state.tool)
  const dirty = useEditor((state) => state.dirty)
  const saveState = useEditor((state) => state.saveState)
  const revision = useEditor((state) => state.revision)
  const canUndo = useEditor((state) => state.past.length > 0)
  const canRedo = useEditor((state) => state.future.length > 0)
  const initEditor = useEditor((state) => state.init)
  const setTool = useEditor((state) => state.setTool)
  const setActiveClassId = useEditor((state) => state.setActiveClassId)
  const selectBox = useEditor((state) => state.select)
  const addBox = useEditor((state) => state.addBox)
  const updateBox = useEditor((state) => state.updateBox)
  const removeBox = useEditor((state) => state.removeBox)
  const undo = useEditor((state) => state.undo)
  const redo = useEditor((state) => state.redo)
  const markError = useEditor((state) => state.markError)
  const applyServer = useEditor((state) => state.applyServer)

  const [prelabelOpen, setPrelabelOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [relocateOpen, setRelocateOpen] = useState(false)
  const [relocatePath, setRelocatePath] = useState('')
  const [railOpen, setRailOpen] = useState(true)
  const [inspectorOpen, setInspectorOpen] = useState(true)

  const initRef = useRef<number | null>(null)
  const imageIdRef = useRef(imageId)

  useEffect(() => {
    imageIdRef.current = imageId
  }, [imageId])

  useEffect(() => {
    initRef.current = null
    useEditor.getState().init([], null)
  }, [imageId])

  useEffect(() => {
    if (!annotationsQuery.data || !classesQuery.data || !imageQuery.data) return
    if (initRef.current === imageId) return
    const current = useEditor.getState().activeClassId
    const valid = classesQuery.data.some((item) => item.id === current)
      ? current
      : (classesQuery.data[0]?.id ?? null)
    initEditor(annotationsQuery.data, valid)
    initRef.current = imageId
  }, [
    annotationsQuery.data,
    classesQuery.data,
    imageQuery.data,
    imageId,
    initEditor,
  ])

  useEffect(() => {
    if (!classesQuery.data) return
    const current = useEditor.getState().activeClassId
    if (current && classesQuery.data.some((item) => item.id === current)) return
    if (classesQuery.data[0]) {
      useEditor.getState().setActiveClassId(classesQuery.data[0].id)
    }
  }, [classesQuery.data])

  const savingRef = useRef(false)
  const pendingRef = useRef<Promise<boolean> | null>(null)
  const saveNowRef = useRef<() => Promise<boolean>>(async () => true)

  const saveNow = useCallback(async (): Promise<boolean> => {
    if (savingRef.current && pendingRef.current) return pendingRef.current
    const state = useEditor.getState()
    if (!state.dirty) return true
    savingRef.current = true
    state.markSaving()
    const capturedRevision = state.revision
    const capturedImageId = imageId
    const payload: AnnotationInput[] = state.boxes.map((box) => ({
      id: box.id,
      class_id: box.class_id,
      x1: box.x1,
      y1: box.y1,
      x2: box.x2,
      y2: box.y2,
      confidence: box.confidence,
    }))
    const task = saveMutation
      .mutateAsync(payload)
      .then((saved) => {
        if (imageIdRef.current !== capturedImageId) return true
        const applied = applyServer(saved, capturedRevision)
        void queryClient.invalidateQueries({ queryKey: ['image', capturedImageId] })
        void queryClient.invalidateQueries({ queryKey: ['images', projectId] })
        void queryClient.invalidateQueries({ queryKey: ['project-stats', projectId] })
        void queryClient.invalidateQueries({ queryKey: ['classes', projectId] })
        queryClient.setQueryData<ImageNavItem[]>(
          ['image-nav', projectId],
          (items) =>
            items?.map((item) =>
              item.id === capturedImageId
                ? {
                    ...item,
                    status: saved.length > 0 ? 'labeled' : 'unlabeled',
                  }
                : item,
            ),
        )
        if (!applied) {
          window.setTimeout(() => {
            void saveNowRef.current()
          }, 150)
        }
        return true
      })
      .catch((error: Error) => {
        if (imageIdRef.current === capturedImageId) {
          toast(error.message || '保存失败', 'error')
          markError()
        }
        return false
      })
      .finally(() => {
        savingRef.current = false
        pendingRef.current = null
      })
    pendingRef.current = task
    return task
  }, [
    applyServer,
    imageId,
    markError,
    projectId,
    queryClient,
    saveMutation,
    toast,
  ])

  useEffect(() => {
    saveNowRef.current = saveNow
  }, [saveNow])

  useEffect(() => {
    if (!dirty) return
    const timer = window.setTimeout(() => {
      void saveNowRef.current()
    }, 500)
    return () => window.clearTimeout(timer)
  }, [dirty, revision])

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (useEditor.getState().dirty) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  const navItems = navQuery.data ?? []
  const currentIndex = navItems.findIndex((item) => item.id === imageId)
  const prevItem = currentIndex > 0 ? navItems[currentIndex - 1] : null
  const nextItem =
    currentIndex >= 0 && currentIndex < navItems.length - 1
      ? navItems[currentIndex + 1]
      : null

  const goTo = useCallback(
    async (targetId: number | null | undefined) => {
      if (!targetId || targetId === imageId) return
      const ok = await saveNowRef.current()
      if (!ok) return
      navigate(`/projects/${projectId}/annotate/${targetId}`)
    },
    [imageId, navigate, projectId],
  )

  const goBack = useCallback(async () => {
    const ok = await saveNowRef.current()
    if (!ok) return
    navigate(`/projects/${projectId}`)
  }, [navigate, projectId])

  const refreshLists = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['image-nav', projectId] })
    void queryClient.invalidateQueries({ queryKey: ['images', projectId] })
    void queryClient.invalidateQueries({ queryKey: ['project-stats', projectId] })
    void queryClient.invalidateQueries({ queryKey: ['classes', projectId] })
  }, [projectId, queryClient])

  const handleConfirm = useCallback(async () => {
    const image = imageQuery.data
    if (!image) return
    if (image.missing) {
      toast('图片文件缺失，无法确认', 'error')
      return
    }
    const ok = await saveNowRef.current()
    if (!ok) return
    if (image.status === 'confirmed') {
      unconfirmMutation.mutate(imageId, {
        onSuccess: async () => {
          await imageQuery.refetch()
          refreshLists()
          toast('已撤销确认', 'success')
        },
        onError: (error) => toast(error.message, 'error'),
      })
      return
    }
    if (useEditor.getState().boxes.length === 0) {
      toast('当前图片没有标注，无法确认', 'error')
      return
    }
    confirmMutation.mutate(imageId, {
      onSuccess: async () => {
        useEditor.setState((state) => ({
          boxes: state.boxes.map((box) => ({ ...box, source: 'human' as const })),
        }))
        await imageQuery.refetch()
        refreshLists()
        toast('已确认这张图片', 'success')
      },
      onError: (error) => toast(error.message, 'error'),
    })
  }, [
    confirmMutation,
    imageId,
    imageQuery,
    refreshLists,
    toast,
    unconfirmMutation,
  ])

  const openPrelabel = async () => {
    if (!projectQuery.data?.model_config_id) {
      toast('请先在项目设置中选择模型', 'error')
      return
    }
    if (!classesQuery.data || classesQuery.data.length === 0) {
      toast('请先添加类别与提示词', 'error')
      return
    }
    const ok = await saveNowRef.current()
    if (!ok) return
    setPrelabelOpen(true)
  }

  const handlePrelabelComplete = async () => {
    refreshLists()
    const result = await annotationsQuery.refetch()
    await imageQuery.refetch()
    if (result.data) {
      const current = useEditor.getState().activeClassId
      const valid = classesQuery.data?.some((item) => item.id === current)
        ? current
        : (classesQuery.data?.[0]?.id ?? null)
      initRef.current = imageId
      initEditor(result.data, valid)
    }
  }

  const keyHandlerRef = useRef<(event: KeyboardEvent) => void>(() => {})
  const keyHandler = (event: KeyboardEvent) => {
    if (event.defaultPrevented) return
    if (isTypingTarget(event.target)) return
    if (document.querySelector('[role="dialog"]')) return

    const modifier = event.ctrlKey || event.metaKey
    if (modifier) {
      const key = event.key.toLowerCase()
      if (key === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        return
      }
      if (key === 'y') {
        event.preventDefault()
        redo()
        return
      }
      if (key === 's') {
        event.preventDefault()
        void saveNowRef.current()
        return
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        void handleConfirm()
      }
      return
    }

    if (event.key === '?') {
      event.preventDefault()
      setHelpOpen(true)
      return
    }
    if (event.key === 'q' || event.key === 'Q') {
      setTool('select')
      return
    }
    if (event.key === 'w' || event.key === 'W') {
      if (!classesQuery.data || classesQuery.data.length === 0) {
        toast('请先添加类别', 'error')
        return
      }
      setTool('draw')
      return
    }
    if (event.key === 'Escape') {
      selectBox(null)
      return
    }
    if (/^[1-9]$/.test(event.key)) {
      const target = classesQuery.data?.[Number(event.key) - 1]
      if (target) setActiveClassId(target.id)
      return
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      void goTo(prevItem?.id)
      return
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      void goTo(nextItem?.id)
      return
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (selectedKey) {
        event.preventDefault()
        removeBox(selectedKey)
      }
    }
  }

  useEffect(() => {
    keyHandlerRef.current = keyHandler
  })

  useEffect(() => {
    const listener = (event: KeyboardEvent) => keyHandlerRef.current(event)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  const handleCreate = (rect: { x1: number; y1: number; x2: number; y2: number }) => {
    const state = useEditor.getState()
    const classList = classesQuery.data ?? []
    const classId = state.activeClassId ?? classList[0]?.id
    if (!classId) {
      toast('请先选择或添加类别', 'error')
      return
    }
    if (!state.activeClassId) state.setActiveClassId(classId)
    addBox({ class_id: classId, ...rect })
  }

  if (projectQuery.isLoading || imageQuery.isLoading || navQuery.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <Loader2 size={22} className="animate-spin text-accent" />
      </div>
    )
  }

  if (imageQuery.isError || !imageQuery.data) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-bg text-center">
        <BrandMark className="h-12 w-12" />
        <div className="text-sm font-medium text-ink">图片加载失败</div>
        <div className="max-w-md text-xs text-muted">
          {imageQuery.error?.message ?? '图片不存在或已被删除'}
        </div>
        <Button onClick={() => navigate(`/projects/${projectId}`)}>返回数据集</Button>
      </div>
    )
  }

  const image = imageQuery.data
  const project = projectQuery.data
  const classes = classesQuery.data ?? []
  const isConfirmed = image.status === 'confirmed'
  const confirmBusy = confirmMutation.isPending || unconfirmMutation.isPending
  const imageUrl = `${image.file_url}?v=${image.sha256.slice(0, 12)}`
  const activeClass = classes.find((item) => item.id === activeClassId)

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-panel/80 px-3 backdrop-blur-xl sm:px-4">
        <button
          type="button"
          onClick={() => void goBack()}
          aria-label="返回数据集"
          title="返回数据集"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-panel text-muted transition-colors hover:border-border-strong hover:text-ink"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] text-faint">
            <span className="max-w-[160px] truncate">{project?.name ?? '项目'}</span>
            <span>/</span>
            <span>标注台</span>
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="max-w-[34vw] truncate text-[13px] font-medium text-ink">
              {image.file_name}
            </span>
            <StatusBadge status={image.status as ImageStatus} missing={image.missing} />
            <SaveIndicator
              state={saveState}
              dirty={dirty}
              onRetry={() => void saveNowRef.current()}
            />
          </div>
        </div>

        <div className="ml-2 hidden items-center gap-0.5 lg:flex">
          <button
            type="button"
            aria-label={railOpen ? '收起图片列表' : '展开图片列表'}
            title={railOpen ? '收起图片列表' : '展开图片列表'}
            onClick={() => setRailOpen((value) => !value)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition-colors hover:bg-panel-2 hover:text-ink"
          >
            {railOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </button>
          <button
            type="button"
            aria-label={inspectorOpen ? '收起标注面板' : '展开标注面板'}
            title={inspectorOpen ? '收起标注面板' : '展开标注面板'}
            onClick={() => setInspectorOpen((value) => !value)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition-colors hover:bg-panel-2 hover:text-ink"
          >
            {inspectorOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
          </button>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <div className="hidden items-center gap-0.5 rounded-xl border border-border bg-panel p-1 md:flex">
            <HeaderIcon label="撤销（Ctrl+Z）" disabled={!canUndo} onClick={undo}>
              <Undo2 size={15} />
            </HeaderIcon>
            <HeaderIcon label="重做（Ctrl+Shift+Z）" disabled={!canRedo} onClick={redo}>
              <Redo2 size={15} />
            </HeaderIcon>
            <span className="mx-0.5 h-4 w-px bg-border" />
            <HeaderIcon
              label="上一张（←）"
              disabled={!prevItem}
              onClick={() => void goTo(prevItem?.id)}
            >
              <ChevronLeft size={16} />
            </HeaderIcon>
            <span className="min-w-12 text-center font-mono text-[10px] text-faint">
              {currentIndex >= 0 ? currentIndex + 1 : '-'} / {navItems.length}
            </span>
            <HeaderIcon
              label="下一张（→）"
              disabled={!nextItem}
              onClick={() => void goTo(nextItem?.id)}
            >
              <ChevronRight size={16} />
            </HeaderIcon>
          </div>

          <Button
            size="sm"
            variant="secondary"
            className="hidden sm:inline-flex"
            disabled={image.missing}
            onClick={() => void openPrelabel()}
          >
            <Sparkles size={14} className="text-accent" />
            预标注
          </Button>
          <Button
            size="sm"
            variant={isConfirmed ? 'secondary' : 'primary'}
            loading={confirmBusy}
            disabled={image.missing || (!isConfirmed && boxes.length === 0)}
            onClick={() => void handleConfirm()}
          >
            {isConfirmed ? <Undo2 size={14} /> : <CheckCheck size={14} />}
            {isConfirmed ? '撤销确认' : '确认标注'}
          </Button>
          <span className="mx-0.5 hidden h-4 w-px bg-border sm:block" />
          <button
            type="button"
            aria-label="快捷键说明"
            title="快捷键说明（?）"
            onClick={() => setHelpOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-panel-2 hover:text-ink"
          >
            <HelpCircle size={16} />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {railOpen ? (
          <ThumbnailRail
            items={navItems}
            currentId={imageId}
            onGo={(targetId) => void goTo(targetId)}
          />
        ) : null}

        <div className="relative min-w-0 flex-1">
          {image.missing ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 bg-bg px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-panel text-faint shadow-card">
                <ImageOff size={28} />
              </div>
              <div className="text-sm font-medium text-ink">图片文件缺失</div>
              <p className="max-w-md break-all text-xs leading-relaxed text-muted">
                找不到文件：{image.original_path}
                <br />
                原文件可能被移动或删除。可以重新定位到新路径，或返回数据集删除这条记录。
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setRelocatePath(image.original_path)
                    setRelocateOpen(true)
                  }}
                >
                  重新定位
                </Button>
                <Button variant="ghost" onClick={() => void goBack()}>
                  返回数据集
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-xl border border-white/10 bg-[#1B1815]/90 p-1.5 shadow-float backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => setTool('select')}
                  title="浏览模式（Q）：悬停查看框信息"
                  className={cx(
                    'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors',
                    tool === 'select'
                      ? 'bg-[#F2B95B] text-[#231F19]'
                      : 'text-white/55 hover:bg-white/8 hover:text-white/90',
                  )}
                >
                  <MousePointer2 size={13} />
                  浏览
                  <span
                    className={cx(
                      'rounded border px-1 py-px font-mono text-[9px]',
                      tool === 'select'
                        ? 'border-black/15 text-black/45'
                        : 'border-white/15 text-white/40',
                    )}
                  >
                    Q
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (classes.length === 0) {
                      toast('请先添加类别', 'error')
                      return
                    }
                    setTool('draw')
                  }}
                  title="框选模式（W）：拖拽画框、移动和缩放"
                  className={cx(
                    'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors',
                    tool === 'draw'
                      ? 'bg-[#F2B95B] text-[#231F19]'
                      : 'text-white/55 hover:bg-white/8 hover:text-white/90',
                  )}
                >
                  <SquareDashed size={13} />
                  框选
                  <span
                    className={cx(
                      'rounded border px-1 py-px font-mono text-[9px]',
                      tool === 'draw'
                        ? 'border-black/15 text-black/45'
                        : 'border-white/15 text-white/40',
                    )}
                  >
                    W
                  </span>
                </button>
                <div className="mx-0.5 h-4 w-px bg-white/10" />
                <ActiveClassChip
                  classes={classes}
                  activeClassId={activeClassId}
                  onClick={() => {
                    if (classes.length === 0) return
                    const index = classes.findIndex((item) => item.id === activeClassId)
                    const next = classes[(index + 1) % classes.length]
                    setActiveClassId(next.id)
                  }}
                />
              </div>

              <div className="pointer-events-none absolute right-3 top-3 z-10 hidden items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-[10px] text-white/40 backdrop-blur-md sm:flex">
                <span className="font-mono text-white/65">{boxes.length}</span> 个标注框
                {classes.length > 0 ? (
                  <>
                    <span className="h-3 w-px bg-white/10" />
                    当前类别
                    <span className="inline-flex items-center gap-1 text-white/70">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: activeClass?.color ?? '#F2B95B' }}
                      />
                      {activeClass?.name ?? '未选择'}
                    </span>
                  </>
                ) : null}
              </div>

              {classes.length === 0 ? (
                <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-xl border border-[#8A5A11]/20 bg-[#FDF6E8]/95 px-4 py-2 text-xs text-[#8A5A11] shadow-float backdrop-blur">
                  还没有类别，
                  <button
                    type="button"
                    className="font-medium underline underline-offset-2"
                    onClick={() => navigate(`/projects/${projectId}/classes`)}
                  >
                    去添加类别
                  </button>
                  后才能画框。
                </div>
              ) : null}

              {annotationsQuery.isLoading ? (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/35 backdrop-blur-[1px]">
                  <Loader2 size={22} className="animate-spin text-[#F2B95B]" />
                </div>
              ) : null}

              {annotationsQuery.isError ? (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-[#151311]/85 px-6 text-center backdrop-blur-sm">
                  <div className="text-sm text-[#F2B95B]">标注加载失败</div>
                  <div className="max-w-md text-xs text-white/55">
                    {annotationsQuery.error.message}
                  </div>
                  <Button size="sm" onClick={() => void annotationsQuery.refetch()}>
                    重新加载
                  </Button>
                </div>
              ) : null}

              <CanvasStage
                key={image.sha256}
                imageUrl={imageUrl}
                imageWidth={image.width}
                imageHeight={image.height}
                boxes={boxes}
                classes={classes}
                activeClassId={activeClassId}
                tool={tool}
                selectedKey={selectedKey}
                onCreate={handleCreate}
                onUpdate={updateBox}
                onSelect={selectBox}
              />
            </>
          )}
        </div>

        {inspectorOpen ? (
          <AnnotationPanel
            classes={classes}
            classesHref={`/projects/${projectId}/classes`}
            activeClassId={activeClassId}
            boxes={boxes}
            selectedKey={selectedKey}
            imageWidth={image.width}
            imageHeight={image.height}
            onSelectClass={setActiveClassId}
            onSelectBox={(key) => {
              selectBox(key)
              if (key) {
                const box = boxes.find((item) => item.key === key)
                if (box) setActiveClassId(box.class_id)
              }
            }}
            onUpdateBox={updateBox}
            onRemoveBox={removeBox}
          />
        ) : null}
      </div>

      <PrelabelDialog
        open={prelabelOpen}
        projectId={projectId}
        imageIds={[imageId]}
        classes={classes}
        modelName={project?.model_name ?? null}
        onClose={() => setPrelabelOpen(false)}
        onComplete={() => void handlePrelabelComplete()}
      />

      <Dialog
        open={helpOpen}
        title="快捷键与操作"
        description="标注台采用浏览与框选两种模式。按 Esc 可以随时取消当前操作。"
        width="max-w-2xl"
        onClose={() => setHelpOpen(false)}
        footer={<Button onClick={() => setHelpOpen(false)}>知道了</Button>}
      >
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="mb-2.5 text-[10px] font-medium tracking-[0.12em] text-faint">
                {group.title}
              </div>
              <div className="flex flex-col gap-2">
                {group.items.map(([key, description]) => (
                  <div key={key} className="flex items-start gap-3">
                    <Kbd className="mt-px shrink-0">{key}</Kbd>
                    <span className="text-xs leading-relaxed text-muted">{description}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Dialog>

      <Dialog
        open={relocateOpen}
        title="重新定位图片"
        description="填写图片现在的完整路径，保存后会更新记录并恢复显示。"
        onClose={() => setRelocateOpen(false)}
        footer={
          <>
            <Button onClick={() => setRelocateOpen(false)}>取消</Button>
            <Button
              variant="primary"
              loading={relocateMutation.isPending}
              onClick={() => {
                if (!relocatePath.trim()) {
                  toast('请填写文件路径', 'error')
                  return
                }
                relocateMutation.mutate(
                  { imageId, path: relocatePath.trim() },
                  {
                    onSuccess: async () => {
                      await imageQuery.refetch()
                      await annotationsQuery.refetch()
                      setRelocateOpen(false)
                      toast('图片已重新定位', 'success')
                    },
                    onError: (error) => toast(error.message, 'error'),
                  },
                )
              }}
            >
              保存定位
            </Button>
          </>
        }
      >
        <Field label="图片文件路径">
          <Input
            autoFocus
            value={relocatePath}
            placeholder="例如：D:\\datasets\\armor\\sample_001.jpg"
            onChange={(event) => setRelocatePath(event.target.value)}
          />
        </Field>
      </Dialog>
    </div>
  )
}

function SaveIndicator({
  state,
  dirty,
  onRetry,
}: {
  state: 'idle' | 'saving' | 'saved' | 'error'
  dirty: boolean
  onRetry: () => void
}) {
  if (state === 'saving') {
    return (
      <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted">
        <Loader2 size={11} className="animate-spin" />
        保存中
      </span>
    )
  }
  if (state === 'error') {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 text-[10px] text-danger underline underline-offset-2"
      >
        保存失败，重试
      </button>
    )
  }
  if (dirty) {
    return <span className="shrink-0 text-[10px] text-warn">未保存</span>
  }
  return (
    <span className="flex shrink-0 items-center gap-1 text-[10px] text-faint">
      <Check size={11} className="text-success" />
      已保存
    </span>
  )
}

function HeaderIcon({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-panel-2 hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  )
}

function ActiveClassChip({
  classes,
  activeClassId,
  onClick,
}: {
  classes: Array<{ id: number; name: string; color: string }>
  activeClassId: number | null
  onClick: () => void
}) {
  const active = classes.find((item) => item.id === activeClassId)
  return (
    <button
      type="button"
      onClick={onClick}
      title="点击切换到下一个类别，也可按 1–9"
      className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] text-white/55 transition-colors hover:bg-white/8 hover:text-white/90"
    >
      <span
        className="h-2.5 w-2.5 rounded-[3px]"
        style={{ backgroundColor: active?.color ?? '#F2B95B' }}
      />
      {active?.name ?? '未选择类别'}
      <span className="rounded border border-white/15 px-1 py-px font-mono text-[9px] text-white/35">
        1–9
      </span>
    </button>
  )
}
