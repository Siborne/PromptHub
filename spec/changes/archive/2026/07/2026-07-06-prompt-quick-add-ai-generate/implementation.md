# Implementation

## Status

Completed.

## Goal

让 `Quick Add` 不仅能分析已有 Prompt 内容，也能直接根据用户需求生成一份可保存的 Prompt 草稿。

## Shipped

- `QuickAddModal` 已扩展为双模式：
  - `Analyze Existing`：粘贴已有 Prompt，先创建占位 Prompt，再由 AI 在后台补齐标题、描述、system prompt、标签与文件夹建议。
  - `AI Generate Prompt`：输入目标和约束，由 AI 返回结构化 Prompt 草稿，再一次性创建完整 Prompt。
- `QuickAddModal` 的 UI 已做第二轮收窄：
  - 顶部模式切换改为更轻量的 segmented control
  - 文件夹选择从大面积网格改为 `Select` 下拉
  - modal 增加最大高度，内容区独立滚动，避免形成过长表单
  - `Select` 菜单改为渲染到 `document.body` 并实时定位，修复下拉被滚动容器裁切的层级问题
- 顺手修复了 Prompt / AI 测试相关多语言显示问题：
  - `AiTestModal` 预览标题改用 `prompt.userPromptLabel`
  - 非英文 locale 的 `prompt.userPrompt/systemPrompt` 不再残留英文占位
  - 补齐 `common.selected` 的 7 语言文案，避免图片选择状态回退成英文 `Selected`
- `quick-add-utils.ts` 已补充：
  - `buildQuickAddAnalysisPrompt()`
  - `buildQuickAddGeneratePrompt()`
  - `parseQuickAddAnalysisResult()`
  - `parseQuickAddGeneratedDraft()`
- 顶部创建菜单已新增 `AI 生成` 入口，可直接以生成模式打开 `Quick Add`。
- `Quick Add` 内部已支持显式切换 `text` / `image` 类型，而不只依赖当前筛选态。
- 新增并同步了 quick add 相关多语言文案，覆盖 7 个 locale。
- 已补充聚焦测试：
  - `quick-add-utils.test.ts`
  - `quick-add-modal.test.tsx`
  - `top-bar.test.tsx`

## Verification

- `pnpm --filter @prompthub/desktop test:run tests/unit/components/quick-add-utils.test.ts tests/unit/components/quick-add-modal.test.tsx tests/unit/components/top-bar.test.tsx`
- `pnpm --filter @prompthub/desktop lint`
- `pnpm --filter @prompthub/desktop build`
- `git diff --check -- apps/desktop/src/renderer/components/prompt/QuickAddModal.tsx apps/desktop/src/renderer/components/prompt/quick-add-utils.ts apps/desktop/src/renderer/components/layout/TopBar.tsx apps/desktop/src/renderer/i18n/locales/en.json apps/desktop/src/renderer/i18n/locales/zh.json apps/desktop/src/renderer/i18n/locales/zh-TW.json apps/desktop/src/renderer/i18n/locales/ja.json apps/desktop/src/renderer/i18n/locales/fr.json apps/desktop/src/renderer/i18n/locales/de.json apps/desktop/src/renderer/i18n/locales/es.json apps/desktop/tests/unit/components/quick-add-utils.test.ts apps/desktop/tests/unit/components/quick-add-modal.test.tsx apps/desktop/tests/unit/components/top-bar.test.tsx spec/changes/archive/2026/07/2026-07-06-prompt-quick-add-ai-generate/proposal.md spec/changes/archive/2026/07/2026-07-06-prompt-quick-add-ai-generate/design.md spec/changes/archive/2026/07/2026-07-06-prompt-quick-add-ai-generate/tasks.md spec/changes/archive/2026/07/2026-07-06-prompt-quick-add-ai-generate/implementation.md spec/changes/archive/2026/07/2026-07-06-prompt-quick-add-ai-generate/specs/desktop/spec.md`

## Remaining

- 如需继续推进，可为 `QuickAddModal` 再增加“先预览再创建”的生成草稿确认流，但这不属于本次最小可用范围。
