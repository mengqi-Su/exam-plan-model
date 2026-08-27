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
import { FlipCountdown } from "./FlipCountdown";
import { getPaletteByString } from "../lib/themePalettes";

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

  const [countdown, setCountdown] = React.useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  React.useEffect(() => {
    if (!activePlan?.examDate) return;
    const calculateCountdown = () => {
      const targetStr = `${activePlan.examDate}T${activePlan.examTime || "09:00"}:00`;
      const target = new Date(targetStr).getTime();
      const now = new Date().getTime();
      const diff = target - now;

      if (diff > 0) {
        setCountdown({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((diff % (1000 * 60)) / 1000),
        });
      } else {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    calculateCountdown();
    const interval = setInterval(calculateCountdown, 1000);
    return () => clearInterval(interval);
  }, [activePlan?.examDate, activePlan?.examTime]);

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
        </div>
      </div>

      {currentTab !== "dashboard" && currentTab !== "master_calendar" && (
        <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-7 pb-5 space-y-6">

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 font-mono">
            <div className="space-y-2">
              <div className="flex items-center space-x-2.5">
                {activePlan && (
                  <span
                    className="w-3.5 h-3.5 border border-[#111111] shrink-0 inline-block"
                    style={{ backgroundColor: getPaletteByString(activePlan.id || activePlan.examName).accentColor }}
                  />
                )}
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111111] font-sans">
                  {activePlan?.examName || t("untitledPlan")}
                </h1>
              </div>
              {activePlan?.examDate && (
                <div className="text-xs text-[#666666] font-mono flex items-center space-x-2.5">
                  <span className="text-[#888888] uppercase">[{language === "zh" ? "考试时间" : "EXAM"}]</span>
                  <strong className="text-[#111111] bg-[#f5f5f5] px-2.5 py-0.5 border border-[#e5e5e5]">
                    {activePlan.examDate} {activePlan.examTime || "09:00"}
                  </strong>
                  <span className="text-[#888888]">({activePlan.subject || (language === "zh" ? "学科" : "Course")})</span>
                </div>
              )}
            </div>

            {activePlan?.examDate && (
              <FlipCountdown
                days={countdown.days}
                hours={countdown.hours}
                minutes={countdown.minutes}
                seconds={countdown.seconds}
                language={language}
              />
            )}
          </div>

          <div className="pt-3 border-t border-[#111111] flex items-center justify-between overflow-x-auto no-scrollbar font-sans text-xs">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => onTabChange("todo")}
                className={`flex items-center space-x-2 px-3.5 py-2 transition-all cursor-pointer border ${
                  currentTab === "todo"
                    ? "bg-[#111111] text-white border-[#111111] font-bold"
                    : "border-transparent text-[#666666] hover:text-[#111111] hover:border-[#dedad1]"
                }`}
              >
                <span className="font-mono text-[10px] opacity-70">01</span>
                <span>{language === "zh" ? "每日待办" : "DAILY TO-DO"}</span>
              </button>

              <button
                onClick={() => onTabChange("realtime")}
                className={`flex items-center space-x-2 px-3.5 py-2 transition-all cursor-pointer border ${
                  currentTab === "realtime"
                    ? "bg-[#111111] text-white border-[#111111] font-bold"
                    : "border-transparent text-[#666666] hover:text-[#111111] hover:border-[#dedad1]"
                }`}
              >
                <span className="font-mono text-[10px] opacity-70">02</span>
                <span>{language === "zh" ? "进度追踪" : "TRACKER"}</span>
              </button>

              <button
                onClick={() => onTabChange("course")}
                className={`flex items-center space-x-2 px-3.5 py-2 transition-all cursor-pointer border ${
                  currentTab === "course" || currentTab === "materials"
                    ? "bg-[#111111] text-white border-[#111111] font-bold"
                    : "border-transparent text-[#666666] hover:text-[#111111] hover:border-[#dedad1]"
                }`}
              >
                <span className="font-mono text-[10px] opacity-70">03</span>
                <span>{language === "zh" ? "考纲资料" : "KNOWLEDGE"}</span>
              </button>
            </div>

            <div className="relative my-0.5 hidden sm:block">
              <Search className="w-3.5 h-3.5 text-[#888888] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={language === "zh" ? "搜索任务考点..." : "SEARCH TASKS..."}
                className="pl-8 pr-3 py-1.5 bg-white border border-[#dedad1] focus:border-[#111111] text-xs font-sans text-[#111111] placeholder-[#888888] focus:outline-none w-44 transition-all"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
