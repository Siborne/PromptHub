# Store Spec Delta

## FR-CLOUD-STORE-001 Cloud Store 读取

桌面端必须能从 Cloud 的公开 feed 和 package endpoint 读取已发布 Skill release，并把它们映射到现有 Store 列表/详情组件。

## FR-CLOUD-STORE-002 安装前确认

### Scenario: 安装 Skill

- **WHEN** 用户从 Cloud Store 选择一个未安装 Skill
- **THEN** 桌面端先取得当前 published package，执行现有安全扫描，并展示版本、文件差异和扫描结果。
- **AND** 只有用户明确确认后才创建 install intent、写入本地 Skill，并回传 `started` 和最终 `succeeded`/`failed`。

## FR-CLOUD-STORE-003 更新前确认与对账

### Scenario: 更新存在本地修改

- **WHEN** 当前本地 Skill 与 Cloud release 不一致
- **THEN** 桌面端显示 B/L/T 对账状态和 Cloud release diff，不得点击“检查更新”后直接覆盖本地内容。
- **AND** `local-modified` / `conflict` 必须沿用现有 source update 策略，只有用户明确选择覆盖并确认后才可写入。

## FR-CLOUD-STORE-004 结果回传

- 安装 intent 必须带 release/fingerprint expectation、客户端版本、平台和目标。
- 本地写入前回传 `started`；成功或失败都必须尽力回传终态。
- 回传失败不得回滚已经成功写入的本地 Skill，也不得阻断本地 UI 完成反馈。

## FR-CLOUD-STORE-005 安装历史

登录用户可读取自己的安装记录；桌面端只展示状态、版本、时间和失败摘要，不展示凭证、对象 key 或 package secret。

## FR-CLOUD-STORE-006 桌面商店互动

Cloud Skill 详情必须在桌面端支持登录用户点赞、收藏和举报，并复用 Cloud 的唯一真源与权限校验。

### Scenario: 未登录浏览

- **WHEN** 用户未登录打开 Cloud Skill 详情
- **THEN** 桌面端仍可显示公开的互动计数，但互动操作必须提示登录，不发送伪造的匿名写请求。

### Scenario: 互动与举报

- **WHEN** 已登录用户点击点赞或收藏
- **THEN** 桌面端调用对应 Cloud API，成功后更新当前详情的计数和 viewer 状态；重复点击执行取消操作。
- **WHEN** 用户提交举报
- **THEN** 桌面端要求选择原因并可填写补充说明，成功后只显示提交结果，不展示凭证或服务端内部字段。

## FR-CLOUD-STORE-007 发布门禁与失败呈现

### Scenario: 尚未开放 Cloud 桌面能力

- **GIVEN** 桌面包没有显式启用 PromptHub Cloud 发布开关
- **THEN** 设置导航和 Skill Store 来源列表都不得展示 PromptHub Cloud。
- **AND** 自动刷新、旧版本持久化状态和程序化来源选择都不得发起 Cloud 请求。
- **AND** 旧版本选中的 Cloud 来源必须回退到官方商店。

### Scenario: 显式启用后服务不可用

- **GIVEN** 桌面包显式启用了 PromptHub Cloud
- **WHEN** Cloud 请求失败
- **THEN** UI 只展示本地化的产品错误，不得透出 Electron IPC 调用包装或内部错误细节。
