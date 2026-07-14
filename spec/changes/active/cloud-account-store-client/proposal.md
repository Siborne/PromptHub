# Cloud 账号与 Skill 商店桌面闭环

## 目的

PromptHub Cloud 已具备账号、公开 Store release、安装意图和结果回传接口，但桌面端仍把商店当作本地/第三方 registry 使用，用户无法在桌面端登录 Cloud、浏览同一份已发布内容、查看更新差异后确认安装，也无法把安装结果回传给 Cloud。

本变更补齐桌面端到 Cloud 的最小真实闭环，并保持本地 Skill 数据仍由桌面端 SQLite 与 Skill repo 负责。

## 范围

- Cloud 桌面登录、当前账号读取、注销和禁用/删除状态错误。
- Electron 主进程安全保存 Cloud 会话凭证；renderer 不接触 token。
- 复用现有 Skill Store UI 增加 PromptHub Cloud 来源。
- Cloud feed/detail/package 映射为现有 `RegistrySkill`。
- 安装和更新先取得 package、展示版本/文件差异和安全扫描结果，再由用户明确确认。
- 安装意图、started、succeeded/failed 状态回传和安装历史读取。

## 不做

- 不把 Cloud token 写入 SQLite、renderer localStorage、日志、toast 或 Skill metadata。
- 不改变本地 Skill 的 SQLite/repo 真源。
- 不在本变更中实现 Cloud 全量 Prompt/Skill 数据同步、团队协作或支付。
- 不绕过现有安全扫描和 source update 对账。

## 回滚

Cloud 来源可独立隐藏；删除本地 Cloud credential 文件不会影响已有本地 Skill。API 失败时安装/更新必须保持本地内容不变，安装意图可保留为失败记录供 Cloud 指标使用。

在生产 endpoint 与发布证据完成前，桌面端必须默认隐藏 Cloud 账号入口和 Cloud Skill Store 来源。仅显式构建开关可以启用该能力；隐藏时不得后台请求 Cloud，也不得让旧版本持久化的 Cloud 选中状态继续触发请求。

## 影响

影响 Electron main/preload/renderer、共享 IPC channel，以及 Cloud auth middleware/API contract。现有第三方 registry 来源和本地 Skill 安装路径保持兼容。
