# PromptHub Change Management Rules

## 基本原则

- 当前状态文档和历史变更文档必须同时维护。
- 新需求、bugfix、重构、发布，不允许只改代码不留文档痕迹。

## 记录规则

- 新需求或需求变化：更新 workflow / knowledge 中受影响内容，并在 `spec/changes/active/<change-key>/` 建立工作区
- bug 修复：更新受影响文档，并在 `spec/changes/active/<change-key>/` 记录症状、根因、验证和影响范围
- 架构或关键技术变化：更新 `spec/workflow/02-design/README.md`、`spec/knowledge/structure/README.md`，必要时补 `spec/adr/`
- 版本发布：新增或更新 `spec/releases/` 中的版本记录
- 实现前：完成 analyze，确认需求、设计、验证、任务和 change 没有冲突、孤立 ID 或阻塞性 `[待确认]`
- 实现后：完成 converge，确认实际行为、验证、稳定文档、记录索引和 change 状态一致
- 变更完成后：归档到 `spec/changes/archive/<YYYY>/<MM>/<YYYY-MM-DD>-<change-key>/`
- `spec/changes/active/` 只保留真正仍在推进、阻塞、待复核或当前工作区仍有未提交改动的 change；不要把已完成记录长期留在 active 中。

## 目录命名

- active change 目录使用小写 kebab-case 语义 key，不加流水号前缀。
- issue 相关 change 优先使用 `<surface>-issue-<number>-<slug>`。
- archive change 目录按年月分层，最终目录名保留完整归档日期：`spec/changes/archive/<YYYY>/<MM>/<YYYY-MM-DD>-<change-key>/`。
- workflow 阶段目录才使用 `00` 到 `05` 的顺序编号。
- `FR / DES / TEST / T` 编号写在 change 文件内容里，不写进目录名。
- 重命名已有 change 目录前必须先完成引用搜索并同步更新引用。

## 最低要求

- 每条 change 工作区都要写清背景、影响范围、同步文档和待确认项
- 每条 bug 记录都要写清症状、根因、修复方案和回归要求
- release 记录要写清新增、修复、破坏性变化和已知问题
- 归档前至少确认 tasks 状态、implementation 结果和引用路径；若历史记录缺少当前模板文件，但任务和 implementation 已证明完成，也应归档为历史记录，而不是继续占用 active。
- 状态写成 Implemented / Shipped / Completed 且没有剩余任务时，不得继续留在 active；若仍需发布、复核或文档同步，状态必须明确写成 release-pending / review-pending / needs-convergence 并列出退出条件。
