# Prompt Spec Delta

## Added Requirements

### Requirement: AI test image attachments

PromptHub MUST allow users to attach local image files when running Prompt AI tests against chat models.

#### Scenario: Send text prompt with images

- GIVEN a user opens AI Test for a text prompt
- AND selects one or more supported image files
- WHEN the user runs single-model AI Test
- THEN PromptHub sends the prompt text and selected images in the same user message using base64 data URLs.

#### Scenario: Compare models with the same images

- GIVEN a user selects two or more chat models for comparison
- AND attaches images in the AI Test modal
- WHEN the user runs comparison
- THEN every selected model receives the same text and image attachments.

#### Scenario: Text-only compatibility

- GIVEN no images are attached
- WHEN AI Test or model comparison runs
- THEN PromptHub sends the same text-only message shape as before.

#### Scenario: Attachment validation

- GIVEN a user selects a non-image file or an image that is too large
- WHEN PromptHub processes the selection
- THEN the file is rejected before any AI request is sent and the user sees an error.
