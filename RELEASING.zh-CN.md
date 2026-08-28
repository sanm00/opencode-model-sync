# 发布指南

[English](RELEASING.md) | [简体中文](RELEASING.zh-CN.md)

本文档供 `opencode-model-sync` 仓库维护者使用，介绍如何通过 Make 和 GitHub
Actions 发布 npm 包及 GitHub Release。

## 发布架构

发布由本地 Make 命令和 GitHub Actions 共同完成：

1. 本地 Make 命令检查仓库状态、运行测试、更新版本并创建 Git 标签。
2. Make 将 `main` 分支和标签推送到 GitHub。
3. `.github/workflows/release.yml` 被 `v*` 标签触发。
4. Release 工作流再次校验版本并运行完整检查。
5. 工作流将包发布到 npm，并创建包含 `.tgz` 文件的 GitHub Release。

本地命令不会直接执行 `npm publish`。npm 发布只在 GitHub Actions 中进行。

## 首次配置

### npm Token

在 npm 创建 Automation Token，然后将其添加为 GitHub Actions Secret：

1. 打开 GitHub 仓库的 `Settings`。
2. 进入 `Secrets and variables` > `Actions`。
3. 点击 `New repository secret`。
4. 名称填写 `NPM_TOKEN`。
5. 值填写 npm Automation Token。

不要将 Token 写入仓库、`.npmrc`、日志或 Release 文件。

### GitHub Actions 权限

仓库需要允许 GitHub Actions 创建 Release。打开：

```text
Settings > Actions > General > Workflow permissions
```

流水线已声明最小权限：

- `contents: write`：创建 GitHub Release。
- `id-token: write`：生成 npm provenance。

### npm 包名

首次发布前确认 `opencode-model-sync` 在 npm 上仍然可用，并确认当前 npm 账号有权
发布该包名。

## 发布前检查

发布前应确认：

- 当前分支是 `main`。
- 所有预期改动都已经提交。
- Git 工作区为空。
- `origin` 指向正确的 GitHub 仓库。
- CI 已通过。
- `package.json`、README 和变更内容一致。
- 没有凭据、状态文件或本地路径被包含在发布包中。

可手动执行：

```sh
make check
npm pack --dry-run
git status --short
```

## 版本选择

项目遵循语义化版本：

| 命令 | 示例 | 适用场景 |
| --- | --- | --- |
| `make release-patch` | `0.1.0` -> `0.1.1` | Bug 修复、文档修正、兼容性优化。 |
| `make release-minor` | `0.1.0` -> `0.2.0` | 新增向后兼容的功能或配置。 |
| `make release-major` | `0.1.0` -> `1.0.0` | 包含不兼容的 API、配置或行为变更。 |

如果不确定，应优先选择 patch。不要为了重新执行失败的流水线而提升版本。

## 首次发布

如果 `package.json` 已经是计划发布的版本，例如 `0.1.0`，首次发布不需要再运行
`make release-patch`，否则版本会变成 `0.1.1`。

先确保本地提交已经推送，然后创建与当前版本一致的标签：

```sh
git push origin main
git tag v0.1.0
git push origin v0.1.0
```

标签推送后，GitHub Release 工作流会自动发布 `0.1.0`。

## 日常发布

根据变更类型选择一个命令：

```sh
make release-patch
make release-minor
make release-major
```

Makefile 会依次执行：

1. 校验版本类型。
2. 确认当前分支为 `main`。
3. 确认工作区干净。
4. 确认已配置 `origin`。
5. 获取 `origin/main`。
6. 检查本地分支没有落后或与远程分叉。
7. 执行 `npm run check`。
8. 通过 `npm version` 更新 `package.json` 和 `package-lock.json`。
9. 创建版本提交和对应的 `v` 标签。
10. 推送 `main` 和标签。

例如：

```sh
make release-patch
```

成功后，在 GitHub Actions 页面观察 `Release` 工作流，直到 npm 发布和 GitHub
Release 创建完成。

## 手动触发流水线

Release 工作流支持在 GitHub Actions 页面手动运行，但只能发布已经存在的标签：

1. 打开 `Actions` > `Release`。
2. 点击 `Run workflow`。
3. 输入已有的 `v` 前缀标签，例如 `v0.1.0`。

工作流会验证标签与 `package.json` 版本完全一致。手动触发不会自动创建标签或修改
版本。

## 发布后验证

发布完成后检查：

```sh
npm view opencode-model-sync version
npm view opencode-model-sync dist-tags
npx opencode-model-sync --help
```

同时确认：

- GitHub Release 已创建。
- Release Notes 内容正确。
- Release 中包含 npm `.tgz` 文件。
- npm provenance 信息可见。
- README 徽章显示正确版本。

## 发布失败处理

### 检查或构建失败

如果标签已经推送，修复问题并提交，然后发布新的 patch 版本。不要删除或移动已经
推送的标签，因为重跑旧标签仍然会检出原来的失败提交。如果标签尚未推送，可以删除
本地标签，在修复后重新执行正常发布流程。

### 标签与版本不一致

流水线要求：

```text
标签 v0.1.0 <=> package.json 版本 0.1.0
```

仅当错误标签尚未触发公开发布，并且明确需要纠正 Git 历史时，才删除远程错误标签，
修正版本后创建正确标签：

```sh
git push origin :refs/tags/vX.Y.Z
git tag -d vX.Y.Z
```

不要删除已经对应公开 npm 版本的标签。

### npm 发布失败但版本尚未存在

确认 `NPM_TOKEN`、npm 权限和包名后，在 GitHub Actions 中使用同一已有标签手动重跑
Release 工作流。不要创建新版本。

### npm 版本已经存在

npm 不允许覆盖已发布版本。如果该版本已经存在，必须修复问题后发布新的 patch
版本。不要尝试覆盖或复用已发布版本号。

## 安全原则

- 不在本地直接发布，统一由受控的 GitHub Actions 发布。
- 不在 Pull Request 流水线中暴露 `NPM_TOKEN`。
- 不提交 `.npmrc`、Token、Provider API Key 或 `.model-sync-status.json`。
- 发布前使用 `npm pack --dry-run` 检查软件包内容。
- 不强制移动已经公开发布的版本标签。
