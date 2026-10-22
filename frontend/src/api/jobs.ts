import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client.ts'
import type { PrelabelJob } from './types.ts'

export function useCreateJob(projectId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { image_ids: number[]; class_ids?: number[] | null }) =>
      apiFetch<PrelabelJob>(`/projects/${projectId}/prelabel-jobs`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (job) => {
      queryClient.setQueryData(['job', job.id], job)
    },
  })
}

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled'])

export function useJob(jobId: number | null) {
  return useQuery({
    queryKey: ['job', jobId],
    queryFn: () => apiFetch<PrelabelJob>(`/prelabel-jobs/${jobId}`),
    enabled: jobId !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status && TERMINAL_STATUSES.has(status)) return false
      return 1000
    },
  })
}

export function useCancelJob(jobId: number | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<PrelabelJob>(`/prelabel-jobs/${jobId}/cancel`, { method: 'POST' }),
    onSuccess: (job) => {
      queryClient.setQueryData(['job', job.id], job)
      void queryClient.invalidateQueries({ queryKey: ['job', job.id] })
    },
  })
}
