import { useState } from 'react'
import {
  Bot,
  Check,
  ChevronDown,
  Cloud,
  Cpu,
  KeyRound,
  Pencil,
  Plug,
  PlugZap,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react'
import {
  useCreateModelConfig,
  useDeleteModelConfig,
  useDiscoverModels,
  useModelConfigs,
  useTestDraftModelConfig,
  useTestModelConfig,
  useUpdateModelConfig,
} from '../api/models.ts'
import type {
  ModelConfig,
  ModelParams,
  ProviderTestResult,
  ProviderType,
} from '../api/types.ts'
import {
  DEFAULT_PRESET_ID,
  PROVIDER_PRESETS,
  defaultConfigName,
  findProviderPreset,
  getProviderPreset,
  providerDisplayName,
} from '../lib/modelPresets.ts'
import type { ProviderPreset, ProviderPresetId } from '../lib/modelPresets.ts'
import {
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  Input,
  Switch,
  Textarea,
} from '../components/ui.tsx'
import { cx } from '../lib/cx.ts'
import { useToast } from '../stores/toast.ts'

const DEFAULT_PARAMS: ModelParams = {
  concurrency: 2,
  max_image_side: 1280,
  temperature: 0,
  timeout_s: 120,
  max_tokens: 2048,
  json_mode: false,
  extra_headers: {},
  extra_instructions: '',
}

function PresetIcon({ id }: { id: ProviderPresetId }) {
  if (id === 'deepseek') return <Sparkles size={16} />
  if (id === 'dashscope') return <Cloud size={16} />
  if (id === 'zhipu') return <Bot size={16} />
  return <Plug size={16} />
}

export function ModelsPage() {
  const configs = useModelConfigs()
  const deleteConfig = useDeleteModelConfig()
  const testModel = useTestModelConfig()
  const toast = useToast()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ModelConfig | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ModelConfig | null>(null)
  const [testingId, setTestingId] = useState<number | null>(null)

  const runTest = (config: ModelConfig) => {
    setTestingId(config.id)
    testModel.mutate(config.id, {
      onSuccess: (result) => {
        setTestingId(null)
        toast(
          result.ok
            ? `${result.message}（耗时 ${result.latency_ms} 毫秒）`
            : result.message,
          result.ok ? 'success' : 'error',
        )
      },
      onError: (error) => {
        setTestingId(null)
        toast(error.message, 'error')
      },
    })
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    deleteConfig.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast('模型配置已删除', 'success')
        setDeleteTarget(null)
      },
      onError: (error) => toast(error.message, 'error'),
    })
  }

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-panel/60 px-2.5 py-1 text-[10px] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            预标注引擎
          </div>
          <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.035em] text-ink">
            模型设置
          </h1>
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-muted">
            选择服务商、粘贴接口密钥即可完成配置。接口地址和默认视觉模型会自动填好，也可以从接口读取完整模型列表。
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
        >
          <Plus size={15} />
          新建配置
        </Button>
      </div>

      {configs.isLoading ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className="h-56 animate-pulse rounded-2xl border border-border bg-panel/70"
            />
          ))}
        </div>
      ) : configs.data && configs.data.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {configs.data.map((config) => {
            const isMock = config.provider_type === 'mock'
            const ready = isMock || (config.has_api_key && Boolean(config.model_name))
            return (
              <article
                key={config.id}
                className="flex flex-col rounded-2xl border border-border bg-panel/80 p-5 shadow-card transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-panel"
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={cx(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                      isMock
                        ? 'bg-warn/10 text-warn'
                        : 'bg-[#E6EBF5] text-[#385C91]',
                    )}
                  >
                    {isMock ? <Sparkles size={18} /> : <Cpu size={18} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold text-ink">{config.name}</h2>
                      <span className="rounded-full border border-border bg-panel-2/60 px-2 py-0.5 text-[9px] text-muted">
                        {isMock ? '模拟模型' : providerDisplayName(config.base_url)}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-[11px] text-muted">
                      {isMock
                        ? '不发起网络请求，返回固定位置的测试框。'
                        : config.model_name || '未填写模型名称'}
                    </div>
                    {!isMock ? (
                      <div className="mt-0.5 truncate font-mono text-[9px] text-faint">
                        {config.base_url || '未填写接口地址'}
                      </div>
                    ) : null}
                  </div>
                  <span
                    className={cx(
                      'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9px]',
                      ready ? 'bg-success/8 text-success' : 'bg-warn/8 text-warn',
                    )}
                  >
                    <span
                      className={cx(
                        'h-1 w-1 rounded-full',
                        ready ? 'bg-success' : 'bg-warn',
                      )}
                    />
                    {ready ? '可使用' : '待完善'}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 divide-border/80 overflow-hidden rounded-xl border border-border/80 bg-panel-2/45 text-[10px] sm:grid-cols-4 sm:divide-x">
                  <div className="px-3 py-2.5">
                    <div className="text-faint">并发数</div>
                    <div className="mt-0.5 font-mono text-xs text-ink">
                      {config.params.concurrency}
                    </div>
                  </div>
                  <div className="px-3 py-2.5">
                    <div className="text-faint">图片长边</div>
                    <div className="mt-0.5 font-mono text-xs text-ink">
                      {config.params.max_image_side} 像素
                    </div>
                  </div>
                  <div className="px-3 py-2.5">
                    <div className="text-faint">请求超时</div>
                    <div className="mt-0.5 font-mono text-xs text-ink">
                      {config.params.timeout_s} 秒
                    </div>
                  </div>
                  <div className="px-3 py-2.5">
                    <div className="flex items-center gap-1 text-faint">
                      <KeyRound size={9} />
                      接口密钥
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[10px] text-ink">
                      {isMock
                        ? '无需密钥'
                        : config.has_api_key
                          ? config.api_key_masked
                          : '未设置'}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 border-t border-border/70 pt-4">
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={testingId === config.id}
                    onClick={() => runTest(config)}
                  >
                    <PlugZap size={14} />
                    测试连接
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditing(config)
                      setDialogOpen(true)
                    }}
                  >
                    <Pencil size={14} />
                    编辑
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto text-faint hover:bg-danger/8 hover:text-danger"
                    onClick={() => setDeleteTarget(config)}
                  >
                    <Trash2 size={14} />
                    删除
                  </Button>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Cpu size={28} />}
          title="还没有模型配置"
          description="选择 DeepSeek、阿里云百炼或智谱，粘贴接口密钥就能创建视觉模型配置。没有密钥时，也可以先用模拟模型体验流程。"
          action={
            <Button
              variant="primary"
              onClick={() => {
                setEditing(null)
                setDialogOpen(true)
              }}
            >
              <Plus size={15} />
              新建配置
            </Button>
          }
        />
      )}

      {dialogOpen ? (
        <ModelConfigDialog
          open
          editing={editing}
          onClose={() => setDialogOpen(false)}
        />
      ) : null}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除模型配置"
        message={`确定删除模型配置「${deleteTarget?.name}」吗？如果它正被项目使用，需要先在项目设置中更换模型。`}
        confirmText="删除配置"
        danger
        loading={deleteConfig.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}

function ModelConfigDialog({
  open,
  editing,
  onClose,
}: {
  open: boolean
  editing: ModelConfig | null
  onClose: () => void
}) {
  const createConfig = useCreateModelConfig()
  const updateConfig = useUpdateModelConfig()
  const testDraft = useTestDraftModelConfig()
  const discoverModels = useDiscoverModels()
  const toast = useToast()

  const initialPreset =
    editing?.provider_type === 'openai_compat'
      ? findProviderPreset(editing.base_url) ?? getProviderPreset('custom')
      : getProviderPreset(DEFAULT_PRESET_ID)

  const [name, setName] = useState(
    editing?.name ?? defaultConfigName(initialPreset),
  )
  const [autoName, setAutoName] = useState(!editing)
  const [providerType, setProviderType] = useState<ProviderType>(
    editing?.provider_type ?? 'openai_compat',
  )
  const [presetId, setPresetId] = useState<ProviderPresetId>(
    editing?.provider_type === 'mock' ? 'custom' : initialPreset.id,
  )
  const [baseUrl, setBaseUrl] = useState(editing?.base_url ?? initialPreset.baseUrl)
  const [apiKey, setApiKey] = useState('')
  const [modelName, setModelName] = useState(
    editing?.model_name ?? initialPreset.defaultModel,
  )
  const [models, setModels] = useState<string[]>(initialPreset.suggestedModels)
  const [recommended, setRecommended] = useState<string | null>(
    editing?.model_name ?? initialPreset.defaultModel ?? null,
  )
  const [params, setParams] = useState<ModelParams>({
    ...DEFAULT_PARAMS,
    ...(editing?.params ?? {}),
  })
  const [headersText, setHeadersText] = useState(
    editing && Object.keys(editing.params.extra_headers ?? {}).length
      ? JSON.stringify(editing.params.extra_headers, null, 2)
      : '',
  )
  const [headersError, setHeadersError] = useState('')
  const [testResult, setTestResult] = useState<ProviderTestResult | null>(null)
  const [discoveryError, setDiscoveryError] = useState('')

  const preset = getProviderPreset(presetId)
  const modelOptions = Array.from(
    new Set(
      [
        ...models,
        ...preset.suggestedModels,
        ...(recommended ? [recommended] : []),
        ...(modelName.trim() ? [modelName.trim()] : []),
      ].filter(Boolean),
    ),
  )

  const applyPreset = (nextPreset: ProviderPreset) => {
    setProviderType('openai_compat')
    setPresetId(nextPreset.id)
    setBaseUrl(nextPreset.baseUrl)
    setModelName(nextPreset.defaultModel)
    setModels(nextPreset.suggestedModels)
    setRecommended(nextPreset.defaultModel || null)
    setDiscoveryError('')
    setTestResult(null)
    if (autoName) setName(defaultConfigName(nextPreset))
  }

  const applyMock = () => {
    setProviderType('mock')
    setPresetId('custom')
    setDiscoveryError('')
    setTestResult(null)
    if (autoName) setName('模拟模型')
  }

  const changeBaseUrl = (value: string) => {
    setBaseUrl(value)
    setModels([])
    setRecommended(null)
    setDiscoveryError('')
    setTestResult(null)
    const matched = findProviderPreset(value)
    setPresetId(matched?.id ?? 'custom')
  }

  const parseHeaders = (): Record<string, string> | null => {
    const text = headersText.trim()
    if (!text) {
      setHeadersError('')
      return {}
    }
    try {
      const parsed = JSON.parse(text)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setHeadersError('附加请求头需要是 JSON 对象')
        return null
      }
      setHeadersError('')
      return Object.fromEntries(
        Object.entries(parsed).map(([key, value]) => [key, String(value)]),
      )
    } catch {
      setHeadersError('附加请求头不是合法 JSON')
      return null
    }
  }

  const effectiveName = () => {
    return (
      name.trim() ||
      (providerType === 'mock' ? '模拟模型' : defaultConfigName(preset))
    )
  }

  const buildPayload = () => {
    const headers = parseHeaders()
    if (headers === null) return null
    return {
      name: effectiveName(),
      provider_type: providerType,
      base_url: providerType === 'mock' ? '' : baseUrl.trim(),
      api_key: providerType === 'mock' ? '' : apiKey,
      model_name: providerType === 'mock' ? '' : modelName.trim(),
      params: {
        ...params,
        extra_headers: headers,
      },
    }
  }

  const validate = () => {
    if (providerType === 'mock') return true
    if (!baseUrl.trim()) {
      toast('请填写接口地址', 'error')
      return false
    }
    if (!modelName.trim()) {
      toast('请填写或选择视觉模型', 'error')
      return false
    }
    return true
  }

  const save = () => {
    if (!validate()) return
    const payload = buildPayload()
    if (!payload) return
    if (editing) {
      updateConfig.mutate(
        {
          configId: editing.id,
          data: {
            ...payload,
            api_key: payload.api_key || undefined,
          },
        },
        {
          onSuccess: () => {
            toast('模型配置已保存', 'success')
            onClose()
          },
          onError: (error) => toast(error.message, 'error'),
        },
      )
    } else {
      createConfig.mutate(payload, {
        onSuccess: () => {
          toast('模型配置已创建', 'success')
          onClose()
        },
        onError: (error) => toast(error.message, 'error'),
      })
    }
  }

  const runTest = () => {
    if (!validate()) return
    const payload = buildPayload()
    if (!payload) return
    testDraft.mutate(
      editing ? { ...payload, config_id: editing.id } : payload,
      {
        onSuccess: (result) => setTestResult(result),
        onError: (error) => toast(error.message, 'error'),
      },
    )
  }

  const discover = () => {
    if (!baseUrl.trim()) {
      toast('请先填写接口地址', 'error')
      return
    }
    if (!apiKey.trim() && !editing?.has_api_key) {
      toast('请先填写接口密钥，再获取模型列表', 'error')
      return
    }
    discoverModels.mutate(
      {
        provider_type: 'openai_compat',
        base_url: baseUrl.trim(),
        api_key: apiKey.trim(),
        config_id: editing?.id,
        default_model: modelName.trim() || preset.defaultModel || undefined,
      },
      {
        onSuccess: (result) => {
          setModels(result.models)
          setRecommended(result.recommended)
          setDiscoveryError('')
          if (result.recommended) setModelName(result.recommended)
          toast(
            `已获取 ${result.count} 个模型${result.recommended ? `，推荐 ${result.recommended}` : ''}`,
            'success',
          )
        },
        onError: (error) => {
          setDiscoveryError(error.message)
          toast(error.message, 'error')
        },
      },
    )
  }

  const saving = createConfig.isPending || updateConfig.isPending
  const savedKeyHint = editing?.has_api_key
    ? `已保存 ${editing.api_key_masked}，留空表示不修改。`
    : '仅保存在本机数据库，不会显示在界面上。'

  return (
    <Dialog
      open={open}
      title={editing ? '编辑模型配置' : '新建模型配置'}
      description={
        editing
          ? '修改服务商、视觉模型或接口密钥；接口密钥留空会保留原值。'
          : '选择服务商后，接口地址和视觉模型会自动填好，通常只需要粘贴接口密钥。'
      }
      width="max-w-2xl"
      onClose={onClose}
      footer={
        <>
          <Button loading={testDraft.isPending} onClick={runTest}>
            <PlugZap size={15} />
            测试连接
          </Button>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" loading={saving} onClick={save}>
            保存配置
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-3.5">
          <div>
            <div className="mb-2 text-[10px] font-medium tracking-[0.12em] text-faint">
              选择服务商
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PROVIDER_PRESETS.map((item) => {
                const active =
                  providerType === 'openai_compat' && presetId === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => applyPreset(item)}
                    className={cx(
                      'relative flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors',
                      active
                        ? 'border-accent/40 bg-accent-soft/50'
                        : 'border-border bg-panel hover:bg-panel-2/55',
                    )}
                  >
                    <span
                      className={cx(
                        'flex h-7 w-7 items-center justify-center rounded-lg',
                        active
                          ? 'bg-panel text-accent'
                          : 'bg-panel-2/70 text-muted',
                      )}
                    >
                      <PresetIcon id={item.id} />
                    </span>
                    <span>
                      <span className="block text-[11px] font-medium text-ink">
                        {item.name}
                      </span>
                      <span className="mt-0.5 block text-[9px] leading-relaxed text-faint">
                        {item.description}
                      </span>
                    </span>
                    {active ? (
                      <Check
                        size={12}
                        className="absolute right-2.5 top-2.5 text-accent"
                        strokeWidth={3}
                      />
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={applyMock}
            className={cx(
              'flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
              providerType === 'mock'
                ? 'border-warn/30 bg-warn/5'
                : 'border-border bg-panel hover:bg-panel-2/55',
            )}
          >
            <span
              className={cx(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                providerType === 'mock'
                  ? 'bg-warn/10 text-warn'
                  : 'bg-panel-2/70 text-muted',
              )}
            >
              <Cpu size={14} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-medium text-ink">模拟模型</span>
              <span className="mt-0.5 block text-[9px] text-faint">
                没有接口密钥时，用固定测试框体验完整流程
              </span>
            </span>
            {providerType === 'mock' ? (
              <span className="flex items-center gap-1 text-[10px] text-warn">
                <Check size={12} strokeWidth={3} />
                已选择
              </span>
            ) : (
              <span className="text-[9px] text-faint">无需联网</span>
            )}
          </button>

          {providerType === 'mock' ? (
            <div className="rounded-xl border border-warn/20 bg-warn/5 px-4 py-3 text-xs leading-relaxed text-muted">
              模拟模型会在每张图片上为每个类别返回一个固定位置的框，用于验证导入、预标注、审核与导出流程。
            </div>
          ) : (
            <>
              <Field label="接口密钥" hint={savedKeyHint}>
                <Input
                  type="password"
                  autoFocus
                  value={apiKey}
                  placeholder={editing?.has_api_key ? '留空则保持原密钥' : '粘贴服务商提供的接口密钥'}
                  onChange={(event) => {
                    setApiKey(event.target.value)
                    setTestResult(null)
                  }}
                />
              </Field>

              <div className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-panel-2/40 px-3 py-2">
                <span className="shrink-0 text-[9px] text-faint">接口地址</span>
                <span className="min-w-0 truncate font-mono text-[9px] text-muted">
                  {baseUrl || '在高级设置中填写'}
                </span>
              </div>

              <Field
                label="视觉模型"
                hint={
                  models.length > preset.suggestedModels.length
                    ? `已获取 ${models.length} 个模型${recommended ? `，推荐 ${recommended}` : ''}`
                    : `${preset.defaultModel ? `默认 ${preset.defaultModel}，` : ''}可粘贴密钥后从接口获取模型列表`
                }
                error={discoveryError || null}
              >
                <div className="flex gap-2">
                  <Input
                    list="labeling-model-options"
                    value={modelName}
                    placeholder={preset.defaultModel || '例如：qwen-vl-max'}
                    onChange={(event) => {
                      setModelName(event.target.value)
                      setTestResult(null)
                    }}
                  />
                  <datalist id="labeling-model-options">
                    {modelOptions.map((model) => (
                      <option key={model} value={model}>
                        {model === recommended ? '推荐模型' : model}
                      </option>
                    ))}
                  </datalist>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-9 shrink-0"
                    loading={discoverModels.isPending}
                    disabled={
                      !baseUrl.trim() || (!apiKey.trim() && !editing?.has_api_key)
                    }
                    onClick={discover}
                  >
                    <RefreshCw size={13} />
                    获取模型
                  </Button>
                </div>
              </Field>

              {presetId === 'custom' ? (
                <Field
                  label="接口地址"
                  hint="填写包含版本号的完整地址；程序会自动拼接对话接口和模型列表接口。"
                >
                  <Input
                    value={baseUrl}
                    placeholder="https://example.com/v1"
                    onChange={(event) => changeBaseUrl(event.target.value)}
                  />
                </Field>
              ) : null}
            </>
          )}
        </section>

        <details className="group rounded-xl border border-border bg-panel-2/25">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[11px] font-medium text-muted transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
            <ChevronDown
              size={13}
              className="text-faint transition-transform group-open:rotate-180"
            />
            高级设置
            <span className="text-[9px] font-normal text-faint">
              配置名称、接口地址与运行参数
            </span>
          </summary>
          <div className="flex flex-col gap-4 border-t border-border/70 px-4 py-4">
            {providerType === 'openai_compat' ? (
              <>
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <Field label="配置名称">
                    <Input
                      value={name}
                      onChange={(event) => {
                        setName(event.target.value)
                        setAutoName(false)
                      }}
                    />
                  </Field>
                  <Field label="接口地址" hint="一般保持自动填好的地址即可。">
                    <Input
                      value={baseUrl}
                      placeholder="https://example.com/v1"
                      onChange={(event) => changeBaseUrl(event.target.value)}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <Field label="并发数" hint="同时请求的图片数，过高容易触发限流。">
                    <Input
                      type="number"
                      min={1}
                      max={16}
                      value={params.concurrency}
                      onChange={(event) =>
                        setParams((prev) => ({
                          ...prev,
                          concurrency: Number(event.target.value),
                        }))
                      }
                    />
                  </Field>
                  <Field label="图片长边（像素）" hint="发送前等比缩小，减少用量。">
                    <Input
                      type="number"
                      min={256}
                      max={4096}
                      step={64}
                      value={params.max_image_side}
                      onChange={(event) =>
                        setParams((prev) => ({
                          ...prev,
                          max_image_side: Number(event.target.value),
                        }))
                      }
                    />
                  </Field>
                  <Field label="请求超时（秒）">
                    <Input
                      type="number"
                      min={5}
                      max={600}
                      value={params.timeout_s}
                      onChange={(event) =>
                        setParams((prev) => ({
                          ...prev,
                          timeout_s: Number(event.target.value),
                        }))
                      }
                    />
                  </Field>
                  <Field label="温度">
                    <Input
                      type="number"
                      min={0}
                      max={2}
                      step={0.1}
                      value={params.temperature}
                      onChange={(event) =>
                        setParams((prev) => ({
                          ...prev,
                          temperature: Number(event.target.value),
                        }))
                      }
                    />
                  </Field>
                  <Field label="最大输出长度">
                    <Input
                      type="number"
                      min={128}
                      max={16384}
                      step={128}
                      value={params.max_tokens}
                      onChange={(event) =>
                        setParams((prev) => ({
                          ...prev,
                          max_tokens: Number(event.target.value),
                        }))
                      }
                    />
                  </Field>
                  <div className="flex flex-col justify-center gap-1.5">
                    <span className="text-xs font-medium text-ink/85">结构化输出</span>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={params.json_mode}
                        label="结构化输出"
                        onChange={(checked) =>
                          setParams((prev) => ({
                            ...prev,
                            json_mode: checked,
                          }))
                        }
                      />
                      <span className="text-[10px] leading-relaxed text-faint">
                        部分服务商需要开启
                      </span>
                    </div>
                  </div>
                </div>

                <Field
                  label="附加请求头（可选）"
                  hint='JSON 对象，例如 {"X-DashScope-DataInspection":"enable"}。'
                  error={headersError}
                >
                  <Textarea
                    rows={2}
                    value={headersText}
                    placeholder='{"Header-Name": "value"}'
                    onChange={(event) => setHeadersText(event.target.value)}
                  />
                </Field>
                <Field
                  label="附加指令（可选）"
                  hint="会追加到类别提示词之后，用于补充输出要求。"
                >
                  <Textarea
                    rows={3}
                    value={params.extra_instructions}
                    placeholder="例如：优先检测距离较近的目标；不要输出被遮挡超过一半的框。"
                    onChange={(event) =>
                      setParams((prev) => ({
                        ...prev,
                        extra_instructions: event.target.value,
                      }))
                    }
                  />
                </Field>
              </>
            ) : (
              <Field label="配置名称">
                <Input
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value)
                    setAutoName(false)
                  }}
                />
              </Field>
            )}
          </div>
        </details>

        {testResult ? (
          <div
            className={
              testResult.ok
                ? 'rounded-xl border border-success/25 bg-success/5 px-4 py-3'
                : 'rounded-xl border border-danger/25 bg-danger/5 px-4 py-3'
            }
          >
            <div
              className={
                testResult.ok
                  ? 'text-xs font-medium text-success'
                  : 'text-xs font-medium text-danger'
              }
            >
              {testResult.ok ? '连接成功' : '连接失败'}
            </div>
            <div className="mt-1 text-[11px] leading-relaxed text-muted">
              {testResult.message}
            </div>
            <div className="mt-1 text-[10px] text-faint">
              耗时 {testResult.latency_ms} 毫秒
              {testResult.http_status ? ` · 状态码 ${testResult.http_status}` : ''}
            </div>
            {testResult.raw_excerpt ? (
              <pre className="mt-2 max-h-28 overflow-auto rounded-lg border border-border bg-panel px-2.5 py-2 text-[10px] leading-relaxed text-faint">
                {testResult.raw_excerpt}
              </pre>
            ) : null}
          </div>
        ) : null}
      </div>
    </Dialog>
  )
}
