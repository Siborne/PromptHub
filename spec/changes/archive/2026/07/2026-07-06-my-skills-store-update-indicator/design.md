# Design

## Overview

将商店远端源同步逻辑从 `SkillStore` 组件内部抽成 `skill.store` 中可复用的 action，让 `SkillManager` 在“我的 Skills”视图下也能触发远端商店源同步。随后基于远端目录里的版本信息，为 `registry_slug` 存在的本地 Skill 计算“是否可能有更新”，并把结果作为 UI 提示状态传给 `SkillListView` 与 `SkillGalleryCard`。

## Key Decisions

### 1. 仅提示商店安装 Skill

- 依据：`Skill.registry_slug` 是否存在。
- 原因：本地导入或手工创建的 Skill 没有稳定的远端注册表映射，不能可靠判断更新。

### 2. 我的 Skills 只做版本级提示，不做内容级逐条远端拉取

- 提示层使用已同步的远端商店目录数据，与 `SkillStore.hasPotentialUpdate` 保持一致。
- 详情页中的 `Check update` / `Update` 继续负责更严格的内容级比对和实际更新。
- 原因：避免“我的 Skills”页为每个 Skill 触发大量远端内容请求。

### 3. 商店源同步逻辑下沉到 store

- 新增 store action，统一处理：
  - 内置官方源与自定义远端源的加载
  - 自动同步 cadence
  - 远端目录缓存写入 `remoteStoreEntries`
- `SkillStore` 和 `SkillManager` 共用这套能力，避免两套实现漂移。

## Affected Modules

- `apps/desktop/src/renderer/stores/skill.store.ts`
- `apps/desktop/src/renderer/components/skill/SkillManager.tsx`
- `apps/desktop/src/renderer/components/skill/SkillListView.tsx`
- `apps/desktop/src/renderer/components/skill/SkillGalleryCard.tsx`

## UX Contract

- 呼吸灯提示必须轻量，不能盖过收藏、安全、平台分发等既有状态。
- 只在本地 Skill 项上提示“商店更新可用”，不在未安装项或纯本地 Skill 上显示。
- 列表与画廊两种视图应保持一致的更新可见性。
