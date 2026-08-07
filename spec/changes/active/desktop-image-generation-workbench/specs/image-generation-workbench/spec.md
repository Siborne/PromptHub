# Image Generation Workbench Requirements

## Purpose

本 delta spec 定义 PromptHub Desktop 生图工作台的产品需求。它描述用户需要获得的
行为、状态和验收结果，不预先锁定数据库表名、IPC channel 或 React 组件结构。

## Actors

- **Prompt 创作者**：已经维护了可复用的 image Prompt，希望重复生产图片。
- **批量创作者**：一次生成几十张候选图，需要持续查看进度和处理部分失败。
- **作品筛选者**：从大量输出中挑选、收藏、淘汰和导出可用图片。
- **迭代创作者**：从某张结果继续变体、作为参考图或调整 Prompt 后再次生成。

## Terms

- **工作台**：独立于 Prompt AI 测试抽屉的图片生成和作品管理界面。
- **生成批次**：用户一次提交的完整生产意图，包含目标数量、Prompt 快照、模型、
  参数和参考图；供应商侧可以由多个实际请求完成。
- **输出**：生成批次产生的一张图片及其状态、文件和来源信息。
- **Prompt 快照**：批次提交时真正送往模型的最终 Prompt，包括变量解析结果，
  不随源 Prompt 后续编辑而变化。
- **剩余任务**：批次中尚未向供应商提交或尚未开始处理的输出目标。

## ADDED Functional Requirements

### `FR-IGW-001`: Prompts 模块内的独立工作台入口

PromptHub Desktop 必须在 Prompts 模块二级导航提供可直接进入的生图工作台，入口与
“关系图谱”同级，不在 global left rail 增加独立模块。用户不得必须先选择一个 Prompt、
打开详情，再进入 AI 测试抽屉才能开始生图。

#### Scenario: Direct entry

Given 用户位于任意 Desktop 主模块
When 用户进入生图工作台
Then 用户能看到新的生成配置区和自己的生成历史
And global left rail 保持选中 Prompts
And 进入工作台不会隐式创建或修改 Prompt。

#### Scenario: Enter from an existing Prompt

Given 用户正在查看一个 image Prompt
When 用户选择“在生图工作台中使用”
Then 工作台以该 Prompt 的当前内容和参考图作为草稿
And 用户仍需显式提交后才产生生成批次。

### `FR-IGW-002`: Prompt 来源与变量解析

工作台必须允许用户选择已有 image Prompt，也必须允许用户直接输入一次性 Prompt。
选择已有 Prompt 时，工作台必须支持填写其变量，并在提交前展示最终解析后的 Prompt。

#### Scenario: Reuse an existing Prompt

Given image Prompt 包含必填变量
When 用户选择该 Prompt 并填写变量
Then 提交预览显示变量已经替换后的最终文本
And 生成历史保存最终文本与源 Prompt 关联。

#### Scenario: Ad-hoc Prompt

Given 用户没有选择已有 Prompt
When 用户输入有效文本并提交
Then 系统可以创建生成批次
And 不会自动把临时文本保存为新的 Prompt。

#### Scenario: Invalid variables

Given 必填变量为空或变量值不合法
When 用户尝试提交
Then 系统阻止提交并指出具体字段
And 不产生空批次或使用次数记录。

### `FR-IGW-003`: 批量数量与批次配置

用户必须可以为一次生成批次指定目标图片数量，首版必须覆盖“几十张”场景。
界面必须在提交前显示目标数量、选中模型、关键参数和可获得的成本信息。

#### Scenario: Generate fifty outputs

Given 用户选择支持的模型并把目标数量设为 50
When 用户提交批次
Then 系统创建一个目标数量为 50 的用户批次
And 不要求供应商单次 API 调用原生支持 50 张。

#### Scenario: Invalid quantity

Given 数量为空、为零、为负数、不是整数或超过产品上限
When 用户尝试提交
Then 系统阻止提交并显示允许范围
And 不向供应商发出请求。

#### Scenario: Cost unavailable

Given 当前供应商无法提供可靠的费用估算
When 用户准备提交
Then 界面明确显示费用未知
And 不得伪造精确金额。

### `FR-IGW-004`: 模型能力驱动的参数

工作台必须复用用户现有 image-generation 模型配置，并只展示或启用当前模型真正
支持的参数。模型切换后，不兼容参数必须被重置、映射或要求用户确认，不能静默
发送无效配置。

#### Scenario: Provider request limit

Given 模型每次最多返回 4 张，而批次目标为 50 张
When 批次开始
Then 系统在内部创建所需的多个生成请求
And 用户仍看到一个统一批次及总进度。

#### Scenario: Unsupported reference images

Given 当前模型不支持参考图
When 草稿中存在参考图
Then 提交前明确阻止或要求移除参考图
And 不在请求失败后才把能力不兼容作为普通网络错误展示。

#### Scenario: Model configuration missing

Given 没有可用的 image-generation 模型
When 用户进入工作台
Then 工作台提供可执行的配置入口和明确空态
And 已有历史作品仍然可浏览。

### `FR-IGW-005`: 参考图选择

用户必须可以从源 Prompt 图片、本地上传图片和已有生成输出中选择参考图。工作台
必须展示每张参考图的来源，并在提交前检测丢失或不可读文件。

参考图选择必须是显式操作。选择来源 Prompt 时不得自动、静默采用其前若干张图片。
用户必须可以点击系统文件选择器或把支持的本地图片拖入参考图区，也必须可以从
Prompt 媒体选择器中挑选图片。已选参考图必须支持移除和拖动排序，并以当前顺序发送
给供应商。首版在 capability contract 完成前沿用现有 Gemini adapter 的保守上限：
最多两张；不支持参考图的模型必须在本地阻止添加和提交。

#### Scenario: 选择 Prompt 媒体

Given PromptHub 中存在带图片的 Prompt
When 用户打开参考图区域并从 Prompt 媒体选择一张图片
Then 该图片进入已选参考图列表并显示来源 Prompt
And 只有用户明确选择的图片进入生成请求

#### Scenario: 拖入本地参考图

Given 当前模型支持参考图且尚未达到数量上限
When 用户把受支持的本地图片拖入参考图区
Then 主进程验证图片字节并把安全副本写入 PromptHub 媒体目录
And 草稿只保存受管文件名，不持有外部绝对路径

#### Scenario: 调整参考图顺序

Given 用户已选择两张参考图
When 用户拖动第一张到第二张之后
Then 已选列表和发送给供应商的参考图顺序同步更新

#### Scenario: Reuse an output as reference

Given 用户在历史中打开一张成功输出
When 用户选择“用作参考图”
Then 新生成草稿包含该输出
And 原批次与新批次之间保留可导航的来源关系。

#### Scenario: Missing local reference

Given 草稿引用的本地文件已被外部删除
When 用户提交
Then 系统阻止提交并标明缺失文件
And 不创建注定失败的批次。

### `FR-IGW-006`: 持久批次与状态

每个生成批次必须拥有持久、用户可理解的状态。至少包括 queued、running、
partially-succeeded、succeeded、failed、cancelled 和 interrupted 的等价状态。
状态必须由实际完成、失败和取消数量推导，不得只保存在当前组件内存中。

#### Scenario: Observe batch progress

Given 一个 50 张批次正在执行
When 部分请求完成
Then 用户能看到目标、排队、运行、成功、失败和取消数量
And 数量总和不会超过批次目标。

#### Scenario: Navigate away

Given 批次正在执行
When 用户切换到其他 PromptHub 模块后再返回
Then 批次状态和已经完成的输出仍然存在
And 页面卸载不会自动取消剩余任务。

### `FR-IGW-007`: 渐进结果展示

成功输出必须在单张可用后立即进入结果区，不得等待整个批次结束。结果区必须适合
连续增加的不同宽高比图片，并能在大量输出下保持稳定布局。

#### Scenario: First output arrives

Given 批次仍有其他请求运行
When 第一张图片已成功保存
Then 用户可以立即预览、收藏、下载或继续使用该图片
And 这些操作不阻塞剩余任务。

#### Scenario: Output save fails

Given 供应商返回图片但本地保存失败
When 系统处理结果
Then 对应输出显示为失败或待恢复
And 不得把只存在于临时内存中的图片计为已持久成功。

### `FR-IGW-008`: 取消、部分成功与重试

用户必须可以取消尚未完成的剩余任务。已成功保存的输出必须保留。部分失败批次必须
允许只重试失败或中断的目标，而不是强制重新生成全部图片。

#### Scenario: Cancel remaining work

Given 批次已有 12 张成功、3 张失败、35 张未完成
When 用户取消剩余任务
Then 12 张成功输出继续可用
And 尚未提交的任务停止提交
And 本地在途 slot 标记为已取消
And 无法中止的供应商计算即使晚到也不得覆盖已取消 slot 或写入本地作品库。

#### Scenario: Retry failures

Given 批次有 7 个失败或中断目标
When 用户选择只重试失败项
Then 系统创建可追溯的重试执行
And 不重复生成已经成功的目标。

#### Scenario: Rate limit

Given 供应商返回可重试的限流错误
When 编排器处理失败
Then 系统采用受限退避或等待用户重试
And 界面显示限流原因，不进行无上限快速重试。

### `FR-IGW-009`: 大批结果筛选与决策

用户必须能够快速浏览和处理一个批次中的几十张图片，包括选择、收藏、取消收藏、
删除和批量操作。工作台必须提供按批次、日期、模型、源 Prompt、状态和收藏状态
筛选历史的能力。

#### Scenario: Select usable outputs

Given 一个批次有 50 张成功输出
When 用户选择其中 8 张并标记收藏
Then 收藏状态持久化
And 用户可以只查看这 8 张或对它们执行批量导出。

#### Scenario: Delete selected outputs

Given 用户批量选择多张输出
When 用户确认删除
Then 只删除选中且没有受保护引用的输出
And 失败时不得留下数据库与文件系统互相矛盾的半删除状态。

### `FR-IGW-010`: 生成历史与可追溯信息

批次历史必须保存提交时的最终 Prompt、源 Prompt 标识和版本信息、变量值、模型与
供应商身份、受支持的生成参数、参考图、目标数量、时间、状态、错误摘要和输出列表。
Prompt 后续修改不得改写历史快照。

#### Scenario: Source Prompt changes

Given 批次使用 Prompt v3 生成
When 用户把源 Prompt 修改为 v4
Then 批次详情仍显示执行时的 v3 最终文本和变量值
And 用户可以选择使用历史快照或最新 Prompt 再次生成。

#### Scenario: Sensitive diagnostics

Given 供应商请求失败
When 系统保存和展示错误
Then 错误信息不包含 API key、Authorization header 或完整敏感请求头。

### `FR-IGW-011`: 从结果继续创作

每张成功输出必须支持至少以下后续动作：下载、复制执行 Prompt、用作参考图、以原
批次配置再次生成、调整 Prompt 后生成，以及关联到一个 Prompt 的参考图片集合。

#### Scenario: Create a variation

Given 用户打开一张成功输出
When 用户选择继续创作
Then 新草稿继承可兼容的 Prompt、模型参数和该图片引用
And 在提交前允许用户修改继承内容。

#### Scenario: Attach to Prompt

Given 用户选择一张或多张成功输出
When 用户将它们添加到指定 Prompt
Then Prompt 图片集合引用本地持久文件
And 不复制出无法追踪的重复文件，除非存储策略明确要求复制。

### `FR-IGW-012`: 批量导出与实际使用

用户必须可以导出单张或多张选中图片，也可以导出整个批次中的成功输出。批量导出
必须使用稳定、不冲突的文件名，并允许同时输出描述生成来源的 manifest。

#### Scenario: Export selected images

Given 用户选择 8 张输出并选择目标目录
When 批量导出完成
Then 目标目录包含 8 个可打开的图片文件
And 原始工作台资产保持不变。

#### Scenario: Partial export failure

Given 目标目录在导出过程中不可写
When 部分文件复制失败
Then 系统报告成功和失败文件清单
And 不删除或改变原始输出。

### `FR-IGW-013`: 应用重启与中断恢复

应用重启后，已成功保存的输出和批次历史必须保留。无法证明仍在远端执行的任务
不得继续显示为 running，必须转为 interrupted 或由供应商协议可靠恢复。

#### Scenario: Restart during a batch

Given 批次在应用退出前已有 20 张成功且仍有剩余任务
When 用户重新打开 PromptHub
Then 20 张成功输出仍可使用
And 未确认完成的任务标记为 interrupted 或被可靠恢复
And 用户可以选择重试剩余目标。

### `FR-IGW-014`: 资产生命周期

生成输出必须具有明确的所有权、引用和删除规则，不能继续只作为 Prompt 卡片的展示
附件存在。删除批次、删除输出、删除源 Prompt、清理文件和恢复备份必须遵循同一套
生命周期语义。

#### Scenario: Source Prompt deleted

Given 批次已经成功产生输出
When 源 Prompt 被删除
Then 系统解除实时 Prompt 关联并保留输出、批次和执行快照
And 行为在删除确认中明确可见
And 不得留下悬空数据库引用或误删仍被引用的文件。

### `FR-IGW-015`: 本地私有边界

工作台生成记录和输出属于设备本地私有资产。首版不得把批次记录或生成原图加入
WebDAV、S3、self-hosted 或 PromptHub 云端上传 payload。未来会员云空间只有在独立
功能完成配额校验并由用户显式选择后才可以改变这一边界。

#### Scenario: Local generation history

Given 用户使用自己配置的供应商生成图片
When 图片成功保存到工作台
Then 除供应商请求本身外，不产生额外公共发布
And 批次记录与生成原图不进入任何远端同步 payload
And 界面不把“生成成功”表达为“已公开”。

#### Scenario: Add a generated image to a Prompt

Given 工作台输出尚未参与远端同步
When 用户显式选择“添加到 Prompt”
Then Prompt 获得一个遵循现有 Prompt 媒体合同的普通图片引用
And 工作台原始输出仍作为本地资产保留
And 系统不把整个批次或其他未选择输出加入同步。

### `FR-IGW-016`: 桌面形态工作台布局

生图工作台 MUST 采用画廊优先的两栏桌面信息架构：结果画廊占据主要空间，右侧固定检查器在“生成设置”和“历史作品”之间切换；历史不得作为常驻第三栏挤压画廊。进入工作台后，Prompts 全局模块入口保留，但文件夹、标签等二级侧栏 MUST 自动收起，为结果审阅释放横向空间；用户仍可通过全局顶栏的侧栏按钮临时展开或再次收起二级侧栏，且该操作 MUST NOT 覆盖普通 Prompt 页面持久化的侧栏偏好；退出工作台后恢复既有侧栏行为。头部 MUST 把工作台身份、批次切换、新建批次和历史入口保持在一行，把作品筛选与画廊选项放在独立工具行，避免标题、筛选和操作互相覆盖。

默认生成配置 MUST 直接显示来源 Prompt、模型、执行 Prompt、变量、比例、质量和生成数量。生成数量 MUST 是配置区内有可见标签的基础字段，不得仅作为页脚中的无标签步进器。参考图等非必需输入 MUST 收进明确的按需披露区，并在收起时提供数量摘要。排序与画廊密度 MUST 收进一个图标菜单。当前批次只要存在成功输出，画廊 MUST 使用一个稳定的大图审阅区和可切换缩略图条；其他筛选仍使用密度可调的结果网格。失败、排队和中断槽位 MUST 使用紧凑中性状态，不得以整屏红色大卡片主导界面。进行中的批次 MUST 在画廊内提供不依赖批次弹层的进度可见性。主预览单击 MUST 打开大图查看器（键盘左右切换、收藏/下载/复制提示词/加入 Prompt 操作）；多选 MUST 遵循桌面语义，选择标记仅在悬停或已选时显示。

#### Scenario: 切换批次

Given 画廊正在显示批次 A
When 用户从头部批次切换器选择批次 B
Then 画廊与头部立即切换到批次 B
And 批次列表在选择后关闭，不长期占用画廊宽度

#### Scenario: 临时展开 Prompts 二级侧栏

Given 用户进入生图工作台后二级侧栏已自动收起
When 用户选择全局顶栏的侧栏按钮
Then 文件夹与标签二级侧栏在当前工作台会话中展开
And 用户可再次选择同一按钮将其收起
And 离开工作台后的普通 Prompt 侧栏状态仍使用进入工作台前的持久化偏好

#### Scenario: 新建干净批次草稿

Given 画廊正在显示一个历史批次及其输出
When 用户选择“新建批次”
Then 工作台进入独立的新草稿状态，清空来源 Prompt、执行 Prompt、图片选择和当前批次画廊
And 历史批次仍可从头部批次切换器访问
And 用户重新选择历史批次后，原有输出立即恢复显示

#### Scenario: 按需展开复杂设置

Given 用户首次进入生图工作台
When 生成配置面板显示
Then 来源、模型、执行 Prompt、变量、比例、质量、数量与生成按钮直接可用
And 数量以具名配置字段呈现，页脚只保留主要生成操作
And 参考图只在用户展开参考图区域后显示
And 画廊排序与密度只在用户打开画廊选项菜单后显示

#### Scenario: 查看大图

Given 画廊中有已生成的图片
When 用户单击图片
Then 大图查看器打开，可键盘切换同批图片并执行收藏/下载操作

#### Scenario: 审阅当前批次

Given 当前批次已经产生至少一张成功图片
When 用户停留在“本批次”筛选
Then 结果区显示一张主预览和一条稳定缩略图带
And 用户选择缩略图时只切换主预览，不触发重新加载整个批次
And 用户单击主预览时打开大图查看器

#### Scenario: 切换历史作品

Given 本地存在多个生成批次
When 用户选择右侧“历史作品”页签
Then 右侧检查器显示有界批次列表和状态摘要
And 用户选择批次后结果区立即切换，右侧仍保持历史页签

## Non-Functional Requirements

### `NFR-IGW-001`: 批量容量

- 单个批次必须稳定支持至少 50 张目标输出。
- 首版产品上限为 100 张；常用选项为 1 / 4 / 8 / 16 / 32，并允许输入 1..100
  的自定义整数。
- 新草稿的生成数量必须默认为 1；“新建批次”必须把此前修改过的数量恢复为 1，避免
  用户未确认时创建高成本批次。
- 历史库达到 10,000 条输出元数据时，列表不得一次加载全部原图到内存。

### `NFR-IGW-002`: 响应性

- 提交、取消、筛选、选择和收藏应在本地交互后立即给出可见反馈。
- 供应商网络等待和文件写入不得阻塞 renderer 主线程。
- 新输出进入结果区时，不得导致已显示卡片发生不可预测的大范围跳动。

### `NFR-IGW-003`: 数据完整性

- generation manifest、数据库派生索引与图片文件写入必须定义提交、失败和清理顺序。
- 任一外部边界失败后，不得把不可读输出计为成功。
- 重试、重复回调和应用恢复必须具备幂等或等价的去重语义。

### `NFR-IGW-004`: 安全与隐私

- 不得在生成记录、manifest、日志或 UI 中持久化 API key。
- 本地文件选择、导出文件名和远端图片下载必须防止路径穿越、空字节和 SSRF-like
  输入。
- Prompt 和供应商错误文本必须作为不可信内容渲染，不执行 HTML 或脚本。

### `NFR-IGW-005`: 供应商兼容性

- 首版必须复用现有 image-generation adapter，不建立与 AI 设置分叉的第二套密钥
  和模型配置。
- 新参数必须有 capability 表达；不支持的供应商可以明确降级，但不得静默忽略会
  改变用户预期的参数。

### `NFR-IGW-006`: 可访问性与国际化

- 所有用户可见文案必须进入现有 7 locale i18n 体系。
- 生成、取消、重试、筛选、选择、收藏、删除、下载和详情操作必须可通过键盘访问，
  icon-only 控件必须有可访问名称。
- loading、partial success、error 和 interrupted 状态不得只依靠颜色表达。

### `NFR-IGW-007`: 可测试性

- 批次拆分、状态归约、重试策略、参数能力和文件生命周期必须从 React 视图中分离，
  能在最低有效层进行确定性测试。
- 关键 DB、文件系统、IPC/preload 和恢复行为必须有集成或契约测试，不能只验证
  mock 调用次数。

### `NFR-IGW-008`: 跨平台

- 本地保存、导出、恢复和文件名语义必须在 macOS、Windows 和 Linux 上一致。
- 不得硬编码用户目录或平台分隔符。

## Acceptance Criteria

### `AC-IGW-001`: Fifty-image batch

用户可以从一个已有 image Prompt 创建目标 50 张的批次；即使 provider 单请求最多
4 张，工作台仍以一个批次展示渐进结果和准确总进度。

### `AC-IGW-002`: Partial success control

批次部分失败时，已成功图片可立即筛选和导出；用户可以取消剩余目标并只重试失败
或中断项。

### `AC-IGW-003`: Durable restart

在批次完成前关闭并重开应用，已经成功持久化的图片和来源信息不丢失，未确认任务不
会永久卡在 running。

### `AC-IGW-004`: Provenance

任意成功输出的详情可以回答：使用了什么最终 Prompt、哪个源 Prompt/版本、变量值、
模型、参数、参考图、批次和生成时间；源 Prompt 后续修改不会改变答案。

### `AC-IGW-005`: Triage and export

用户可以在 50 张结果中收藏并选择一部分，批量导出到指定目录；导出失败不会破坏
工作台内的原始资产。

### `AC-IGW-006`: Private by default

用户完成批量生图后，输出只进入本地工作台，不自动发布到公共社区或 PromptHub
远端服务。

### `AC-IGW-007`: Consistent asset lifecycle

删除源 Prompt、批次或输出时，确认界面与实际结果遵循同一套已确认的资产生命周期
规则；操作结束后不存在悬空引用、误删仍被使用的文件或不可解释的孤立记录。

## Requirement To Acceptance Mapping

| Requirement                                            | Acceptance                 |
| ------------------------------------------------------ | -------------------------- |
| `FR-IGW-001`, `FR-IGW-002`                             | `AC-IGW-001`               |
| `FR-IGW-003`, `FR-IGW-004`, `FR-IGW-006`, `FR-IGW-007` | `AC-IGW-001`               |
| `FR-IGW-008`                                           | `AC-IGW-002`               |
| `FR-IGW-005`, `FR-IGW-011`                             | `AC-IGW-004`, `AC-IGW-005` |
| `FR-IGW-010`, `FR-IGW-013`                             | `AC-IGW-003`, `AC-IGW-004` |
| `FR-IGW-009`, `FR-IGW-012`                             | `AC-IGW-005`               |
| `FR-IGW-014`                                           | `AC-IGW-007`               |
| `FR-IGW-015`                                           | `AC-IGW-006`               |

## Explicit Non-Goals

- 不把工作台命名或设计成公共作品社区。
- 不要求首版支持评论、关注、点赞排行榜或公开个人主页。
- 不要求首版实现模型训练、LoRA 管理或节点式工作流编辑。
- 不要求首版实现跨模型同批并排比较；一个批次只使用一个模型，用户可复制批次并
  切换模型。
- 不要求 Web 在没有本地文件和长任务执行合同前提供伪造的等价工作台。

## Open Product Decisions

- None for the first release. Optional member cloud storage is a future change.
