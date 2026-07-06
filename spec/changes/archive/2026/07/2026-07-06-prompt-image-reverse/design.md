# Design

## Approach

图片反推作为独立 Prompt 创建能力，不放在 `QuickAddModal` 内。

- `QuickAddModal` 只保留 `Analyze Existing` 和 `AI Generate`
- `ImagePromptReverseModal` 作为独立弹窗，从顶部新建菜单进入
- `imageReverse` 作为独立 AI usage scenario，类型为 chat，且要求 chat 模型声明 `vision` 能力

`Image Reverse` 不使用 `imageTest` 场景，因为 `imageTest` 当前代表生图模型 endpoint。图片反推需要“视觉理解 + 文本输出”，所以使用新的 `imageReverse` chat 场景，并只允许选择 vision-capable chat model。普通文本 chat 模型不能作为图片反推兜底。

当用户没有配置可用的 vision-capable chat 模型时，图片反推必须显示独立错误提示，指向“AI 模型工作台 + 视觉模型路由”。不能复用 Quick Add 的通用 AI 配置错误，也不能回退到旧版根级文本模型配置。

## Model Routing

AI 模型配置分两层：模型自身能力与业务路由必须分开。

- `type=chat`：文本输出接口形态
- `type=image`：生图接口形态
- `capabilities.vision=true`：chat 模型可读取图片 / 截图
- `modelRouteDefaults.fastText`：快速 / 低成本任务路由到哪个 chat 模型

当前产品层暴露四个稳定路由槽位，而不是直接暴露所有业务场景：

- `mainText`：能力较强的 chat 模型，用于 Prompt 文本测试等主流程
- `fastText`：低成本 chat 模型，用于 Quick Add、翻译、轻量审核等任务
- `visionText`：vision-capable chat 模型，用于图片反推和多模态输入
- `imageGeneration`：image generation 模型，用于 Prompt 生图测试

业务场景只作为内部调用点，并映射到上述路由：

- `quickAdd` / `translation` -> `fastText`
- `promptTest` -> `mainText`
- `imageReverse` -> `visionText`
- `imageTest` -> `imageGeneration`

## Data Flow

1. 用户从 Prompt 新建菜单进入 `Image Reverse`
2. 用户选择、拖拽或粘贴一张图片
3. Renderer 将图片保存到本地 image store，保留 fileName
4. Renderer 使用图片 base64 + 用户可选补充说明调用 `chatCompletion`
5. 模型返回 JSON 草稿
6. Modal 展示可编辑草稿，不自动创建 Prompt：
   - 用户可以编辑 title / userPrompt / description / tags
   - 用户可以复制 `userPrompt`，不落盘
   - 用户可以重新反推
7. 只有用户点击创建时，才调用 `onCreate()` 创建 image Prompt：
   - `promptType=image`
   - `userPrompt` 为反推生图 prompt
   - 当用户勾选“同时添加为参考图”时，`images` 包含参考图 fileName

## Preference

图片反推的“同时添加为参考图”是用户偏好，默认开启以保持第一版行为。

- 存储位置：`useSettingsStore` 的 zustand persist 状态
- 持久化 key：`prompthub-settings`
- 字段：`imageReverseAttachReferenceByDefault`
- 行为：用户在弹窗中切换勾选项后立即持久化，下次打开沿用该偏好

## AI Contract

模型必须只返回 JSON：

```json
{
  "title": "...",
  "promptType": "image",
  "systemPrompt": "",
  "userPrompt": "...",
  "description": "...",
  "suggestedFolder": null,
  "tags": ["image", "style"]
}
```

要求：

- `userPrompt` 必须是可直接用于生图模型的提示词。
- 重点覆盖主体、构图、镜头、光线、材质、风格、色彩、质量词和必要的负向约束。
- 不编造图片中无法判断的品牌、人物身份或版权实体。

## Verification

- Unit: builder/parser 生成严格 JSON 指令并解析 image draft。
- Component: 独立 Image Reverse modal 选图后调用 multimodal chat 并创建 image Prompt。
- Component: 独立 Image Reverse modal 选图后只生成可编辑草稿，不自动创建 image Prompt。
- Component: 用户可以复制反推草稿而不创建 / 不落盘。
- Component: 取消“同时添加为参考图”后创建 Prompt 不写入 `images`，且偏好被记住。
- Component: 没有 vision-capable chat 模型时显示图片反推专用配置错误，不调用 AI，也不创建 Prompt。
- Component: 视觉模型返回不可解析内容时显示解析错误，不创建 Prompt。
- Component: 视觉模型调用失败时显示图片反推失败，不创建 Prompt。
- Regression: 旧版根级文本 AI 配置不能作为图片反推兜底。
- Regression: 标记了 `vision` 但缺少 API key / endpoint / model 的不完整模型，不能作为图片反推可用配置。
- Regression: 视觉路由错误指向普通 chat 模型时，解析器会忽略该目标并回退到已配置的 vision-capable chat 模型。
- Regression: Quick Add 不再暴露图片反推模式。
- Regression: Image Reverse 使用 `imageReverse` chat 场景，不误走 image generation 模型配置。
