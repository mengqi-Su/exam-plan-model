import { AlertCircle, Info, X } from "lucide-react";
import { useI18n } from "../lib/i18n";

interface NoticeBandProps {
  /**
   * error = 这件事没做成；notice = 这件事做成了，但有情况要说一句。
   * 红底只在真的没做成时用：把「已跳过 1 份重复资料」染成失败红，等于让用户去查一个不存在的故障。
   */
  tone: "error" | "notice";
  /** 失败才需要的帽子；说明性的一句话自己就是完整句子，不再套一个标题。 */
  headline?: string;
  message: string;
  onDismiss?: () => void;
}

export function NoticeBand({ tone, headline, message, onDismiss }: NoticeBandProps) {
  const { language } = useI18n();
  const tt = (zh: string, en: string) => (language === "zh" ? zh : en);
  const isError = tone === "error";

  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-[13px] animate-fadeIn ${
        isError ? "border-[#f5d6d0] bg-[#FDF0EE] text-[#B42318]" : "border-[#e5e2dc] bg-[#faf9f6] text-[#1c1b1a]"
      }`}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        {isError ? (
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        ) : (
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#6b6660]" />
        )}
        <div className="min-w-0 leading-relaxed">
          {headline && <p className="font-medium">{headline}</p>}
          <p className={headline ? "mt-0.5" : ""}>{message}</p>
        </div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className={`shrink-0 rounded-lg p-1 transition-colors cursor-pointer ${
            isError ? "hover:bg-[#B42318]/10" : "hover:bg-[#1c1b1a]/5"
          }`}
          aria-label={tt("关闭提示", "Dismiss")}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
