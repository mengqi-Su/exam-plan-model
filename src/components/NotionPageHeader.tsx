import React from "react";
import { 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Download, 
  ExternalLink, 
  FileText, 
  GraduationCap, 
  MoreHorizontal, 
  Plus, 
  RefreshCw, 
  Search, 
  Share2, 
  Sparkles, 
  Star, 
  Target, 
  Zap,
  Layers,
  BarChart3,
  LayoutDashboard,
  Settings,
  User,
  Languages,
  Info
} from "lucide-react";
import { ExamStudyPlan, UserProfile } from "../types";
import { downloadICSFile } from "../lib/calendarExport";
import { useI18n } from "../lib/i18n";
import { APP_VERSION_DATA } from "../lib/storage";

interface NotionPageHeaderProps {
  activePlan: ExamStudyPlan | null;
  currentTab: "dashboard" | "master_calendar" | "todo" | "realtime" | "course" | "materials" | "add_subject";
  onTabChange: (tab: "dashboard" | "master_calendar" | "todo" | "realtime" | "course" | "materials" | "add_subject") => void;
  onOpenRebalanceModal: () => void;
  onNewPlan: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  userProfile?: UserProfile;
  onOpenSettings?: (tab?: "general" | "account" | "language" | "version") => void;
}

export function NotionPageHeader({
  activePlan,
  currentTab,
  onTabChange,
  onOpenRebalanceModal,
  onNewPlan,
  searchQuery,
  onSearchChange,
  userProfile,
  onOpenSettings,
}: NotionPageHeaderProps) {
  const { t, language, setLanguage } = useI18n();

  if (currentTab === "add_subject") {
    return (
      <div className="w-full bg-white border-b border-[#111111]">
        <div className="h-11 px-4 sm:px-8 flex items-center justify-between text-xs font-mono text-[#666666]">
          <div className="flex items-center space-x-2 truncate">
            <button
              onClick={() => onTabChange("todo")}
              className="hover:text-[#111111] transition-colors"
            >
              WORKSPACE
            </button>
            <span>/</span>
            <button
              onClick={() => onTabChange("todo")}
              className="hover:text-[#111111] transition-colors"
            >
              COURSES
            </button>
            <span>/</span>
            <span className="font-bold text-[#111111] truncate flex items-center space-x-1">
              <span>[+] {language === "zh" ? "新建科目" : "NEW SUBJECT"}</span>
            </span>
          </div>

          {activePlan && (
            <button
              onClick={() => onTabChange("todo")}
              className="text-xs font-mono text-[#666666] hover:text-[#111111] transition-colors"
            >
              ← {language === "zh" ? `返回：${activePlan.examName}` : `BACK TO: ${activePlan.examName}`}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Calculate remaining days
  const daysRemaining = React.useMemo(() => {
    if (!activePlan?.examDate) return null;
    const now = new Date();
    const [y, m, d] = activePlan.examDate.split("-").map(Number);
    const examDate = new Date(y, m - 1, d);
    const diffTime = examDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [activePlan?.examDate]);

  const completedTasks = activePlan?.tasks.filter((t) => t.status === "completed").length || 0;
  const totalTasks = activePlan?.tasks.length || 0;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="w-full bg-[#faf9f6] border-b border-[#111111]">
      {/* Top Editorial Breadcrumbs Bar */}
      <div className="h-11 px-4 sm:px-8 flex items-center justify-between border-b border-[#dedad1] text-xs font-sans text-[#666666]">
        {currentTab === "dashboard" ? (
          <div className="flex items-center space-x-2 truncate">
            <span className="hover:text-[#111111] cursor-pointer transition-colors font-mono">WORKSPACE</span>
            <span>/</span>
            <span className="font-bold text-[#111111] truncate flex items-center space-x-1.5 font-sans">
              <span>[01 // {language === "zh" ? "总览看板" : "DASHBOARD"}]</span>
            </span>
          </div>
        ) : currentTab === "master_calendar" ? (
          <div className="flex items-center space-x-2 truncate">
            <button
              onClick={() => onTabChange("dashboard")}
              className="hover:text-[#111111] transition-colors font-mono"
            >
              WORKSPACE
            </button>
            <span>/</span>
            <span className="font-bold text-[#111111] truncate flex items-center space-x-1.5 font-sans">
              <span>[03 // {language === "zh" ? "全科日历" : "CALENDAR"}]</span>
            </span>
          </div>
        ) : (
          <div className="flex items-center space-x-2 truncate">
            <button
              onClick={() => onTabChange("dashboard")}
              className="hover:text-[#111111] transition-colors font-mono"
            >
              WORKSPACE
            </button>
            <span>/</span>
            <button
              onClick={() => onTabChange("dashboard")}
              className="hover:text-[#111111] transition-colors font-mono"
            >
              COURSES
            </button>
            <span>/</span>
            <span className="font-bold text-[#111111] truncate flex items-center space-x-1.5 font-sans">
              <span>[{activePlan?.examName || t("untitledPlan")}]</span>
            </span>
          </div>
        )}

        <div className="flex items-center space-x-1 sm:space-x-2 font-mono">
          {currentTab !== "dashboard" && currentTab !== "master_calendar" && activePlan && (
            <button
              onClick={onOpenRebalanceModal}
              className="flex items-center space-x-1 px-2.5 py-1 text-[#111111] hover:bg-[#111111] hover:text-white rounded-none text-xs transition-colors border border-[#111111] cursor-pointer bg-white"
              title="Dynamically adjust and rebalance study schedule"
            >
              <RefreshCw className="w-3 h-3" />
              <span className="hidden sm:inline">[{language === "zh" ? "智能重排" : "REBALANCE"}]</span>
            </button>
          )}

          <button
            onClick={onNewPlan}
            className="flex items-center space-x-1.5 px-3 py-1 text-white bg-[#111111] hover:bg-[#333333] rounded-none text-xs transition-colors font-medium cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{language === "zh" ? "新建科目" : "NEW"}</span>
          </button>

          {/* Language Switcher Button */}
          <button
            onClick={() => onOpenSettings ? onOpenSettings("language") : setLanguage(language === "zh" ? "en" : "zh")}
            className="flex items-center space-x-1 px-2 py-1 text-[#111111] hover:bg-[#e4e1d8] rounded-none text-xs transition-colors border border-[#111111] cursor-pointer bg-white"
            title="Adjust Language / 切换语言"
          >
            <span className="font-bold text-[11px]">{language === "zh" ? "ZH" : "EN"}</span>
          </button>

          {/* Settings & Configuration Button */}
          {onOpenSettings && (
            <button
              onClick={() => onOpenSettings("general")}
              className="p-1.5 text-[#111111] hover:bg-[#e4e1d8] rounded-none text-xs transition-colors border border-[#111111] cursor-pointer bg-white"
              title={t("settingsTitle")}
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Single-Course Properties Header: Only shown on Course-specific tabs */}
      {currentTab !== "dashboard" && currentTab !== "master_calendar" && (
        <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-6 pb-4">
          {/* Header Metadata Ribbon */}
          <div className="flex flex-wrap items-center gap-2 mb-2 font-mono text-[10px]">
            <span className="px-2 py-0.5 bg-[#111111] text-white uppercase font-bold tracking-wider">
              {activePlan?.subject || "COURSE"}
            </span>
            <span className="px-2 py-0.5 border border-[#111111] text-[#111111]">
              EXAM_DATE: {activePlan?.examDate || "2026-08-20"}
            </span>
            {daysRemaining !== null && (
              <span className={`px-2 py-0.5 font-bold ${daysRemaining <= 3 ? "bg-[#fef08a] text-[#111111] border border-[#111111]" : "border border-[#111111] text-[#111111]"}`}>
                {daysRemaining < 0 ? "EXAM COMPLETED" : daysRemaining === 0 ? "EXAM TODAY" : `T-${daysRemaining} DAYS`}
              </span>
            )}
            <span className="px-2 py-0.5 border border-[#e5e5e5] text-[#666666]">
              PACING: {(activePlan?.preferences?.studyPace || "spaced_repetition").toUpperCase().replace(/_/g, " ")}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111111] mb-4">
            {activePlan?.examName || t("untitledPlan")}
          </h1>

          {/* Course Sub-View Navigation Segment */}
          <div className="pt-2 border-t border-[#111111] flex items-center justify-between overflow-x-auto no-scrollbar font-mono text-xs">
            <div className="flex items-center space-x-1">
              <button
                onClick={() => onTabChange("todo")}
                className={`flex items-center space-x-1.5 px-3 py-1.5 transition-all cursor-pointer border ${
                  currentTab === "todo"
                    ? "bg-[#111111] text-white border-[#111111] font-bold"
                    : "border-transparent text-[#666666] hover:text-[#111111] hover:border-[#e5e5e5]"
                }`}
              >
                <span>[01]</span>
                <span>{language === "zh" ? "每日待办" : "DAILY TO-DO"}</span>
                {activePlan && (
                  <span className={`ml-1 text-[10px] ${currentTab === "todo" ? "text-[#fef08a]" : "text-[#888888]"}`}>
                    ({activePlan.tasks.length})
                  </span>
                )}
              </button>

              <button
                onClick={() => onTabChange("realtime")}
                className={`flex items-center space-x-1.5 px-3 py-1.5 transition-all cursor-pointer border ${
                  currentTab === "realtime"
                    ? "bg-[#111111] text-white border-[#111111] font-bold"
                    : "border-transparent text-[#666666] hover:text-[#111111] hover:border-[#e5e5e5]"
                }`}
              >
                <span>[02]</span>
                <span>{language === "zh" ? "进度追踪" : "TRACKER"}</span>
              </button>

              <button
                onClick={() => onTabChange("course")}
                className={`flex items-center space-x-1.5 px-3 py-1.5 transition-all cursor-pointer border ${
                  currentTab === "course" || currentTab === "materials"
                    ? "bg-[#111111] text-white border-[#111111] font-bold"
                    : "border-transparent text-[#666666] hover:text-[#111111] hover:border-[#e5e5e5]"
                }`}
              >
                <span>[03]</span>
                <span>{language === "zh" ? "考纲资料" : "KNOWLEDGE"}</span>
                {activePlan && (
                  <span className={`ml-1 text-[10px] ${currentTab === "course" ? "text-[#fef08a]" : "text-[#888888]"}`}>
                    ({(activePlan.topics?.length || 0) + (activePlan.materials?.length || 0)})
                  </span>
                )}
              </button>
            </div>

            {/* Quick Search */}
            <div className="relative my-0.5 hidden sm:block">
              <Search className="w-3.5 h-3.5 text-[#888888] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="SEARCH_TASKS..."
                className="pl-8 pr-3 py-1 bg-[#fafafa] border border-[#111111] focus:bg-white text-xs font-mono text-[#111111] placeholder-[#888888] focus:outline-none w-44 transition-all"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
