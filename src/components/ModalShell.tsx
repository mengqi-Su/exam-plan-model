import React, { useEffect } from "react";
import { X } from "lucide-react";

/**
 * 全站唯一的悬浮窗骨架：遮罩、Esc、点空白关闭、滚动锁定都只在这里做一次。
 * 各弹窗只负责填 title / 内容 / footer，不再各自抄一份 fixed inset-0。
 */

const SIZE_CLASS = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
} as const;

export interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  /** 标题栏文字，同时用作 dialog 的可访问名 */
  title: string;
  closeLabel: string;
  icon?: React.ReactNode;
  /** warn 给资料/删除确认这类需要一点底色的图标块 */
  tone?: "neutral" | "warn";
  size?: keyof typeof SIZE_CLASS;
  children: React.ReactNode;
  /** 底栏左侧的次要说明 */
  note?: React.ReactNode;
  /** 底栏右侧的操作 */
  footer?: React.ReactNode;
  bodyClassName?: string;
}

export function ModalShell({
  open,
  onClose,
  title,
  closeLabel,
  icon,
  tone = "neutral",
  size = "md",
  children,
  note,
  footer,
  bodyClassName = "",
}: ModalShellProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#1c1b1a]/40 p-4 backdrop-blur-sm animate-fadeIn"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className={`my-auto flex max-h-[88vh] w-full flex-col overflow-hidden rounded-2xl border border-[#eae7e1] bg-white text-[#1c1b1a] shadow-[0_18px_50px_rgba(28,27,26,0.22)] ${SIZE_CLASS[size]}`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#f0ede8] bg-[#faf9f6] px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            {icon && (
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  tone === "warn" ? "bg-[#FBF3DC] text-[#8A5A00]" : "bg-[#f1efe9] text-[#6b6660]"
                }`}
                aria-hidden="true"
              >
                {icon}
              </span>
            )}
            <span className="ui-section-title truncate">{title}</span>
          </div>
          <button
            onClick={onClose}
            aria-label={closeLabel}
            className="shrink-0 rounded-md p-1.5 text-[#a39e97] transition-colors hover:bg-[#f1efe9] hover:text-[#1c1b1a] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className={`min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 ${bodyClassName}`}>{children}</div>

        {(note || footer) && (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#f0ede8] bg-[#faf9f6] px-5 py-3.5">
            {note && <span className="ui-row-meta min-w-0 flex-1">{note}</span>}
            {footer && <div className="ml-auto flex shrink-0 items-center gap-2">{footer}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
