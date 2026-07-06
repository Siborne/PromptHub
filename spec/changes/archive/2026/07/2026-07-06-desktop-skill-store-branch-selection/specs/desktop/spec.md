# Desktop Delta Spec

## ADDED Requirements

### Requirement: Git Repo Store Sources Must Support Explicit Branch Selection

桌面端 Skill 商店在新增或编辑 `git-repo` 类型的自定义 source 时，必须允许用户显式指定一个 branch；当 branch 为空时，系统才可以退回到仓库默认分支。

#### Scenario: User adds a git repo source with a branch

- Given 用户在 Skill Store 的自定义 source 表单中选择了 `Git Repository`
- And 用户输入了仓库 URL 和 branch 名称
- When 用户保存该 source
- Then source 持久化数据必须记录该 branch
- And 后续刷新该 source 时必须优先使用该 branch 扫描仓库内容

#### Scenario: User leaves branch empty

- Given 用户添加了一个 `git-repo` source 但未填写 branch
- When 系统首次加载或刷新该 source
- Then 系统必须先尝试读取仓库默认分支
- And 仅在默认分支缺失时才允许回退到兼容默认值

### Requirement: Git Repo Store Sources Must Support Optional Subdirectory Selection

桌面端 Skill 商店必须允许 `git-repo` source 配置一个可选的仓库子目录，用于限制扫描范围。

#### Scenario: User targets a curated subdirectory

- Given 用户为 `git-repo` source 填写了 `directory`
- When 系统加载该 source
- Then 系统只应在该目录范围内查找 `SKILL.md` 或兼容入口文件
- And 生成的 source 展示信息必须包含该目录

### Requirement: Legacy GitHub Tree URLs Must Be Preserved Through Normalization

已经保存的 GitHub `/tree/<branch>/<path>` URL source 必须在升级后保持可用，并在内部归一化为结构化的 branch / directory 语义。

#### Scenario: Existing source uses tree URL

- Given 用户已有一个 URL 为 `https://github.com/<owner>/<repo>/tree/<branch>/<path>` 的 `git-repo` source
- When 桌面端加载该 source 配置
- Then 系统必须识别出仓库根地址、branch 和 directory
- And 不得因为结构变化导致该 source 刷新失败
- And 编辑弹窗中必须展示解析后的 branch 和 directory

### Requirement: Git Repo Load Errors Must Mention Branch and Directory Context

当 `git-repo` source 使用显式 branch 或 directory 加载失败时，错误信息必须带出当前解析到的 branch / directory 上下文，便于用户自查。

#### Scenario: Branch does not exist

- Given 用户配置了不存在的 branch
- When 系统刷新该 source
- Then 系统必须返回 branch 相关错误
- And 错误文本中必须包含该 branch 名称

#### Scenario: Directory does not exist under branch

- Given 用户配置了存在的 branch 但不存在的 directory
- When 系统刷新该 source
- Then 系统必须返回 directory 相关错误
- And 错误文本中必须包含该 directory 值

## MODIFIED Requirements

### Requirement: Git Repo Store Source Input Validation Must Accept Structured Git Sources

当前 `git-repo` source 的校验与归一化逻辑必须从“只验证 URL 字符串”扩展为“验证仓库地址，并兼容可选 branch / directory”。

#### Scenario: User enters a repo root URL and a branch separately

- Given 用户输入 `https://github.com/org/repo`
- And branch 字段为 `release-skills`
- When 系统校验并保存 source
- Then source 应被视为合法 git repo source
- And 不要求用户必须把 branch 写进 URL

#### Scenario: User enters a tree URL without separate branch fields

- Given 用户输入 `https://github.com/org/repo/tree/main/skills/.curated`
- When 系统校验并保存 source
- Then 系统必须继续接受该输入
- And 应将其解析为仓库根地址加 branch / directory 语义

## Traceability

- FR-001 Git repo source branch selection -> DES-001 Structured git source model -> TEST-001 branch-specific remote source load
- FR-002 Optional directory selection -> DES-002 GitHub loader branch/directory precedence -> TEST-002 subdirectory-scoped skill discovery
- FR-003 Legacy tree URL compatibility -> DES-003 source normalization and migration-free compatibility -> TEST-003 legacy tree URL normalization
