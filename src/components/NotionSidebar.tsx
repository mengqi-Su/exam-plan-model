import React from "react";
import { 
  BookOpen, 
  Calendar, 
  CheckSquare, 
  ChevronRight, 
  FileText, 
  Folder, 
  GraduationCap, 
  Plus, 
  Search, 
  Settings, 
  Sparkles, 
  Trash2, 
  Zap, 
  PanelLeftClose, 
  PanelLeft, 
  ExternalLink, 
  Download, 
  RefreshCw,
  Star,
  Clock,
  HelpCircle,
  Languages
} from "lucide-react";
import { ExamStudyPlan } from "../types";
import { downloadICSFile } from "../lib/calendarExport";
import { useI18n } from "../lib/i18n";

interface NotionSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  plans: ExamStudyPlan[];
  activePlan: ExamStudyPlan | null;
  onSelectPlan: (planId: string) => void;
  onNewPlan: () => void;
  currentTab: "todo" | "calendar" | "realtime" | "course" | "materials" | "add_subject";
  onTabChange: (tab: "todo" | "calendar" | "realtime" | "course" | "materials" | "add_subject") => void;
  onOpenRebalanceModal: () => void;
}

export function NotionSidebar({
  isOpen,
  onToggle,
  plans,
  activePlan,
  onSelectPlan,
  onNewPlan,
  currentTab,
  onTabChange,
  onOpenRebalanceModal,
}: NotionSidebarProps) {
  const { t, language, setLanguage } = useI18n();

  if (!isOpen) {
    return (
      <div className="fixed top-3 left-3 z-40">
        <button
          onClick={onToggle}
          className="p-1.5 rounded-md hover:bg-[#efefed] text-[#787774] hover:text-[#37352f] transition-colors border border-[#e9e9e7] bg-white shadow-xs"
          title="Open Notion Sidebar"
        >
          <PanelLeft className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <aside className="w-64 bg-[#f7f6f3] border-r border-[#e9e9e7] flex flex-col h-screen fixed top-0 left-0 z-40 select-none text-[13px] text-[#37352f]">
      {/* Workspace Header */}
      <div className="p-3.5 flex items-center justify-between border-b border-[#e9e9e7]">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-6 h-6 rounded bg-[#37352f] text-white flex items-center justify-center text-xs font-bold shrink-0">
            EP
          </div>
          <div className="min-w-0">
            <span className="font-semibold text-xs text-[#37352f] block truncate">
              {t("appName")}
            </span>
            <span className="text-[11px] text-[#787774] block truncate">
              {t("appSubtitle")}
            </span>
          </div>
        </div>

        <button
          onClick={onToggle}
          className="p-1 rounded hover:bg-[#efefed] text-[#787774] hover:text-[#37352f] transition-colors"
          title="Collapse Sidebar"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Navigation / Primary Views */}
      <div className="px-2 py-3 space-y-0.5 border-b border-[#e9e9e7]">
        <button
          onClick={() => onTabChange("todo")}
          className={`w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-md text-left transition-colors ${
            currentTab === "todo"
              ? "bg-[#efefed] font-semibold text-[#37352f]"
              : "hover:bg-[#efefed] text-[#5a5a57]"
          }`}
        >
          <CheckSquare className="w-4 h-4 text-[#787774]" />
          <span className="flex-1 truncate">{t("tabTodo")}</span>
        </button>

        <button
          onClick={() => onTabChange("calendar")}
          className={`w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-md text-left transition-colors ${
            currentTab === "calendar"
              ? "bg-[#efefed] font-semibold text-[#37352f]"
              : "hover:bg-[#efefed] text-[#5a5a57]"
          }`}
        >
          <Calendar className="w-4 h-4 text-[#787774]" />
          <span className="flex-1 truncate">{t("tabCalendar")}</span>
        </button>

        <button
          onClick={() => onTabChange("realtime")}
          className={`w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-md text-left transition-colors ${
            currentTab === "realtime"
              ? "bg-[#efefed] font-semibold text-[#37352f]"
              : "hover:bg-[#efefed] text-[#5a5a57]"
          }`}
        >
          <Zap className="w-4 h-4 text-[#cb912f]" />
          <span className="flex-1 truncate">{t("tabRealtime")}</span>
        </button>

        <button
          onClick={() => onTabChange("course")}
          className={`w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-md text-left transition-colors ${
            currentTab === "course"
              ? "bg-[#efefed] font-semibold text-[#37352f]"
              : "hover:bg-[#efefed] text-[#5a5a57]"
          }`}
        >
          <GraduationCap className="w-4 h-4 text-[#2b78a0]" />
          <span className="flex-1 truncate">{t("tabCourse")}</span>
        </button>

        <button
          onClick={() => onTabChange("materials")}
          className={`w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-md text-left transition-colors ${
            currentTab === "materials"
              ? "bg-[#efefed] font-semibold text-[#37352f]"
              : "hover:bg-[#efefed] text-[#5a5a57]"
          }`}
        >
          <BookOpen className="w-4 h-4 text-[#9065b0]" />
          <span className="flex-1 truncate">{t("tabMaterials")}</span>
        </button>
      </div>

      {/* Exam Study Plans Tree */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        <div className="flex items-center justify-between px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#9b9a97]">
          <span>{t("examPlans")}</span>
          <button
            onClick={onNewPlan}
            className="p-0.5 rounded hover:bg-[#e9e9e7] text-[#787774] hover:text-[#37352f]"
            title={t("addNewPlan")}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {plans.map((p) => {
          const isSelected = activePlan?.id === p.id;
          const completedCount = p.tasks.filter((t) => t.status === "completed").length;
          const totalCount = p.tasks.length;
          const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

          return (
            <button
              key={p.id}
              onClick={() => onSelectPlan(p.id)}
              className={`w-full group flex items-start space-x-2 px-2.5 py-1.5 rounded-md text-left transition-colors ${
                isSelected
                  ? "bg-[#efefed] text-[#37352f] font-medium"
                  : "hover:bg-[#efefed] text-[#5a5a57]"
              }`}
            >
              <span className="text-sm shrink-0 mt-0.5">🎓</span>
              <div className="flex-1 min-w-0">
                <span className="block truncate text-xs">{p.examName}</span>
                <div className="flex items-center space-x-1.5 text-[10px] text-[#9b9a97] mt-0.5">
                  <span className="truncate">{p.subject}</span>
                  <span>•</span>
                  <span>{progressPercent}%</span>
                </div>
              </div>
            </button>
          );
        })}

        <button
          onClick={onNewPlan}
          className={`w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-md text-left transition-colors text-xs ${
            currentTab === "add_subject"
              ? "bg-[#37352f] text-white font-semibold shadow-xs"
              : "text-[#787774] hover:bg-[#efefed] hover:text-[#37352f]"
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{language === "zh" ? "添加新考试科目" : "Add Exam Subject"}</span>
        </button>
      </div>

      {/* Language Switcher & Sidebar Footer Actions */}
      <div className="p-3 border-t border-[#e9e9e7] space-y-1.5 text-xs bg-[#f7f6f3]">
        {/* Language selector toggle */}
        <button
          onClick={() => setLanguage(language === "zh" ? "en" : "zh")}
          className="w-full flex items-center justify-between px-2 py-1.5 rounded text-[#5a5a57] hover:bg-[#efefed] transition-colors"
        >
          <span className="flex items-center space-x-2">
            <Languages className="w-3.5 h-3.5 text-[#787774]" />
            <span>{language === "zh" ? "语言 / Language" : "Language / 语言"}</span>
          </span>
          <span className="font-semibold text-[11px] px-1.5 py-0.5 rounded bg-[#e9e9e7] text-[#37352f]">
            {language === "zh" ? "中文" : "English"}
          </span>
        </button>

        {activePlan && (
          <>
            <button
              onClick={onOpenRebalanceModal}
              className="w-full flex items-center space-x-2 px-2 py-1.5 rounded text-[#937264] hover:bg-[#f4eeee] transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{t("adaptiveRebalance")}</span>
            </button>

            <button
              onClick={() => downloadICSFile(activePlan)}
              className="w-full flex items-center space-x-2 px-2 py-1.5 rounded text-[#448361] hover:bg-[#edf3ec] transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t("exportICS")}</span>
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
