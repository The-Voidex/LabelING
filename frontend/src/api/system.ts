import { useMutation, useQuery } from '@tanstack/react-query'
import { apiFetch } from './client.ts'

export interface SystemStatus {
  status: string
  version: string
  pid: number
  started_at: number
  uptime_seconds: number
  url: string
  data_dir: string
  host: string
  port: number
}

export function useSystemStatus(enabled = true) {
  return useQuery({
    queryKey: ['system-status'],
    queryFn: () => apiFetch<SystemStatus>('/system/status'),
    enabled,
    retry: false,
    staleTime: 5000,
    refetchInterval: enabled ? 30000 : false,
  })
}

export function useShutdownService() {
  return useMutation({
    mutationFn: () => apiFetch<{ ok: boolean }>('/system/shutdown', { method: 'POST' }),
  })
}

export function useOpenDataDir() {
  return useMutation({
    mutationFn: () =>
      apiFetch<{ ok: boolean; path: string }>('/system/open-data-dir', { method: 'POST' }),
  })
}
