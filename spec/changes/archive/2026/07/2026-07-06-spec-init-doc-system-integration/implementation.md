# Implementation

## Status

Implementation landed.

## Notes

- 已把 `spec-init` skill 整理到 `.agents/skills/spec-init/`
- 已更新 `README.md` 与 `spec/README.md`
- 已新增 `spec-init` 风格的项目级入口目录
- 已更新 `AGENTS.md`，把文档工作流改成 `spec-init` 边界 + PromptHub 现有 change flow 的混合模型
- 已按最新 `spec-init` 升级补齐 `spec/workflow/*` 与 `spec/knowledge/*`，并把 `verification` 命名显式落位
- 已新增根级 `spec-init.topology.yml`，显式声明 PromptHub 的文档语义到 `spec/` 路由
- 已新增 `spec/rules/document-routing-rules.md`，作为目录语义和路由规则的项目内真相源
- 已完成第一阶段内容迁移：旧 `spec/domains/`、`spec/architecture/`、`spec/logic/`、`spec/assets/` 中的稳定内容已迁入 `spec/knowledge/*` 与 `spec/releases/`
- `spec/workflow/*` 已升级为项目级唯一主入口，并移除了根目录重复的 `00-intake` ~ `05-tasks` 目录
- 已继续补强 `records` 与 `knowledge` 层说明，使其更接近最新 `spec-init` 中的长期真相层与记录层语义
- 已新增 `spec/changes/README.md` 与 `spec/changes/completed/README.md`，并修正 `spec-init.topology.yml` 的 changes 路由，使 changes 层级与最新 skill 更一致
- 已补充 `spec/rules/` 下的核心规则文件，使 rules 层不再只有入口 README
- 已删除旧的 `spec/domains/`、`spec/architecture/`、`spec/logic/`、`spec/assets/` 根目录，避免形成双主入口
- 已更新仓库内主要入口文档与交叉引用，指向迁移后的稳定路径
- 本次改造未重写历史 `spec/changes/active/*` 的业务内容，只修正与结构迁移直接相关的入口说明

## Verification

- README / spec / AGENTS 入口已同步到同一套文档工作流表述
- 仓库内旧稳定根目录引用已替换为迁移后的 `workflow / knowledge / releases` 路径
- `spec-init` skill 已落到项目内 `.agents/skills/spec-init/SKILL.md`
