# Web Delta Spec

## Modified Requirements

### Requirement: Web Runtime Must Track Desktop Bridge Contract

- `apps/web` 通过 Web runtime 复用 desktop renderer 时，bridge 层必须为 renderer 已依赖的关键 preload API 提供兼容实现或显式降级。
- Web runtime 不得因为缺失 `window.api.*` / `window.electron.*` 方法而在主要页面上出现功能性崩溃。
- Web runtime 的产品边界不是替代桌面端本机管理能力。自部署 Web 主要用于 Prompt 临时浏览、远端备份 / 恢复源、以及备份内容的可视化查看。
- Skill、Rules、Agent、本机平台目录、软链接、第三方 AI 工具分发与替换等需要写入用户本机文件系统或平台配置的能力，必须归桌面端执行；Web 端只能浏览、备份、恢复或明确降级，不得暗示它会直接分发到用户桌面环境。
- Web 导入桌面端数据时必须考虑版本差异。较新桌面端产生的备份可能包含较旧 Web 端未知字段；Web 端应优先保留可识别数据、明确报告不兼容项，并避免静默破坏 Prompt / Skill / Rules 数据。

#### Scenario: Rules and Tag Management in Web Runtime

- WHEN self-hosted Web 打开与 desktop 共用的 renderer 界面
- THEN Rules 工作台、Prompt 标签管理、Skill 文件编辑等最近已交付的能力应继续可用或明确降级
- AND 不得因为 bridge 缺失方法而在用户交互时抛出运行时错误

#### Scenario: Browser Workspace Does Not Promise Local Distribution

- WHEN 用户在自部署 Web 工作区查看 Skill、Rules、Agent 或设备管理入口
- THEN 页面必须说明 Web 是备份与浏览工作区
- AND 本机平台目录写入、软链接创建、第三方 AI 工具分发、桌面端替换操作必须引导用户回到桌面端执行或显式禁用

#### Scenario: Cross-Version Backup Import

- GIVEN 桌面端版本可能新于 Web 端部署版本
- WHEN Web 端读取桌面端备份快照
- THEN 备份格式必须带有可判断的版本 / schema 信息
- AND Web 端必须拒绝或降级处理无法安全理解的结构
- AND 不能因为未知字段、未知枚举或新增配置项导致已支持的 Prompt 数据无法浏览

#### Scenario: Prompt Desktop-Compatible Restore Surface

- WHEN Web runtime 复用桌面端的全量备份恢复流程
- THEN `folder.insertDirect`、`prompt.insertDirect`、`version.insertDirect`、`version.delete`、`prompt.syncWorkspace` 必须写入 Web 后端的 SQLite / workspace
- AND 这些 bridge 方法不得是空实现
- AND 恢复后必须能通过 Web Prompt API 读取恢复出的 folder、prompt、version
- AND Cloudflare Worker 形态必须暴露同名兼容 API；其中 `prompt.syncWorkspace` 在无本机文件系统的 Worker 上可以是受认证 no-op，但不能返回 404
