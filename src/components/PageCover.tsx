import { ExamStudyPlan } from "../types";
import { coverImageSrc, findPreset } from "../lib/pageCover";

/**
 * 页头那条封面带：满宽、贴顶，规格全在 .ui-cover-band（见 index.css）。
 * 它只画背景，不接事件也不放内容——页头的信息仍然是「图标 → 标题 → 属性」；
 * 浮在它上面的返回 / 编辑由页面自己摆，这个组件不管布局。
 */
export function PageCover({ plan }: { plan: Pick<ExamStudyPlan, "cover"> }) {
  const preset = findPreset(plan.cover);
  const src = coverImageSrc(plan.cover);
  if (!preset && !src) return null;

  return (
    <div aria-hidden="true" style={preset ? { background: preset.background } : undefined} className="ui-cover-band">
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : null}
    </div>
  );
}
