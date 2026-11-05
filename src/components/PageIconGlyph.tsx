import { ExamStudyPlan } from "../types";
import { planIcon } from "../lib/pageIcon";

interface PageIconGlyphProps {
  plan: ExamStudyPlan;
  /** 只由调用方决定体量：页头走 ui-page-icon，列表与标签走 13–18px。 */
  className?: string;
}

/**
 * 页面图标只有一处渲染口径：取哪个 emoji 由 planIcon 决定，这里只管显示。
 * 纯装饰，科目名本身已经在旁边，所以对读屏器隐藏。
 */
export function PageIconGlyph({ plan, className = "text-[15px]" }: PageIconGlyphProps) {
  return (
    <span aria-hidden="true" className={`shrink-0 select-none leading-none ${className}`}>
      {planIcon(plan)}
    </span>
  );
}
