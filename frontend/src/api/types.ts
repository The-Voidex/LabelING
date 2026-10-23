export type ImageStatus = 'unlabeled' | 'labeled' | 'confirmed'
export type AnnotationSource = 'ai' | 'human'
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
export type ProviderType = 'openai_compat' | 'mock'

export interface Project {
  id: number
  name: string
  description: string
  model_config_id: number | null
  model_name: string | null
  image_count: number
  class_count: number
  created_at: string
  updated_at: string
}

export interface ProjectStats {
  unlabeled: number
  labeled: number
  confirmed: number
  missing: number
  total: number
}

export interface LabelClass {
  id: number
  project_id: number
  name: string
  color: string
  prompt: string
  order_index: number
  annotation_count: number
}

export interface ImageAsset {
  id: number
  project_id: number
  file_name: string
  original_path: string
  storage_mode: 'copy' | 'reference'
  width: number
  height: number
  status: ImageStatus
  missing: boolean
  sha256: string
  thumbnail_url: string
  file_url: string
  created_at: string
  updated_at: string
}

export interface ImagePage {
  items: ImageAsset[]
  total: number
  page: number
  page_size: number
}

export interface Annotation {
  id: number
  image_id: number
  class_id: number
  x1: number
  y1: number
  x2: number
  y2: number
  source: AnnotationSource
  confidence: number | null
}

export interface ModelParams {
  concurrency: number
  max_image_side: number
  temperature: number
  timeout_s: number
  max_tokens: number
  json_mode: boolean
  extra_headers: Record<string, string>
  extra_instructions: string
  [key: string]: unknown
}

export interface ModelConfig {
  id: number
  name: string
  provider_type: ProviderType
  base_url: string
  api_key_masked: string
  has_api_key: boolean
  model_name: string
  params: ModelParams
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface ProviderTestResult {
  ok: boolean
  message: string
  latency_ms: number
  parsed_count: number
  http_status: number | null
  raw_excerpt: string
}

export interface ModelDiscoveryResult {
  models: string[]
  recommended: string | null
  count: number
}

export interface JobError {
  image_id: number
  error_message: string
  raw_excerpt: string
  latency_ms: number | null
}

export interface PrelabelJob {
  id: number
  project_id: number
  status: JobStatus
  total: number
  processed: number
  succeeded: number
  failed: number
  cancel_requested: boolean
  error_summary: string
  prompt_tokens: number
  completion_tokens: number
  created_at: string
  started_at: string | null
  finished_at: string | null
  errors: JobError[]
}

export interface ImportPreview {
  found: number
  duplicates: number
  total_bytes: number
  limit_exceeded: boolean
  unreadable: number
}

export interface ImportResult {
  imported: number
  skipped_duplicates: number
  failed: number
}

export interface FsEntry {
  name: string
  path: string
  size?: number
}

export interface FsListing {
  path: string
  parent: string | null
  dirs: FsEntry[]
  images: FsEntry[]
  image_count: number
  truncated: boolean
}

export interface ImageNavItem {
  id: number
  file_name: string
  status: ImageStatus
  missing: boolean
  sha256: string
}

export interface BatchConfirmResult {
  confirmed: number
  skipped: number
}

export interface BatchUnconfirmResult {
  unconfirmed: number
  skipped: number
}
