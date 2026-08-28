import { access } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join, resolve } from "node:path"

export async function resolveConfigPath(explicit?: string) {
  if (explicit) return resolve(explicit)
  if (process.env.OPENCODE_CONFIG) return resolve(process.env.OPENCODE_CONFIG)

  const configHome = process.env.XDG_CONFIG_HOME || join(homedir(), ".config")
  const candidates = [
    join(configHome, "opencode", "opencode.json"),
    join(configHome, "opencode", "opencode.jsonc"),
  ]

  for (const candidate of candidates) {
    try {
      await access(candidate)
      return candidate
    } catch {
      // Continue to the next standard location.
    }
  }

  throw new Error("OpenCode config not found; set configPath or OPENCODE_CONFIG")
}

export function resolveStatusPath(configPath: string, explicit?: string) {
  return explicit ? resolve(explicit) : join(dirname(configPath), ".model-sync-status.json")
}
