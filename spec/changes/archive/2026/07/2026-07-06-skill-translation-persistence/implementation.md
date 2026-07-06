# Implementation

## Shipped

- 扩展 `apps/desktop/src/renderer/stores/skill.store.ts` 的翻译缓存结构，为每条缓存记录补充 `sourceFingerprint`，并新增 `getTranslationState()`，统一返回 `value / hasTranslation / isStale`。
- 在 `apps/desktop/src/renderer/services/skill-store-update.ts` 复用现有规范化逻辑，新增同步可用的 `computeSkillContentFingerprint()`，供 renderer 侧在不依赖异步 crypto 的情况下判断 `SKILL.md` 内容是否变化。
- 新增并接入 `apps/desktop/src/renderer/services/skill-translation-sidecar.ts`，把译文持久化到 `.prompthub/translations/<language>/<mode>/SKILL.md` 与 `meta.json`。
- 更新 `apps/desktop/src/renderer/components/skill/SkillFullDetailPage.tsx` 与 `SkillStoreDetail.tsx`：
- 翻译读写与 stale 判断改为基于完整 `SKILL.md` 文档，而不是仅正文。
- 有有效已保存译文时默认显示译文；翻译按钮在显示译文时保持高亮，再次点击切回原文。
- 当当前原始 `SKILL.md` fingerprint 与 sidecar 不一致时，回退原文并弹出“是否重新翻译”确认。
- 描述区与正文区统一从当前选中的完整文档版本派生，避免“描述来自原文、正文来自译文”的混合渲染。
- 更新 `apps/desktop/src/renderer/components/skill/SkillPreviewPane.tsx`，预览渲染统一剥离当前文档 frontmatter 后展示正文，stale 且当前未展示译文时显示轻量提醒 badge。
- 收紧 `apps/desktop/src/renderer/stores/skill.store.ts` 的翻译 prompt，要求返回合法完整 `SKILL.md`：frontmatter 保持 YAML 合法，immersive 模式仅在正文交错插入 `<t>...</t>`。
- 更新 `apps/desktop/src/main/services/skill-installer-platform.ts`，将平台 symlink 安装从“整个技能目录 symlink”改为“平台目录内仅 symlink canonical `SKILL.md` 文件”，避免 `.prompthub/` sidecar 暴露到平台技能目录。
- 为新增文案补齐 7 个 locale，并把稳定约束同步回 `spec/knowledge/behavior/skills.md`。

## Verification

- `pnpm --filter @prompthub/desktop test -- --run tests/unit/stores/skill.store.test.ts tests/unit/components/skill-preview-pane.test.tsx tests/unit/components/skill-i18n-smoke.test.tsx tests/unit/components/skill-store-remote.test.tsx`
- `pnpm --filter @prompthub/desktop test -- --run tests/unit/main/skill-installer-platform.test.ts`
- `pnpm --filter @prompthub/desktop lint`

## Synced Docs

- `spec/changes/archive/2026/07/2026-07-06-skill-translation-persistence/proposal.md`
- `spec/changes/archive/2026/07/2026-07-06-skill-translation-persistence/design.md`
- `spec/changes/archive/2026/07/2026-07-06-skill-translation-persistence/specs/skills/spec.md`
- `spec/knowledge/behavior/skills.md`

## Follow-ups

- 评估是否需要彻底移除 renderer `translationCache` 的历史 fallback，或仅保留未安装商店 Skill 的短期缓存用途。
- 进一步验证外部平台是否存在依赖 repo 内其他辅助文件的 Skill 形态；当前实现仍以平台消费 `SKILL.md` 为前提。
