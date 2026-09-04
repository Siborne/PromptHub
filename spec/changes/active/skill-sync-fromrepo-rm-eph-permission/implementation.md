# Implementation — EPERM-safe canonical skill workspace replacement

Branch: feat/my-skills-tag-search（同一 commit 内含该 change 的存档与源码实现）
Status: implemented, verified (typecheck + core tests); Windows transient-file
acceptance runs on-device.

## 现象 / 根因

`skill:syncFromRepo`（及 create/update 触发的 hydrate）在替换
`cache/skill-workspaces/<skillId>` 时，旧代码先
`fs.rmSync(workspacePath, { recursive: true, force: true })` 再 rename 新树进
原地。Windows 下当 `SKILL.md`（或任一文件）被短时句柄占用（编辑器/索引器/
杀软），递归删除一部分后抛 EPERM → 可能已撕碎旧工作区并让同步失败：

```
resource ... skill-workspaces/<id>/SKILL.md
EPERM: operation not permitted, lstat ... (at rmSync → hydrateCanonicalSkillWorkspace)
```

## 改动

`packages/core/src/canonical-skill-library.ts`：迁移为 **rename-first 交换**
（不再就地先删再用）：

- `isTransientOwnershipCode`：识别 EPERM/EBUSY。
- `removeDeprecatedTree`：仅对「废弃/prior/stage」树做 best-effort 删除，
  短暂占用失败不抛（残留无害且不引用），其余 IO 错误照常上抛。
- `replaceOwnedWorkspace`：新树在 stage 完整就绪后，旧 `workspacePath` 以单次
  rename 移至 `.prior-<pid>-<ts>`，再把 stage 原子 rename 回原位；旧树只在
  成功换上后才尽力删除。若移动旧树本身失败，旧树保持不动并按既有语义抛错。
- `hydrateCanonicalSkillWorkspace`：stage 用含时间戳的后缀避免 PID 复用碰撞；
  保证父目录存在；结尾 finally 只做残余 stage 的 tolerant 清理。

关键不变量：永不就地删除受控运行副本 → 不再因 EPERM 撕裂工作区；已废弃
`.prior-*` 删除失败不再把一次健康同步变失败。

## 验证

- `packages/core` `tsc --noEmit` → 通过（无输出）。
- `canonical-skill-db.test.ts` → 6 passed / 1 failed。“restores pending row…”
  失败为 Windows 宿主 `fs.symlinkSync` EPERM（测试 setup 需要符号链接权限），
  环境既有问题，与本次改动无关；其余（含 create→update 走新 replaceOwnedWorkspace
  全路径）通过。

## 已知覆盖缺口 / 设备验收

- 无法在 CI/Linux 稳定构造 Windows-only transient EPERM；「removeDeprecatedTree
  吞 EPERM/EBUSY」「move 失败时旧树保留」分支需在该 Windows 桌面设备上真机复验
  （导入后可多次 syncFromRepo，确认不再出现 SKILL.md EPERM；必要时保留一条设备
  记录）。断言剩余 `.prior-*` 不与主路径竞态，随回归纳入。
