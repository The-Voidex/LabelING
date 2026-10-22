import { useEffect, useState } from 'react'
import {
  Cpu,
  KeyRound,
  Pencil,
  Plus,
  PlugZap,
  Trash2,
} from 'lucide-react'
import {
  useCreateModelConfig,
  useDeleteModelConfig,
  useModelConfigs,
  useTestDraftModelConfig,
  useTestModelConfig,
  useUpdateModelConfig,
} from '../api/models.ts'
import type { ModelConfig, ModelParams, ProviderTestResult, ProviderType } from '../api/types.ts'
import {
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  Input,
  Select,
  Switch,
  Textarea,
} from '../components/ui.tsx'
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

const PROVIDER_LABELS: Record<ProviderType, string> = {
  openai_compat: 'OpenAI 兼容接口',
  mock: '模拟模型（仅开发测试）',
}

export function ModelsPage() {
  const configs = useModelConfigs()
  const deleteConfig = useDeleteModelConfig()
  const testModel = useTestModelConfig()
  const toast = useToast()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ModelConfig | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ModelConfig | null>(null)

  const runTest = (config: ModelConfig) => {
    testModel.mutate(config.id, {
      onSuccess: (result) => {
        toast(
          result.ok
            ? `${result.message}（耗时 ${result.latency_ms} ms）`
            : result.message,
          result.ok ? 'success' : 'error',
        )
      },
      onError: (error) => toast(error.message, 'error'),
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
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink">模型设置</h1>
          <p className="mt-1 text-xs text-muted">
            配置 OpenAI 兼容的视觉模型接口。支持千问、DeepSeek 等国内平台，也可以先使用模拟模型体验流程。
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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className="h-40 animate-pulse rounded-2xl border border-border bg-panel"
            />
          ))}
        </div>
      ) : configs.data && configs.data.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {configs.data.map((config) => (
            <div
              key={config.id}
              className="flex flex-col rounded-2xl border border-border bg-panel p-5"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-accent/20 bg-accent-soft/50 text-accent">
                  <Cpu size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-ink">{config.name}</h2>
                    <span className="rounded-full border border-border bg-panel-2 px-2 py-0.5 text-[10px] text-muted">
                      {PROVIDER_LABELS[config.provider_type]}
                    </span>
                  </div>
                  <div className="mt-1.5 text-xs text-muted">
                    {config.provider_type === 'mock'
                      ? '不发起网络请求，返回固定位置的测试框。'
                      : `${config.model_name || '未填写模型'} · ${config.base_url || '未填写 Base URL'}`}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-muted sm:grid-cols-4">
                <div className="rounded-lg bg-panel-2 px-2.5 py-2">
                  <div className="text-ink">{config.params.concurrency}</div>
                  <div>并发数</div>
                </div>
                <div className="rounded-lg bg-panel-2 px-2.5 py-2">
                  <div className="text-ink">{config.params.max_image_side} px</div>
                  <div>长边上限</div>
                </div>
                <div className="rounded-lg bg-panel-2 px-2.5 py-2">
                  <div className="text-ink">{config.params.timeout_s} s</div>
                  <div>超时</div>
                </div>
                <div className="rounded-lg bg-panel-2 px-2.5 py-2">
                  <div className="flex items-center gap-1 truncate text-ink">
                    <KeyRound size={11} />
                    {config.has_api_key ? config.api_key_masked : '未设置'}
                  </div>
                  <div>API Key</div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Button
                  size="sm"
                  loading={testModel.isPending}
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
                  className="ml-auto text-faint hover:text-danger"
                  onClick={() => setDeleteTarget(config)}
                >
                  <Trash2 size={14} />
                  删除
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Cpu size={34} />}
          title="还没有模型配置"
          description="配置一个 OpenAI 兼容接口后，项目就可以调用它做预标注。没有 API Key 时，可以先创建模拟模型体验完整流程。"
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

      <ModelConfigDialog
        open={dialogOpen}
        editing={editing}
        onClose={() => setDialogOpen(false)}
      />

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
  const toast = useToast()

  const [name, setName] = useState('')
  const [providerType, setProviderType] = useState<ProviderType>('openai_compat')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [modelName, setModelName] = useState('')
  const [params, setParams] = useState<ModelParams>(DEFAULT_PARAMS)
  const [headersText, setHeadersText] = useState('')
  const [testResult, setTestResult] = useState<ProviderTestResult | null>(null)
  const [headersError, setHeadersError] = useState('')

  const resetFromEditing = () => {
    if (editing) {
      setName(editing.name)
      setProviderType(editing.provider_type)
      setBaseUrl(editing.base_url)
      setApiKey('')
      setModelName(editing.model_name)
      setParams({ ...DEFAULT_PARAMS, ...editing.params })
      setHeadersText(
        Object.keys(editing.params.extra_headers ?? {}).length
          ? JSON.stringify(editing.params.extra_headers, null, 2)
          : '',
      )
    } else {
      setName('')
      setProviderType('openai_compat')
      setBaseUrl('')
      setApiKey('')
      setModelName('')
      setParams(DEFAULT_PARAMS)
      setHeadersText('')
    }
    setTestResult(null)
    setHeadersError('')
  }

  useEffect(() => {
    if (open) resetFromEditing()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing])

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

  const buildPayload = () => {
    const headers = parseHeaders()
    if (headers === null) return null
    return {
      name: name.trim(),
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

  const save = () => {
    if (!name.trim()) {
      toast('请填写配置名称', 'error')
      return
    }
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
    const payload = buildPayload()
    if (!payload) return
    testDraft.mutate(
      { ...payload, name: payload.name || '临时测试' },
      {
        onSuccess: (result) => setTestResult(result),
        onError: (error) => toast(error.message, 'error'),
      },
    )
  }

  const saving = createConfig.isPending || updateConfig.isPending

  return (
    <Dialog
      open={open}
      title={editing ? '编辑模型配置' : '新建模型配置'}
      description="图片会以 Base64 发送到该接口，接口需要支持视觉输入并返回检测框坐标。"
      width="max-w-2xl"
      onClose={() => {
        onClose()
        resetFromEditing()
      }}
      footer={
        <>
          <Button loading={testDraft.isPending} onClick={runTest}>
            <PlugZap size={15} />
            测试连接
          </Button>
          <Button
            onClick={() => {
              onClose()
              resetFromEditing()
            }}
          >
            取消
          </Button>
          <Button variant="primary" loading={saving} onClick={save}>
            保存配置
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="配置名称">
            <Input
              value={name}
              placeholder="例如：千问 VL Max"
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field label="接口类型">
            <Select
              value={providerType}
              onChange={(event) => {
                setProviderType(event.target.value as ProviderType)
                setTestResult(null)
              }}
            >
              <option value="openai_compat">OpenAI 兼容接口</option>
              <option value="mock">模拟模型（仅开发测试）</option>
            </Select>
          </Field>
        </div>

        {providerType === 'mock' ? (
          <div className="rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 text-xs leading-relaxed text-muted">
            模拟模型不会请求外部接口，会在每张图片上为每个类别返回一个固定位置的框，用于验证导入、预标注、审核与导出流程。
          </div>
        ) : (
          <>
            <Field
              label="Base URL"
              hint="填写包含版本号的完整地址，例如 https://dashscope.aliyuncs.com/compatible-mode/v1；程序会自动拼接 /chat/completions。"
            >
              <Input
                value={baseUrl}
                placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
                onChange={(event) => setBaseUrl(event.target.value)}
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="API Key"
                hint={
                  editing?.has_api_key
                    ? `已保存 ${editing.api_key_masked}，留空表示不修改。`
                    : '仅保存在本机，不会回传到浏览器。'
                }
              >
                <Input
                  type="password"
                  value={apiKey}
                  placeholder={editing?.has_api_key ? '留空则不修改' : 'sk-...'}
                  onChange={(event) => setApiKey(event.target.value)}
                />
              </Field>
              <Field label="模型名称" hint="以服务商文档为准，例如 qwen-vl-max。">
                <Input
                  value={modelName}
                  placeholder="qwen-vl-max"
                  onChange={(event) => setModelName(event.target.value)}
                />
              </Field>
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="并发数" hint="同时请求的图片数，过高容易触发限流。">
            <Input
              type="number"
              min={1}
              max={16}
              value={params.concurrency}
              onChange={(event) =>
                setParams((prev) => ({ ...prev, concurrency: Number(event.target.value) }))
              }
            />
          </Field>
          <Field label="图片长边上限（px）" hint="发送前等比缩小，降低 token 消耗。">
            <Input
              type="number"
              min={256}
              max={4096}
              step={64}
              value={params.max_image_side}
              onChange={(event) =>
                setParams((prev) => ({ ...prev, max_image_side: Number(event.target.value) }))
              }
            />
          </Field>
          <Field label="超时（秒）">
            <Input
              type="number"
              min={5}
              max={600}
              value={params.timeout_s}
              onChange={(event) =>
                setParams((prev) => ({ ...prev, timeout_s: Number(event.target.value) }))
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
                setParams((prev) => ({ ...prev, temperature: Number(event.target.value) }))
              }
            />
          </Field>
          <Field label="最大 tokens">
            <Input
              type="number"
              min={128}
              max={16384}
              step={128}
              value={params.max_tokens}
              onChange={(event) =>
                setParams((prev) => ({ ...prev, max_tokens: Number(event.target.value) }))
              }
            />
          </Field>
          <div className="flex flex-col justify-center gap-1.5">
            <span className="text-xs font-medium text-muted">JSON 模式</span>
            <div className="flex items-center gap-2">
              <Switch
                checked={params.json_mode}
                label="JSON 模式"
                onChange={(checked) =>
                  setParams((prev) => ({ ...prev, json_mode: checked }))
                }
              />
              <span className="text-[11px] text-faint">
                部分服务商需要开启，也可能不支持
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

        <Field label="附加指令（可选）" hint="会追加到类别提示词之后，用于补充输出要求。">
          <Textarea
            rows={3}
            value={params.extra_instructions}
            placeholder="例如：优先检测距离较近的目标；不要输出被遮挡超过一半的框。"
            onChange={(event) =>
              setParams((prev) => ({ ...prev, extra_instructions: event.target.value }))
            }
          />
        </Field>

        {testResult ? (
          <div
            className={
              testResult.ok
                ? 'rounded-xl border border-success/30 bg-success/5 px-4 py-3'
                : 'rounded-xl border border-danger/30 bg-danger/5 px-4 py-3'
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
            <div className="mt-1 text-xs leading-relaxed text-muted">
              {testResult.message}
            </div>
            <div className="mt-1 text-[11px] text-faint">
              耗时 {testResult.latency_ms} ms
              {testResult.http_status ? ` · HTTP ${testResult.http_status}` : ''}
            </div>
            {testResult.raw_excerpt ? (
              <pre className="mt-2 max-h-28 overflow-auto rounded-lg bg-bg/70 p-2 text-[10px] leading-relaxed text-faint">
                {testResult.raw_excerpt}
              </pre>
            ) : null}
          </div>
        ) : null}
      </div>
    </Dialog>
  )
}
