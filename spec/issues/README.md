# Spec Issues

`spec/issues/` 用于存放 PromptHub 内部 SSD 视角下的问题跟踪，而不是对外 issue 模板或零散聊天记录。

在锁定的 `spec-init` 基线（`f83def1`）中，这一层属于 `records.issues`。

## Structure

- `active/`：当前仍在跟踪的问题，包括内部质量跟踪与当前 open GitHub issues 快照。
- `archive/`：已关闭或仅保留历史参考价值的问题记录。

## Current Records

- `active/quality.md`：内部质量与工具链问题跟踪。
- `active/github-open.md`：当前 `legeling/PromptHub` 仓库 open issues 快照。
- `active/local-github-status.md`：本地 triage / delivery 状态覆盖层，用于记录已实现但尚未发布的问题。
- `active/ISS-20260710-001-spec-governance-debt.md`：spec-init 对齐后发现的 active-change、生命周期和索引治理欠账。
- `active/ISS-20260809-001-remaining-open-issues-roadmap.md`：当前 open GitHub issues 的真实剩余工作分类、优先级与 authoritative change 路由。
- `active/ISS-20260902-001-git-transport-resilience-parity.md`：Skill #211 修复后，Plugin、CLI 与显式 Git 操作仍需分别决定 archive fallback 或明确 Git 前置条件。
- `archive/github-closed.md`：当前 `legeling/PromptHub` 仓库 closed issues 快照。

## Internal Record Index

| ID                 | Title                         | Status | Path                                                                   | Related change/issue                                                   | Updated    |
| ------------------ | ----------------------------- | ------ | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------- |
| `ISS-20260710-001` | Spec Governance Debt          | open   | `spec/issues/active/ISS-20260710-001-spec-governance-debt.md`          | `2026-07-10-spec-init-upstream-alignment`                              | 2026-07-10 |
| `ISS-20260806-001` | MCP Issues 200-202 Triage     | open   | `spec/issues/active/ISS-20260806-001-mcp-issue-triage.md`              | `spec/changes/archive/2026/08/2026-08-06-mcp-issues-200-202-analysis/` | 2026-08-06 |
| `ISS-20260809-001` | Remaining Open Issues Roadmap | open   | `spec/issues/active/ISS-20260809-001-remaining-open-issues-roadmap.md` | Multiple routed active changes                                         | 2026-08-09 |
| `ISS-20260902-001` | Git Transport Resilience Parity  | open   | `spec/issues/active/ISS-20260902-001-git-transport-resilience-parity.md`  | `skills-issue-211-git-http-fallback`      | 2026-09-02 |

## GitHub vs Local State

GitHub issue state and PromptHub local delivery state are intentionally separate:

- `github-open.md` / `github-closed.md` only mirror remote GitHub state.
- `local-github-status.md` records local statuses such as `untriaged`, `accepted`, `in_progress`, `local_done`, `release_pending`, `released`, `wontfix`, and `duplicate`.
- A locally completed issue remains open on GitHub until the target release has shipped.
- After a release ships, close the GitHub issue publicly, then refresh both snapshots.

This prevents the project from closing user-reported issues before users can download a build that contains the fix.

## Sync Note

- 当前 GitHub issue 清单通过 GitHub CLI 手工同步到仓库。
- 本轮同步时间：`2026-08-08`。
- 新增 #203：清理由 PromptHub 生成的 Agent 配置副产物，并纠正 MCP
  版本与外部投影的边界；当前本地状态为 `in_progress`，对应 active
  change 为 `mcp-version-history-and-projection-safety`。
- 当前实施范围已收缩到历史升级与恢复问题 #89、#97、#98。移动端、
  Windows 签名、云端协作、外部商店和 Git 远端备份保留设计记录，但本地
  状态为 `accepted`，不表示实现已经开始。
- MCP issue triage 记录见 `active/ISS-20260806-001-mcp-issue-triage.md`，覆盖 #200、#201、#202 的当前边界和后续门禁。
- 如果 GitHub issue 状态发生明显变化，或某个 active change 依赖 issue 上下文，应优先刷新这里的快照。
- 如果只是本地实现状态变化，更新 `active/local-github-status.md`，不要手改 GitHub 快照文件。

## Routing Rule

- 未解决问题、风险、技术债、外部 issue 快照 -> `spec/issues/`
- 单次变更的实施细节和验证不写在这里，应写回 `spec/changes/active/<change-key>/`
