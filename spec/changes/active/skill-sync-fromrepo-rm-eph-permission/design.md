# Design — EPERM-safe canonical skill workspace replacement

Status: pre-implementation; design notes for the pending coding pass.

## Current behavior

`hydrateCanonicalSkillWorkspace`（packages/core/src/canonical-skill-library.ts）：
- `fs.rmSync(workspacePath, { recursive: true, force: true })`
- 再 mkdir + 逐个 `COPYFILE_EXCL` + 写 `.canonical-bundle-hash` + rename 进入。

即先删旧树再建新树；删除若被 Windows 占用（EPERM on `SKILL.md`）即整体失败，
并把错误带进 `skill:syncFromRepo`/`restore`，而下一次回收又在同一路径重试。

## 比选

1. 建栈替换（推荐）：
   - 在带 PID/salt 的 `workspacePath.<nonce>.stage` 里完整建好新树（含
     `.canonical-bundle-hash`）；
   - 就绪后把当前 `workspacePath` rename 为 `.prior`，再把 stage rename 成目标，
     失败则把 prior 换回；
   - prior 清理失败（EPERM）不应标记同步失败：仅记录并留待下次启动回收
     （与项目既有 journal/prior 回收语义一致）。
   - 好处：不做成对 DB 一致性的写，占用只影响无害 prior 延迟删除。
2. 直接对 `rmSync` 做有限重试/延迟——治标，占用若持续仍失败。

## Owner / 不改点

- 仅 core `canonical-skill-library` workspace 替换时序与启动期回收 hook；
  不触碰 `resource-bundle` 只读完整性校验。
- `packages/shared`/IPC 对外契约不变（sync 结果类型不变，仅在失败根因归一化）。

## 验证草案

- 集成/单测注入「对某文件持有 fd / 令删除抛 EPERM」的 hook：旧树在失败后仍存在、
  新树未半写、后续调用可收敛。
- covered lines/branches 目标 100%（node:fs rm/rename 边界用 stub+真实 tmpfs 混合）。
