# Implementation

## Shipped

- Desktop 卡片详情 inline edit 状态下不再额外引入新的输入框造型：标题使用透明输入，系统提示词和用户提示词沿用原有详情卡片表面，只将内部内容切换为可编辑 textarea。
- 这次改动只覆盖 `MainContent.tsx` 的卡片详情 inline edit 场景，没有改变 `Input` / `Textarea` 组件的全局默认样式，因此不会影响其他表单。
- 集成测试新增了编辑态样式断言，防止后续再次把 inline edit 做成突兀的新框体。

## Verification

- `pnpm --filter @prompthub/desktop test -- tests/integration/components/main-content-inline-edit.integration.test.tsx --run`
- `pnpm --filter @prompthub/desktop exec tsc --noEmit`
