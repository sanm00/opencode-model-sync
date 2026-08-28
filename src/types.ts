export type ModelConfig = Record<string, unknown>

export type ProviderConfig = {
  options?: Record<string, unknown>
  models?: Record<string, ModelConfig>
  [key: string]: unknown
}

export type OpenCodeConfig = {
  provider?: Record<string, ProviderConfig>
  [key: string]: unknown
}

export type ProviderStatus = {
  status: "success" | "warning"
  count?: number
  changed?: boolean
  message?: string
}

export type SyncStatus = {
  status: "success" | "warning"
  providers: Record<string, ProviderStatus>
  updatedAt: string
}

export type SyncOptions = {
  configPath?: string
  statusPath?: string
  providerIDs?: string[]
  endpoint?: string
  timeout?: number
  defaultModel?: ModelConfig
  updateRuntimeConfig?: boolean
}
