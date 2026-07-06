# Implementation

## Shipped

- 为 Rules 工作台版本快照列表补齐可点击交互和选中态
- 为右侧编辑区增加历史快照只读预览模式
- 增加“返回草稿”和“恢复到草稿”操作，避免历史回看直接覆盖磁盘文件
- 更新 Rules 相关多语言文案并补充 store / component 回归测试
- 修复 Rules 顶部搜索框此前被硬编码为只读假输入框的问题，并将其接入真实的规则文件筛选与结果导航

## Verification

- `pnpm lint`
- `pnpm --filter @prompthub/desktop test -- --run tests/unit/components/rules-manager.test.tsx tests/unit/stores/rules.store.test.ts`
- `pnpm --filter @prompthub/desktop build`
- `pnpm --filter @prompthub/desktop test -- tests/unit/components/top-bar.test.tsx tests/unit/components/sidebar.test.tsx tests/unit/components/skill-store-remote.test.tsx tests/unit/services/skill-filter.test.ts --run`
  - 结果：通过（36/36），其中新增覆盖 Rules 顶部搜索输入、共享筛选、`Enter` 选中与 `Tab` 结果导航行为

## Follow-up Adjustments

- Rules 搜索现在基于 `rules.store.ts` 的独立 `searchQuery` 状态，不再复用 Prompt / Skill 搜索状态。
- 搜索语义明确为筛选左侧规则文件列表，匹配平台名、规则名、描述、文件名与路径，而不是搜索右侧正文内容。
- Sidebar 与 TopBar 使用同一份过滤条件，确保输入、计数、Tab/Enter 导航与选中规则保持一致。
- “当前”版本卡片不再是不可点击的死状态；当用户正在查看旧快照 diff 时，点击“当前”会直接退出预览并回到当前草稿视图。
- 正式版 changelog 与官网 changelog 镜像已移除顶部 `0.5.6-beta.*` 历史段，避免稳定版说明被预览版记录盖在前面。

## Synced Docs

- `spec/knowledge/behavior/rules-workspace.md`

## Follow-ups

- 可后续补充规则快照 diff 视图
- 可后续补充“从历史快照新建分支草稿”的更细粒度交互
