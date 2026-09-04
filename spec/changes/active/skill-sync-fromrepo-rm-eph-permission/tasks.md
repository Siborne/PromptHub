# Tasks — skill-sync-fromrepo-rm-eph-permission

- [x] 复现定位：Windows 下 rmSync 删除 `cache/skill-workspaces/<id>` 内被占用
      `SKILL.md` 抛 EPERM，导致 syncFromRepo/update 失败（见 proposal/implementation）。
- [x] 实现：hydrate 改 rename-first 交换（旧树原子 rename 至 `.prior-*`，成功换上后才
      尽力删除旧树）；残余 stage/prior 删除仅吞 EPERM/EBUSY，其它 IO 照抛；
      stage 后缀带时间戳避免 PID 复用。
- [x] `packages/core` typecheck 通过。
- [x] canonical-skill-db 套件：6 passed（1 failure 为 Windows `fs.symlinkSync`
      环境 EPERM，与本改动无关）。
- [ ] 真机 Windows 验收：导入后多次 syncFromRepo 不再出 SKILL.md EPERM；如需，
      记录设备结果并回填本 implementation.md。
