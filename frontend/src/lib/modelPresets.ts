export type ProviderPresetId = 'deepseek' | 'dashscope' | 'zhipu' | 'custom'

export interface ProviderPreset {
  id: ProviderPresetId
  name: string
  description: string
  baseUrl: string
  defaultModel: string
  suggestedModels: string[]
  host: string | null
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: '深度求索官方视觉接口',
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-flash',
    suggestedModels: ['deepseek-flash'],
    host: 'api.deepseek.com',
  },
  {
    id: 'dashscope',
    name: '阿里云百炼',
    description: '通义千问视觉模型',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-vl-max',
    suggestedModels: ['qwen-vl-max', 'qwen-vl-plus'],
    host: 'dashscope.aliyuncs.com',
  },
  {
    id: 'zhipu',
    name: '智谱 GLM',
    description: 'GLM 视觉模型',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4v-plus',
    suggestedModels: ['glm-4v-plus', 'glm-4v-flash'],
    host: 'open.bigmodel.cn',
  },
  {
    id: 'custom',
    name: '自定义接口',
    description: '任意 OpenAI 兼容服务',
    baseUrl: '',
    defaultModel: '',
    suggestedModels: [],
    host: null,
  },
]

export const DEFAULT_PRESET_ID: ProviderPresetId = 'deepseek'

export function getProviderPreset(id: ProviderPresetId): ProviderPreset {
  return PROVIDER_PRESETS.find((preset) => preset.id === id) ?? PROVIDER_PRESETS[0]
}

export function findProviderPreset(baseUrl: string): ProviderPreset | null {
  const value = baseUrl.trim()
  if (!value) return null
  try {
    const host = new URL(value).hostname.toLowerCase()
    return PROVIDER_PRESETS.find((preset) => preset.host === host) ?? null
  } catch {
    return null
  }
}

export function providerDisplayName(baseUrl: string): string {
  return findProviderPreset(baseUrl)?.name ?? '自定义接口'
}

export function defaultConfigName(preset: ProviderPreset): string {
  return preset.id === 'custom' ? '自定义视觉模型' : `${preset.name} 视觉模型`
}
