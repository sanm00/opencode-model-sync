import { randomUUID } from "node:crypto"
import { readFile, rename, unlink, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { applyEdits, modify, parse, printParseErrorCode, type FormattingOptions, type ParseError } from "jsonc-parser"
import { resolveConfigPath, resolveStatusPath } from "./paths.js"
import type { ModelConfig, OpenCodeConfig, ProviderConfig, ProviderStatus, SyncOptions, SyncStatus } from "./types.js"

const DEFAULT_MODEL: ModelConfig = {
  limit: {
    context: 204800,
    output: 131072,
  },
}

function asObject(value: unknown): Record<string, any> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, any>
    : undefined
}

function modelIDs(payload: unknown) {
  const data = asObject(payload)?.data
  if (!Array.isArray(data)) return []

  return [...new Set(data
    .map((item) => asObject(item)?.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 256),
  )].sort()
}

function modelsURL(baseURL: string, endpoint: string) {
  const base = baseURL.endsWith("/") ? baseURL : `${baseURL}/`
  return new URL(endpoint.replace(/^\/+/, ""), base)
}

function buildModels(ids: string[], existing: Record<string, ModelConfig>, defaults: ModelConfig) {
  return Object.fromEntries(ids.map((id) => [
    id,
    {
      ...defaults,
      ...asObject(existing[id]),
      name: asObject(existing[id])?.name ?? id,
    },
  ]))
}

async function atomicWrite(path: string, content: string) {
  const temporaryPath = resolve(dirname(path), `.${process.pid}-${randomUUID()}.tmp`)
  try {
    await writeFile(temporaryPath, content, { mode: 0o600 })
    await rename(temporaryPath, path)
  } catch (error) {
    await unlink(temporaryPath).catch(() => {})
    throw error
  }
}

async function fetchModels(provider: ProviderConfig, options: Required<Pick<SyncOptions, "endpoint" | "timeout" | "defaultModel">>) {
  const providerOptions = asObject(provider.options)
  const baseURL = providerOptions?.baseURL
  const apiKey = providerOptions?.apiKey

  if (typeof baseURL !== "string" || baseURL.length === 0) {
    throw new Error("options.baseURL is not configured")
  }

  const headers: Record<string, string> = { Accept: "application/json" }
  if (typeof apiKey === "string" && apiKey.length > 0) headers.Authorization = `Bearer ${apiKey}`

  const response = await fetch(modelsURL(baseURL, options.endpoint), {
    headers,
    signal: AbortSignal.timeout(options.timeout),
  })
  if (!response.ok) throw new Error(`GET /models returned HTTP ${response.status}`)

  const ids = modelIDs(await response.json())
  if (ids.length === 0) throw new Error("the remote model list is empty or invalid")

  return buildModels(ids, provider.models ?? {}, options.defaultModel)
}

function formattingOptions(raw: string): FormattingOptions {
  const indent = raw.match(/\n([ \t]+)\S/)?.[1] ?? "  "
  return {
    insertSpaces: !indent.includes("\t"),
    tabSize: indent.includes("\t") ? 1 : indent.length,
    eol: raw.includes("\r\n") ? "\r\n" : "\n",
  }
}

export async function persistStatus(path: string, status: SyncStatus) {
  await atomicWrite(path, `${JSON.stringify(status)}\n`)
}

export async function syncProviders(config: OpenCodeConfig, options: SyncOptions = {}): Promise<SyncStatus> {
  const providers = config.provider ?? {}
  const providerIDs = [...new Set(options.providerIDs ?? Object.keys(providers))].sort()
  const syncOptions = {
    endpoint: options.endpoint ?? "models",
    timeout: options.timeout ?? 5000,
    defaultModel: options.defaultModel ?? DEFAULT_MODEL,
  }

  const entries = await Promise.all(providerIDs.map(async (providerID) => {
    const provider = providers[providerID]
    if (!provider) return [providerID, { status: "warning", message: "provider is not configured" }] as const
    try {
      return [providerID, {
        status: "success",
        count: 0,
        models: await fetchModels(provider, syncOptions),
      }] as const
    } catch (error) {
      return [providerID, {
        status: "warning",
        message: error instanceof Error ? error.message : String(error),
      }] as const
    }
  }))

  const results: Record<string, ProviderStatus & { models?: Record<string, ModelConfig> }> = Object.fromEntries(entries)
  const successful = Object.values(results).some((result) => result.status === "success")
  const configPath = await resolveConfigPath(options.configPath)
  let changed = false

  if (successful) {
    let raw = await readFile(configPath, "utf8")
    const errors: ParseError[] = []
    const persisted = parse(raw, errors) as OpenCodeConfig
    if (errors.length > 0) {
      const detail = errors.map((error) => printParseErrorCode(error.error)).join(", ")
      throw new Error(`cannot parse ${configPath}: ${detail}`)
    }
    const persistedProviders = persisted.provider ?? {}

    for (const [providerID, result] of Object.entries(results)) {
      if (result.status !== "success" || !result.models) continue
      const persistedProvider = persistedProviders[providerID]
      if (!persistedProvider) {
        results[providerID] = { status: "warning", message: `provider is not defined in ${configPath}` }
        continue
      }
      result.count = Object.keys(result.models).length
      result.changed = JSON.stringify(persistedProvider.models) !== JSON.stringify(result.models)
      if (result.changed) {
        raw = applyEdits(raw, modify(raw, ["provider", providerID, "models"], result.models, {
          formattingOptions: formattingOptions(raw),
        }))
        changed = true
      }
      if (options.updateRuntimeConfig !== false) providers[providerID].models = result.models
      delete result.models
    }

    if (changed) await atomicWrite(configPath, raw)
  }

  for (const result of Object.values(results)) delete result.models

  const status: SyncStatus = {
    status: Object.values(results).some((result) => result.status === "warning") ? "warning" : "success",
    providers: results,
    updatedAt: new Date().toISOString(),
  }
  await persistStatus(resolveStatusPath(configPath, options.statusPath), status)
  return status
}
