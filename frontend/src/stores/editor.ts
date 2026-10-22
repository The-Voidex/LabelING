import { create } from 'zustand'
import type { Annotation } from '../api/types.ts'
import { clampBox } from '../canvas/geometry.ts'
import { pushPast, redoStep, undoStep } from '../canvas/history.ts'

export type EditorTool = 'select' | 'draw'
export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export interface BoxDraft {
  key: string
  id?: number
  class_id: number
  x1: number
  y1: number
  x2: number
  y2: number
  source: 'ai' | 'human'
  confidence: number | null
}

let keyCounter = 0

function createKey(): string {
  keyCounter += 1
  return `n-${Date.now()}-${keyCounter}`
}

function fromAnnotation(annotation: Annotation): BoxDraft {
  return {
    key: `a-${annotation.id}`,
    id: annotation.id,
    class_id: annotation.class_id,
    x1: annotation.x1,
    y1: annotation.y1,
    x2: annotation.x2,
    y2: annotation.y2,
    source: annotation.source,
    confidence: annotation.confidence,
  }
}

interface EditorState {
  boxes: BoxDraft[]
  past: BoxDraft[][]
  future: BoxDraft[][]
  selectedKey: string | null
  activeClassId: number | null
  tool: EditorTool
  dirty: boolean
  saveState: SaveState
  revision: number
  init: (annotations: Annotation[], activeClassId: number | null) => void
  setTool: (tool: EditorTool) => void
  setActiveClassId: (classId: number) => void
  select: (key: string | null) => void
  addBox: (box: Omit<BoxDraft, 'key' | 'source' | 'confidence' | 'id'>) => void
  updateBox: (
    key: string,
    patch: Partial<Pick<BoxDraft, 'x1' | 'y1' | 'x2' | 'y2' | 'class_id'>>,
  ) => void
  removeBox: (key: string) => void
  undo: () => void
  redo: () => void
  markSaving: () => void
  markError: () => void
  applyServer: (annotations: Annotation[], expectedRevision: number) => boolean
}

function commit(state: EditorState, boxes: BoxDraft[]): Partial<EditorState> {
  return {
    boxes,
    past: pushPast(state.past, state.boxes),
    future: [],
    dirty: true,
    revision: state.revision + 1,
    saveState: 'idle',
  }
}

export const useEditor = create<EditorState>((set, get) => ({
  boxes: [],
  past: [],
  future: [],
  selectedKey: null,
  activeClassId: null,
  tool: 'select',
  dirty: false,
  saveState: 'idle',
  revision: 0,

  init: (annotations, activeClassId) => {
    set((state) => ({
      boxes: annotations.map(fromAnnotation),
      past: [],
      future: [],
      selectedKey: null,
      activeClassId: activeClassId ?? state.activeClassId,
      dirty: false,
      saveState: 'idle',
      revision: state.revision + 1,
    }))
  },

  setTool: (tool) => set({ tool }),

  setActiveClassId: (classId) => set({ activeClassId: classId }),

  select: (key) => set({ selectedKey: key }),

  addBox: (box) => {
    set((state) => {
      const normalized = clampBox(box)
      const next: BoxDraft = {
        key: createKey(),
        class_id: box.class_id,
        ...normalized,
        source: 'human',
        confidence: null,
      }
      return {
        ...commit(state, [...state.boxes, next]),
        selectedKey: next.key,
      }
    })
  },

  updateBox: (key, patch) => {
    set((state) => {
      const index = state.boxes.findIndex((box) => box.key === key)
      if (index < 0) return {}
      const current = state.boxes[index]
      const merged = { ...current, ...patch }
      const normalized = clampBox(merged)
      const nextClassId = patch.class_id ?? current.class_id
      const changed =
        nextClassId !== current.class_id ||
        current.x1 !== normalized.x1 ||
        current.y1 !== normalized.y1 ||
        current.x2 !== normalized.x2 ||
        current.y2 !== normalized.y2
      if (!changed) return {}
      let source = current.source
      let confidence = current.confidence
      if (current.source === 'ai') {
        source = 'human'
        confidence = null
      }
      const next = state.boxes.slice()
      next[index] = {
        ...current,
        ...normalized,
        class_id: nextClassId,
        source,
        confidence,
      }
      return commit(state, next)
    })
  },

  removeBox: (key) => {
    set((state) => {
      if (!state.boxes.some((box) => box.key === key)) return {}
      const next = state.boxes.filter((box) => box.key !== key)
      return {
        ...commit(state, next),
        selectedKey: state.selectedKey === key ? null : state.selectedKey,
      }
    })
  },

  undo: () => {
    set((state) => {
      const step = undoStep(state.past, state.future, state.boxes)
      if (!step) return {}
      return {
        boxes: step.value,
        past: step.past,
        future: step.future,
        selectedKey: null,
        dirty: true,
        revision: state.revision + 1,
        saveState: 'idle',
      }
    })
  },

  redo: () => {
    set((state) => {
      const step = redoStep(state.past, state.future, state.boxes)
      if (!step) return {}
      return {
        boxes: step.value,
        past: step.past,
        future: step.future,
        selectedKey: null,
        dirty: true,
        revision: state.revision + 1,
        saveState: 'idle',
      }
    })
  },

  markSaving: () => set({ saveState: 'saving' }),

  markError: () => set({ saveState: 'error' }),

  applyServer: (annotations, expectedRevision) => {
    const state = get()
    if (state.revision !== expectedRevision) return false
    const serverById = new Map(annotations.map((item) => [item.id, item]))
    const existingIds = new Set(
      state.boxes.filter((box) => box.id !== undefined).map((box) => box.id as number),
    )
    const unmatchedServer = annotations.filter((item) => !existingIds.has(item.id))
    let cursor = 0
    let missingOnServer = false

    const next = state.boxes.map((box) => {
      if (box.id !== undefined) {
        const server = serverById.get(box.id)
        if (!server) {
          missingOnServer = true
          return box
        }
        return {
          ...box,
          source: server.source,
          confidence: server.confidence,
          class_id: server.class_id,
        }
      }
      const server = unmatchedServer[cursor]
      cursor += 1
      if (!server) {
        missingOnServer = true
        return box
      }
      return {
        ...box,
        id: server.id,
        source: server.source,
        confidence: server.confidence,
        class_id: server.class_id,
      }
    })

    const usedIds = new Set(
      next.filter((box) => box.id !== undefined).map((box) => box.id as number),
    )
    for (const annotation of annotations) {
      if (!usedIds.has(annotation.id)) {
        next.push(fromAnnotation(annotation))
      }
    }

    const selectedKey = next.some((box) => box.key === state.selectedKey)
      ? state.selectedKey
      : null
    set({
      boxes: next,
      selectedKey,
      dirty: missingOnServer,
      saveState: missingOnServer ? 'idle' : 'saved',
    })
    return true
  },
}))
