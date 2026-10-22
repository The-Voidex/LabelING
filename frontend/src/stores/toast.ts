import { create } from 'zustand'

export type ToastKind = 'success' | 'error' | 'info'

export interface ToastItem {
  id: number
  message: string
  kind: ToastKind
}

interface ToastState {
  items: ToastItem[]
  push: (message: string, kind?: ToastKind) => void
  remove: (id: number) => void
}

let sequence = 1

export const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (message, kind = 'info') => {
    const id = sequence++
    set((state) => ({ items: [...state.items, { id, message, kind }] }))
    window.setTimeout(() => {
      set((state) => ({ items: state.items.filter((item) => item.id !== id) }))
    }, 4200)
  },
  remove: (id) => {
    set((state) => ({ items: state.items.filter((item) => item.id !== id) }))
  },
}))

export function useToast(): (message: string, kind?: ToastKind) => void {
  return useToastStore((state) => state.push)
}
