export class ApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('X-LabelING-Client', 'web')
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const response = await fetch(`/api${path}`, { ...init, headers })
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    const message =
      data?.error?.message ?? `请求失败（状态码 ${response.status}）`
    throw new ApiError(message, response.status, data?.error?.code)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}
