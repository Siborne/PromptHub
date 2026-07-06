# Image prompt reverse generation

## Why

很多用户并没有现成的生图 Prompt。更常见的入口是“我有一张参考图，想得到类似风格/构图/主体的提示词”。PromptHub 应支持把图片拖入或粘贴截图后，用视觉模型反推出可保存的 image Prompt。

## Scope

- 在 Prompt Quick Add 中新增 `Image Reverse` 模式。
- 支持选择图片、拖拽图片、粘贴截图/图片。
- 使用现有 chat multimodal 能力，不走 image generation endpoint。
- 创建 `promptType=image` 的 Prompt，并把参考图保存到 Prompt 的 `images`。

## Non-goals

- 不做原生屏幕捕获权限和窗口选择；第一版通过系统截图后粘贴完成。
- 不新增第三方图片生成模型调用。
- 不做多图融合或 prompt 测评。

## Risks

- 用户可能误选 image generation 模型；该能力需要视觉 chat 模型。
- 图片 base64 走现有 AI transport，必须继续使用主进程请求代理，避免 renderer 直接跨域。
- Drop/paste 图片需要保存到本地图片库，避免只生成 prompt 而丢失参考图。
