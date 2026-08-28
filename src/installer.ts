import { access, mkdir, readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join, resolve } from "node:path"
import { applyEdits, modify, parse, printParseErrorCode, type FormattingOptions, type ParseError } from "jsonc-parser"

const SERVER_PLUGIN = "opencode-model-sync"
const TUI_PLUGIN = "opencode-model-sync/tui"

type InstallerOptions = {
  configDir?: string
}

type InstallResult = {
  configDir: string
  files: Array<{ path: string; changed: boolean }>
}

function formattingOptions(raw: string): FormattingOptions {
  const indent = raw.match(/\n([ \t]+)\S/)?.[1] ?? "  "
  return {
    insertSpaces: !indent.includes("\t"),
    tabSize: indent.includes("\t") ? 1 : indent.length,
    eol: raw.includes("\r\n") ? "\r\n" : "\n",
  }
}

async function updatePluginConfig(path: string, schema: string, plugin: string) {
  let raw: string
  try {
    raw = await readFile(path, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    raw = `${JSON.stringify({ $schema: schema, plugin: [] }, null, 2)}\n`
  }

  const errors: ParseError[] = []
  const config = parse(raw, errors) as { plugin?: unknown }
  if (errors.length > 0) {
    const detail = errors.map((error) => printParseErrorCode(error.error)).join(", ")
    throw new Error(`cannot parse ${path}: ${detail}`)
  }
  if (config.plugin !== undefined && !Array.isArray(config.plugin)) {
    throw new Error(`${path}: plugin must be an array`)
  }

  const plugins = config.plugin ?? []
  const installed = plugins.some((entry) => (
    entry === plugin || (Array.isArray(entry) && entry[0] === plugin)
  ))
  if (installed) return false

  const next = applyEdits(raw, modify(raw, ["plugin", plugins.length], plugin, {
    isArrayInsertion: true,
    formattingOptions: formattingOptions(raw),
  }))
  await writeFile(path, next, { mode: 0o600 })
  return true
}

export async function install(options: InstallerOptions = {}): Promise<InstallResult> {
  const configHome = process.env.XDG_CONFIG_HOME || join(homedir(), ".config")
  const configDir = resolve(options.configDir ?? join(configHome, "opencode"))
  await mkdir(configDir, { recursive: true })
  const jsonPath = join(configDir, "opencode.json")
  const jsoncPath = join(configDir, "opencode.jsonc")
  let configPath = jsonPath
  try {
    await access(jsonPath)
  } catch {
    try {
      await access(jsoncPath)
      configPath = jsoncPath
    } catch {
      // Create opencode.json when neither standard config file exists.
    }
  }

  const files = await Promise.all([
    [configPath, "https://opencode.ai/config.json", SERVER_PLUGIN],
    [join(configDir, "tui.json"), "https://opencode.ai/tui.json", TUI_PLUGIN],
  ].map(async ([path, schema, plugin]) => ({
    path,
    changed: await updatePluginConfig(path, schema, plugin),
  })))

  return { configDir, files }
}
