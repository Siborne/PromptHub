# Desktop Delta Spec

## ADDED Requirements

### Requirement: Store Listings Must Preserve Same-Name Skills From Different Sources

Skill 商店在加载远端 source 时，必须允许不同 source、不同 branch、不同 directory 的同名 skill 同时出现在列表中。

#### Scenario: Same name exists in two different sources

- Given 用户添加了两个 source
- And 这两个 source 都提供了名称为 `abc` 的 skill
- And 两份 `abc` 的 `source_url` 或 source identity 不同
- When 用户浏览商店列表
- Then 两份 `abc` 都必须显示
- And UI 不得仅因为名称相同而隐藏其中一份

#### Scenario: Same name exists in main and dev branches

- Given 用户添加了同一个仓库的 `main` 与 `dev` 两个 branch source
- And 两个 branch 下都存在名为 `abc` 的 skill
- When 用户浏览商店列表
- Then 两份 `abc` 必须作为两个独立条目显示
- And 每个条目都必须显示自身对应的 branch 信息

### Requirement: Store Dedupe Must Only Collapse Source-Equivalent And Directory-Equivalent Entries

商店远端结果只允许在“来源身份相同且整个 skill 目录内容完全相同”时折叠重复条目。

#### Scenario: Two entries are directory-equivalent mirrors

- Given 两个条目来自镜像 source 或嵌套 marketplace
- And 它们解析出的 source identity 相同
- And 它们的 skill 目录指纹相同
- When 系统合并列表
- Then 系统可以折叠它们为一个条目

#### Scenario: Two entries share a name but some file content differs

- Given 两个条目显示名称相同
- But 它们的 skill 目录指纹不同
- When 系统合并列表
- Then 系统不得折叠这两个条目

### Requirement: Installed State Must Be Evaluated Per Source Identity

商店卡片、详情页与更新提示必须按“来源身份对应的已安装实例”判断，而不是按 `name` 或 `slug` 粗略合并。

#### Scenario: One same-name variant is installed, another is not

- Given 用户已经安装了 `main` 分支的 `abc`
- And `dev` 分支也提供 `abc`
- When 用户查看 `dev` 分支条目
- Then 该条目不得直接显示为已安装
- And 应显示“未安装”或“可并行安装”的状态

#### Scenario: Exact same source variant is installed

- Given 用户安装了来自某个 source identity 的 `abc`
- When 用户再次查看同一个 source identity 的条目
- Then 该条目应显示为已安装
- And 更新检查应只与该安装实例比较

### Requirement: Users Must Be Able To Install Same-Name Skills As Independent Instances

本地技能库必须允许同名但不同来源身份的 skill 独立安装。

#### Scenario: Install main and dev variants side by side

- Given `main` 分支与 `dev` 分支都提供 `abc`
- And 两者来源身份不同
- When 用户分别安装这两个条目
- Then 本地库中必须保留两个独立 skill 实例
- And 它们不得因名称相同而互相覆盖或安装失败

### Requirement: Disk Layout Evolution Must Preserve Existing User Data And Paths During Migration

同名 skill 的长期磁盘结构演进必须以迁移成本可控为前提，不得要求现有用户在升级时一次性重排全部 skill 目录。

#### Scenario: Existing user upgrades with historical managed repo directories

- Given 用户已经在当前版本下使用 PromptHub 管理多个 skill
- And 这些 skill 已经存在历史本地目录、备份脚本或平台软链接
- When 用户升级到支持同名变体的新版本
- Then 系统必须继续读取历史目录
- And 不得要求用户手动迁移所有 skill 才能继续使用
- And 新版本不得因为目录结构变化而导致已有 skill 丢失或失效

### Requirement: External Platform Activation Must Prefer Platform-Compatible Logical Skill Names

外部平台安装目录应优先保持与平台原生 skill 逻辑名兼容；同逻辑名的多个变体在平台侧一次只应激活一个版本。

#### Scenario: Two same-name variants exist in PromptHub but platform already has one active

- Given PromptHub 本地库中同时存在两个逻辑名相同的 skill 变体
- And 外部平台当前已经激活其中一个变体
- When 用户尝试把另一个变体安装到同一平台
- Then 系统应提示这是一次“切换平台当前激活版本”
- And 用户确认后，平台目录应切换到新的变体
- And PromptHub 本地库中的两个变体都必须继续保留

### Requirement: User-Created Skills Must Enter The Same Variant Model As Imported Skills

用户在 PromptHub 内直接创建 skill 时，系统必须把它纳入同一套逻辑 skill / variant 模型，而不是创建一类无法演进的“特殊本地条目”。

#### Scenario: User creates a new skill inside PromptHub

- Given 用户在 PromptHub 内新建一个名为 `writer` 的 skill
- When 系统创建本地 repo 与元数据
- Then 系统必须为其创建一个本地 authored variant
- And 该 variant 必须具备稳定的来源元数据
- And 后续它仍可被发布、fork、导入项目或安装到平台

### Requirement: Official Store Entries May Carry Platform-Specific Projections Without Splitting Logical Skill Names

官方商店必须允许一个逻辑 skill 在不同平台上有轻微变体，而不要求把每个平台版本拆成完全不同的 skill 名。

该能力当前属于未来扩展项，不阻塞本轮同名 variant 存储结构定稿；当前只要求目录结构与元数据模型为此预留扩展位。

#### Scenario: Official writer skill has Claude and Cursor differences

- Given 官方商店中存在逻辑名相同的 `writer`
- And Claude 与 Cursor 只在少量文件或 frontmatter 上存在差异
- When 系统展示与安装该 skill
- Then 用户仍应看到同一个逻辑 skill 条目
- And 系统应能在平台安装时应用对应平台的差异内容

### Requirement: Copy And Symlink Must Be Materialization Modes, Not Identity Modes

`copy / symlink` 必须只影响导入或分发时的落盘方式，不得改变 skill 本身的逻辑身份或来源身份。

凡是进入 My Skills 的 skill，都必须拥有统一的 variant 容器；`copy / symlink` 只决定容器内 `repo/` 的 materialization 方式。

#### Scenario: Same variant imported to project via copy and symlink

- Given 用户从 My Skills 把同一个 variant 部署到两个项目目标目录
- And 一个目标使用 `copy`
- And 另一个目标使用 `symlink`
- When 系统记录这些部署
- Then 两次部署必须仍然指向同一个 variant 身份
- And `copy / symlink` 只能作为部署模式存在，而不是生成两个不同 skill 实例

#### Scenario: External folder is imported to My Skills via symlink

- Given 用户把一个外部 skill 目录导入到 My Skills
- And 用户选择 `symlink`
- When 系统创建该 skill 的本地实例
- Then 系统必须仍然创建统一的 variant 容器目录
- And 容器内必须保留来源元数据文件
- And 只有容器内的 `repo/` 可以指向外部源目录

### Requirement: Backup And Export Must Preserve Variant And Activation Metadata

备份、恢复、导出与导入流程必须保留 variant 元数据、来源信息以及平台激活关系。

#### Scenario: User restores a backup containing same-name variants

- Given 用户备份了包含多个同名变体的 skill 数据
- When 用户恢复该备份
- Then 系统必须恢复这些变体之间的关系
- And 必须恢复来源信息与当前平台激活映射
- And 不得把这些变体错误合并成一个 skill

### Requirement: UI Must Surface User-Readable Source Labels For Same-Name Skills

当商店中存在同名 skill 时，UI 必须提供足够的来源信息帮助用户区分。

#### Scenario: Same-name entries appear together

- Given 列表中同时存在多个同名条目
- When 用户查看卡片或详情
- Then 商店列表和商店详情必须显示当前商店名称或用户自定义商店名称
- And `My Skills` 卡片和列表必须显示用户可理解的来源分类，例如商店名称、项目导入、本地导入、GitHub 导入、Gitea 导入、Gitee 导入、Git 导入、远程链接导入或本地创建
- And UI 不得把 branch、directory、repo 路径片段、source identity hash 或商店版本号当作默认标签展示
- And 当 skill 明确来自非默认 Git 分支时，UI 必须额外显示真实分支名；`main` / `master` 这类默认分支不得显示成额外标签
- And 详情页必须继续展示来源渠道和具体地址或本地路径，供用户追溯来源

### Requirement: Refresh Must Preserve Installed State For The Same Remote Skill Identity

对于同一个远端 skill，刷新商店 source 后系统必须继续识别它是同一个已导入实例，不能因为 refresh 重新计算 identity 而丢失已安装状态。

#### Scenario: Self-hosted Git source refresh keeps imported badge

- Given 用户已经从某个自建 Git / Gitea source 导入一个 skill
- And 本地 `skills` 表中已经持久化该实例的 `source_id`
- When 用户点击刷新该 source
- Then refresh 后远端条目必须继续产出相同的 `source_id`
- And 商店卡片必须继续显示 `Imported`
- And 详情页必须继续能定位到已导入实例

### Requirement: Delete From My Skills Must Have Consistent Repo Ownership Semantics

当用户从 `My Skills` 删除一个 skill 时，系统必须明确且一致地处理 PromptHub managed repo 容器，而不是只删除数据库记录导致 repo 残留。

#### Scenario: Delete removes PromptHub-managed variant container

- Given 某个 skill 已经进入 PromptHub managed repo 容器
- And 该容器由 PromptHub 自己创建并托管
- When 用户从 `My Skills` 删除该 skill
- Then 系统必须删除对应的数据库记录
- And 必须删除该实例对应的 PromptHub managed repo 容器或其 materialized repo 内容
- And 不得在 `skills/<instance-key>/repo/` 下残留孤儿 `SKILL.md`

#### Scenario: Delete does not remove external original source directory

- Given 某个 skill 最初来自外部本地目录或 Git 仓库
- And PromptHub 当前只托管其内部 variant 容器
- When 用户删除该 skill
- Then 系统只能删除 PromptHub 自己托管的数据
- And 不得删除用户原始外部目录或原始远端仓库

### Requirement: Duplicate Detection Must Compare The Full Skill Directory

系统判断两个 skill 是否“完全相同”时，必须比较整个 skill 目录，而不是只比较 `SKILL.md`。

#### Scenario: Same SKILL.md but different helper files

- Given 两个条目的 `SKILL.md` 内容完全相同
- But 它们的脚本、模板、资源文件或其他附属文件存在差异
- When 系统判断这两份 skill 是否可折叠
- Then 系统必须将它们视为不同 skill 变体

#### Scenario: Whole skill directory is identical

- Given 两个条目的所有纳管文件路径与文件内容都相同
- When 系统判断这两份 skill 是否可折叠
- Then 系统可以将其标记为重复内容或折叠为同一条目

## MODIFIED Requirements

### Requirement: Remote Skill Identity Must Be Stable Beyond Slug And Name

远端 `RegistrySkill` 的身份模型必须从“`slug` / `name` 即主标识”调整为“显示字段 + 稳定来源身份”分离。

#### Scenario: Same slug from different sources

- Given 两个 source 都产出 `slug = writer`
- But 它们的来源身份不同
- When 系统缓存、选中、安装或检查更新
- Then 系统必须区分这两个条目
- And 不得因为 slug 相同而互相覆盖

### Requirement: My Skills Persistence Must Stop Using Lowercased Name As The Sole Unique Key

本地 `skills` 表不能再只依赖 `LOWER(name)` 作为唯一约束。

#### Scenario: Same name with different source identity

- Given 用户安装两个名称相同的 skill
- And 两者来源身份不同
- When 系统写入数据库
- Then 写入必须成功
- And 系统必须保留各自来源身份、内容哈希与更新来源信息

## Design Notes

### Identity Model Recommendation

- `displayName`: 继续显示给用户的名称，来自 `install_name || name || slug`
- `sourceIdentity`: 稳定来源身份，建议由以下字段标准化后组成：
  - source kind (`official` / `git-repo` / `marketplace-json` / `local-dir` / `skills-sh`)
  - normalized repo/store root URL
  - branch
  - directory
  - normalized skill relative path or canonical content URL
- `directoryFingerprint`: 规范化后的“整个 skill 目录哈希”，用于判断“内容完全相同”
- `installInstanceId`: 本地安装实例主键，对应数据库行 id
- `logicalSkillName`: 平台兼容的逻辑 skill 名，用于组织长期目录和平台激活键
- `variantKey`: 同一逻辑名下区分来源实例的磁盘目录键，建议为 `source-label + short-hash`
- `platformProjection`: variant 在指定平台上的轻微覆盖视图，不应默认膨胀成新的逻辑 skill

### UI Recommendation

- 列表不再拆成 `Installed` / `Available` 两个纯过滤区块，否则同名实例容易被分散隐藏。
- `My Skills` 画廊和列表视图必须提供分页控件，避免大量 skill 时只能依赖一次性渲染或无限滚动。
- `My Skills` 分页的每页数量必须持久化到本地设置，应用重载后继续使用用户上次选择；无效历史值必须回退到默认值。
- `My Skills` 画廊卡片和列表行必须支持与 prompt 列表一致的右键快捷操作入口。
- 用户必须能把侧栏 skill 标签拖拽到某个 skill 卡片或列表行上，以便直接给目标 skill 赋值该标签。
- 改成统一列表 + 状态 badge：
  - `Installed`
  - `Installed from main`
  - `Another variant installed`
  - `Duplicate content`
- 卡片副标题增加来源标签：
  - `Source: My Stable Store`
  - `Branch: main`
  - `Dir: skills/.curated`
  - `Author: icelemon`

## Traceability

- FR-001 Preserve same-name skills in listing -> DES-001 source identity model -> TEST-001 same-name cross-source listing
- FR-002 Collapse only source/directory-equivalent entries -> DES-002 directory fingerprint dedupe -> TEST-002 mirror-entry collapse only on exact directory match
- FR-003 Installed state is per source identity -> DES-003 installed variant mapping -> TEST-003 one variant installed while another remains installable
- FR-004 Allow same-name independent installs -> DES-004 relax DB unique constraint from name-only -> TEST-004 main/dev variants install side by side
- FR-005 Preserve existing disk layout during migration -> DES-005 phased storage evolution -> TEST-005 legacy directories remain readable after upgrade
- FR-006 Keep external platform activation single-variant per logical name -> DES-006 platform-compatible activation mapping -> TEST-006 installing another variant switches platform active version without deleting the local variant
- FR-007 User-created skills join the same variant model -> DES-007 local-authored variant strategy -> TEST-007 creating a skill produces a valid local-authored variant
- FR-008 Official store supports platform-specific projections -> DES-008 overlay/projection model -> TEST-008 one logical skill can materialize different files for different platforms
- FR-009 Copy/symlink are materialization modes only -> DES-009 deployment-mode semantics -> TEST-009 copy and symlink deployments retain one variant identity
- FR-010 Backup/export preserves variant and activation metadata -> DES-010 canonical metadata persistence -> TEST-010 restore recreates same-name variant relationships and active platform mapping
