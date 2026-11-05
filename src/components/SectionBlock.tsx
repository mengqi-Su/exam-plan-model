import React from "react";

interface SectionBlockProps {
  title: string;
  /** 一句话说明，落在标栏里；内容区不再重复解释自己是什么 */
  hint?: React.ReactNode;
  /** 标栏底部的计数/状态，只在段落级别出现一次 */
  aside?: React.ReactNode;
  /** 标题行的操作（展开、编辑这类轻量控件） */
  action?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * 科目页的分栏骨架。
 *
 * 板块不是一张张等宽白卡竖着平铺：左侧固定一段落标（标题 + 一句说明 + 计数或操作），
 * 右侧才是这一段的内容，段与段之间用发丝分隔线断开。
 * 白卡因此只留给真正的内容本身，段落标题不再被画进卡里重复一遍。
 */
export function SectionBlock({ title, hint, aside, action, children }: SectionBlockProps) {
  return (
    <section className="py-9 lg:py-10 flex flex-col lg:flex-row lg:gap-10">
      <div className="min-w-0 lg:w-[168px] lg:shrink-0 lg:pt-1">
        <div className="flex items-start justify-between gap-3 mb-2 lg:mb-2.5">
          <h2 className="ui-section-title">{title}</h2>
          {action && <div className="shrink-0">{action}</div>}
        </div>
        {hint && <p className="ui-row-meta leading-relaxed">{hint}</p>}
        {aside && <div className="mt-2.5 flex flex-wrap items-center gap-2">{aside}</div>}
      </div>
      <div className="flex-1 min-w-0 mt-4 lg:mt-0">{children}</div>
    </section>
  );
}
