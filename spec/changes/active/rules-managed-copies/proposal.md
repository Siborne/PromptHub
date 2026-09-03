# Proposal

## Why

当前 `Rules` 模块把外部规则文件当作唯一数据源：读取时直接从磁盘加载，保存时直接覆写目标文件，PromptHub 只额外保存少量项目路径元数据和一个脱离 `userData` 的 JSON 历史快照目录。

这套模型已经和 PromptHub 现有的数据体系脱节，具体问题包括：

- 规则正文不在 PromptHub 自己的数据路径中，数据库备份与恢复无法完整覆盖 Rules 内容。
- `ruleProjects` 只保存路径，恢复到新机器后如果原始目录不存在，规则内容就丢失。
- 历史版本落在 `~/.prompthub/rule-history/`，既不进入现有数据库，也不在 `userData/data/` 下，和现有升级备份、数据布局迁移、手动导出链路都不一致。
- 当前实现内置了一个 `Current Project` 伪规则项，和“项目规则应只来自用户手动添加目录”这一产品语义冲突。
- 未来规则市场要求用户可以下载、替换、恢复、备份规则，这天然要求 PromptHub 保留自己的 canonical 副本文本，而不是只做外部文件编辑器。

PromptHub 现有成熟模式已经给出方向：

- Prompt：正文和版本都进入内部数据模型，可完整备份和恢复。
- Skill：除了数据库元数据和版本外，还保留本地 repo 副本，并把外部平台目录当作同步目标。

Rules 需要升级为与现有 `data/` 真相源架构一致的“文件真相源 + 索引缓存”模型：规则正文和版本正文落在 `userData/data/rules/`，`prompthub.db` 只承担索引/状态缓存，外部平台文件只是部署/同步目标。

## Scope

- In scope:
- 为 Rules 建立 PromptHub 托管的数据模型，规则正文和版本进入应用内部数据层
- 在 `userData/data/` 下为 Rules 建立文本副本目录，作为可备份、可导出、可恢复的 canonical 副本
- 删除 `Current Project` / `workspace-agents` 伪规则项，项目规则只来自用户手动添加目录
- 保留现有全局规则白名单模型，但其内容读取改为优先来自 PromptHub 内部副本与数据库
- 为规则内容引入显式同步状态：内部副本、数据库、外部目标文件三者的关系可追踪
- 让手动备份 / 压缩备份 / 升级快照 / WebDAV 同步都能覆盖 Rules 正文与版本
- 为未来规则市场预留“下载到库 / 替换当前版本 / 一键部署到目标文件”的数据契约

- Out of scope:
- 本次不直接实现规则市场 UI、搜索、评分、发布协议
- 本次不扩展 `Rules` 去管理多文件 workspace bootstrap surface（例如 OpenClaw 那组文件）
- 本次不把 `Cursor` / `Kiro` / `Roo Code` / `GitHub Copilot` 自动纳入全局规则白名单
- 本次不实现跨平台实时文件监听同步，只要求显式加载、保存、部署与冲突检测

## Risks

- 如果同时引入数据库正文和副本文本而没有明确主从关系，容易造成三份状态漂移：DB、managed copy、target file。
- 如果 restore 时强制回写外部目标路径，可能覆盖用户当前机器上的真实平台配置。
- 如果继续让 `ruleProjects` 只保存在 settings，而不升级成规则记录，Rules 仍会停留在“路径列表 + 文件编辑器”的半成品状态。
- 如果副本目录放置不符合现有 `userData/data/` 布局，后续升级备份和数据迁移会再次出现旁路文件。

## Rollback Thinking

- 新方案应以新增 `rules` / `rule_versions` 与 `data/rules/` 副本目录为主，不直接删除外部目标文件，因此回退时用户外部规则文件仍保留。
- 从旧模型迁移时，首次只做“导入到 PromptHub”，不立即重写目标文件；如需回退，仍可继续使用磁盘原文件。
- 若新同步状态模型出现问题，可先退回“DB + managed copy 可用，外部部署手动触发”，不影响规则正文留存在 PromptHub 内部。

## Issue Addendum 2026-08-20

- GitHub #210 confirms that `importRuleBackupRecords()` still bypasses the
  accepted restore boundary: it writes imported managed content directly to a
  divergent external target and replaces the local version set in the same
  loop.
- GitHub #209 reports the same user-visible class of external `CLAUDE.md`
  overwrite after reopening PromptHub. Normal materialization only detects
  drift, so the exact deferred restore/sync caller must be reproduced before
  deciding whether #209 and #210 share one trigger.
- The stable specification and design remain authoritative: backup import must
  restore PromptHub-managed state first and must not silently overwrite an
  external target. The two issues remain open until the data-loss path,
  recoverable history behavior, and all Desktop/CLI restore callers pass
  regression coverage.
