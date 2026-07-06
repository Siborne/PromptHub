# Delta Spec

## Added

- 当用户使用 Google/Gemini provider 且请求目标是 Gemini OpenAI 兼容端点时，系统必须使用 `Authorization: Bearer <apiKey>` 鉴权。
- 当用户请求 Gemini 原生模型发现接口时，系统必须继续使用 `x-goog-api-key` 鉴权。

## Modified

- Google/Gemini 的请求头选择逻辑不再只按域名判断，而是按最终请求协议（原生 Gemini / OpenAI 兼容）判断。

## Removed

- 无。

## Scenarios

- 当用户在设置页选择 Google provider，并用默认 host 测试聊天模型时：
- 系统自动补全到 `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`
- 请求必须携带 `Authorization: Bearer <apiKey>`

- 当用户点击“获取模型列表”时：
- 系统请求 `https://generativelanguage.googleapis.com/v1beta/models`
- 请求必须携带 `x-goog-api-key: <apiKey>`
