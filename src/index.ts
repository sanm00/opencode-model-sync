import type { Plugin } from "@opencode-ai/plugin"
import { syncProviders } from "./core.js"
import type { SyncOptions } from "./types.js"

const ModelSyncPlugin: Plugin = async (_input, pluginOptions = {}) => ({
  config: async (config) => {
    void syncProviders(config, {
      ...pluginOptions as SyncOptions,
      updateRuntimeConfig: false,
    }).catch(() => {})
  },
})

export { syncProviders } from "./core.js"
export type { ProviderStatus, SyncOptions, SyncStatus } from "./types.js"
export default ModelSyncPlugin
