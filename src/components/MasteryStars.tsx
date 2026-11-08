import { Star } from "lucide-react";

/* as const 让 onChange 的参数类型就是 1|2|3|4|5，与 StudyTask.confidenceRating 对得上，
   两个调用点都不必再写 as any。 */
const STARS = [1, 2, 3, 4, 5] as const;

interface MasteryStarsProps {
  value: number;
  onChange: (rating: (typeof STARS)[number]) => void;
  /** 读屏用的名字由调用方给：这里不猜语言，也不自己造一套文案。 */
  labelFor: (star: number) => string;
}

/**
 * 掌握度五星评分。置顶待办卡片与专注计时器共用这一份，不再各写一遍。
 *
 * 选中＝实心琥珀，未选＝空心次墨（清单 UI-03）。
 * 原来两态都是实心，只靠 #FCD33B / #d8d4cc 区分：这两个颜色在白底上分别只有
 * 1.6:1 和 1.5:1，整排控件其实看不见；而且「只用颜色区分状态」本身也不合规。
 * 现在形状（实心 / 空心）与颜色一起表达状态，两态都过得了 3:1 的图形下限。
 *
 * 命中区固定 24×24：计时器那一份原来只有 20px，比一颗星大不了多少，手指点不准。
 */
export function MasteryStars({ value, onChange, labelFor }: MasteryStarsProps) {
  return (
    <div className="flex items-center gap-0.5">
      {STARS.map((star) => {
        const isOn = value >= star;
        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            title={`${star} / 5`}
            aria-label={labelFor(star)}
            aria-pressed={isOn}
            className={`p-1 min-w-6 min-h-6 rounded-lg transition-colors cursor-pointer ${
              isOn ? "text-[#8A5A00]" : "text-[#6b6660] hover:text-[#8A5A00]"
            }`}
          >
            <Star
              className="w-3.5 h-3.5"
              fill={isOn ? "currentColor" : "none"}
              strokeWidth={isOn ? 0 : 1.5}
            />
          </button>
        );
      })}
    </div>
  );
}