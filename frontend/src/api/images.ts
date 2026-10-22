import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client.ts'
import type {
  ImageAsset,
  ImageNavItem,
  ImagePage,
  ImportPreview,
  ImportResult,
} from './types.ts'

export interface ImageQueryParams {
  page: number
  pageSize: number
  status?: string
  q?: string
}

function imagesUrl(projectId: number, params: ImageQueryParams): string {
  const search = new URLSearchParams()
  search.set('page', String(params.page))
  search.set('page_size', String(params.pageSize))
  if (params.status) search.set('status', params.status)
  if (params.q) search.set('q', params.q)
  return `/projects/${projectId}/images?${search.toString()}`
}

export function useImages(projectId?: number, params?: ImageQueryParams) {
  return useQuery({
    queryKey: ['images', projectId, params],
    queryFn: () =>
      apiFetch<ImagePage>(imagesUrl(projectId!, params!)),
    enabled: projectId !== undefined && params !== undefined,
  })
}

export function useImage(imageId?: number) {
  return useQuery({
    queryKey: ['image', imageId],
    queryFn: () => apiFetch<ImageAsset>(`/images/${imageId}`),
    enabled: imageId !== undefined,
  })
}

export function useImageNav(projectId?: number) {
  return useQuery({
    queryKey: ['image-nav', projectId],
    queryFn: () => apiFetch<ImageNavItem[]>(`/projects/${projectId}/images/nav`),
    enabled: projectId !== undefined,
  })
}

export interface ImportInput {
  folder_path: string
  mode: 'copy' | 'reference'
  recursive: boolean
}

export function useImportPreview(projectId: number) {
  return useMutation({
    mutationFn: (data: ImportInput) =>
      apiFetch<ImportPreview>(`/projects/${projectId}/import/preview`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  })
}

export function useImportImages(projectId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ImportInput) =>
      apiFetch<ImportResult>(`/projects/${projectId}/import`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['images', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['image-nav', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['project-stats', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useRelocateImage(projectId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ imageId, path }: { imageId: number; path: string }) =>
      apiFetch<ImageAsset>(`/images/${imageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ path }),
      }),
    onSuccess: (_image, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['image', variables.imageId] })
      void queryClient.invalidateQueries({ queryKey: ['images', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['image-nav', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['project-stats', projectId] })
    },
  })
}

export function useDeleteImage(projectId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (imageId: number) =>
      apiFetch<void>(`/images/${imageId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['images', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['image-nav', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['project-stats', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
  })
}

export function useBatchDeleteImages(projectId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (imageIds: number[]) =>
      apiFetch<{ deleted: number }>(`/projects/${projectId}/images/batch-delete`, {
        method: 'POST',
        body: JSON.stringify({ image_ids: imageIds }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['images', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['image-nav', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['project-stats', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
  })
}
