import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client.ts'
import type {
  Annotation,
  BatchConfirmResult,
  BatchUnconfirmResult,
} from './types.ts'

export interface AnnotationInput {
  id?: number
  class_id: number
  x1: number
  y1: number
  x2: number
  y2: number
  confidence?: number | null
}

export function useAnnotations(imageId?: number) {
  return useQuery({
    queryKey: ['annotations', imageId],
    queryFn: () => apiFetch<Annotation[]>(`/images/${imageId}/annotations`),
    enabled: imageId !== undefined,
  })
}

export function useSaveAnnotations(imageId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (annotations: AnnotationInput[]) =>
      apiFetch<Annotation[]>(`/images/${imageId}/annotations`, {
        method: 'PUT',
        body: JSON.stringify({ annotations }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['image', imageId] })
    },
  })
}

function invalidateImageLists(
  queryClient: ReturnType<typeof useQueryClient>,
  projectId: number,
) {
  void queryClient.invalidateQueries({ queryKey: ['images', projectId] })
  void queryClient.invalidateQueries({ queryKey: ['image-nav', projectId] })
  void queryClient.invalidateQueries({ queryKey: ['project-stats', projectId] })
}

export function useConfirmImage(projectId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (imageId: number) =>
      apiFetch<void>(`/images/${imageId}/confirm`, { method: 'POST' }),
    onSuccess: (_data, imageId) => {
      void queryClient.invalidateQueries({ queryKey: ['image', imageId] })
      invalidateImageLists(queryClient, projectId)
    },
  })
}

export function useUnconfirmImage(projectId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (imageId: number) =>
      apiFetch<void>(`/images/${imageId}/unconfirm`, { method: 'POST' }),
    onSuccess: (_data, imageId) => {
      void queryClient.invalidateQueries({ queryKey: ['image', imageId] })
      invalidateImageLists(queryClient, projectId)
    },
  })
}

export function useBatchConfirm(projectId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (imageIds: number[]) =>
      apiFetch<BatchConfirmResult>(`/projects/${projectId}/images/batch-confirm`, {
        method: 'POST',
        body: JSON.stringify({ image_ids: imageIds }),
      }),
    onSuccess: () => invalidateImageLists(queryClient, projectId),
  })
}

export function useBatchUnconfirm(projectId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (imageIds: number[]) =>
      apiFetch<BatchUnconfirmResult>(
        `/projects/${projectId}/images/batch-unconfirm`,
        {
          method: 'POST',
          body: JSON.stringify({ image_ids: imageIds }),
        },
      ),
    onSuccess: () => invalidateImageLists(queryClient, projectId),
  })
}
