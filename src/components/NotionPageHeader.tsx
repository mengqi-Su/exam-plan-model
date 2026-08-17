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
  LayoutDashboard
} from "lucide-react";
import { ExamStudyPlan } from "../types";
import { downloadICSFile } from "../lib/calendarExport";
import { useI18n } from "../lib/i18n";

interface NotionPageHeaderProps {
  activePlan: ExamStudyPlan | null;
  currentTab: "dashboard" | "todo" | "calendar" | "realtime" | "course" | "materials" | "add_subject";
  onTabChange: (tab: "dashboard" | "todo" | "calendar" | "realtime" | "course" | "materials" | "add_subject") => void;
  onOpenRebalanceModal: () => void;
  onNewPlan: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function NotionPageHeader({
  activePlan,
  currentTab,
  onTabChange,
  onOpenRebalanceModal,
  onNewPlan,
  searchQuery,
  onSearchChange,
}: NotionPageHeaderProps) {
  const { t, language } = useI18n();

  if (currentTab === "add_subject") {
    return (
      <div className="w-full bg-white border-b border-[#e9e9e7]">
        <div className="h-11 px-4 sm:px-8 flex items-center justify-between text-xs text-[#787774]">
          <div className="flex items-center space-x-2 truncate">
            <button
              onClick={() => onTabChange("todo")}
              className="hover:text-[#37352f] transition-colors"
            >
              {t("workspace")}
            </button>
            <span>/</span>
            <button
              onClick={() => onTabChange("todo")}
              className="hover:text-[#37352f] transition-colors"
            >
              {t("examPlans")}
            </button>
            <span>/</span>
            <span className="font-medium text-[#37352f] truncate flex items-center space-x-1.5">
              <Plus className="w-3.5 h-3.5" />
              <span>{language === "zh" ? "添加新考试科目与智能备考" : "Add Exam Subject & Plan"}</span>
            </span>
          </div>

          {activePlan && (
            <button
              onClick={() => onTabChange("todo")}
              className="text-xs text-[#787774] hover:text-[#37352f] hover:underline transition-colors"
            >
              {language === "zh" ? `返回：${activePlan.examName}` : `Back to: ${activePlan.examName}`}
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
    <div className="w-full bg-white border-b border-[#e9e9e7]">
      {/* Notion Top Breadcrumbs Bar */}
      <div className="h-11 px-4 sm:px-8 flex items-center justify-between border-b border-[#e9e9e7] text-xs text-[#787774]">
        {currentTab === "dashboard" ? (
          <div className="flex items-center space-x-2 truncate">
            <span className="hover:text-[#37352f] cursor-pointer transition-colors">{t("workspace")}</span>
            <span>/</span>
            <span className="font-medium text-[#37352f] truncate flex items-center space-x-1.5">
              <LayoutDashboard className="w-3.5 h-3.5 text-[#2b78a0]" />
              <span>{language === "zh" ? "全学科备考总览主看板" : "Master Study Hub"}</span>
            </span>
          </div>
        ) : (
          <div className="flex items-center space-x-2 truncate">
            <button
              onClick={() => onTabChange("dashboard")}
              className="hover:text-[#37352f] transition-colors"
            >
              {t("workspace")}
            </button>
            <span>/</span>
            <button
              onClick={() => onTabChange("dashboard")}
              className="hover:text-[#37352f] transition-colors"
            >
              {t("examPlans")}
            </button>
            <span>/</span>
            <span className="font-medium text-[#37352f] truncate flex items-center space-x-1.5">
              <GraduationCap className="w-3.5 h-3.5" />
              <span>{activePlan?.examName || t("untitledPlan")}</span>
            </span>
          </div>
        )}

        <div className="flex items-center space-x-1 sm:space-x-2">
          {currentTab !== "dashboard" && activePlan && (
            <>
              <button
                onClick={onOpenRebalanceModal}
                className="flex items-center space-x-1 px-2.5 py-1 text-[#937264] hover:bg-[#f4eeee] rounded text-xs transition-colors border border-[#e8dedc]"
                title="Dynamically adjust and rebalance study schedule"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t("adaptiveRebalance")}</span>
              </button>

              <button
                onClick={() => downloadICSFile(activePlan)}
                className="flex items-center space-x-1 px-2.5 py-1 text-[#448361] hover:bg-[#edf3ec] rounded text-xs transition-colors border border-[#d5e5d3]"
                title="Export .ics calendar sync file"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t("exportICS")}</span>
              </button>
            </>
          )}

          <button
            onClick={onNewPlan}
            className="flex items-center space-x-1.5 px-2.5 py-1 text-[#37352f] bg-[#efefed] hover:bg-[#e3e2e0] rounded text-xs transition-colors font-medium shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{language === "zh" ? "添加新科目" : t("newPlan")}</span>
          </button>
        </div>
      </div>

      {/* Notion Page Cover Banner & Single-Course Properties Header: Only shown on Course-specific tabs */}
      {currentTab !== "dashboard" && (
        <>
          {/* Notion Page Cover Banner */}
          <div className="h-32 sm:h-40 w-full bg-gradient-to-r from-[#f7f6f3] via-[#faece3] to-[#e7f3f8] relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(#e9e9e7_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />
          </div>

          {/* Notion Page Content Header: Floating Icon, Title, Notion Properties */}
          <div className="max-w-6xl mx-auto px-4 sm:px-8 -mt-9 pb-4">
            {/* Floating Page Icon */}
            <div className="w-16 h-16 rounded-xl bg-white border border-[#e9e9e7] shadow-sm flex items-center justify-center select-none mb-3">
              <GraduationCap className="w-8 h-8 text-[#37352f]" />
            </div>

            {/* Title */}
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-[#37352f]">
              {activePlan?.examName || t("untitledPlan")}
            </h1>

            {/* Notion Page Properties Table */}
            {activePlan && (
              <div className="mt-4 pt-3 border-t border-[#e9e9e7] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-2 gap-x-6 text-xs">
                {/* Subject Property */}
                <div className="flex items-center space-x-2">
                  <span className="w-28 text-[#787774] flex items-center space-x-1.5 shrink-0">
                    <FileText className="w-3.5 h-3.5" />
                    <span>{t("propSubject")}</span>
                  </span>
                  <span className="notion-tag-blue px-2 py-0.5 rounded text-[11px] font-medium truncate">
                    {activePlan.subject || "General"}
                  </span>
                </div>

                {/* Exam Date Property */}
                <div className="flex items-center space-x-2">
                  <span className="w-28 text-[#787774] flex items-center space-x-1.5 shrink-0">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{t("propExamDate")}</span>
                  </span>
                  <div className="flex items-center space-x-1.5">
                    <span className="font-medium text-[#37352f]">
                      {activePlan.examDate}
                    </span>
                    {daysRemaining !== null && (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          daysRemaining <= 3
                            ? "notion-tag-red"
                            : daysRemaining <= 7
                            ? "notion-tag-orange"
                            : "notion-tag-green"
                        }`}
                      >
                        {daysRemaining < 0
                          ? t("examPast")
                          : daysRemaining === 0
                          ? t("examToday")
                          : `${daysRemaining} ${t("daysLeft")}`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Pace Property */}
                <div className="flex items-center space-x-2">
                  <span className="w-28 text-[#787774] flex items-center space-x-1.5 shrink-0">
                    <Zap className="w-3.5 h-3.5" />
                    <span>{t("propStudyPace")}</span>
                  </span>
                  <span className="notion-tag-purple px-2 py-0.5 rounded text-[11px] font-medium capitalize">
                    {activePlan.preferences.studyPace.replace("_", " ")}
                  </span>
                </div>

                {/* Readiness / Progress */}
                <div className="flex items-center space-x-2">
                  <span className="w-28 text-[#787774] flex items-center space-x-1.5 shrink-0">
                    <Target className="w-3.5 h-3.5" />
                    <span>{t("propProgress")}</span>
                  </span>
                  <div className="flex items-center space-x-2 flex-1">
                    <div className="w-20 h-2 bg-[#efefed] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#448361] transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <span className="text-[#5a5a57] font-medium text-[11px]">
                      {progressPercent}% ({completedTasks}/{totalTasks})
                    </span>
                  </div>
                </div>

                {/* Target Score */}
                <div className="flex items-center space-x-2">
                  <span className="w-28 text-[#787774] flex items-center space-x-1.5 shrink-0">
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>{t("propTargetScore")}</span>
                  </span>
                  <span className="notion-tag-yellow px-2 py-0.5 rounded text-[11px] font-medium">
                    {activePlan.preferences.targetScoreOrGrade || "Target Grade A"}
                  </span>
                </div>

                {/* Weak Areas Focus */}
                {activePlan.preferences.weakTopicsFocus && activePlan.preferences.weakTopicsFocus.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <span className="w-28 text-[#787774] flex items-center space-x-1.5 shrink-0">
                      <Target className="w-3.5 h-3.5" />
                      <span>{t("propWeakFocus")}</span>
                    </span>
                    <div className="flex items-center space-x-1 truncate">
                      {activePlan.preferences.weakTopicsFocus.slice(0, 2).map((w, idx) => (
                        <span key={idx} className="notion-tag-red px-1.5 py-0.5 rounded text-[10px] font-medium truncate">
                          {w}
                        </span>
                      ))}
                      {activePlan.preferences.weakTopicsFocus.length > 2 && (
                        <span className="text-[#9b9a97] text-[10px]">
                          +{activePlan.preferences.weakTopicsFocus.length - 2}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Notion Database Views Tab Strip: Only shown on Course-specific tabs */}
      {currentTab !== "dashboard" && (
        <div className="max-w-6xl mx-auto px-4 sm:px-8 flex items-center justify-between border-t border-[#e9e9e7] overflow-x-auto no-scrollbar">
          <div className="flex space-x-1 py-1">
            <button
              onClick={() => onTabChange("dashboard")}
              className="flex items-center space-x-1.5 px-3 py-2 text-xs font-medium rounded-md whitespace-nowrap transition-colors text-[#787774] hover:text-[#37352f] hover:bg-[#f7f6f3]"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-[#2b78a0]" />
              <span>{t("tabDashboard")}</span>
            </button>

            <button
              onClick={() => onTabChange("todo")}
              className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                currentTab === "todo"
                  ? "bg-[#efefed] text-[#37352f] shadow-xs"
                  : "text-[#787774] hover:text-[#37352f] hover:bg-[#f7f6f3]"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-[#448361]" />
              <span>{t("tabTodo")}</span>
              {activePlan && (
                <span className="ml-1 px-1.5 py-0.2 bg-[#e9e9e7] text-[#5a5a57] rounded-full text-[10px]">
                  {activePlan.tasks.length}
                </span>
              )}
            </button>

            <button
              onClick={() => onTabChange("calendar")}
              className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                currentTab === "calendar"
                  ? "bg-[#efefed] text-[#37352f] shadow-xs"
                  : "text-[#787774] hover:text-[#37352f] hover:bg-[#f7f6f3]"
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-[#2b78a0]" />
              <span>{t("tabCalendar")}</span>
            </button>

            <button
              onClick={() => onTabChange("realtime")}
              className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                currentTab === "realtime"
                  ? "bg-[#efefed] text-[#37352f] shadow-xs"
                  : "text-[#787774] hover:text-[#37352f] hover:bg-[#f7f6f3]"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-[#cb912f]" />
              <span>{t("tabRealtime")}</span>
            </button>

            <button
              onClick={() => onTabChange("course")}
              className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                currentTab === "course" || currentTab === "materials"
                  ? "bg-[#efefed] text-[#37352f] shadow-xs"
                  : "text-[#787774] hover:text-[#37352f] hover:bg-[#f7f6f3]"
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5 text-[#2b78a0]" />
              <span>{t("tabCourse")}</span>
              {activePlan && (
                <span className="ml-1 px-1.5 py-0.2 bg-[#e9e9e7] text-[#5a5a57] rounded-full text-[10px]">
                  {(activePlan.topics?.length || 0) + (activePlan.materials?.length || 0)}
                </span>
              )}
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative my-1 hidden sm:block">
            <Search className="w-3.5 h-3.5 text-[#9b9a97] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="pl-8 pr-3 py-1 bg-[#f7f6f3] border border-[#e9e9e7] hover:border-[#dfdfde] focus:border-[#2b78a0] focus:bg-white rounded-md text-xs text-[#37352f] placeholder-[#9b9a97] focus:outline-none w-44 transition-all"
            />
          </div>
        </div>
      )}
    </div>
  );
}
