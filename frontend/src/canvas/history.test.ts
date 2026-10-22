import { describe, expect, test } from 'vitest'
import { pushPast, redoStep, undoStep } from './history.ts'

describe('history', () => {
  test('过去栈限制长度', () => {
    let past: number[][] = []
    for (let index = 0; index < 60; index += 1) {
      past = pushPast(past, [index], 50)
    }
    expect(past).toHaveLength(50)
    expect(past[past.length - 1]).toEqual([59])
  })

  test('撤销与重做', () => {
    const first = undoStep([1, 2], [], 3)
    expect(first).not.toBeNull()
    expect(first!.value).toBe(2)
    expect(first!.past).toEqual([1])
    expect(first!.future).toEqual([3])

    const second = redoStep(first!.past, first!.future, first!.value)
    expect(second!.value).toBe(3)
    expect(second!.past).toEqual([1, 2])
  })

  test('无历史时返回 null', () => {
    expect(undoStep([], [], 1)).toBeNull()
    expect(redoStep([], [], 1)).toBeNull()
  })
})
