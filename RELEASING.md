# Release Guide

[English](RELEASING.md) | [简体中文](RELEASING.zh-CN.md)

This guide is for `opencode-model-sync` maintainers. It explains how to publish
the npm package and GitHub Release with Make and GitHub Actions.

## Release Architecture

Local Make commands and GitHub Actions share the release process:

1. A local Make command checks the repository, runs tests, updates the version,
   and creates a Git tag.
2. Make pushes `main` and the tag to GitHub.
3. A `v*` tag triggers `.github/workflows/release.yml`.
4. The Release workflow verifies the version and runs the complete check suite
   again.
5. The workflow publishes the package to npm and creates a GitHub Release that
   contains the `.tgz` package.

Local commands never run `npm publish`. Publishing to npm happens only in
GitHub Actions.

## Initial Setup

### npm Token

Create an npm Automation Token and add it as a GitHub Actions secret:

1. Open the GitHub repository `Settings`.
2. Go to `Secrets and variables` > `Actions`.
3. Click `New repository secret`.
4. Enter `NPM_TOKEN` as the name.
5. Enter the npm Automation Token as the value.

Never write the token to the repository, `.npmrc`, logs, or release files.

### GitHub Actions Permissions

The repository must allow GitHub Actions to create releases. Open:

```text
Settings > Actions > General > Workflow permissions
```

The workflow declares only the permissions it needs:

- `contents: write` creates the GitHub Release.
- `id-token: write` generates npm provenance.

### npm Package Name

Before the first release, verify that `opencode-model-sync` is still available
on npm and that the npm account can publish that package name.

## Pre-release Checks

Before releasing, confirm that:

- The current branch is `main`.
- All intended changes are committed.
- The Git working tree is clean.
- `origin` points to the correct GitHub repository.
- CI has passed.
- `package.json`, the README files, and the changes agree.
- The package contains no credentials, status files, or local paths.

You can run these checks manually:

```sh
make check
npm pack --dry-run
git status --short
```

## Choosing a Version

The project follows Semantic Versioning:

| Command | Example | Use when |
| --- | --- | --- |
| `make release-patch` | `0.1.0` -> `0.1.1` | Fixing bugs or documentation without breaking compatibility. |
| `make release-minor` | `0.1.0` -> `0.2.0` | Adding backward-compatible features or configuration. |
| `make release-major` | `0.1.0` -> `1.0.0` | Shipping incompatible API, configuration, or behavior changes. |

When uncertain, prefer a patch release. Do not increment the version merely to
retry a failed workflow.

## First Release

If `package.json` already contains the version you intend to publish, such as
`0.1.0`, do not run `make release-patch`; that would change it to `0.1.1`.

Push the current commit, then create a tag that matches the current version:

```sh
git push origin main
git tag v0.1.0
git push origin v0.1.0
```

Pushing the tag starts the GitHub Release workflow and publishes `0.1.0`.

## Regular Releases

Choose one command according to the type of change:

```sh
make release-patch
make release-minor
make release-major
```

The Makefile performs these steps in order:

1. Validates the version increment.
2. Confirms that the current branch is `main`.
3. Confirms that the working tree is clean.
4. Confirms that `origin` is configured.
5. Fetches `origin/main`.
6. Ensures that the local branch is not behind or diverged from the remote.
7. Runs `npm run check`.
8. Uses `npm version` to update `package.json` and `package-lock.json`.
9. Creates the version commit and matching `v` tag.
10. Pushes `main` and the tag.

For example:

```sh
make release-patch
```

After the command succeeds, monitor the `Release` workflow in GitHub Actions
until npm publishing and GitHub Release creation finish.

## Manual Workflow Dispatch

The Release workflow can be started manually in GitHub Actions, but it can only
publish an existing tag:

1. Open `Actions` > `Release`.
2. Click `Run workflow`.
3. Enter an existing `v`-prefixed tag, such as `v0.1.0`.

The workflow requires the tag to match the version in `package.json` exactly.
Manual dispatch does not create a tag or change the package version.

## Post-release Verification

After the release completes, run:

```sh
npm view opencode-model-sync version
npm view opencode-model-sync dist-tags
npx opencode-model-sync --help
```

Also confirm that:

- The GitHub Release exists.
- The generated release notes are correct.
- The npm `.tgz` file is attached to the release.
- npm provenance is visible.
- The README badges show the correct version.

## Handling Failures

### Checks or Build Fail

If the tag has already been pushed, fix and commit the problem, then publish a
new patch version. Do not delete or move the pushed tag: rerunning it still
checks out the original failing commit. If the tag has not been pushed, delete
the local tag and repeat the normal release process after fixing the problem.

### Tag and Version Do Not Match

The workflow requires:

```text
tag v0.1.0 <=> package.json version 0.1.0
```

Delete an incorrect remote tag only when it has not produced a public release
and correcting Git history is explicitly necessary:

```sh
git push origin :refs/tags/vX.Y.Z
git tag -d vX.Y.Z
```

Never delete a tag that corresponds to a published npm version.

### npm Publishing Fails Before the Version Exists

After correcting `NPM_TOKEN`, npm permissions, or the package name, rerun the
Release workflow for the same existing tag in GitHub Actions. Do not create a
new version.

### The npm Version Already Exists

npm does not allow published versions to be overwritten. Fix the problem and
publish a new patch version instead of attempting to reuse the version number.

## Security Principles

- Publish only through the controlled GitHub Actions workflow, not locally.
- Never expose `NPM_TOKEN` to Pull Request workflows.
- Never commit `.npmrc`, tokens, Provider API keys, or
  `.model-sync-status.json`.
- Inspect package contents with `npm pack --dry-run` before releasing.
- Never force-move a tag for a publicly released version.
