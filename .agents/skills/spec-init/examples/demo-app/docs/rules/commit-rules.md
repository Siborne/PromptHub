# 提交规范

## 提交门禁

- AI agent 只有在用户明确要求提交、分批提交、改写提交或推送时才能执行 Git 写操作。
- 提交前必须查看 `git status --short`，区分本轮改动、用户改动和并行改动。
- 每个 commit 必须是一个独立、可回滚的逻辑单元。
- 非 trivial commit 必须关联一个主要 Issue 或 change workspace。

## 标题

使用 Conventional Commits：

```text
<type>(optional-scope): <简短祈使句>
```

## 提交正文

非 trivial commit 必须包含正文，至少记录摘要、主要关联和实际测试状态；只有短标题不算合规提交。

```text
摘要：
说明本次提交为什么存在。

关联：
- Change: docs/changes/active/<change-key>/
- Issue: #123

测试状态：
- <实际命令>：通过
- <未运行项及原因>
```

## Issue 语义

- 版本尚未发布时使用 `Refs #123`。
- 只有包含该变更的版本已经发布且 issue 应关闭时，才使用 `Closes #123`。

## 提交前检查

1. staged 文件只属于本提交。
2. 非 trivial change 已维护 `FR -> DES -> TEST -> T`。
3. commit body 已记录主要关联和测试状态。
4. `git diff --cached --check` 通过。
