# Implementation

## Status

Completed.

## Goal

修正 Prompt AI 测试模式边界、恢复多模态聊天测试的图片附件入口，并优化 Prompt 弹窗的信息层级：创建时优先进入写作流，编辑时保留已有内容的上下文。

## Shipped

- `AiTestModal` 现在按 Prompt 类型正确收敛模式边界：
  - 文本 Prompt 只显示单模型测试与多模型对比。
  - image Prompt 才显示生图测试模式。
- 文本 Prompt 的测试附件不再只是 UI 占位；上传图片后会真正传入 `buildMessagesFromPrompt(..., imageAttachments)`，覆盖单模型测试与多模型对比两条调用链。
- image Prompt 继续支持两类参考图输入：
  - 已保存参考图的选择
  - 当前测试会话内临时上传的参考图
- `CreatePromptModal` 现在采用 create-only 极简首屏：
  - 标题后首屏只突出 `Prompt Type` 与 `User Prompt`
  - `Description`、`System Prompt`、双语切换、参考媒体、变量提示、文件夹、标签、来源、备注都收纳到 `More Settings`
  - 折叠状态下会用摘要提示已填写的 description / system prompt / folder / tags / media
- `EditPromptModal` 保留较强的编辑上下文：
  - `Basic Info` 继续展示描述、Prompt 类型
  - image Prompt 的参考媒体继续放在 `Basic Info`
  - 文本 Prompt 的参考媒体仍放在 `More Settings`
- 多语言文案已同步调整，重点包括：
  - `prompt.typeImage` 从 “Media/媒体” 收敛为 “Image/绘图”
  - 新增 `basicInfo`、`moreSettings`、`aiTestSelectReferenceImages`、`aiTestUploadedReferenceImages`、`videoLabel`
- 跟随修正：
  - `MainContent` 的 image 类型错误提示改用 `prompt.mismatchImage`
  - `PromptGalleryView` 的视频角标改为独立 `videoLabel`，不再误用 `typeImage`

## Verification

- `pnpm --filter @prompthub/desktop test:run tests/unit/components/ai-test-workbench.test.tsx`
- `pnpm --filter @prompthub/desktop test:run tests/unit/components/prompt-modal-structure.test.tsx`
- `pnpm --filter @prompthub/desktop lint`
- `pnpm --filter @prompthub/desktop build`

## Remaining

- 如需继续推进，可补跑整套桌面单测或单独清理当前仓库里已存在的 `typecheck` 阻塞项（与本次修改无直接关系）。
