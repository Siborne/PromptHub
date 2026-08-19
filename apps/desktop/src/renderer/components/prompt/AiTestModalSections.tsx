import type { RefObject } from "react";
import type { TFunction } from "i18next";
import {
  DownloadIcon,
  ImageIcon,
  LoaderIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";

import type { AIModelConfig } from "../../stores/settings.store";
import { LocalImage } from "../ui/LocalImage";
import {
  MAX_AI_TEST_IMAGE_BYTES,
  MAX_AI_TEST_IMAGES,
  type AiTestImageAttachment,
} from "./ai-test-modal-config";

interface AiTestAttachmentsProps {
  attachments: AiTestImageAttachment[];
  formatImageSize: (bytes: number) => string;
  imageInputRef: RefObject<HTMLInputElement>;
  isImagePrompt: boolean;
  onFilesSelected: (files: FileList | null) => void;
  onRemoveAttachment: (id: string) => void;
  onToggleReference: (fileName: string) => void;
  promptImages?: string[];
  selectedReferenceImages: string[];
  t: TFunction;
}

export function AiTestAttachments({
  attachments,
  formatImageSize,
  imageInputRef,
  isImagePrompt,
  onFilesSelected,
  onRemoveAttachment,
  onToggleReference,
  promptImages,
  selectedReferenceImages,
  t,
}: AiTestAttachmentsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <ImageIcon className="w-4 h-4" aria-hidden="true" />
            {isImagePrompt
              ? t("prompt.referenceImages")
              : t("prompt.aiTestAttachments", "测试附件")}
          </h4>
          <p className="text-xs text-muted-foreground">
            {isImagePrompt
              ? t("prompt.typeImageDesc")
              : t("prompt.aiTestAttachmentHint", {
                  count: MAX_AI_TEST_IMAGES,
                  size: formatImageSize(MAX_AI_TEST_IMAGE_BYTES),
                })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          disabled={attachments.length >= MAX_AI_TEST_IMAGES}
          className="flex shrink-0 items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background text-sm font-medium hover:bg-accent disabled:opacity-50 transition-colors"
        >
          <ImageIcon className="w-4 h-4" aria-hidden="true" />
          {t("prompt.aiTestAddImages")}
        </button>
        <input
          ref={imageInputRef}
          type="file"
          aria-label={t("prompt.aiTestAddImages")}
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={(event) => {
            onFilesSelected(event.currentTarget.files);
            event.currentTarget.value = "";
          }}
        />
      </div>

      {isImagePrompt && promptImages && promptImages.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">
            {t(
              "prompt.aiTestSelectReferenceImages",
              "Select existing reference images",
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {promptImages.map((imageName) => {
              const selected = selectedReferenceImages.includes(imageName);
              return (
                <button
                  type="button"
                  key={imageName}
                  onClick={() => onToggleReference(imageName)}
                  aria-label={
                    selected
                      ? t("prompt.aiTestDeselectReferenceImage", {
                          name: imageName,
                          defaultValue: `Deselect reference image ${imageName}`,
                        })
                      : t("prompt.aiTestSelectReferenceImage", {
                          name: imageName,
                          defaultValue: `Select reference image ${imageName}`,
                        })
                  }
                  aria-pressed={selected}
                  className={`relative overflow-hidden rounded-lg border text-left transition-colors ${
                    selected
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <LocalImage
                    src={imageName}
                    alt=""
                    aria-hidden="true"
                    className="h-24 w-full object-cover"
                    fallbackClassName="h-24 w-full"
                  />
                  <div className="absolute left-1.5 top-1.5 rounded-md bg-background/90 px-1.5 py-0.5 text-[10px] font-medium">
                    {selected
                      ? t("common.selected", "Selected")
                      : t("common.select", "Select")}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">
            {t(
              "prompt.aiTestUploadedReferenceImages",
              "Uploaded reference images",
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="relative overflow-hidden rounded-lg border border-border bg-muted/40"
              >
                <img
                  src={attachment.dataUrl}
                  alt={attachment.name}
                  className="h-24 w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(attachment.id)}
                  aria-label={t("prompt.aiTestRemoveImage")}
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm hover:bg-background"
                  title={t("prompt.aiTestRemoveImage")}
                >
                  <XIcon className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <div className="space-y-0.5 px-2 py-1.5">
                  <p
                    className="truncate text-xs font-medium"
                    title={attachment.name}
                  >
                    {attachment.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatImageSize(attachment.size)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface AiImageGenerationSectionProps {
  defaultImageModel: AIModelConfig | null;
  generatedImages: string[];
  imageGenerationError: string | null;
  isLoading: boolean;
  onAddImage?: (imageUrl: string) => void;
  onDownloadImage: (imageUrl: string, index: number) => void;
  onRun: () => void;
  providerName: string | null;
  t: TFunction;
}

export function AiImageGenerationSection({
  defaultImageModel,
  generatedImages,
  imageGenerationError,
  isLoading,
  onAddImage,
  onDownloadImage,
  onRun,
  providerName,
  t,
}: AiImageGenerationSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <span className="text-sm text-muted-foreground">
            {t("settings.model")}:{" "}
            {defaultImageModel?.model ||
              t("settings.noImageModel", "未配置生图模型")}
          </span>
          {defaultImageModel && (
            <p className="text-xs text-muted-foreground">
              {t("settings.provider")}: {providerName}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onRun}
          disabled={isLoading || !defaultImageModel}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {isLoading ? (
            <LoaderIcon className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <ImageIcon className="w-4 h-4" aria-hidden="true" />
          )}
          {isLoading
            ? t("prompt.generating", "生成中...")
            : t("settings.testImage")}
        </button>
      </div>

      {imageGenerationError && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-3"
        >
          <p className="text-sm font-medium text-destructive">
            {t("settings.imageGenerationFailed")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground break-words">
            {imageGenerationError}
          </p>
        </div>
      )}

      {generatedImages.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">
            {t("settings.generatedImages", "生成的图片")}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {generatedImages.map((imageUrl, index) => (
              <div
                key={index}
                className="relative group rounded-lg overflow-hidden border border-border"
              >
                <img
                  src={imageUrl}
                  alt={`Generated ${index + 1}`}
                  className="w-full h-auto object-cover"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {onAddImage && (
                    <button
                      type="button"
                      onClick={() => onAddImage(imageUrl)}
                      className="flex items-center gap-1 px-3 py-2 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90"
                      title={t("prompt.addToPrompt", "添加到 Prompt")}
                    >
                      <PlusIcon className="w-4 h-4" aria-hidden="true" />
                      {t("prompt.addToPrompt", "添加到 Prompt")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDownloadImage(imageUrl, index)}
                    aria-label={t("common.download", "下载")}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg bg-muted text-foreground text-xs font-medium hover:bg-muted/80"
                    title={t("common.download", "下载")}
                  >
                    <DownloadIcon className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!defaultImageModel && (
        <div className="p-4 rounded-lg bg-muted/50 border border-border text-center">
          <ImageIcon
            className="w-8 h-8 mx-auto mb-2 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-sm text-muted-foreground">
            {t("settings.noImageModelHint", "请先在设置中配置生图模型")}
          </p>
        </div>
      )}
    </div>
  );
}
