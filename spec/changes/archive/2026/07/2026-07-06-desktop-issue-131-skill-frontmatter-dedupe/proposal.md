# Proposal

## Why

GitHub issue `#131` 报告：从商店导入的 skill 若原始 `SKILL.md` 已包含 YAML frontmatter，后续安装到 AI 编程工具平台时会再次在头部追加一份 frontmatter，导致同一个文件出现两段 YAML。

当前桌面端平台安装链路会先调用 `skill.export("skillmd")` 再执行 `installMd`。导出层会无条件重新拼装 frontmatter，并直接把 `skill.instructions` 原文拼在后面；当 `instructions` 本身就是完整 `SKILL.md` 时，就会稳定产出双 frontmatter。

## Scope

- In scope:
- 修正桌面端 `skillmd` 导出逻辑，避免对已包含 frontmatter 的 `SKILL.md` 再次叠加 YAML。
- 补充回归测试，覆盖“已有完整 `SKILL.md` -> 导出 -> 安装”这条核心前置条件。

- Out of scope:
- 重构 Skill 平台安装 UI。
- 修改 Skill 仓库同步或翻译逻辑。

## Risks

- 导出逻辑改动会影响所有 `skillmd` 导出与平台安装路径，需要保证仍保留数据库中的最新 metadata（如 version / author / compatibility）。

## Rollback Thinking

- 若新逻辑误伤无 frontmatter 的普通 instructions，可回退到旧实现，并改为仅在安装平台时做一次 frontmatter 去重。
