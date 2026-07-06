# PromptHub Clarification Rules

本规则定义什么时候必须向用户确认，什么时候可以继续推进并把假设写入 active change。

## 基本原则

- 不要把“我觉得合理”当成“用户已经确认”。
- 可以给候选方案和推荐意见，但必须区分“建议”和“已确认决定”。
- 关键疑点必须进入 `spec/changes/active/<change-key>/`、`spec/issues/` 或相关 workflow/knowledge 文档，不能只停留在聊天里。
- 小的实现细节可以按现有代码风格自行判断；会改变用户行为、数据语义、存储位置、兼容性或安全边界的选择必须确认。

## 必须暂停确认的场景

- 当前代码、稳定文档、active change 或用户要求互相冲突。
- 两个合理方案会导致不同的数据归属、迁移方式、用户体验或兼容性后果。
- 需要改变 source of truth，例如从 DB 改成 filesystem，或从复制改成链接。
- 需要覆盖、删除、迁移、重写或不可逆修改已有用户数据。
- 安全、权限、同步、备份、恢复、发布或 issue 关闭时机存在不确定性。
- 用户要求和项目规则冲突，例如跳过必须的 active change、测试或验证记录。

## 可以继续但必须记录的场景

- 只影响局部 UI 文案、布局微调或非持久化状态，且现有设计模式明确。
- 可以从当前代码和稳定文档推出唯一合理实现。
- 变更不会改变公共 contract、数据库/文件布局、同步语义或兼容性。
- 用户已经明确要求先执行，且风险可通过 active change 的假设和验证记录控制。

## 推荐提问格式

1. 说明当前疑点和它影响的边界。
2. 给 2 到 3 个候选方案。
3. 对每个方案说明适用场景、优点、代价和风险。
4. 给出推荐时明确写“推荐”，不要写成“已确认”。
5. 等待用户确认后再改变高风险边界。

## 待确认记录位置

- 单次变更内的待确认事项：`spec/changes/active/<change-key>/proposal.md` 或 `design.md`。
- 长期风险、技术债、阻塞项：`spec/issues/active/`。
- 已确认且长期有效的规则：`spec/knowledge/*` 或 `spec/rules/`。
- 对外用户影响：`docs/` 或 release notes，按实际发布范围决定。

## 禁止行为

- 为了省时间跳过关键澄清。
- 用模糊措辞掩盖尚未确认的设计选择。
- 在多个可行方案有明显数据或用户后果时自行拍板。
- 把 `[待确认]` 留在实现代码里，而不写入 spec 或 issue。

## 相关规则

- `AGENTS.md` 的 Design Conflict Stop Rule
- `spec/rules/agent-boundary-guardrails.md`
- `spec/rules/doc-sync-rules.md`
- `spec/rules/issue-management-rules.md`
