# Tasks — skills-my-skills-tag-search

- [x] 在 `main` 上创建分支 `feat/my-skills-tag-search`。
- [x] 建 active change 契约（proposal/specs/design/tasks/implementation）。
- [x] TDD（service）：`services/skill-tag-options.ts` + `tests/unit/services/skill-tag-options.test.ts`
      覆盖：unique/trim/忽略空、排序稳定、查询收窄大小写不敏感、无匹配、空集合（7 passed）。
- [x] 实现 `components/skill/SkillTagSearchFilter.tsx`（presentation、受控）。
- [x] 组件单测 `skill-tag-search-filter.test.tsx`（6 passed）：展开列出、查询收窄、toggle、移除 chip、
      清除全部、可访问性状态。
- [x] `SkillManagerLibraryHeader` 注入 props 并在 my-skills filter bar 渲染（无 tags 时不渲染）。
- [x] `SkillManager` 绑定动作、派生候选并传 props。
- [x] i18n：`skill.*` 6 个新键覆盖 7 语言；parity 测试绿。
- [x] desktop `pnpm typecheck`（`tsc --noEmit`）→ exit 0。
- [x] 受检文件 `eslint --max-warnings 0` → RC 0。
- [x] 相关回归（sidebar-skills、skill-filter、skill-i18n-manager 的 SkillManager/Header 挂载 smoke）53 passed。
- [ ] 全量 `pnpm test:run`——本会话多次被运行环境 2min 墙钟超时打断（记录于 implementation.md），交 CI/本机执行。
- [ ] 汇报用户；确认后提交 / push / 开 PR（绝不自动 commit）。
