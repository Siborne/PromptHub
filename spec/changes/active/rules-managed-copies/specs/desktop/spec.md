# Delta Spec

## Added

- Rules 模块应将规则正文作为 PromptHub 托管数据保存到内部数据层，而不是只存在于外部目标文件。
- Rules 模块应在 `userData/data/rules/` 下保留每条规则的纯文本 canonical 副本，便于备份、恢复、导出、规则市场分发和人工修复。
- Rules 模块应为每条规则维护内部版本历史，支持创建、手动保存、AI 改写、市场安装和版本恢复等来源标签。
- Rules 模块应区分内部托管状态与外部目标文件同步状态，并允许用户显式重新部署到目标文件。
- 当外部目标规则文件被 PromptHub 之外的工具或用户直接修改后，Rules 模块应在扫描/读取对应规则时检测到冲突，并让用户选择同步方向。

## Modified

- 项目规则不再自动包含“当前项目”伪规则项；项目规则只来自用户手动添加的项目路径。
- Rules 模块的保存语义应从“直接覆写外部文件”改为“先保存到 PromptHub 内部，再同步到外部目标文件”。
- 备份与恢复应覆盖规则正文与规则版本，而不只覆盖 `ruleProjects` 路径元数据。
- 恢复数据时，不得自动无提示覆写外部平台规则文件；恢复后的规则可处于待部署或冲突状态。
- 全局规则白名单仍由共享常量声明，但其内容存储不再依赖直接从目标文件路径读取。
- SQLite catalog 重建后，Rules 首次读取必须从 canonical Rule 文件恢复正文、版本和项目目标绑定，并重新派生内置全局规则的当前设备目标路径；不得把 canonical `rule.md` 误当作外部部署目标。
- standalone Rules 侧栏必须展示已由 PromptHub 文件持有但外部目标缺失的规则，使用户可以查看、编辑和重新部署托管内容；`exists` 只表示外部目标状态，不表示规则是否存在。

## Removed

- `Current Project` / `workspace-agents` 作为默认项目规则入口的产品语义。
- `~/.prompthub/rule-history/` 作为 Rules 版本历史的长期主存储角色。

## Scenarios

- 当用户手动添加一个项目目录后，PromptHub 会为该目录的 canonical `AGENTS.md` 建立一条托管规则记录，并在内部保存正文与版本。
- 当用户编辑一个全局规则并点击保存时，PromptHub 会先保存内部记录和 managed copy，再尝试同步到目标文件；即使目标路径不可写，规则正文仍保存在 PromptHub 内部。
- 当用户导出或备份数据时，规则正文和规则版本会和 Prompt、Skill 一样进入备份载荷，而不是只留下一个路径列表。
- 当用户在新机器恢复备份后，即使原来的平台根目录或项目路径尚不存在，规则内容仍可在 PromptHub 内查看、继续编辑，并等待重新部署。
- 当未来规则市场下载一份规则时，PromptHub 可以先把它作为内部托管规则保存，再由用户选择覆盖哪个外部目标文件。
- 当用户绕过 PromptHub 直接修改项目目录或平台目录中的 `AGENTS.md` / `CLAUDE.md` 后，再次扫描并选择该规则时，PromptHub 应展示内部托管版本与外部文件版本，并让用户选择“保留 PromptHub 版本”或“保留外部文件版本”；执行覆盖前必须二次确认。
- 当 `prompthub.db` 被删除、损坏或因 schema 迁移而重建时，项目 Rule 的目标路径和项目根路径从 canonical 文件恢复；首屏不弹恢复选择，也不要求用户点击 Rescan 才能重新看到规则。

## `FR-RULESCROLL-001` Long Conflict Comparison

当规则冲突包含超出可视区域的长文件时，差异和并排比较必须共享一个可聚焦、可上下滚动的内容区域；标题、比较模式和覆盖操作保持可见，不得因嵌套滚动或裁剪而阻止用户检查后续差异。

## `FR-RULESCROLL-002` Conflict Source Identity

冲突弹窗必须持续、明确地区分 PromptHub 托管版本与磁盘外部文件版本，并让两个保留操作直接写明将保留哪一个版本；来源标识不得只依赖 `+` / `-` 符号或会随差异正文滚走的图例。

## `FR-RULESCROLL-003` Compact Conflict Toolbar

比较模式与来源标识必须保持紧凑、左对齐并按可用宽度自然换行；来源状态块不得拉伸占满整行，滚动正文与固定工具栏之间必须保留稳定间距。

## `FR-RULES-COPY-020` Rebuildable Rule Placement And Visibility

删除、损坏或迁移 `prompthub.db` 后，PromptHub 必须只依赖 canonical Rule
bundles 和当前设备路径配置重建 Rules 正文、版本、项目绑定与外部目标投影。
首次 Rules 列表读取必须自动纠正旧/错误缓存；外部 target 缺失不得隐藏仍有
canonical 正文的 Rule，也不得触发人工数据恢复选择。
无内容、版本或项目 placement 变化的扫描不得改写 canonical Rule bundle 或提升
revision，避免制造下一次启动的虚假 catalog rebuild。

## `FR-RULES-COPY-021` Bounded Agent Rule Loading

从 Agent 详情首次打开 Rules 时，文件权威扫描必须保持线性且有界：一次扫描只
获取一次 SQLite 投影适配器，同一个已打开的数据库连接只执行一次 canonical
Skill 工作区 hydration。Agent 页在 inventory 返回后只读取当前 Agent 的 Rule，
不得先读取列表中的无关 Rule。扫描失败必须结束 loading 并进入现有错误/重试
状态，不得以重复扫描掩盖错误。

## `FR-RULES-COPY-022` Chronological Rule Version Repair

Rules 首次读取必须兼容 canonical hydration 曾产生的“旧到新”compatibility
version index，以及正常写入产生的“新到旧”index。读取时应无损归一化为运行期
“新到旧”顺序，写入 SQLite 时按时间分配递增 version number，canonical bundle
始终发布“旧到新”历史。旧索引顺序不得导致整个 `rules:list` 失败或隐藏规则。
