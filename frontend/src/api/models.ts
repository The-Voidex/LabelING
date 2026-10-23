import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client.ts'
import type {
  ModelConfig,
  ModelDiscoveryResult,
  ModelParams,
  ProviderTestResult,
  ProviderType,
} from './types.ts'

export function useModelConfigs() {
  return useQuery({
    queryKey: ['model-configs'],
    queryFn: () => apiFetch<ModelConfig[]>('/model-configs'),
  })
}

export interface ModelConfigInput {
  name: string
  provider_type: ProviderType
  base_url: string
  api_key?: string
  model_name: string
  params: Partial<ModelParams>
  is_default?: boolean
}

export interface ModelDraftTestInput extends ModelConfigInput {
  config_id?: number
}

export interface ModelDiscoveryInput {
  provider_type: ProviderType
  base_url: string
  api_key: string
  config_id?: number
  default_model?: string
}

export function useCreateModelConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ModelConfigInput) =>
      apiFetch<ModelConfig>('/model-configs', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['model-configs'] })
    },
  })
}

export function useUpdateModelConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ configId, data }: { configId: number; data: Partial<ModelConfigInput> }) =>
      apiFetch<ModelConfig>(`/model-configs/${configId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['model-configs'] })
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useDeleteModelConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (configId: number) =>
      apiFetch<void>(`/model-configs/${configId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['model-configs'] })
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useTestModelConfig() {
  return useMutation({
    mutationFn: (configId: number) =>
      apiFetch<ProviderTestResult>(`/model-configs/${configId}/test`, {
        method: 'POST',
      }),
  })
}

export function useTestDraftModelConfig() {
  return useMutation({
    mutationFn: (data: ModelDraftTestInput) =>
      apiFetch<ProviderTestResult>('/model-configs/test-draft', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  })
}

export function useDiscoverModels() {
  return useMutation({
    mutationFn: (data: ModelDiscoveryInput) =>
      apiFetch<ModelDiscoveryResult>('/model-configs/discover-models', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  })
}
