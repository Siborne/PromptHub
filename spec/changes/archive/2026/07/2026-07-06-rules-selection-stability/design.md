# Design

## Store Guarding

- 在 `apps/desktop/src/renderer/stores/rules.store.ts` 内为 `loadFiles()` 和 `selectRule()` 引入单调递增的请求序号。
- 只有当前最新请求才能提交 `files` / `currentFile` / `draftContent` / `error`，避免晚到的旧请求覆盖新选择。

## Save Stability

- `saveCurrentRule()` 成功后显式把 `selectedRuleId` 设为返回记录的 `id`，确保保存后的 store 状态仍锚定当前规则。

## Verification

- store 单测覆盖“先读 A 后切到 B，A 的晚到响应不能覆盖 B”。
- store / component 单测覆盖“保存当前规则后仍保持该规则选中”。
