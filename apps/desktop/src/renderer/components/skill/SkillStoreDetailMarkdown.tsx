import { memo } from "react";

import { renderImmersiveSegments } from "./detail-utils";
import { SkillMarkdown } from "./SkillMarkdown";

interface SkillStoreDetailMarkdownProps {
  contentUrl?: string;
  effectiveContent: string;
  showTranslation: boolean;
  sourceUrl?: string;
  translatedContent: string;
  translationMode: "full" | "immersive";
}

const MARKDOWN_CONTAINER_CLASS =
  "prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-h1:text-base prose-h1:font-bold prose-h2:text-sm prose-h2:font-semibold prose-h3:text-xs prose-h3:font-semibold prose-p:text-foreground/80 prose-p:text-[13px] prose-strong:text-foreground prose-li:text-foreground/80 prose-li:text-[13px] prose-code:text-primary prose-pre:bg-muted prose-pre:border prose-pre:border-border text-[13px]";

function MarkdownContent({
  content,
  contentUrl,
  sourceUrl,
}: Pick<SkillStoreDetailMarkdownProps, "contentUrl" | "sourceUrl"> & {
  content: string;
}) {
  return (
    <div className={MARKDOWN_CONTAINER_CLASS}>
      <div className="markdown-body">
        <SkillMarkdown
          content={content}
          sourceUrl={sourceUrl}
          contentUrl={contentUrl}
        />
      </div>
    </div>
  );
}

function ImmersiveMarkdownContent(props: SkillStoreDetailMarkdownProps) {
  const segments = renderImmersiveSegments(props.translatedContent);
  return (
    <div className={MARKDOWN_CONTAINER_CLASS}>
      <div className="markdown-body">
        {segments.map((segment, index) =>
          segment.type === "translation" ? (
            <div
              key={index}
              className="border-l-2 border-primary/40 pl-3 my-1 text-primary/70 text-[12px] italic"
            >
              <SkillMarkdown
                content={segment.text}
                sourceUrl={props.sourceUrl}
                contentUrl={props.contentUrl}
              />
            </div>
          ) : (
            <SkillMarkdown
              key={index}
              content={segment.text}
              sourceUrl={props.sourceUrl}
              contentUrl={props.contentUrl}
            />
          ),
        )}
      </div>
    </div>
  );
}

function SkillStoreDetailMarkdownView(props: SkillStoreDetailMarkdownProps) {
  if (
    props.showTranslation &&
    props.translatedContent &&
    props.translationMode === "immersive"
  ) {
    return <ImmersiveMarkdownContent {...props} />;
  }
  const content =
    props.showTranslation && props.translatedContent
      ? props.translatedContent
      : props.effectiveContent;
  return (
    <MarkdownContent
      content={content}
      contentUrl={props.contentUrl}
      sourceUrl={props.sourceUrl}
    />
  );
}

export const SkillStoreDetailMarkdown = memo(SkillStoreDetailMarkdownView);
