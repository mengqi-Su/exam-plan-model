import React from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * 资料阅读器的正文渲染器（清单 PERF-01）。
 *
 * 单独成文件不是为了分层，是为了让 react-markdown + remark-gfm 那一整套
 * unified/micromark/mdast 依赖（约 180 kB）落在按需块里：整套应用只有这一个地方用到它，
 * 放在阅读器组件里静态 import 就等于每次打开应用都先下载一遍 markdown 解析器。
 * 阅读器外壳（主题、字号、目录、搜索）留在原处，状态不会因为懒加载而丢。
 *
 * 主题色由调用方传进来，这里不自己定义一套——阅读器的纸/柔/夜三套色只有一处出处。
 */
export interface MarkdownTheme {
  border: string;
  subtleBorder: string;
  blockquoteBg: string;
  codeBg: string;
}

interface MarkdownBodyProps {
  content: string;
  theme: MarkdownTheme;
  isDark: boolean;
}

export function MarkdownBody({ content, theme, isDark }: MarkdownBodyProps) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ node, ...props }) => (
          <h1
            className={`text-[20px] sm:text-[24px] font-semibold pt-6 pb-2 border-b ${theme.subtleBorder} mt-8 mb-4 tracking-tight`}
            {...props}
          />
        ),
        h2: ({ node, ...props }) => (
          <h2
            className={`text-[20px] font-semibold pt-4 pb-1.5 border-b ${theme.subtleBorder} mt-6 mb-3 tracking-tight`}
            {...props}
          />
        ),
        h3: ({ node, ...props }) => (
          <h3 className="text-[15px] sm:text-[20px] font-semibold pt-3 mt-4 mb-2" {...props} />
        ),
        h4: ({ node, ...props }) => (
          <h4 className="text-[13px] sm:text-[15px] font-semibold mt-3 mb-1" {...props} />
        ),
        p: ({ node, ...props }) => <p className="my-3 leading-relaxed" {...props} />,
        ul: ({ node, ...props }) => <ul className="my-3 list-disc pl-6 space-y-1.5" {...props} />,
        ol: ({ node, ...props }) => (
          <ol className="my-3 list-decimal pl-6 space-y-1.5 font-medium" {...props} />
        ),
        li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
        blockquote: ({ node, ...props }) => (
          <blockquote
            className={`my-4 pl-4 py-2 border-l-2 ${theme.border} ${theme.blockquoteBg} italic text-[13px] rounded-r-lg`}
            {...props}
          />
        ),
        table: ({ node, ...props }) => (
          <div className={`overflow-x-auto my-4 rounded-lg border ${theme.subtleBorder}`}>
            <table className="w-full text-left text-[12px] border-collapse" {...props} />
          </div>
        ),
        thead: ({ node, ...props }) => (
          <thead
            className={`${isDark ? "bg-white/[0.06]" : "bg-black/[0.04]"} font-medium border-b ${theme.subtleBorder}`}
            {...props}
          />
        ),
        th: ({ node, ...props }) => (
          <th className={`p-2.5 border ${theme.subtleBorder} font-medium`} {...props} />
        ),
        td: ({ node, ...props }) => <td className={`p-2.5 border ${theme.subtleBorder}`} {...props} />,
        code: ({ node, className, children, ...props }) => {
          const isInline = !className && typeof children === "string" && !children.includes("\n");
          if (isInline) {
            return (
              <code
                className={`px-1.5 py-0.5 rounded-lg font-mono text-[12px] ${theme.codeBg} border ${theme.subtleBorder}`}
                {...props}
              >
                {children}
              </code>
            );
          }
          return (
            <div className="relative my-4 group">
              <pre
                className={`p-4 rounded-lg overflow-x-auto font-mono text-[12px] ${theme.codeBg} border ${theme.subtleBorder} leading-relaxed`}
              >
                <code {...props}>{children}</code>
              </pre>
            </div>
          );
        },
        hr: () => <hr className={`my-8 border-t ${theme.subtleBorder}`} />,
        a: ({ node, ...props }) => (
          <a
            className={`font-medium underline hover:opacity-80 ${isDark ? "text-[#8ab4f8]" : "text-[#1D4ED8]"}`}
            target="_blank"
            rel="noreferrer"
            {...props}
          />
        ),
      }}
    >
      {content}
    </Markdown>
  );
}