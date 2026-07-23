# Prompt Image Preview Gallery

## Why

Prompt 详情可以展示多张参考图片，但当前大图预览只接收被点击的单张图片。用户关闭
预览、点击下一张缩略图、再重新打开才能逐张查看，打断了连续比较图片的流程。

## Outcome

- 点击任意 Prompt 图片后，从该图片位置打开大图预览。
- 多图时提供稳定的上一张、下一张按钮和当前位置提示。
- 支持 `ArrowLeft` / `ArrowRight` 键盘切换，保留 `Escape` 关闭。
- 单图以及不属于 Prompt 图片集合的临时 AI 图片继续使用简洁单图预览。

## Scope

- Desktop Prompt 右侧详情区和独立 Prompt 详情弹窗。
- 共享 `ImagePreviewModal` 的画廊能力与七语言无障碍文案。
- 组件回归测试与稳定 Desktop 行为文档。

## Non-Goals

- 不修改 Prompt 图片的存储顺序、数据库、IPC 或同步协议。
- 不增加缩略图胶片、图片编辑、缩放、下载或自动播放。
- 不把临时 AI 响应图片混入已保存 Prompt 图片集合。

## Risk And Rollback

风险集中在键盘事件冲突、边界索引和图片加载失败状态。实现使用有界索引，不循环
切换；切换图片时重置错误状态。回滚只需恢复单图 modal 调用，不涉及数据迁移。
