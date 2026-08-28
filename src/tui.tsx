/** @jsxImportSource @opentui/solid */
import { readFile } from "node:fs/promises"
import { createSignal, onCleanup } from "solid-js"
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { syncProviders } from "./core.js"
import { resolveConfigPath, resolveStatusPath } from "./paths.js"
import type { SyncOptions, SyncStatus } from "./types.js"

const STATUS_DURATION = 60_000

const tui: TuiPlugin = async (api, pluginOptions) => {
  const options = pluginOptions as SyncOptions | undefined ?? {}
  const configPath = await resolveConfigPath(options.configPath)
  const statusPath = resolveStatusPath(configPath, options.statusPath)
  const [status, setStatus] = createSignal<SyncStatus>()
  const [syncing, setSyncing] = createSignal(false)
  let hideTimer: ReturnType<typeof setTimeout> | undefined
  let lastUpdatedAt: string | undefined

  function showStatus(next: SyncStatus) {
    if (hideTimer) clearTimeout(hideTimer)
    lastUpdatedAt = next.updatedAt
    const remaining = STATUS_DURATION - (Date.now() - Date.parse(next.updatedAt))
    if (!Number.isFinite(remaining) || remaining <= 0) {
      setStatus(undefined)
      return
    }
    setStatus(next)
    hideTimer = setTimeout(() => setStatus(undefined), remaining)
  }

  async function readStatus() {
    try {
      return JSON.parse(await readFile(statusPath, "utf8")) as SyncStatus
    } catch {
      return undefined
    }
  }

  const initialStatus = await readStatus()
  if (initialStatus?.providers) showStatus(initialStatus)
  const refreshTimer = setInterval(async () => {
    const next = await readStatus()
    if (next?.providers && next.updatedAt !== lastUpdatedAt) showStatus(next)
  }, 1000)
  onCleanup(() => {
    clearInterval(refreshTimer)
    if (hideTimer) clearTimeout(hideTimer)
  })

  async function sync(providerIDs?: string[]) {
    if (syncing()) return
    setSyncing(true)
    api.ui.dialog.clear()
    try {
      showStatus(await syncProviders(api.state.config, {
        ...options,
        configPath,
        statusPath,
        providerIDs,
        updateRuntimeConfig: false,
      }))
    } catch (error) {
      showStatus({
        status: "warning",
        providers: {
          "Model sync": {
            status: "warning",
            message: error instanceof Error ? error.message : String(error),
          },
        },
        updatedAt: new Date().toISOString(),
      })
    } finally {
      setSyncing(false)
    }
  }

  function selectProvider() {
    if (syncing()) return
    const providerIDs = Object.keys(api.state.config.provider ?? {}).sort()
    if (providerIDs.length === 0) {
      showStatus({
        status: "warning",
        providers: { "Model sync": { status: "warning", message: "No providers are configured." } },
        updatedAt: new Date().toISOString(),
      })
      return
    }

    api.ui.dialog.replace(() => (
      <api.ui.DialogSelect
        title="Sync provider models"
        options={[
          { title: "All providers", value: undefined, description: `Update ${providerIDs.length} providers` },
          ...providerIDs.map((providerID) => ({ title: providerID, value: providerID })),
        ]}
        onSelect={(option) => void sync(option.value ? [option.value] : undefined)}
      />
    ))
  }

  const unregisterCommand = api.command?.register(() => [{
    title: "Sync provider models",
    value: "model-sync",
    description: "Update models for one provider or all providers",
    category: "Models",
    slash: { name: "model-sync" },
    onSelect: selectProvider,
  }])
  if (unregisterCommand) onCleanup(unregisterCommand)

  const color = () => status()?.status === "warning"
    ? api.theme.current.warning
    : api.theme.current.success
  const text = () => {
    if (syncing()) return "Syncing provider models..."
    const current = status()
    if (!current) return ""
    const details = Object.entries(current.providers).map(([providerID, result]) => (
      result.status === "success"
        ? `${providerID}: ${result.count ?? 0} models${result.changed ? " updated" : ""}`
        : `${providerID}: ${result.message ?? "sync failed"}`
    )).join(" | ")
    const prefix = current.status === "success" ? "models reload succeeded" : "models reload failed"
    return `${prefix}: ${details}`
  }

  api.slots.register({
    slots: {
      home_bottom() {
        if (!syncing() && !status()) return null
        return (
          <box width="100%" alignItems="center">
            <text fg={status() ? color() : api.theme.current.textMuted}>{text()}</text>
          </box>
        )
      },
    },
  })
}

const plugin: TuiPluginModule & { id: string } = {
  id: "opencode-model-sync",
  tui,
}

export default plugin
