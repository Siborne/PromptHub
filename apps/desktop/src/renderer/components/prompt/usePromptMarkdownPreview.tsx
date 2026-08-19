import { useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import rehypeHighlight from "rehype-highlight";
import { defaultSchema } from "hast-util-sanitize";

import { resolvePromptMarkdownHref } from "./prompt-markdown-url";

export function usePromptMarkdownPreview() {
  const sanitizeSchema: any = useMemo(() => {
    const schema = {
      ...defaultSchema,
      attributes: { ...defaultSchema.attributes },
    };
    schema.attributes.code = [...(schema.attributes.code || []), ["className"]];
    schema.attributes.span = [...(schema.attributes.span || []), ["className"]];
    schema.attributes.pre = [...(schema.attributes.pre || []), ["className"]];
    return schema;
  }, []);

  const rehypePlugins = useMemo(
    () => [
      [rehypeHighlight, { ignoreMissing: true }] as any,
      [rehypeSanitize, sanitizeSchema] as any,
    ],
    [sanitizeSchema],
  );

  const components = useMemo(
    () => ({
      h1: (props: any) => (
        <h1 className="text-2xl font-bold mb-4 text-foreground" {...props} />
      ),
      h2: (props: any) => (
        <h2
          className="text-xl font-semibold mb-3 mt-5 text-foreground"
          {...props}
        />
      ),
      h3: (props: any) => (
        <h3
          className="text-lg font-semibold mb-3 mt-4 text-foreground"
          {...props}
        />
      ),
      p: (props: any) => (
        <p className="mb-3 leading-relaxed text-foreground/90" {...props} />
      ),
      ul: (props: any) => (
        <ul className="list-disc pl-5 mb-3 space-y-1" {...props} />
      ),
      ol: (props: any) => (
        <ol className="list-decimal pl-5 mb-3 space-y-1" {...props} />
      ),
      li: (props: any) => <li className="leading-relaxed" {...props} />,
      code: (props: any) => (
        <code
          className="px-1 py-0.5 rounded bg-muted font-mono text-[13px]"
          {...props}
        />
      ),
      pre: (props: any) => (
        <pre
          className="p-3 rounded-lg bg-muted overflow-x-auto text-[13px] leading-relaxed"
          {...props}
        />
      ),
      blockquote: (props: any) => (
        <blockquote
          className="border-l-4 border-border pl-3 text-muted-foreground italic mb-3"
          {...props}
        />
      ),
      hr: () => <hr className="my-4 border-border" />,
      a: ({ href, children, ...props }: any) => {
        const safeHref = resolvePromptMarkdownHref(href);
        return safeHref ? (
          <a
            className="text-primary hover:underline"
            {...props}
            href={safeHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ) : (
          <span {...props}>{children}</span>
        );
      },
    }),
    [],
  );

  return useCallback(
    (content: string) => (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {content}
      </ReactMarkdown>
    ),
    [components, rehypePlugins],
  );
}
