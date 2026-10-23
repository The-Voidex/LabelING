import type { ImageStatus } from '../api/types.ts'

export const STATUS_LABELS: Record<ImageStatus, string> = {
  unlabeled: '未标注',
  labeled: '待审核',
  confirmed: '已确认',
}

export const STATUS_ORDER: ImageStatus[] = ['unlabeled', 'labeled', 'confirmed']

export function statusLabel(status: string): string {
  return STATUS_LABELS[status as ImageStatus] ?? status
}

export function sourceLabel(source: string): string {
  return source === 'ai' ? '模型预标' : '人工'
}

export const JOB_STATUS_LABELS: Record<string, string> = {
  queued: '排队中',
  running: '运行中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
}
