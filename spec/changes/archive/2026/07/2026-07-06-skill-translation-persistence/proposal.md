# Proposal

## Why

当前 Skill 详情页和 Skill Store 详情页虽然支持 AI 翻译，但翻译结果仍停留在 renderer 本地缓存：用户重进页面后恢复逻辑不稳，翻译结果也不是一个真正可管理的 Skill 文档变体。更关键的是，这种缓存既不应该污染原始 `SKILL.md`，也不适合继续塞在 renderer 持久化状态里。

## Scope

- In scope:
- 将 Skill 翻译结果改为存放在 Skill 本地 repo 的 `.prompthub/translations/` sidecar 目录中。
- 翻译结果以“完整翻译版 `SKILL.md` + `meta.json`”的形式保存，而不是页面片段缓存。
- 当存在有效 sidecar 译文时，Skill 详情页和商店详情页默认显示译文，翻译按钮保持高亮，再点同一按钮切回原文。
- 当原始 `SKILL.md` 发生变化导致 sidecar 译文失效时，提示用户是否立即重新翻译。
- `.prompthub/` 作为 PromptHub 内部目录，默认不在文件树、导出 ZIP、扫描与分发流程中暴露。
- Out of scope:
- 新增独立翻译管理中心、批量重翻、跨语言历史版本管理。
- 修改原始 `SKILL.md`。
- 将整份翻译正文写入数据库字段。

## Risks

- 如果内容指纹计算不稳定，可能导致误报“译文过期”或错误复用旧译文。
- 如果默认显示译文逻辑与页面局部状态冲突，可能出现按钮高亮与实际内容不一致。

## Rollback Thinking

- 回退到 renderer cache 作为临时方案。
- 停止读写 `.prompthub/translations/`，恢复为不持久化或仅会话级翻译。
