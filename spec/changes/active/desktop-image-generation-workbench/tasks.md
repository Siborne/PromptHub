# Desktop Image Generation Workbench Tasks

## Specify And Clarify

- [x] `T-IGW-001` 建立 active change，记录现有生图能力、用户目标、范围和风险。
- [x] `T-IGW-002` 完成 `FR-IGW-*`、`NFR-IGW-*`、场景和验收标准初稿。
- [x] `T-IGW-003` 导航、资产独立性、100 张上限、单模型批次和生成资产本地专属
      边界已确认。
      Covers `FR-IGW-001`, `FR-IGW-003`, `FR-IGW-014`, `DES-IGW-001`,
      `DES-IGW-003`, `DES-IGW-005`.

## Plan

- [x] `T-IGW-004` 完成数据、文件、备份/同步、迁移和删除生命周期设计，详见
      `data-contract.md`。
      Covers `FR-IGW-005`, `FR-IGW-009`..`FR-IGW-015`, `DES-IGW-003`,
      `DES-IGW-004`, `DES-IGW-006`, `DES-IGW-009`, `TEST-IGW-004`,
      `TEST-IGW-006`, `TEST-IGW-009`.
- [x] `T-IGW-005` 完成编排、provider capability、并发、取消、重试和恢复设计，
      详见 `orchestration.md`。
      Covers `FR-IGW-003`..`FR-IGW-008`, `FR-IGW-013`, `DES-IGW-002`,
      `DES-IGW-005`, `DES-IGW-008`, `TEST-IGW-002`, `TEST-IGW-003`,
      `TEST-IGW-005`.
- [x] `T-IGW-006` 完成交互信息架构、原型和 Desktop UI 验收矩阵。
      2026-07-15 已确认 Prompts 二级导航、画布优先结果墙、右侧批次/溯源面板的
      UI concept；逐状态验收矩阵见 `ui-acceptance.md`。
      Covers `FR-IGW-001`, `FR-IGW-002`, `FR-IGW-007`, `FR-IGW-009`,
      `FR-IGW-011`, `FR-IGW-012`, `DES-IGW-001`, `DES-IGW-007`,
      `TEST-IGW-001`, `TEST-IGW-008`.
- [x] `T-IGW-007` 确认首版生成记录和原图不进入任何远端 payload；未来会员云空间
      另立 change。Web capability 不宣称支持本地批量工作台。
      Covers `FR-IGW-015`, `NFR-IGW-SYNC-001`, `DES-IGW-009`, `TEST-IGW-009`.
- [x] `T-IGW-008` 完成实现前 Analyze，消除阻塞性 `[待确认]`、孤立 ID、
      active change 冲突和未映射测试。

## Implement

- [ ] `T-IGW-009` 按 `TEST-IGW-002`..`TEST-IGW-006` 先添加失败测试，再实现
      shared contract、数据库迁移、编排和文件生命周期；先从接近 2,000 行上限的
      `renderer/services/ai.ts` 提取现有生图 adapters，不继续扩大该文件。
      已完成首个本地 manifest/SQLite index、IPC/preload、runner、恢复、重试、
      favorite 与复制到 Prompt media 的纵向切片；已补齐远端输出直存、字节 MIME
      检测、引用图 capability、比例映射、取消晚到结果和批次写串行化。adapter 提取和
      完整覆盖率仍待完成。
- [ ] `T-IGW-010` 按 `TEST-IGW-001`、`TEST-IGW-008` 先添加失败测试，再实现
      Desktop 导航、工作台配置、进度、结果库、详情和批量操作。
      已完成导航、紧凑配置区、结果墙、筛选/排序/密度、多选、批次队列、进度、
      provenance 和单/多输出动作。2026-07-17 完成第二轮 UI 优化：补充无模型原因、
      本地存储提示、按需批次抽屉、始终可见的右侧生成面板、进度语义、详情预览和列表
      元数据。2026-07-22 按新确认设计重构为左侧结果画布、右侧生成配置及按需批次
      抽屉，并完成 `1586x992` 及用户截图等效 `1008x622` 固定右栏视觉验收；带作品的
      固定 fixture 截图与最小窗口 shell 折叠验收仍待最终 Converge 前补齐。
- [ ] `T-IGW-011` 按 `TEST-IGW-007` 完成 100 输出批次与 10,000 元数据资产库
      压力验证并修复性能瓶颈。
- [ ] `T-IGW-012` 按 `TEST-IGW-009` 完成迁移、备份/恢复、同步范围和 Web
      capability 合同。
      已修复旧生成目录创建后遮蔽 legacy Prompt media 的兼容选择，并在读取批次时将
      旧 workbench 原图复制到新的 `data/generations/assets/`；完整备份/同步合同测试
      仍待完成。

## Verify And Converge

- [ ] `T-IGW-013` 运行 focused tests、coverage、typecheck、lint、Desktop 实操和
      relevant release harness，在 `implementation.md` 记录实际结果与跳过项。
- [ ] `T-IGW-014` 同步 `spec/workflow/*`、`spec/knowledge/behavior/desktop.md`、
      Prompt workspace/data layout/backup-sync 稳定文档及必要的 public docs。
- [ ] `T-IGW-015` 完成 Converge，更新 issues/releases/ADR/index，并把完成 change
      移入日期归档目录。
- [x] `T-IGW-016` 按 `DES-IGW-010` 实施桌面形态布局（`FR-IGW-016`）：批次常驻左栏、
      配置面板可折叠、画廊头部批次身份与切换、运行中细进度条、Lightbox 大图查看
      （键盘导航 + 操作栏）、桌面多选语义、移除空 Advanced 开关。验证合同：左栏切换
      批次无遮罩、配置面板折叠状态流转、Lightbox 打开/键盘切换/Escape/操作、
      hover 才显示选择标记、7 locales、既有生图测试零回归。
