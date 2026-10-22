import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client.ts'
import type { Project, ProjectStats } from './types.ts'

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => apiFetch<Project[]>('/projects'),
  })
}

export function useProject(projectId?: number) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: () => apiFetch<Project>(`/projects/${projectId}`),
    enabled: projectId !== undefined,
  })
}

export function useProjectStats(projectId?: number) {
  return useQuery({
    queryKey: ['project-stats', projectId],
    queryFn: () => apiFetch<ProjectStats>(`/projects/${projectId}/stats`),
    enabled: projectId !== undefined,
  })
}

export interface ProjectInput {
  name: string
  description?: string
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ProjectInput) =>
      apiFetch<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: number
      data: { name?: string; description?: string; model_config_id?: number | null }
    }) =>
      apiFetch<Project>(`/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: (_project, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      void queryClient.invalidateQueries({ queryKey: ['project', variables.projectId] })
    },
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (projectId: number) =>
      apiFetch<void>(`/projects/${projectId}`, { method: 'DELETE' }),
    onSuccess: (_data, projectId) => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.removeQueries({ queryKey: ['project', projectId] })
    },
  })
}
