domain: skills
related: feat/my-skills-tag-search（同分支、独立 commit）

## 行为

导入的 Skill 若 frontmatter/first-sync 携带 tags，其在列表行/卡片行的元信息区域应
与详情页最终见到的一致——不应要求先打开详情（触发一次完整 sync/投影）才可见。

## 当前差异（待确认根因）

- 列表行（`SkillListView`）直接渲染 `skill.tags`（一个来源）。
- 用户报告列表为空、点详情后 tags 才出现，暗示列表初始行对象的 tags 为空或
  过期，detail-first 的 fetch/sync 才补到正确 tags。

## 验收草案

- 同一次导入后，在不打开详情/不额外 sync 的前提下，列表行已显示该技能 frontmatter tags。
- 详情打开后的 tags 与列表一致，无“先详情后列表才更新”的一阶差异。
