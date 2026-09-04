# Tasks — skills-tag-list-glance-display

- [x] 定位：本分支迁移将 SKILL.md frontmatter(source)标签放入 `original_tags`；
      列表行仅显 `skill.tags`，而详情相关路径显式处理 `original_tags` →
      导入技能列表无 tag、点详情才见。
- [x] 实现：SkillListView 行徽标改为 `tags` ∪ `original_tags`（去重、上限 3），
      不改 filter/tag-search 语义。
- [x] 用例：新增 “shows migrated frontmatter tags in list rows without opening
      detail”（tags 空 + original_tags 三项 → 列表即显示）。
- [x] desktop vitest：`skill-view-tags.test.tsx` 16 passed。
- [ ] （如可）真机核对远程 frontmatter tags 导入后列表行即时显示。
