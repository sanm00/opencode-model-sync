import assert from "node:assert/strict"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { syncProviders } from "../dist/index.js"

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "opencode-model-sync-"))
  const configPath = join(directory, "opencode.jsonc")
  const statusPath = join(directory, "status.json")
  await writeFile(configPath, `{
  // Keep this comment.
  "provider": {
    "alpha": {
      "options": { "baseURL": "https://alpha.test/v1", "apiKey": "{env:SECRET}" },
      "models": {
        "old": { "name": "old" },
        "keep": { "modalities": { "input": ["text"] } }
      }
    },
    "beta": {
      "options": { "baseURL": "https://beta.test/v1" },
      "models": { "existing": { "name": "existing" } }
    }
  }
}\n`)
  return { configPath, statusPath }
}

test("syncs all providers while preserving failed providers and secrets", async (context) => {
  const { configPath, statusPath } = await fixture()
  const runtime = {
    provider: {
      alpha: {
        options: { baseURL: "https://alpha.test/v1", apiKey: "resolved-secret" },
        models: {
          old: { name: "old" },
          keep: { modalities: { input: ["text"] } },
        },
      },
      beta: {
        options: { baseURL: "https://beta.test/v1" },
        models: { existing: { name: "existing" } },
      },
    },
  }
  const originalFetch = globalThis.fetch
  context.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("beta")) return new Response("failed", { status: 503 })
    assert.equal(init.headers.Authorization, "Bearer resolved-secret")
    return Response.json({ data: [{ id: "new" }, { id: "keep" }, { id: "new" }] })
  }

  const status = await syncProviders(runtime, { configPath, statusPath, updateRuntimeConfig: false })
  const raw = await readFile(configPath, "utf8")

  assert.match(raw, /Keep this comment/)
  assert.match(raw, /\{env:SECRET\}/)
  assert.doesNotMatch(raw, /resolved-secret/)
  assert.doesNotMatch(raw, /"old"/)
  assert.match(raw, /"modalities"/)
  assert.match(raw, /"existing"/)
  assert.equal(status.status, "warning")
  assert.deepEqual(status.providers.alpha, { status: "success", count: 2, changed: true })
  assert.deepEqual(status.providers.beta, { status: "warning", message: "GET /models returned HTTP 503" })
})

test("updates only selected providers", async (context) => {
  const { configPath, statusPath } = await fixture()
  const raw = await readFile(configPath, "utf8")
  const runtime = JSON.parse(raw.replace("// Keep this comment.", ""))
  const requested = []
  const originalFetch = globalThis.fetch
  context.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async (url) => {
    requested.push(String(url))
    return Response.json({ data: [{ id: "only-alpha" }] })
  }

  const status = await syncProviders(runtime, { configPath, statusPath, providerIDs: ["alpha"] })

  assert.equal(requested.length, 1)
  assert.match(requested[0], /alpha/)
  assert.deepEqual(Object.keys(status.providers), ["alpha"])
  assert.equal(runtime.provider.alpha.models["only-alpha"].name, "only-alpha")
  assert.ok(runtime.provider.beta.models.existing)
})
