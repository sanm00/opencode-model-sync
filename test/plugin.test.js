import assert from "node:assert/strict"
import test from "node:test"

import plugin from "../dist/index.js"

test("server config hook does not wait for model requests", async (context) => {
  const originalFetch = globalThis.fetch
  context.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = () => new Promise(() => {})
  const hooks = await plugin({}, { timeout: 60_000 })
  const config = {
    provider: {
      slow: { options: { baseURL: "https://slow.test/v1" }, models: {} },
    },
  }

  const started = performance.now()
  await Promise.race([
    hooks.config(config),
    new Promise((_, reject) => setTimeout(() => reject(new Error("config hook blocked startup")), 100)),
  ])

  assert.ok(performance.now() - started < 100)
})
