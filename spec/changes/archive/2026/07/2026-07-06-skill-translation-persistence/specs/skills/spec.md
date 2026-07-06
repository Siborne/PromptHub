# Skills Spec Delta

## Added Requirements

### Requirement: Persisted Skill translation state

Skill 详情相关页面必须把翻译结果当作可恢复的用户状态，而不是仅当前会话内的临时切换。

#### Scenario: Translation is stored as a sidecar document

- **Given** 某个 Skill 已经有可写入的本地 repo
- **When** 用户执行 AI 翻译
- **Then** PromptHub 必须把翻译结果写入 `.prompthub/translations/<language>/<mode>/SKILL.md`
- **And** 必须同时写入包含原始 `SKILL.md` fingerprint 的 `meta.json`
- **And** 原始 `SKILL.md` 不得被修改

#### Scenario: Existing valid translation is shown by default

- **Given** 某个 Skill 已经存在基于当前 `SKILL.md` 内容生成的有效 sidecar 译文
- **When** 用户重新打开该 Skill 详情页或商店详情页
- **Then** 页面默认显示译文
- **And** 翻译按钮保持高亮
- **And** 再次点击同一翻译按钮时切回原文

#### Scenario: Translation becomes stale after SKILL.md changes

- **Given** 某个 Skill 之前已经保存过译文
- **And** 当前 `SKILL.md` 内容已经发生变化
- **When** 用户再次打开该 Skill 详情页或商店详情页
- **Then** 页面不能继续默认展示旧译文
- **And** 页面应提示用户旧译文已过期并可选择立即重新翻译

#### Scenario: Only SKILL.md content participates in translation freshness

- **Given** Skill 仓库中除 `SKILL.md` 以外的其他文件发生变化
- **When** 当前 `SKILL.md` 派生内容未变化
- **Then** 已保存译文不应被误判为过期

#### Scenario: Internal translation files stay hidden from user-facing repo flows

- **Given** Skill repo 中存在 `.prompthub/translations/` sidecar 文件
- **When** 用户浏览文件树、导出 ZIP、扫描本地技能或向平台分发 Skill
- **Then** 这些 sidecar 文件默认不应出现在用户可见的普通技能文件集合里
