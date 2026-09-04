# Implementation — skill tag visible in list without opening detail

Branch: feat/my-skills-tag-search（同一 commit 内归档与实现）。

## 改动

- `apps/desktop/src/renderer/components/skill/SkillListView.tsx`:行徽标由
  “仅 `skill.tags`”改为“`tags` ∪ `original_tags` 去重（上限 3）”。
  `normalizeStringArray` 为文件既有局部函数，`original_tags` 为 Skill 既有字段；
  未改变过滤/tag-search 语义。

依据最终诊断：本分支把 SKILL.md frontmatter(source)标签迁移进 `original_tags`，
而 `tags` 存用户/DB 标签；列表行只读 `tags`，详情相关路径（preview/编辑器/适配）
显式处理 `original_tags`，造成「导入技能列表无 tag、点详情才见」。

## 验证

- desktop `apps/desktop`：`vitest run tests/unit/components/skill-view-tags.test.tsx`
  → `16 passed`（含新增用例 “shows migrated frontmatter tags in list rows without
  opening detail”：`tags: []` + `original_tags: [agentic, github, review]` 列表即显示）。
  仅有 SkillListView 既有 act() 状态更新告警，不影响断言。

## 设备 / UI 验收

- 若需真机核对：导入一个 frontmatter 带 tags 的远程技能，My Skills 列表行应
  直接出现徽标，无需先进详情。
