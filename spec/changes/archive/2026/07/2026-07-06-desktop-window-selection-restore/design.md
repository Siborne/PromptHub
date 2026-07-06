# Design

## Overview

- 优先使用最小修复：在 prompt store 中保留最近一次显式选中的 prompt id。
- 当 prompt 列表重新加载或窗口恢复后，如果当前 `selectedId` 为空、且最近选中的 prompt 仍然存在于当前可见列表中，则恢复该选中项。
- 恢复逻辑必须受当前文件夹/筛选后的可见 prompt 列表约束，避免恢复到不可见条目。

## Affected Areas

- Data model:
- `apps/desktop/src/renderer/stores/prompt.store.ts`
- UI / UX:
- `apps/desktop/src/renderer/components/layout/MainContent.tsx`
- Verification:
- 桌面端 store / MainContent 相关测试

## Tradeoffs

- 不做完整滚动位置恢复，改动更小，能优先解决“每次回到第一条”的主要抱怨。
- 只恢复当前可见列表中的条目，避免跨上下文误恢复。
