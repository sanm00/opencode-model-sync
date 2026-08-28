# opencode-model-sync

Keep models for OpenAI-compatible OpenCode providers in sync with their
`GET /models` endpoints.

## Features

- Discovers every provider from the merged OpenCode configuration.
- Fetches providers concurrently without blocking OpenCode startup.
- Writes all successful updates to the config in one atomic operation.
- Keeps existing model metadata and removes models no longer returned upstream.
- Leaves a provider unchanged when its request fails.
- Never writes resolved API keys or other runtime provider options to disk.
- Preserves comments in `opencode.jsonc`.
- Includes an optional TUI command for updating one provider or all providers.

## Requirements

- OpenCode 1.18 or newer.
- Providers with an OpenAI-compatible `GET /models` endpoint.
- A writable JSON or JSONC OpenCode config containing the provider definitions.

## Install

After the package is published to npm, add the server plugin to
`opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-model-sync"]
}
```

To use a local checkout before publishing, run `npm install && npm run build`
in this repository and reference the absolute build path instead:

```json
{
  "plugin": ["/absolute/path/to/opencode-model-sync/dist/index.js"]
}
```

The default config path is resolved in this order:

1. The plugin option `configPath`.
2. `OPENCODE_CONFIG`.
3. `~/.config/opencode/opencode.json`.
4. `~/.config/opencode/opencode.jsonc`.

For a project config, pass its path explicitly because OpenCode merges global
and project configuration before invoking plugins:

```json
{
  "plugin": [
    [
      "opencode-model-sync",
      { "configPath": "/absolute/path/to/project/opencode.json" }
    ]
  ]
}
```

## Optional TUI

Add the TUI entry to `tui.json`:

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": ["opencode-model-sync/tui"]
}
```

For a local checkout, use the absolute path to `dist/tui.js`.

Run `/model-sync` to select one provider or all providers. The latest result is
shown centered immediately below the home prompt and disappears after one
minute. Models written in the background are loaded the next time OpenCode
starts.

## Options

Options are optional and can be supplied to either plugin entry:

```json
[
  "opencode-model-sync",
  {
    "configPath": "/absolute/path/to/opencode.jsonc",
    "statusPath": "/absolute/path/to/.model-sync-status.json",
    "endpoint": "models",
    "timeout": 5000,
    "defaultModel": {
      "limit": {
        "context": 204800,
        "output": 131072
      }
    }
  }
]
```

| Option | Default | Description |
| --- | --- | --- |
| `configPath` | Discovered | JSON/JSONC file whose provider models are updated. |
| `statusPath` | Beside config | Shared status file used by the TUI plugin. |
| `endpoint` | `models` | Path relative to each provider's `options.baseURL`. |
| `timeout` | `5000` | Request timeout in milliseconds. |
| `defaultModel` | 204800 context, 131072 output | Metadata for newly discovered models. |

Provider IDs do not need to be listed. The plugin reads all providers from the
current merged configuration. A provider without `options.baseURL` is reported
as a warning and left unchanged.

## Development

```sh
npm install
npm run check
```

## Security

The plugin requests only each configured provider's model endpoint. It uses the
runtime `apiKey` for the request but persists only the returned model IDs and
model metadata. The status file contains no credentials.

## License

MIT
