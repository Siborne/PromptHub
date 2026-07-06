# Design

## Summary

本次变更将桌面端 Skill 商店里的 `git-repo` source 从“只有一个 URL”升级为“仓库 URL + 可选 branch + 可选 directory”的结构化模型，但保持现有持久化入口、Zustand persist 和 UI 主体不变。

目标是：

1. 默认用户仍然只填一个仓库 URL 即可工作。
2. 进阶用户可以显式选择 branch。
3. 旧有 `/tree/<branch>/<path>` URL source 不需要手工迁移。

## Current Behavior

### Existing call chain

当前商店源加载调用链为：

`SkillStore -> useSkillStoreRemoteSync.loadStoreSource() -> loadGitHubRepoSkills() -> loadGitHubSkillRepo()`

其中关键问题是：

- `SkillStoreSource` 只有 `url`
- `parseGitRepo()` 只解析 owner/repo，不返回 branch/path
- `loadGitHubSkillRepo()` 总是请求 repo metadata 并使用 `default_branch`
- 旧的 `/tree/<branch>/<path>` 只是在输入校验阶段被接受，但不会稳定驱动后续 branch 选择

## Proposed Model

### Source shape

为 `SkillStoreSource` 增加两个可选字段：

- `branch?: string`
- `directory?: string`

约束：

- 只对 `type === "git-repo"` 生效
- 其他 source 类型写入时忽略这两个字段

### Normalized git source

引入一个面向商店源的归一化结果，例如：

```ts
interface NormalizedGitStoreSource {
  repositoryUrl: string;
  cloneUrl: string;
  host: string;
  owner: string;
  repo: string;
  protocol: "https" | "ssh";
  branch?: string;
  directory?: string;
}
```

该归一化逻辑负责：

- 从 root repo URL 解析 owner/repo
- 从 GitHub `/tree/<branch>/<path>` URL 解析 branch/directory
- 用显式字段覆盖 URL 中隐式的 branch/directory

## Resolution Rules

### Branch precedence

`resolvedBranch` 优先级如下：

1. `source.branch`
2. 从 `source.url` 解析出的 tree branch
3. GitHub API 的 `default_branch`
4. `main`

### Directory precedence

`resolvedDirectory` 优先级如下：

1. `source.directory`
2. 从 `source.url` 解析出的 tree path
3. 空值（表示仓库根）

## UI Design

### Add source form

在 `SkillStoreSourceForm` 中，当 `sourceType === "git-repo"` 时增加一组高级选项：

- `Branch` 输入框
- `Directory` 输入框

交互要求：

- 这两个字段默认折叠在 `Advanced Git Options` 区域，避免增加新手复杂度
- `Branch` placeholder: `Leave empty to use default branch`
- `Directory` placeholder: `Optional subdirectory, e.g. skills/.curated`

### Edit source modal

在 `SkillStoreSourceEditModal` 中同步暴露 `branch` 和 `directory` 字段。

额外要求：

- 若当前 source 是由旧 tree URL 解析而来，弹窗打开时必须显示解析后的 branch/directory
- 保存时应优先存结构化字段，而不是简单回写原 tree URL

### Source presentation

在自定义 source 列表与详情中展示：

- 仓库
- 分支（若未指定则显示“Default branch”）
- 目录（若未指定则显示“Repository root”）

## Loader Changes

### `loadGitHubSkillRepo()`

需要把现有签名从：

```ts
loadGitHubSkillRepo(repoUrl, options)
```

扩展为可接受结构化参数，例如：

```ts
loadGitHubSkillRepo(repoUrl, {
  branch,
  directory,
  ...options,
})
```

职责变化：

- 先读取 repo metadata 获取 `default_branch`
- 再按 precedence 计算 `resolvedBranch`
- 基于 `resolvedBranch` 请求 tree
- 若 `resolvedDirectory` 非空，则只保留该目录下的 skill 文件
- `source_url` 与 `content_url` 生成时使用 `resolvedBranch`

### SSH fallback path

`SkillInstaller.scanRemoteGithub()` 当前仅支持 SSH 仓库扫描；本轮不做远程 branch UI 差异化，但对 SSH source 也应允许结构化 branch 字段存在。

行为要求：

- 若后续 SSH 扫描路径仍无法直接用 branch 字段，则需要在 design 中明确标记为后续能力
- 本轮至少保证 HTTPS GitHub 路径完整支持 branch / directory

## Validation

### Input validation

`validateStoreSourceInput()` 继续负责 source URL 基础合法性，但对 `git-repo` source 需要拆为两层：

1. URL 是否为合法仓库地址或可兼容的 GitHub tree URL
2. branch / directory 是否满足最小字符串约束

建议：

- branch 不允许空白字符首尾未 trim 的原值直接落库
- directory 在保存前统一去掉前导 `/` 与尾部 `/`

## Backward Compatibility

### Persisted custom sources

不做强制 migration。采用“读取时归一化，保存时结构化”的策略：

1. 旧 source 读取时若 URL 中带 `/tree/...`，自动推导出 branch/directory
2. UI 打开编辑时展示推导结果
3. 用户保存后写回结构化字段

这样可以避免为本地 Zustand persist 做专门版本迁移。

## Error Model

新增三类面向用户的错误上下文：

1. 指定 branch 不存在
2. 指定 directory 不存在
3. branch + directory 下没有 skill 文件

这些错误都必须带上：

- 仓库名
- 解析后的 branch
- 解析后的 directory（若有）

## Verification Strategy

### Core tests

- `git-repo` source 仅填 URL，仍按默认分支工作
- `git-repo` source 显式 branch 时，优先使用该 branch
- URL 中自带 `/tree/<branch>/<path>` 时，能正确归一化
- directory 限制生效，只返回子目录内的 skills
- 编辑旧 source 后，branch/directory 展示与保存一致

## Tradeoffs

### Why not only keep branch in URL?

只继续依赖 URL 内嵌 branch/path 虽然改动更少，但问题依旧：

- URL 语义不透明
- UI 不能显式展示 branch 状态
- 编辑与校验逻辑会继续散落在多个调用点

结构化字段虽然增加了两个可选属性，但能让数据模型、UI 和加载逻辑对齐，长期维护成本更低。
