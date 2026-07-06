# Delta Spec

## Added

### Requirement: Desktop data directory has a single authoritative root

桌面端必须让“用户数据目录”对用户和程序都代表同一个完整根目录，不应再把主数据库放在根目录、把工作区放在 `data/` 子目录，导致用户误判哪些文件必须一起迁移。

#### Scenario: copy complete data directory between versions

- Given 用户将旧版本完整数据目录复制到新版本使用的位置
- When 新版本首次启动并执行数据布局探测
- Then 应能在不依赖手工导出导入的前提下识别并使用完整数据
- And 不应因为主数据库与工作区目录分离而只恢复部分 prompt

### Requirement: Desktop startup supports legacy layout migration

桌面端在检测到旧布局时，必须安全地把旧布局迁移到统一布局，且迁移失败时不得破坏原始数据。

#### Scenario: startup sees legacy root db plus workspace subdirectories

- Given 当前 `userData` 中存在旧布局数据
- And 主数据库位于旧根路径，工作区/资源位于旧子路径
- When 应用启动
- Then 应创建迁移前快照
- And 自动迁移到新布局
- And 若迁移失败，仍能回退到旧布局继续启动

### Requirement: Recovery and backup flows remain layout-agnostic

桌面端的升级备份、恢复候选检测与数据路径切换能力必须同时兼容旧布局与新布局。

#### Scenario: recovery candidate scan after layout unification

- Given 当前版本已经使用统一布局
- When 系统扫描历史恢复候选
- Then 应同时识别旧布局候选与新布局候选
- And 恢复后应用启动不应因布局差异导致部分数据不可见
