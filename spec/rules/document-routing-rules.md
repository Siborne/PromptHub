# PromptHub Document Routing Rules

这个文件定义 PromptHub 在接入锁定的 `spec-init` 基线（`f83def1`）后的文档语义到目录路径映射规则。

## 目标

- 让 agent 和贡献者知道“这份内容该写去哪”
- 让 `spec-init.topology.yml`、`README.md`、`AGENTS.md` 和 `spec/` 目录结构保持一致
- 避免把项目级 workflow / knowledge 文档和单次 change 工作区混在一起

## 路由规则

### Workflow

- 背景、用户、目标、非目标、约束：`spec/workflow/00-intake/README.md`
- FR / NFR / AC、范围外：`spec/workflow/01-requirements/README.md`
- 当前阶段 how、架构、模块、接口、数据、权衡：`spec/workflow/02-design/README.md`
- 里程碑、依赖、阶段顺序：`spec/workflow/03-implementation/README.md`
- 需求到测试映射、回归策略、验证方式：`spec/workflow/04-verification/README.md`
- 当前可执行动作：`spec/workflow/05-tasks/README.md`

### Knowledge

- 长期稳定的术语、角色、实体、产品边界：`spec/knowledge/context/`
- 长期稳定的模块边界、系统结构、集成关系：`spec/knowledge/structure/`
- 长期稳定的关键流程、规则、状态流转：`spec/knowledge/behavior/`
- 协议、schema、样例、fixtures、固定参考资料：`spec/knowledge/reference/`

### Changes

- 单次需求、bugfix、重构、流程变化：`spec/changes/active/<change-key>/`
- 已完成 change 语义入口：`spec/changes/completed/`
- PromptHub 当前真实归档目录：`spec/changes/archive/<YYYY>/<MM>/<YYYY-MM-DD>-<change-key>/`
- 仅保留历史价值的旧变更资料：`spec/changes/legacy/`

### Records

- 未解决问题、风险、技术债：`spec/issues/`
- 项目默认规则：`spec/rules/`
- 版本级交付摘要：`spec/releases/`
- 架构决策记录：`spec/adr/`
- 项目级归档入口：`spec/archive/`

### Rules

- bug 修复工作流、根因、回归要求：`spec/rules/bug-fix-rules.md`
- 需求澄清、设计冲突、待确认记录：`spec/rules/clarification-rules.md`
- 编码标准、错误处理、安全和结构要求入口：`spec/rules/coding-standards.md`
- 文档语义到路径映射：`spec/rules/document-routing-rules.md`
- issue、技术债、本地交付状态和归档：`spec/rules/issue-management-rules.md`
- 测试方法、覆盖、UI 操作验证和回归矩阵：`spec/rules/testing-standards.md`
- 文档同步要求：`spec/rules/doc-sync-rules.md`
- active change、发布和变更记录：`spec/rules/change-management-rules.md`
- 完成定义：`spec/rules/definition-of-done.md`
- agent 边界保护：`spec/rules/agent-boundary-guardrails.md`
- TDD 和设计门禁：`spec/rules/tdd-design-gate.md`
- 代码质量和架构边界：`spec/rules/code-quality-architecture.md`
- 提交、编号、PR 和发布引用：`spec/rules/submission-traceability-rules.md`
- 记录 ID、索引、生命周期目录和年月归档：`spec/rules/document-archive-rules.md`

## PromptHub 当前稳定真相源

PromptHub 已经完成第一轮稳定文档迁移，当前长期真相源直接落在以下目录：

- `spec/workflow/*`：项目级背景、需求、设计、实施、验证与任务入口
- `spec/knowledge/context/`：长期稳定的角色、术语、产品边界
- `spec/knowledge/structure/`：长期稳定的结构、架构、模块边界
- `spec/knowledge/behavior/`：长期稳定的行为、规则、流程、状态流转
- `spec/knowledge/reference/`：平台矩阵、协议、schema、固定参考资料
- `spec/releases/`：发布规则与版本级交付摘要

## 当前规则

- 新增项目级文档统一写入 `spec/workflow/*`
- 根目录下不再保留重复的 `00-intake` ~ `05-tasks` 目录
- 根目录下不再保留 `spec/domains/`、`spec/architecture/`、`spec/logic/`、`spec/assets/` 旧稳定层
- 从 `spec-init` 同步规则时必须改写通用 `docs/*` 路由，不能在 PromptHub 内新增平行内部 `docs/workflow/*`、`docs/issues/*` 或 `docs/rules/*` 真相源

## 目录命名与编号规则

- 只有有固定执行顺序的 workflow 阶段目录使用两位数字前缀：`00-intake`、`01-requirements`、`02-design`、`03-implementation`、`04-verification`、`05-tasks`。
- `spec/knowledge/*`、`spec/rules/*`、`spec/issues/*`、`spec/releases/*`、`spec/adr/*`、`spec/archive/*` 使用语义化小写 kebab-case 名称；不要为了排序给这些目录新增数字前缀。
- `spec/changes/active/<change-key>/` 使用语义化小写 kebab-case 变更 key，不使用流水号前缀。
- 关联 GitHub issue 的 change key 优先使用 `<surface>-issue-<number>-<slug>`，例如 `desktop-issue-161-skill-store-batch`；只有无法确定 surface 时才使用 `issue-<number>-<slug>`。
- 已完成或放弃的 change 归档到 `spec/changes/archive/<YYYY>/<MM>/<YYYY-MM-DD>-<change-key>/`，日期前缀只用于归档时间，不用于 active 排序；`archive/` 根目录不平铺 date-prefixed change folder。
- 需求、设计、验证、任务编号写在文件内容里：`FR-###`、`DES-###`、`TEST-###`、`T-###`；不要把这些编号编码进文件夹名。
- 重命名已有 active change 目录必须作为单独整理任务处理，并同步更新所有仓库引用，不能在无引用检查的情况下批量改路径。
- 新建 standalone issue / bug / change request / ADR 使用 `ISS-YYYYMMDD-NNN`、`BUG-YYYYMMDD-NNN`、`CR-YYYYMMDD-NNN`、`ADR-YYYYMMDD-NNN`；已有 change key、GitHub snapshot 和历史归档不追溯重命名。

## 同步要求

- 目录结构变化时，必须同步更新 `spec-init.topology.yml`
- 目录结构变化时，必须同步更新 `README.md`
- 目录结构变化时，必须同步更新 `AGENTS.md`
- 文档边界变化时，必须同步更新本文件
- 规则分类变化时，必须同步更新 `spec/rules/README.md`、本文件和相关 active change
