# Implementation

## Shipped

- `apps/desktop/src/renderer/stores/rules.store.ts` 现在为 `loadFiles()` 与 `selectRule()` 引入了最新请求序号保护；晚到的旧读取结果不会再覆盖用户后来选中的规则详情或草稿。
- `saveCurrentRule()` 成功后现在会显式保留 `selectedRuleId = updated.id`，避免保存完成后的 store 状态被动丢失当前锚点。
- `apps/desktop/tests/unit/stores/rules.store.test.ts` 新增“旧规则读取结果不能覆盖新选择”的回归测试，并补充保存后保持选中项断言。
- `apps/desktop/tests/unit/components/rules-manager.test.tsx` 新增“保存当前 draft 后仍保持 Gemini 规则选中”的组件回归。
- `apps/desktop/tests/unit/components/sidebar.test.tsx` 新增“Rules 模块初始加载的旧读取结果不能覆盖用户后来点击的 Gemini 选择”的侧边栏交互回归。

## Verification

- `pnpm --filter @prompthub/desktop test -- tests/unit/stores/rules.store.test.ts --run`
- `pnpm --filter @prompthub/desktop test -- tests/unit/components/rules-manager.test.tsx --run`
- `pnpm --filter @prompthub/desktop test -- tests/unit/components/sidebar.test.tsx --run`

## Follow-ups

- 如果后续仍收到“保存后跳项”的反馈，再补一个更重的 Sidebar + RulesManager 联动级测试，覆盖模块切换、首次加载和保存动作连续发生的完整路径。
