import React, { useEffect } from "react";
import { X } from "lucide-react";

/**
 * 全站唯一的悬浮窗骨架：遮罩、Esc、点空白关闭、滚动锁定都只在这里做一次。
 * 各弹窗只负责填 title / 内容 / footer，不再各自抄一份 fixed inset-0。
 *
 * 滚动口径也钉在这里：卡片高度封顶，只有中间那段内容滚，
 * 页头和底栏永远钉在屏幕上——按钮不会因为表单变长而跑到屏幕外面。
 *
 * 页头只有眉栏（页面归属、已存数量这类状态）和标题，没有「标题下面一句说明」的槽：
 * 解释性次要灰字全站清掉，弹窗也不例外。要告诉用户为什么走不下去，
 * 就写在挡住他的那一层里，紧跟一个能解开它的动作，而不是在页头预告一遍。
 * 底栏的 note 是状态读数（字数、已选章数、进度），不是说明文，留着。
 */

const SIZE_CLASS = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
} as const;

/**
 * 背景滚动锁：整站共用一个引用计数。
 * 弹窗是会套娃的（向导 → 教材目录 → 资料预览），如果每个实例自己记「进来之前 body 是什么」，
 * 记到的值就完全取决于 effect 的重跑顺序：内层那句 hidden 有可能被外层当成原值存下来，
 * 全部关掉之后页面就永久锁死了。计数归零才还原真正的第一层。
 */
let scrollLocks = 0;
let overflowBeforeLock = "";

function lockBodyScroll() {
  if (scrollLocks === 0) {
    overflowBeforeLock = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  scrollLocks += 1;
  return () => {
    scrollLocks = Math.max(0, scrollLocks - 1);
    if (scrollLocks === 0) document.body.style.overflow = overflowBeforeLock;
  };
}

export interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  /** 标题栏文字，同时用作 dialog 的可访问名 */
  title: string;
  closeLabel: string;
  /** 生成中这类「此刻不能退」的场景，让右上角的叉显出禁用态（拦截本身仍由 onClose 负责） */
  closeDisabled?: boolean;
  /** 标题上方那行小字（页面归属、已存数量这类） */
  eyebrow?: React.ReactNode;
  icon?: React.ReactNode;
  /** warn 给资料/删除确认这类需要一点底色的图标块 */
  tone?: "neutral" | "warn";
  size?: keyof typeof SIZE_CLASS;
  /** 钉在页头和内容之间、不参与滚动的一条（分步导航这类） */
  subheader?: React.ReactNode;
  children: React.ReactNode;
  /** 底栏左侧的次要说明 */
  note?: React.ReactNode;
  footer?: React.ReactNode;
  /** actions：右侧一排按钮；block：底栏整条交给调用方排（多步向导那种一行放不下就换行的） */
  footerMode?: "actions" | "block";
  bodyClassName?: string;
  /** 滚动的内容区句柄：换步骤要滚回顶部、打开后要聚焦第一个字段，都用它，不必再抄一份卡片骨架 */
  bodyRef?: React.Ref<HTMLDivElement>;
}

export function ModalShell({
  open,
  onClose,
  title,
  closeLabel,
  closeDisabled = false,
  eyebrow,
  icon,
  tone = "neutral",
  size = "md",
  subheader,
  children,
  note,
  footer,
  footerMode = "actions",
  bodyClassName = "",
  bodyRef,
}: ModalShellProps) {
  // 两件事各管各的：Esc 关心的是「现在这一层的最上面那个 onClose」，
  // 背景锁关心的是「还有没有弹窗开着」。混在一个 effect 里，
  // onClose 每次重渲染都换个身份，锁就会跟着被拆掉重装，还原时记错原值。
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    return lockBodyScroll();
  }, [open]);

  if (!open) return null;

  const hasHeaderExtras = Boolean(eyebrow || subheader);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1c1b1a]/40 p-2 backdrop-blur-sm animate-fadeIn sm:p-4"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className={`ui-modal flex max-h-[94vh] w-full flex-col overflow-hidden rounded-2xl border border-[#eae7e1] bg-white text-[#1c1b1a] shadow-[0_18px_50px_rgba(28,27,26,0.22)] sm:max-h-[88vh] ${SIZE_CLASS[size]}`}
      >
        <div
          className={`shrink-0 border-b border-[#f0ede8] bg-[#faf9f6] px-5 ${
            hasHeaderExtras ? "py-3.5" : ""
          }`}
        >
          <div
            className={`flex justify-between gap-3 ${
              hasHeaderExtras ? "items-start" : "items-center py-3.5"
            }`}
          >
            <div className="min-w-0 flex-1 space-y-1">
              {eyebrow && (
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-[#6b6660]">{eyebrow}</div>
              )}
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
            </div>
            <button
              onClick={onClose}
              disabled={closeDisabled}
              aria-label={closeLabel}
              className="shrink-0 rounded-lg p-1.5 text-[#6b6660] transition-colors hover:bg-[#f1efe9] hover:text-[#1c1b1a] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {subheader && <div className="pt-3">{subheader}</div>}
        </div>

        <div
          ref={bodyRef}
          className={`min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-5 ${bodyClassName}`}
        >
          {children}
        </div>

        {(note || footer) && (
          <div className="shrink-0 border-t border-[#f0ede8] bg-[#faf9f6] px-5 py-3.5">
            {footerMode === "block" ? (
              footer
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                {note && <span className="ui-row-meta min-w-0 flex-1">{note}</span>}
                {footer && <div className="ml-auto flex shrink-0 items-center gap-2">{footer}</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
