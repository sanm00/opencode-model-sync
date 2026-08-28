import assert from "node:assert/strict"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { parse } from "jsonc-parser"

import { install } from "../dist/installer.js"

test("creates server and TUI configuration", async () => {
  const configDir = await mkdtemp(join(tmpdir(), "opencode-model-sync-install-"))
  const result = await install({ configDir })
  const server = JSON.parse(await readFile(join(configDir, "opencode.json"), "utf8"))
  const tui = JSON.parse(await readFile(join(configDir, "tui.json"), "utf8"))

  assert.deepEqual(result.files.map((file) => file.changed), [true, true])
  assert.deepEqual(server.plugin, ["opencode-model-sync"])
  assert.deepEqual(tui.plugin, ["opencode-model-sync/tui"])
})

test("preserves JSONC and is idempotent", async () => {
  const configDir = await mkdtemp(join(tmpdir(), "opencode-model-sync-install-"))
  const configPath = join(configDir, "opencode.jsonc")
  await writeFile(configPath, `{
  // Existing configuration must survive.
  "plugin": ["existing-plugin"],
  "model": "provider/model"
}\n`)

  await install({ configDir })
  const second = await install({ configDir })
  const raw = await readFile(configPath, "utf8")
  const config = parse(raw)

  assert.match(raw, /Existing configuration must survive/)
  assert.equal(config.model, "provider/model")
  assert.deepEqual(config.plugin, ["existing-plugin", "opencode-model-sync"])
  assert.deepEqual(second.files.map((file) => file.changed), [false, false])
  await assert.rejects(readFile(join(configDir, "opencode.json"), "utf8"), { code: "ENOENT" })
})

test("does not overwrite an invalid plugin property", async () => {
  const configDir = await mkdtemp(join(tmpdir(), "opencode-model-sync-install-"))
  const configPath = join(configDir, "opencode.json")
  await writeFile(configPath, `{ "plugin": "existing-plugin" }\n`)

  await assert.rejects(install({ configDir }), /plugin must be an array/)
  assert.equal(await readFile(configPath, "utf8"), `{ "plugin": "existing-plugin" }\n`)
})
