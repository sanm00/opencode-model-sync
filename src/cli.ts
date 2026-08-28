#!/usr/bin/env node
import { install } from "./installer.js"

function usage() {
  return `Usage: opencode-model-sync [install] [--config-dir <path>]

Installs the server and TUI entries in the global OpenCode configuration.

Options:
  --config-dir <path>  Override the OpenCode configuration directory
  -h, --help           Show this help message`
}

function parseArguments(args: string[]) {
  let configDir: string | undefined
  const rest = [...args]
  if (rest[0] === "install") rest.shift()

  while (rest.length > 0) {
    const argument = rest.shift()
    if (argument === "-h" || argument === "--help") return { help: true, configDir }
    if (argument === "--config-dir") {
      configDir = rest.shift()
      if (!configDir) throw new Error("--config-dir requires a path")
      continue
    }
    throw new Error(`unknown argument: ${argument}`)
  }

  return { help: false, configDir }
}

try {
  const options = parseArguments(process.argv.slice(2))
  if (options.help) {
    console.log(usage())
  } else {
    const result = await install({ configDir: options.configDir })
    for (const file of result.files) {
      console.log(`${file.changed ? "updated" : "already configured"}: ${file.path}`)
    }
    console.log("Restart OpenCode to load opencode-model-sync.")
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  console.error(usage())
  process.exitCode = 1
}
