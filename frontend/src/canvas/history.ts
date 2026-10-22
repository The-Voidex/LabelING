export const HISTORY_LIMIT = 50

export function pushPast<T>(past: T[], current: T, limit = HISTORY_LIMIT): T[] {
  const next = [...past, current]
  return next.length > limit ? next.slice(next.length - limit) : next
}

export function undoStep<T>(
  past: T[],
  future: T[],
  current: T,
): { past: T[]; future: T[]; value: T } | null {
  if (past.length === 0) return null
  const value = past[past.length - 1]
  return {
    past: past.slice(0, -1),
    future: [...future, current],
    value,
  }
}

export function redoStep<T>(
  past: T[],
  future: T[],
  current: T,
): { past: T[]; future: T[]; value: T } | null {
  if (future.length === 0) return null
  const value = future[future.length - 1]
  return {
    past: [...past, current],
    future: future.slice(0, -1),
    value,
  }
}
