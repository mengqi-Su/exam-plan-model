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
              <span>{language === "zh" ? "新建科目" : "Add Exam Subject & Plan"}</span>
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
              <span>{language === "zh" ? "总览看板" : "Master Study Hub"}</span>
            </span>
          </div>
        ) : currentTab === "master_calendar" ? (
          <div className="flex items-center space-x-2 truncate">
            <button
              onClick={() => onTabChange("dashboard")}
              className="hover:text-[#37352f] transition-colors"
            >
              {t("workspace")}
            </button>
            <span>/</span>
            <span className="font-medium text-[#37352f] truncate flex items-center space-x-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#2b78a0]" />
              <span>{language === "zh" ? "全科日历" : "Master Calendar"}</span>
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
          {currentTab !== "dashboard" && currentTab !== "master_calendar" && activePlan && (
            <button
              onClick={onOpenRebalanceModal}
              className="flex items-center space-x-1 px-2.5 py-1 text-[#937264] hover:bg-[#f4eeee] rounded text-xs transition-colors border border-[#e8dedc]"
              title="Dynamically adjust and rebalance study schedule"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t("adaptiveRebalance")}</span>
            </button>
          )}

          <button
            onClick={onNewPlan}
            className="flex items-center space-x-1.5 px-2.5 py-1 text-[#37352f] bg-[#efefed] hover:bg-[#e3e2e0] rounded text-xs transition-colors font-medium shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{language === "zh" ? "新建科目" : t("newPlan")}</span>
          </button>

          {/* Language Switcher Button */}
          <button
            onClick={() => onOpenSettings ? onOpenSettings("language") : setLanguage(language === "zh" ? "en" : "zh")}
            className="flex items-center space-x-1 px-2 py-1 text-[#5a5a57] hover:bg-[#efefed] hover:text-[#37352f] rounded text-xs transition-colors border border-[#e9e9e7]"
            title="Adjust Language / 切换语言"
          >
            <Languages className="w-3.5 h-3.5 text-[#787774]" />
            <span className="font-semibold text-[11px]">{language === "zh" ? "中" : "EN"}</span>
          </button>

          {/* Settings & Configuration Button */}
          {onOpenSettings && (
            <button
              onClick={() => onOpenSettings("general")}
              className="p-1.5 text-[#5a5a57] hover:bg-[#efefed] hover:text-[#37352f] rounded text-xs transition-colors border border-[#e9e9e7]"
              title={t("settingsTitle")}
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}

          {/* User Account & Login Profile Button */}
          {onOpenSettings && userProfile && (
            <button
              onClick={() => onOpenSettings("account")}
              className={`flex items-center space-x-1.5 pl-1.5 pr-2.5 py-1 rounded text-xs transition-all border ${
                userProfile.isLoggedIn
                  ? "bg-[#faf9f6] border-[#e9e9e7] hover:border-[#37352f] text-[#37352f]"
                  : "bg-[#37352f] text-white border-[#37352f]"
              }`}
              title={userProfile.isLoggedIn ? userProfile.name : t("userLoginBtn")}
            >
              <span className="text-xs">{userProfile.isLoggedIn ? (userProfile.avatar || "🎓") : "👤"}</span>
              <span className="font-medium max-w-[80px] sm:max-w-[110px] truncate text-[11px]">
                {userProfile.isLoggedIn ? userProfile.name.split(" ")[0] : t("userLoginBtn")}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Notion Page Cover Banner & Single-Course Properties Header: Only shown on Course-specific tabs */}
      {currentTab !== "dashboard" && currentTab !== "master_calendar" && (
        <>
          {/* Notion Page Cover Banner */}
          <div className="h-32 sm:h-40 w-full bg-gradient-to-r from-[#f7f6f3] via-[#faece3] to-[#e7f3f8] relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(#e9e9e7_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />
          </div>

          {/* Notion Page Content Header: Title, Notion Properties */}
          <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-4 pb-4">
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
                    {(activePlan.preferences?.studyPace || "spaced_repetition").replace(/_/g, " ")}
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
                    {activePlan.preferences?.targetScoreOrGrade || "Target Grade A"}
                  </span>
                </div>

                {/* Weak Areas Focus */}
                {activePlan.preferences?.weakTopicsFocus && activePlan.preferences.weakTopicsFocus.length > 0 && (
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

            {/* Course Sub-View Navigation Segment */}
            <div className="mt-4 pt-2 border-t border-[#e9e9e7] flex items-center justify-between overflow-x-auto no-scrollbar">
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => onTabChange("todo")}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    currentTab === "todo"
                      ? "bg-[#37352f] text-white shadow-xs"
                      : "text-[#5a5a57] hover:bg-[#efefed] hover:text-[#37352f]"
                  }`}
                >
                  <CheckCircle2 className={`w-3.5 h-3.5 ${currentTab === "todo" ? "text-white" : "text-[#448361]"}`} />
                  <span>{language === "zh" ? "每日待办" : "Daily Checklist"}</span>
                  {activePlan && (
                    <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${currentTab === "todo" ? "bg-white/20 text-white" : "bg-[#e9e9e7] text-[#5a5a57]"}`}>
                      {activePlan.tasks.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => onTabChange("realtime")}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    currentTab === "realtime"
                      ? "bg-[#37352f] text-white shadow-xs"
                      : "text-[#5a5a57] hover:bg-[#efefed] hover:text-[#37352f]"
                  }`}
                >
                  <BarChart3 className={`w-3.5 h-3.5 ${currentTab === "realtime" ? "text-white" : "text-[#cb912f]"}`} />
                  <span>{language === "zh" ? "进度追踪" : "Progress Tracker"}</span>
                </button>

                <button
                  onClick={() => onTabChange("course")}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    currentTab === "course" || currentTab === "materials"
                      ? "bg-[#37352f] text-white shadow-xs"
                      : "text-[#5a5a57] hover:bg-[#efefed] hover:text-[#37352f]"
                  }`}
                >
                  <GraduationCap className={`w-3.5 h-3.5 ${currentTab === "course" || currentTab === "materials" ? "text-white" : "text-[#2b78a0]"}`} />
                  <span>{language === "zh" ? "考纲资料" : "Knowledge Base"}</span>
                  {activePlan && (
                    <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${currentTab === "course" || currentTab === "materials" ? "bg-white/20 text-white" : "bg-[#e9e9e7] text-[#5a5a57]"}`}>
                      {(activePlan.topics?.length || 0) + (activePlan.materials?.length || 0)}
                    </span>
                  )}
                </button>
              </div>

              {/* Quick Search */}
              <div className="relative my-0.5 hidden sm:block">
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
          </div>
        </>
      )}
    </div>
  );
}
