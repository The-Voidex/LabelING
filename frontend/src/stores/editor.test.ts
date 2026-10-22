import { beforeEach, describe, expect, test } from 'vitest'
import type { Annotation } from '../api/types.ts'
import { useEditor } from './editor.ts'

const AI_ANNOTATION: Annotation = {
  id: 1,
  image_id: 1,
  class_id: 4,
  x1: 0.1,
  y1: 0.1,
  x2: 0.5,
  y2: 0.5,
  source: 'ai',
  confidence: 0.9,
}

function reset() {
  useEditor.getState().init([], null)
  useEditor.setState({ tool: 'select', selectedKey: null })
}

describe('editor store', () => {
  beforeEach(reset)

  test('新增框为人工来源并被选中', () => {
    useEditor.getState().init([AI_ANNOTATION], 4)
    useEditor.getState().addBox({ class_id: 4, x1: 0.2, y1: 0.2, x2: 0.7, y2: 0.8 })
    const state = useEditor.getState()
    expect(state.boxes).toHaveLength(2)
    const added = state.boxes[1]
    expect(added.source).toBe('human')
    expect(added.confidence).toBeNull()
    expect(state.selectedKey).toBe(added.key)
    expect(state.dirty).toBe(true)
  })

  test('移动 AI 框后转为人工并清除置信度', () => {
    useEditor.getState().init([AI_ANNOTATION], 4)
    useEditor.getState().updateBox('a-1', { x2: 0.8 })
    const box = useEditor.getState().boxes[0]
    expect(box.source).toBe('human')
    expect(box.confidence).toBeNull()
    expect(box.x2).toBeCloseTo(0.8)
  })

  test('未变化的更新不产生修改', () => {
    useEditor.getState().init([AI_ANNOTATION], 4)
    const revision = useEditor.getState().revision
    useEditor.getState().updateBox('a-1', { x2: 0.5 })
    expect(useEditor.getState().revision).toBe(revision)
    expect(useEditor.getState().dirty).toBe(false)
  })

  test('删除、撤销与重做', () => {
    useEditor.getState().init([AI_ANNOTATION], 4)
    useEditor.getState().removeBox('a-1')
    expect(useEditor.getState().boxes).toHaveLength(0)
    useEditor.getState().undo()
    expect(useEditor.getState().boxes).toHaveLength(1)
    useEditor.getState().redo()
    expect(useEditor.getState().boxes).toHaveLength(0)
  })

  test('applyServer 更新来源与服务器 ID', () => {
    useEditor.getState().init([AI_ANNOTATION], 4)
    useEditor.getState().updateBox('a-1', { y2: 0.7 })
    const revision = useEditor.getState().revision
    const applied = useEditor.getState().applyServer(
      [{ ...AI_ANNOTATION, source: 'human', confidence: null, y2: 0.7 }],
      revision,
    )
    expect(applied).toBe(true)
    expect(useEditor.getState().boxes[0].source).toBe('human')
    expect(useEditor.getState().dirty).toBe(false)

    const stale = useEditor.getState().applyServer([AI_ANNOTATION], revision - 1)
    expect(stale).toBe(false)
  })

  test('applyServer 为新框分配服务器 ID', () => {
    useEditor.getState().init([], 4)
    useEditor.getState().addBox({ class_id: 4, x1: 0.1, y1: 0.1, x2: 0.4, y2: 0.4 })
    const revision = useEditor.getState().revision
    const applied = useEditor.getState().applyServer(
      [
        {
          id: 9,
          image_id: 1,
          class_id: 4,
          x1: 0.1,
          y1: 0.1,
          x2: 0.4,
          y2: 0.4,
          source: 'human',
          confidence: null,
        },
      ],
      revision,
    )
    expect(applied).toBe(true)
    expect(useEditor.getState().boxes[0].id).toBe(9)
    expect(useEditor.getState().boxes[0].source).toBe('human')
  })
})
