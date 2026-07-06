# Skills Spec Delta

## Added Requirements

### Requirement: My Skills store-installed update indicator

“我的 Skills”视图必须能为从商店安装的 Skill 显示“存在可用更新”的轻量提示。

#### Scenario: Store-installed skill has a newer registry version

- **Given** 某个本地 Skill 带有 `registry_slug`，并且远端商店目录中同 slug 的 Skill 版本高于本地 `installed_version`
- **When** 用户打开“我的 Skills”视图
- **Then** 该 Skill 在列表视图与画廊视图里都应显示更新提示

#### Scenario: Local-only skill does not show store update indicator

- **Given** 某个本地 Skill 没有 `registry_slug`
- **When** 用户打开“我的 Skills”视图
- **Then** 该 Skill 不应显示商店更新提示

#### Scenario: My Skills can refresh store cache without opening store page

- **Given** 用户只停留在“我的 Skills”视图，从未手动打开商店页
- **When** 应用根据设备设置执行商店目录同步
- **Then** “我的 Skills”仍应能基于同步后的远端商店目录显示更新提示
