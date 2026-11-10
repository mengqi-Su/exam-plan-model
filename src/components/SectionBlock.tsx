import React from "react";

interface SectionBlockProps {
  title: string;
  /** 一句话状态读数（份数、第几段），跟标题同一行右侧，不再单开一栏 */
  hint?: React.ReactNode;
  /** 标题行的计数/状态胶囊，只在段落级别出现一次 */
  aside?: React.ReactNode;
  /** 标题行最右的操作（展开、重排这类轻量控件） */
  action?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * 科目页的分块骨架：一行块头 + 全宽内容，块与块靠留白和一条发丝线分开。
 *
 * 原来这里是「左 168px 标栏 + 右边内容」的两栏排法。那是清单/表单的排版，
 * 可右边填进去的是一张张 dashboard 卡——读者不知道该把它当表格读还是当面板读，
 * 而且每段的标题会在左栏写一遍、卡里再写一遍。现在标题、状态、操作挤同一行，
 * 内容拿到整页宽度，白卡只留给内容本身，一页最多一层卡面。
 */
export function SectionBlock({ title, hint, aside, action, children }: SectionBlockProps) {
  // toArray 会把 false / null / undefined 都摘掉，所以「没有内容」和「有一个空 div」
  // 在这里分得开：重排没展开时不该再多出一段 12px 的间距。
  const body = React.Children.toArray(children);
  return (
    <section className="py-6 lg:py-7">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="ui-section-title">{title}</h2>
        {hint && <span className="ui-row-meta tabular-nums">{hint}</span>}
        {aside && <span className="flex flex-wrap items-center gap-2">{aside}</span>}
        {action && <span className="ml-auto shrink-0">{action}</span>}
      </div>
      {body.length > 0 && <div className="mt-3 min-w-0">{body}</div>}
    </section>
  );
}
