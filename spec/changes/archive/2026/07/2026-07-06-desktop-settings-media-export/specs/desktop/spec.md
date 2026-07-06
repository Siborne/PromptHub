# Delta Spec

## Added

- 桌面端外观设置支持选择本地图像作为应用背景，并允许调节透明度与虚化强度。
- 桌面端 Skill 详情导出支持直接导出整个本地 Skill 仓库 zip。

## Modified

- 桌面端设置页中的升级快照列表应默认收敛，并在大量快照存在时使用独立滚动容器显示。
- 桌面端设置页应继续将 Skill 安装方式、平台顺序、目标目录与额外扫描目录放在独立的 `Skill` 导航页；`DataSettings` 不得混入这些 Skill 配置。
- 桌面端 Skill 平台顺序应支持直接拖拽调整；在没有用户自定义顺序时，默认优先显示 `Claude Code`、`Codex CLI`、`OpenCode`、`OpenClaw`、`Hermes Agent`、`Cursor`。
- 仓库的 GitHub issue 提交流程应根据 issue form 中的版本字段自动补一个 `version: ...` 标签；同一个 issue 只能保留一个当前版本标签。
- 桌面端在启用背景图后，应切换到一套独立的图片模式 glass 主题层；该主题层需要分别定义 light/dark 下的语义化 surface token，并提升亮色模式的文字与边框对比度。
- 桌面端图片模式的 glass 主题层应继续细分为 blur / tint / stroke / specular / shadow 合同，并让 panel、search、sidebar、toolbar 与 card 使用不同强度的局部材质层级，而不是共享同一档半透明面板。
- 桌面端选择背景图后，背景图透明度与模糊值必须完全沿用设置中的当前值；不得在首次进入图片模式时自动覆盖为额外默认档。
- 桌面端外观设置中的背景图预览应复用应用实际图片模式的背景层与 glass 壳层结构，而不是单独绘制一套简化预览，确保预览效果与实际界面一致。
- Skill 详情页导出入口应收敛为用户可直接使用的 `SKILL.md` 与 `zip`，不再突出内部 JSON 交换格式。
- 桌面端 About 页版权行应显示当前年份 `2026`。

## Removed

- 无

## Scenarios

- 当用户已经积累较多升级快照时，设置页不会被长列表无限撑高，用户仍然可以滚动查看全部历史。
- 当用户打开桌面端设置页时，左侧导航会显示独立的 `Skill` 入口；进入 `DataSettings` 时不再看到 Skill 安装方式、平台顺序或扫描目录配置。
- 当用户在桌面端 `Skill` 设置页调整平台显示顺序时，可以直接拖拽卡片改变顺序；如果从未自定义过顺序，界面会优先显示 Claude、Codex、OpenCode、OpenClaw、Hermes、Cursor。
- 当用户提交 bug 或 feature issue 时，只要填写了版本字段，仓库会自动给该 issue 挂上 `version: <填写值>` 标签；如果后续编辑版本字段，旧的 `version:` 标签会被替换。
- 当用户在桌面端选择背景图后，应用根布局会稳定显示该图像，并在重启后保持相同设置。
- 当用户在背景图模式下切换 light/dark 时，界面会使用图片模式专属 token 控制 panel、surface、settings card 与列表卡片，而不是继续依赖默认主题的零散覆写。
- 当用户在背景图模式下操作搜索、侧边栏和 Prompt 卡片时，不同组件会呈现出清晰的 Liquid Glass 层级：搜索框最亮最聚焦，toolbar / sidebar 是中层承托，card 与 chip 更轻，且 light / dark 下都保持足够对比度。
- 当用户把背景模糊调到 `0px` 时，应用背景图层不应再被偷偷追加额外模糊；只有主左侧菜单栏保留独立的默认玻璃材质，设置页左导航和右侧内容区继续完全遵循用户的背景图滑块设置，不再额外叠加 UI 模糊。
- 当用户在设置页查看背景图预览时，预览卡片会复用实际应用的背景图层、blanket 和 wallpaper shell 结构，因此用户在预览中看到的玻璃层级应与应用实际效果保持一致。
- 当用户导出 Skill 时，可以拿到单文件 `SKILL.md` 或包含全部本地仓库文件的 zip 包。
- 当用户进入 About 页时，底部版权文案会显示 `AGPL-3.0 License © 2026 PromptHub`。
