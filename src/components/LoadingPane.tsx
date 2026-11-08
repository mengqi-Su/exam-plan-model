import { useI18n } from "../lib/i18n";

/**
 * 懒加载边界共用的占位（清单 PERF-01）。
 *
 * 只有一颗转圈，不写解释文案——「次要灰字全清」的口径同样适用于等待态。
 * 读屏仍然要被告知这里在加载，所以名字放在 aria-label 上，配合 role="status"。
 *
 * 页面级视图用它撑住内容区（min-h 让侧栏和底栏不会往上跳一下）；
 * 弹窗级边界直接用 fallback={null}：弹窗还没到就在页面上闪一块灰，比多等 50ms 更糟。
 */
export function LoadingPane() {
  const { language } = useI18n();
  return (
    <div
      role="status"
      aria-label={language === "zh" ? "正在加载" : "Loading"}
      className="flex min-h-[40vh] items-center justify-center"
    >
      <span
        aria-hidden="true"
        className="h-4 w-4 animate-spin rounded-full border-2 border-[#ddd9d2] border-t-[#1c1b1a]"
      />
    </div>
  );
}