# Tasks

- [x] 定义新的全局应用壳数据模型（AppModule / module order / visibility）
- [x] 设计最左侧一级功能栏组件
- [x] 将现有 Prompt / Skill 迁移到新的应用壳下
- [x] 新增 Rules 模块并接入一级功能栏
- [x] 实现白名单规则文件读取 / 保存 IPC
- [x] 将 Rules 白名单改为平台注册表驱动，并接入 Claude / Codex / Gemini / OpenCode 全局规则
- [x] 将 Rules 左侧重构为“全局规则 / 项目规则”两组（由后续 Rules 工作区交付）
- [x] 支持手动添加项目目录并管理其 canonical `AGENTS.md`（由后续 Rules 工作区交付）
- [x] 保留 Skill 下的 Projects 二级入口
- [x] 将平台路径模型收口到“平台根目录中心”，统一派生 Skills / Rules / Config 路径并保留 legacy 兼容
- [x] 为 Agent / MCP 预留一级模块壳（后续工作台已接入真实一级模块）
- [x] 将 `Agent管理` 从“额外 Skill 扫描目录”升级为“平台根目录 + 派生资产预览”的 agent 资产管理入口
- [x] 将 `Trae CN` 升级为显式内置平台，并迁移历史 `trae -> ~/.trae-cn` 配置
- [x] 新增 `Cline` 作为显式内置平台，并接入平台根目录派生模型
- [x] 设计用户可配置排序 / 显隐策略（由 `desktop-home-layout-controls` 交付）
- [x] 补充导航与壳层测试
- [x] 迁移现有设置 / Store / 其他系统入口到新壳层
