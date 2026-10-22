import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client.ts'
import type { LabelClass } from './types.ts'

export function useClasses(projectId?: number) {
  return useQuery({
    queryKey: ['classes', projectId],
    queryFn: () => apiFetch<LabelClass[]>(`/projects/${projectId}/classes`),
    enabled: projectId !== undefined,
  })
}

export interface ClassInput {
  name: string
  color?: string | null
  prompt?: string
}

export function useCreateClass(projectId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ClassInput) =>
      apiFetch<LabelClass>(`/projects/${projectId}/classes`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['classes', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useUpdateClass(projectId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ classId, data }: { classId: number; data: ClassInput }) =>
      apiFetch<LabelClass>(`/classes/${classId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['classes', projectId] })
    },
  })
}

export function useDeleteClass(projectId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ classId, force }: { classId: number; force?: boolean }) =>
      apiFetch<void>(`/classes/${classId}${force ? '?force=true' : ''}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['classes', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['project-stats', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['images', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['image-nav', projectId] })
    },
  })
}

export function useReorderClasses(projectId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (classIds: number[]) =>
      apiFetch<LabelClass[]>(`/projects/${projectId}/classes/reorder`, {
        method: 'POST',
        body: JSON.stringify({ class_ids: classIds }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['classes', projectId] })
    },
  })
}
