import type { ComponentProps } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import { resolvePromptMarkdownHref } from "../prompt/prompt-markdown-url";

interface AgentConversationMarkdownProps {
  content: string;
}

type MarkdownAnchorProps = ComponentProps<"a"> & { node?: unknown };
type MarkdownImageProps = ComponentProps<"img"> & { node?: unknown };

const markdownComponents: ComponentProps<typeof ReactMarkdown>["components"] = {
  h1: ({ children }) => (
    <h1 className="mb-2 mt-3 text-base font-semibold first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-1.5 mt-3 text-[15px] font-semibold first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1 mt-2.5 text-sm font-semibold first:mt-0">{children}</h3>
  ),
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="mb-2 list-disc space-y-0.5 pl-5 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 list-decimal space-y-0.5 pl-5 last:mb-0">{children}</ol>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-current/30 pl-3 opacity-80">
      {children}
    </blockquote>
  ),
  code: ({ children, className, ...props }) => (
    <code
      {...props}
      className={`${className || ""} rounded bg-black/10 px-1 py-0.5 font-mono text-[11px]`}
    >
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg bg-slate-950 px-3 py-2 font-mono text-[11px] leading-4 text-slate-100 last:mb-0">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <table className="my-2 w-full border-collapse text-left text-xs">
      {children}
    </table>
  ),
  th: ({ children }) => (
    <th className="border border-current/20 bg-black/5 px-2 py-1 font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-current/20 px-2 py-1">{children}</td>
  ),
  a: ({ children, href, node: _node, ...props }: MarkdownAnchorProps) => {
    const safeHref = resolvePromptMarkdownHref(href);
    return safeHref ? (
      <a
        {...props}
        href={safeHref}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium underline decoration-current/40 underline-offset-2"
      >
        {children}
      </a>
    ) : (
      <span>{children}</span>
    );
  },
  img: ({ alt, node: _node }: MarkdownImageProps) => (
    <span className="rounded bg-black/5 px-1.5 py-0.5 text-[11px] opacity-70">
      {alt || "image"}
    </span>
  ),
};

export function AgentConversationMarkdown({
  content,
}: AgentConversationMarkdownProps) {
  return (
    <div className="agent-conversation-markdown break-words text-[13px] leading-5">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
