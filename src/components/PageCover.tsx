import { ExamStudyPlan } from "../types";
import { coverImageSrc, findPreset } from "../lib/pageCover";

/**
 * 页头那条封面带。它只画背景，不接事件也不放内容——
 * 页头的信息仍然是「图标 → 标题 → 属性」，封面只是给这份文档一个底。
 */
export function PageCover({
  plan,
  className = "",
}: {
  plan: Pick<ExamStudyPlan, "cover">;
  className?: string;
}) {
  const preset = findPreset(plan.cover);
  const src = coverImageSrc(plan.cover);
  if (!preset && !src) return null;

  return (
    <div
      aria-hidden="true"
      style={preset ? { background: preset.background } : undefined}
      className={`h-[112px] w-full overflow-hidden rounded-xl sm:h-[152px] ${className}`}
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : null}
    </div>
  );
}
