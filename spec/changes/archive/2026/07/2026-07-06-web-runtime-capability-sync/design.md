# Design

## Approach

- 把 `apps/web/src/client/desktop/install-bridge.ts` 当成 Web runtime 的 preload contract 适配层，优先补齐 desktop renderer 已真实调用的方法，而不是去修改 desktop renderer 做 Web 特判。
- 缺失能力分三类处理：
  - 已有 Web 路由但 bridge 没接：直接补 bridge
  - desktop 使用但 Web 后端没有等价路由：新增最小 Web 路由
  - 明确 desktop-only：提供显式降级或 no-op，但保证不会让 renderer 因 `undefined is not a function` 崩溃
- 这轮优先级：
  - `prompt.getAllTags / renameTag / deleteTag`
  - `rules.*`
  - `skill` 的关键 by-path / version / zip export / 平台状态兼容能力
  - `window.electron` 中 desktop renderer 已直接依赖的缺失能力

## Product Boundary

- 自部署 Web 是远端工作区和备份源，不是桌面端本机分发器。
- Prompt 是 Web 的主要浏览与临时编辑对象；Skill / Rules / Agent 数据可以被纳入备份、浏览和恢复，但不能在浏览器里直接写入用户桌面上的 Claude Code、Codex、Cherry Studio 或项目目录。
- 任何需要本机 filesystem 权限、软链接、平台配置替换、第三方 AI 工具目录扫描的动作都必须归桌面端完成。Web bridge 对这些能力应返回明确降级状态，而不是假装成功。
- 用户可见文案必须避免“Web 完整复刻桌面端”的误导，应说明 Web 用于临时查看 Prompt、集中备份和恢复。

## Backup Compatibility

- 桌面端完整恢复的最稳妥边界是用户数据根目录中的持久数据：当前主布局集中在 `<userData>/data`，包括 `data/prompthub.db`、`data/prompts`、`data/rules`、`data/skills`、`data/assets` 等；历史版本还可能存在根目录 `prompthub.db`、`skills`、`workspace`、`images`、`videos`。
- 升级快照当前复制整个 `userData` 树中除运行时缓存、临时数据库文件和备份根之外的条目；这比只复制 `data/` 更适合作为桌面端灾难恢复。
- Web 同步快照不是原始目录镜像，而是 schema 化 payload：Prompt / Folder / Rule / Skill / Settings / media。它适合作为自部署备份源和浏览源，但不能替代桌面端完整用户数据目录快照。
- 跨版本读取必须由 manifest / schema 约束保护。旧 Web 读取新桌面快照时应保留可理解字段、报告无法处理字段或枚举，并拒绝可能破坏数据的导入。
- Web runtime 复用桌面全量备份恢复流程时，`insertDirect` 类 bridge 不能降级为空实现；否则桌面恢复流程会先删除现有数据再“成功”执行空插入。Prompt / Folder / Version direct restore 必须落到 Web 后端受认证保护的 route，并更新 SQLite 与 workspace 文件。
- Cloudflare Worker 使用 `apps/web/dist/client` 作为前端资产，因此 Web 前端新增的 API contract 也必须同步到 Worker route。Worker 没有本机 filesystem workspace，`prompt.syncWorkspace` 可以只返回成功；但 direct restore、version delete 必须真实更新 D1 中的 snapshot。

## Tradeoffs

- 继续复用 desktop renderer 能最大化共享功能，但代价是 Web bridge 必须持续跟进 preload contract。
- 不在这轮引入自动 contract 生成；先用最小代码修复和测试覆盖恢复功能，再决定后续是否需要自动化对齐。
- Web 端显示 Skill / Rules 内容会提高备份可见性，但不能把浏览能力扩展解释为本机平台分发能力；否则用户会误以为浏览器能替代桌面端写入本机 AI 工具配置。
- Prompt 是 Web 端应完整支持的核心域；因此 Prompt CRUD、搜索、标签、版本、文件化 workspace、导入导出和桌面兼容恢复 bridge 都应有真实后端实现与回归测试。
- 每次 Web bridge 增加 API 时，需要同时检查 Node self-hosted Web、Cloudflare Worker、桌面 self-hosted sync、CLI/API 入口是否需要同名契约或显式降级，避免前端资源最新但某个后端形态仍停留在旧 contract。
