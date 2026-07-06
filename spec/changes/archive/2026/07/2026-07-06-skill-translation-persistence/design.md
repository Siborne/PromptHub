# Design

## Overview

把翻译结果从 renderer 本地缓存迁移为 Skill 本地 repo 里的 sidecar 文档：

- `.prompthub/translations/<language>/<mode>/SKILL.md`
- `.prompthub/translations/<language>/<mode>/meta.json`

其中 `SKILL.md` 是完整翻译版文档，`meta.json` 保存原始 `SKILL.md` 的 fingerprint、翻译时间、语言和模式。页面层不再把翻译当作一段临时文本，而是把它当作“原始 Skill 的一个派生文档版本”。这样可以同时满足：

- 同一个 Skill 在重进页面后默认恢复译文展示
- `SKILL.md` 内容变化后旧译文自动失效
- 不修改原始 `SKILL.md`
- 不把整份翻译正文塞进数据库

## Affected Areas

- Data model:
- `apps/desktop/src/renderer/services/skill-store-update.ts` 继续提供原始 `SKILL.md` 指纹计算。
- sidecar `meta.json` 保存译文对应的 `sourceFingerprint` 与翻译参数。
- IPC / API:
- 优先复用现有 `window.api.skill.getRepoPath/readLocalFile/writeLocalFile`，直接在 Skill 本地 repo 中读写 sidecar 文件。
- Filesystem / sync:
- sidecar 文件位于 `.prompthub/translations/`。
- stale 判断仅基于原始 `SKILL.md` fingerprint。
- `.prompthub/` 属于 PromptHub 内部目录，默认不参与文件树展示、ZIP 导出、技能扫描和平台分发。
- UI / UX:
- `SkillFullDetailPage` 默认在原始文档与翻译 sidecar 间切换。
- 翻译结果按“完整文档”渲染，不再单独翻译描述区。
- `SkillPreviewPane` 的描述和正文都从当前选中的文档版本解析而来。

## Tradeoffs

- 选择 Skill repo sidecar 而非数据库：翻译结果本质是文档衍生物，不是核心结构化业务字段；sidecar 更符合 repo 模型，也更利于后续导出、调试和迁移。
- 选择 `.prompthub/translations/` 而非顶层 `.translation/`：命名空间更清晰，也为未来其他内部 sidecar 数据预留空间。
- 选择完整 `SKILL.md` sidecar 而非“描述 + 正文分片缓存”：可以保证页面各区域来自同一份翻译文档，不再出现只翻译部分区域的 UI 语义错误。
