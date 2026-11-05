import React from "react";
import {
  Calendar,
  LayoutDashboard,
  PanelLeft,
  PanelLeftClose,
  Plus,
  Settings,
  Sun,
  Trash2,
} from "lucide-react";
import { AppTab, ExamStudyPlan } from "../types";
import { useI18n } from "../lib/i18n";
import { PageIconGlyph } from "./PageIconGlyph";

interface NotionSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  plans: ExamStudyPlan[];
  activePlan: ExamStudyPlan | null;
  onSelectPlan: (planId: string) => void;
  onNewPlan: () => void;
  onDeletePlan?: (planId: string) => void;
  onRequestDeletePlan?: (plan: ExamStudyPlan) => void;
  currentTab: AppTab;
  onTabChange: (tab: AppTab, planId?: string) => void;
}

export function NotionSidebar({
  isOpen,
  onToggle,
  plans,
  activePlan,
  onSelectPlan,
  onNewPlan,
  onDeletePlan,
  onRequestDeletePlan,
  currentTab,
  onTabChange,
}: NotionSidebarProps) {
  const { language } = useI18n();
  const isZh = language === "zh";

  if (!isOpen) {
    return (
      <div className="hidden md:block fixed top-3 left-3 z-40">
        <button
          onClick={onToggle}
          className="p-2 min-w-9 min-h-9 rounded-lg border border-[#eae7e1] bg-white text-[#8a8580] shadow-[0_1px_2px_rgba(28,27,26,0.04)] transition-colors hover:text-[#1c1b1a] hover:bg-[#faf9f6] cursor-pointer"
          title={isZh ? "展开侧栏" : "Open sidebar"}
          aria-label={isZh ? "展开侧栏" : "Open sidebar"}
        >
          <PanelLeft className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const navItems: { id: AppTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "today", label: isZh ? "今日" : "Today", icon: Sun },
    { id: "dashboard", label: isZh ? "科目" : "Subjects", icon: LayoutDashboard },
    { id: "master_calendar", label: isZh ? "日历" : "Calendar", icon: Calendar },
  ];

  return (
    <aside
      className="hidden md:flex w-64 bg-[#f2f0ea] border-r border-[#e7e4de] flex-col h-screen fixed top-0 left-0 z-40 select-none text-[13px] text-[#1c1b1a]"
      aria-label={isZh ? "主导航侧栏" : "Main navigation"}
    >
      <div className="p-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded-md bg-[#1c1b1a] text-white flex items-center justify-center text-[10px] font-semibold shrink-0 tracking-tight">
            EP
          </div>
          <span className="font-semibold text-[13px] text-[#1c1b1a] tracking-tight block truncate">
            EXAM PLAN AI
          </span>
        </div>

        <button
          onClick={onToggle}
          className="p-2 min-w-9 min-h-9 rounded-lg text-[#8a8580] hover:text-[#1c1b1a] hover:bg-black/[0.04] transition-colors cursor-pointer"
          title={isZh ? "收起侧栏" : "Collapse sidebar"}
          aria-label={isZh ? "收起侧栏" : "Collapse sidebar"}
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      <div className="px-2.5 pb-2 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              aria-current={active ? "page" : undefined}
              className={`ui-nav-item ${active ? "ui-nav-active" : "ui-nav-idle"}`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-2.5 pt-2 space-y-0.5 border-t border-[#e7e4de]">
        <div className="flex items-center justify-between px-2.5 py-1.5 mb-0.5">
          <span className="text-[11px] font-medium text-[#a39e97]">{isZh ? "备考科目" : "Courses"}</span>
          <span className="ui-chip tabular-nums">{plans.length}</span>
        </div>

        {plans.map((p) => {
          const isActivePlan = activePlan?.id === p.id && currentTab === "course";

          return (
            <div
              key={p.id}
              className={`group flex items-center justify-between w-full rounded-lg transition-all ${
                isActivePlan ? "bg-white shadow-[0_1px_2px_rgba(28,27,26,0.08)]" : "hover:bg-black/[0.04]"
              }`}
            >
              <button
                onClick={() => {
                  onSelectPlan(p.id);
                  onTabChange("course", p.id);
                }}
                className="flex-1 flex items-center gap-2.5 px-2.5 py-2 text-left truncate cursor-pointer min-w-0 rounded-lg"
              >
                {/* 科目身份在侧栏就是页面图标，和详情页页头取同一个值，不再另配一套色点。 */}
                <PageIconGlyph plan={p} className="w-4 text-center text-[13px]" />
                <span className={`flex-1 truncate text-[13px] ${isActivePlan ? "font-medium text-[#1c1b1a]" : "text-[#6b6660]"}`}>
                  {p.examName}
                </span>
              </button>

              {(onRequestDeletePlan || onDeletePlan) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onRequestDeletePlan) {
                      onRequestDeletePlan(p);
                    } else if (onDeletePlan) {
                      onDeletePlan(p.id);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 p-2 mr-1 text-[#a39e97] hover:text-[#B42318] transition-all shrink-0 cursor-pointer rounded-md"
                  title={isZh ? "删除此科目" : "Delete subject"}
                  aria-label={isZh ? `删除科目 ${p.examName}` : `Delete subject ${p.examName}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}

        {plans.length === 0 && (
          <p className="text-[12px] text-[#a39e97] px-2.5 py-1.5">{isZh ? "暂无科目" : "No subjects yet"}</p>
        )}

        <button
          onClick={onNewPlan}
          className="ui-nav-item mt-1 border border-dashed border-[#d8d4cc] text-[#6b6660] hover:border-[#bdb8ae] hover:bg-black/[0.02]"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span className="flex-1 truncate">{isZh ? "新建科目" : "New subject"}</span>
        </button>
      </div>

      <div className="p-2.5 border-t border-[#e7e4de]">
        <button
          onClick={() => onTabChange("settings")}
          aria-current={currentTab === "settings" ? "page" : undefined}
          className={`ui-nav-item ${currentTab === "settings" ? "ui-nav-active" : "ui-nav-idle"}`}
        >
          <Settings className="w-4 h-4 shrink-0" />
          <span className="flex-1 truncate">{isZh ? "设置" : "Settings"}</span>
        </button>
      </div>
    </aside>
  );
}