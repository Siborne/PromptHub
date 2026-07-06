# PromptHub Bug Fix Rules

本规则定义 PromptHub 修复缺陷时的默认工作方式。它补充 `spec/rules/testing-standards.md`、`spec/rules/tdd-design-gate.md` 和 `spec/rules/change-management-rules.md`。

## 基本原则

- 修 bug 必须定位根因，不能只绕开症状。
- 修复前先确认问题调用链、触发条件、影响范围和真实 source of truth。
- 用户可见 bug、持久化 bug、同步/恢复 bug、IPC/API bug、安装/导入/导出 bug 都属于非 trivial 工作，默认需要 active change。
- 修复必须能回链到症状、根因、修复方案、回归验证和残留风险。
- 不能靠默认值、空 catch、硬编码假数据、跳过校验、注释掉逻辑来“修好”问题。

## 必须步骤

1. 复现问题，或明确记录无法复现时的已知失败现象和证据来源。
2. 识别 owning surface：`apps/desktop`、`apps/web`、`apps/cli`、`apps/web-cloudflare`、`packages/core`、`packages/db` 或 `packages/shared`。
3. 识别 source of truth：SQLite、filesystem workspace、SKILL.md、settings、remote sync payload、IPC/API contract 或 UI state。
4. 画出调用链，例如 `renderer action -> store -> preload -> IPC handler -> service -> DB/filesystem`。
5. 在 `spec/changes/active/<change-key>/` 记录症状、根因、设计取舍、任务和验证。
6. 先补能失败的最低有效层回归测试，再实现修复；文档-only 或无法先写测试时必须记录原因。
7. 修复后运行相关测试、类型检查、lint 或 release harness，并把结果写入 `implementation.md`。

## 回归要求

- 回归测试必须复现原失败条件，而不是只覆盖修复后的 happy path。
- 持久化、文件系统、同步、安装、导入、导出、删除等 bug 必须断言 durable side effects。
- UI bug 必须检查用户实际依赖的可见状态、可点击入口、loading/empty/error 状态和主流程结果。
- Skill 系统 bug 必须先检查 `spec/knowledge/reference/skill-defect-taxonomy.md` 和 `spec/knowledge/reference/skill-regression-test-matrix.md`。
- 如果涉及 partial failure，必须验证不会留下半写入 DB row、半复制目录、半安装状态或错误 UI 状态。

## Active Change 记录要求

Bugfix active change 至少记录：

- 用户或系统看到的失败现象。
- 受影响入口和调用链。
- 根因和为什么现有测试没有拦住。
- 修复方案及其不改变的边界。
- 回归测试、手动验证和未覆盖风险。
- 是否需要同步稳定 docs、issue 本地状态或 release notes。

## 禁止行为

- 没有读相关代码和稳定文档就直接改。
- 没有根因说明就只改表象。
- 把错误吞掉并返回成功。
- 用 mock call count 替代用户可见结果或持久化结果。
- 在用户未要求时自动 commit。

## 相关规则

- `spec/rules/tdd-design-gate.md`
- `spec/rules/testing-standards.md`
- `spec/rules/change-management-rules.md`
- `spec/rules/submission-traceability-rules.md`
