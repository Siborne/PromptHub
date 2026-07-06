# Delta Spec

## Added

- Skill 域支持导出整个本地仓库目录为 zip，以覆盖附加文件、资源文件和多文件 Skill 场景。

## Modified

- Skill 导出入口以 `SKILL.md` 和 `zip` 为主，不再将 JSON 暴露为详情页主导出动作。

## Removed

- 无

## Scenarios

- 当用户只想把 Skill 分享给支持 `SKILL.md` 的工具时，可以直接下载单文件 `SKILL.md`。
- 当用户需要完整迁移或备份一个多文件 Skill 时，可以直接下载包含整个仓库内容的 zip。
