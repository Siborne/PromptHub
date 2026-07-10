# PromptHub Changes

`spec/changes/` 是 PromptHub 的单次变更工作区总入口，对齐锁定的 `spec-init` 基线（`f83def1`）中的 `changes` 语义。

## Structure

- `active/`：当前进行中的 change workspace
- `completed/`：已完成或已发布的 change 兼容入口
- `archive/`：PromptHub 当前实际使用的已完成 / 已放弃变更归档目录
- `legacy/`：旧流程遗留、仍可参考但不是当前真相源的历史文档
- `_templates/`：新建 change 时使用的模板说明

## PromptHub Current Rule

PromptHub 当前仍以 `spec/changes/archive/` 作为已完成 change 的真实归档目录。

为了与该基线的 `changes.completed` 语义对齐，本仓库额外保留：

- `spec/changes/completed/`

它当前作为兼容入口，指向已完成 change 的归档语义，而不是第二套独立归档仓。

## Inventory

- 生成后的 active / archive / legacy 清单：`spec/changes/index.md`
- 刷新清单：`pnpm spec:index`
- 校验清单是否与目录一致：`pnpm spec:index:check`
- 清单由脚本生成，不手工维护；新增、归档或移动 change 后必须刷新。

## Routing Rule

- 新需求、bugfix、重构、流程变化 -> `spec/changes/active/<change-key>/`
- 已完成或已放弃的 change -> `spec/changes/archive/<YYYY>/<MM>/<YYYY-MM-DD>-<change-key>/`
- 旧平铺内部文档、历史遗留资料 -> `spec/changes/legacy/`
- `active/` 不是历史 backlog；任务全部完成、已发布、已放弃或被后续变更取代的目录应及时移入 `archive/`。

## Change Key Naming

- Active change 目录使用语义化小写 kebab-case：`<area>-<scope>-<outcome>`。
- 不给 active change 加流水号前缀；排序由文件系统或 Git 历史处理，不写进目录名。
- 关联 GitHub issue 时优先使用 `<surface>-issue-<number>-<slug>`，例如 `desktop-issue-161-skill-store-batch`。
- 无法确定 surface 时才使用 `issue-<number>-<slug>`，后续触碰该 change 时应评估是否补齐 surface。
- 归档目录使用 `spec/changes/archive/<YYYY>/<MM>/<YYYY-MM-DD>-<change-key>/`，日期表示归档时间，年/月目录用于避免 archive 根目录继续平铺膨胀。
- `FR-###`、`DES-###`、`TEST-###`、`T-###` 是文档内追踪编号，不是目录编号。
