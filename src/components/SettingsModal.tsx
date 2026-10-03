import React, { useState } from "react";
import {
  X,
  RotateCcw,
  Download,
  Upload,
  Database,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { useI18n, Language } from "../lib/i18n";
import {
  AppSettings,
  UserProfile,
  ExamStudyPlan,
} from "../types";
import {
  APP_VERSION_DATA,
} from "../lib/storage";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "account" | "language" | "version";
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  userProfile: UserProfile;
  onUpdateUserProfile: (newProfile: UserProfile) => void;
  plans: ExamStudyPlan[];
  onImportPlans?: (importedPlans: ExamStudyPlan[]) => void;
  onResetPlans?: () => void;
  onLogout?: () => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  initialTab = "account",
  settings,
  onUpdateSettings,
  userProfile,
  onUpdateUserProfile,
  plans,
  onImportPlans,
  onResetPlans,
  onLogout,
}: SettingsModalProps) {
  const { t, language, setLanguage } = useI18n();
  const [activeTab, setActiveTab] = useState<"account" | "language" | "version">(
    (initialTab as any) === "general" ? "account" : initialTab
  );

  const [editingProfile, setEditingProfile] = useState<UserProfile>({ ...userProfile });
  const [isEditing, setIsEditing] = useState(false);

  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setNotificationMsg(msg);
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  const handleSaveProfile = () => {
    onUpdateUserProfile(editingProfile);
    setIsEditing(false);
    showToast(language === "zh" ? "个人资料已更新" : "Profile updated successfully");
  };

  const handleClearLocalData = () => {
    if (
      !window.confirm(
        language === "zh"
          ? "确定要清除本机所有备考数据吗？此操作不可恢复。"
          : "Clear all local exam data? This cannot be undone."
      )
    ) {
      return;
    }
    onLogout?.();
    showToast(language === "zh" ? "本机数据已清除" : "Local data cleared");
  };

  const handleExportJson = () => {
    const data = {
      exportDate: new Date().toISOString(),
      version: APP_VERSION_DATA.version,
      userProfile,
      settings,
      plans,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `exam-plans-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(language === "zh" ? "备份数据已成功导出" : "Backup exported successfully");
  };

  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.plans && Array.isArray(parsed.plans)) {
          onImportPlans?.(parsed.plans);
          if (parsed.settings) onUpdateSettings(parsed.settings);
          if (parsed.userProfile) onUpdateUserProfile(parsed.userProfile);
          showToast(language === "zh" ? "数据导入成功！" : "Data imported successfully!");
        } else {
          alert(language === "zh" ? "导入文件格式不匹配" : "Invalid backup file format");
        }
      } catch (err) {
        alert(language === "zh" ? "解析 JSON 失败" : "Failed to parse JSON file");
      }
    };
    reader.readAsText(file);
  };

  const totalCompletedTasks = plans.reduce(
    (acc, p) => acc + (p.tasks?.filter((t) => t.status === "completed").length || 0),
    0
  );
  const totalTasks = plans.reduce((acc, p) => acc + (p.tasks?.length || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div className="bg-white border border-[#111111] w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden text-[#111111] font-mono shadow-2xl">

        <div className="flex items-center justify-between px-6 py-4 border-b border-[#111111] bg-[#fafafa]">
          <div className="flex items-center space-x-2.5">
            <span className="px-1.5 py-0.5 bg-[#111111] text-white text-[10px] font-bold">
              [SETTINGS]
            </span>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-tight text-[#111111] flex items-center space-x-2">
                <span>{t("settingsTitle")}</span>
                <span className="text-[10px] px-1.5 py-0.2 border border-[#111111] bg-white text-[#111111]">
                  v{APP_VERSION_DATA.version}
                </span>
              </h2>
              <p className="text-[11px] text-[#666666]">
                {language === "zh"
                  ? "管理学员账号、多语言切换与系统环境"
                  : "Manage student profiles, localization, and system state"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#111111] hover:bg-[#111111] hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {notificationMsg && (
          <div className="bg-[#111111] text-white text-xs px-4 py-2 flex items-center justify-between transition-all border-b border-[#111111]">
            <span className="flex items-center space-x-1.5">
              <span>[✓]</span>
              <span>{notificationMsg}</span>
            </span>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">

          <div className="w-48 bg-[#fafafa] border-r border-[#111111] p-3 space-y-1 shrink-0 overflow-y-auto font-mono">
            <button
              onClick={() => setActiveTab("account")}
              className={`w-full flex items-center space-x-2 px-3 py-2 text-xs font-bold transition-colors text-left cursor-pointer border ${
                activeTab === "account"
                  ? "bg-[#111111] text-white border-[#111111]"
                  : "bg-white text-[#666666] border-[#e5e5e5] hover:border-[#111111] hover:text-[#111111]"
              }`}
            >
              <span className="truncate">{t("settingsTabAccount")}</span>
              {userProfile.isLoggedIn && (
                <span className="w-1.5 h-1.5 bg-[#111111] ml-auto shrink-0" />
              )}
            </button>

            <button
              onClick={() => setActiveTab("language")}
              className={`w-full flex items-center space-x-2 px-3 py-2 text-xs font-bold transition-colors text-left cursor-pointer border ${
                activeTab === "language"
                  ? "bg-[#111111] text-white border-[#111111]"
                  : "bg-white text-[#666666] border-[#e5e5e5] hover:border-[#111111] hover:text-[#111111]"
              }`}
            >
              <span className="truncate">{t("settingsTabLanguage")}</span>
              <span className="text-[10px] ml-auto">
                [{language.toUpperCase()}]
              </span>
            </button>

            <button
              onClick={() => setActiveTab("version")}
              className={`w-full flex items-center space-x-2 px-3 py-2 text-xs font-bold transition-colors text-left cursor-pointer border ${
                activeTab === "version"
                  ? "bg-[#111111] text-white border-[#111111]"
                  : "bg-white text-[#666666] border-[#e5e5e5] hover:border-[#111111] hover:text-[#111111]"
              }`}
            >
              <span className="truncate">{t("settingsTabVersion")}</span>
            </button>
          </div>

          <div className="flex-1 p-6 overflow-y-auto bg-white space-y-6 font-mono">

            {activeTab === "account" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111] mb-1">
                    {t("settingsTabAccount")}
                  </h3>
                  <p className="text-[11px] text-[#666666]">
                    {language === "zh"
                      ? "管理学员身份、登录状态与跨科目学习档案。"
                      : "Manage student account credentials, profile details, and multi-course records."}
                  </p>
                </div>

                {userProfile.isLoggedIn && (
                  <div className="p-5 border border-[#111111] bg-white space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3.5">
                        <div className="w-10 h-10 border border-[#111111] bg-[#111111] text-white flex items-center justify-center text-sm font-bold overflow-hidden">
                          {userProfile.avatar?.startsWith("http") ? (
                            <img
                              src={userProfile.avatar}
                              alt={userProfile.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            userProfile.name?.charAt(0) || "U"
                          )}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-xs uppercase text-[#111111]">
                              {userProfile.name}
                            </span>
                            <span className="px-1.5 py-0.2 text-[10px] font-bold bg-[#111111] text-white">
                              {userProfile.membershipTier || "FREE"}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#666666] mt-0.5">
                            {userProfile.email || (language === "zh" ? "本地访客（无需登录）" : "Local guest (no sign-in)")}
                          </div>
                          <div className="text-[10px] text-[#999999] mt-0.5">
                            {userProfile.institution || "Student"}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={handleClearLocalData}
                        className="flex items-center space-x-1 px-2.5 py-1 bg-white border border-[#111111] hover:bg-[#ededed] text-xs font-bold text-[#111111] transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>[{language === "zh" ? "清除本机数据" : "CLEAR LOCAL DATA"}]</span>
                      </button>
                    </div>

                    <div className="p-3 bg-[#fafafa] border border-[#111111]">
                      <div className="text-xs font-bold uppercase text-[#111111]">
                        [{language === "zh" ? "本地存储（本机浏览器）" : "LOCAL STORAGE (THIS BROWSER)"}]
                      </div>
                      <div className="text-[10px] text-[#666666] mt-0.5 leading-relaxed">
                        {language === "zh"
                          ? "数据仅保存在当前浏览器，无需登录。清除浏览器数据或更换设备会丢失，请定期在「版本」页导出备份。"
                          : "Data is saved in this browser only, no sign-in needed. Clearing browser data or switching devices will lose it. Export a backup in the Version tab."}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#111111]">
                      <div className="p-2.5 bg-white border border-[#111111]">
                        <div className="text-[10px] text-[#666666] uppercase">
                          {t("userStudyStreak")}
                        </div>
                        <div className="text-sm font-bold text-[#111111] mt-0.5">
                          {userProfile.studyStreakDays} {language === "zh" ? "天" : "DAYS"}
                        </div>
                      </div>
                      <div className="p-2.5 bg-white border border-[#111111]">
                        <div className="text-[10px] text-[#666666] uppercase">
                          {t("userTotalStudyHours")}
                        </div>
                        <div className="text-sm font-bold text-[#111111] mt-0.5">
                          {(userProfile.totalStudyMinutes / 60).toFixed(1)}h
                        </div>
                      </div>
                      <div className="p-2.5 bg-white border border-[#111111]">
                        <div className="text-[10px] text-[#666666] uppercase">
                          {language === "zh" ? "已完成" : "DONE"}
                        </div>
                        <div className="text-sm font-bold text-[#111111] mt-0.5">
                          {totalCompletedTasks}/{totalTasks}
                        </div>
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="p-4 bg-[#fafafa] border border-[#111111] space-y-3">
                        <div className="font-bold text-xs uppercase text-[#111111]">
                          {language === "zh" ? "编辑学员档案" : "EDIT PROFILE"}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] uppercase font-bold text-[#666666] block mb-1">
                              {t("userNameLabel")}
                            </label>
                            <input
                              type="text"
                              value={editingProfile.name}
                              onChange={(e) =>
                                setEditingProfile({ ...editingProfile, name: e.target.value })
                              }
                              className="w-full px-2.5 py-1.5 border border-[#111111] text-xs text-[#111111] bg-white focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase font-bold text-[#666666] block mb-1">
                              {t("userInstitutionLabel")}
                            </label>
                            <input
                              type="text"
                              value={editingProfile.institution || ""}
                              onChange={(e) =>
                                setEditingProfile({ ...editingProfile, institution: e.target.value })
                              }
                              className="w-full px-2.5 py-1.5 border border-[#111111] text-xs text-[#111111] bg-white focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase font-bold text-[#666666] block mb-1">
                              {t("userMajorLabel")}
                            </label>
                            <input
                              type="text"
                              value={editingProfile.major || ""}
                              onChange={(e) =>
                                setEditingProfile({ ...editingProfile, major: e.target.value })
                              }
                              className="w-full px-2.5 py-1.5 border border-[#111111] text-xs text-[#111111] bg-white focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase font-bold text-[#666666] block mb-1">
                              {t("userTargetGoalLabel")}
                            </label>
                            <input
                              type="text"
                              value={editingProfile.targetDegreeOrGoal || ""}
                              onChange={(e) =>
                                setEditingProfile({
                                  ...editingProfile,
                                  targetDegreeOrGoal: e.target.value,
                                })
                              }
                              className="w-full px-2.5 py-1.5 border border-[#111111] text-xs text-[#111111] bg-white focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end space-x-2 pt-2">
                          <button
                            onClick={() => setIsEditing(false)}
                            className="px-3 py-1 text-xs border border-[#111111] bg-white text-[#111111] hover:bg-[#ededed] font-bold cursor-pointer"
                          >
                            [{t("cancel")}]
                          </button>
                          <button
                            onClick={handleSaveProfile}
                            className="px-3 py-1 text-xs bg-[#111111] text-white border border-[#111111] font-bold cursor-pointer"
                          >
                            [{t("save")}]
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-end">
                        <button
                          onClick={() => setIsEditing(true)}
                          className="text-xs text-[#111111] hover:underline font-bold"
                        >
                          [{language === "zh" ? "修改档案" : "EDIT PROFILE"}]
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === "language" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111] mb-1">
                    {t("settingsTabLanguage")}
                  </h3>
                  <p className="text-[11px] text-[#666666]">
                    {language === "zh"
                      ? "选择界面显示语言，全量文字、考纲视图与操作提示将实时刷新生效。"
                      : "Select the interface display language. All syllabus views and tools will update instantly."}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      setLanguage("zh");
                      showToast("语言已切换为 简体中文");
                    }}
                    className={`p-4 border text-left transition-all cursor-pointer ${
                      language === "zh"
                        ? "bg-[#111111] text-white border-[#111111]"
                        : "bg-white border-[#111111] hover:bg-[#ededed] text-[#111111]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm">[ZH-CN]</span>
                      {language === "zh" && <span className="font-bold text-xs">[ACTIVE]</span>}
                    </div>
                    <div className="font-bold text-xs uppercase">
                      简体中文 (SIMPLIFIED CHINESE)
                    </div>
                    <div className="text-[11px] opacity-80 mt-1">
                      完整中文化考纲知识点提取、艾宾浩斯复习节奏与自适应重排。
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setLanguage("en");
                      showToast("Language changed to English (US)");
                    }}
                    className={`p-4 border text-left transition-all cursor-pointer ${
                      language === "en"
                        ? "bg-[#111111] text-white border-[#111111]"
                        : "bg-white border-[#111111] hover:bg-[#ededed] text-[#111111]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm">[EN-US]</span>
                      {language === "en" && <span className="font-bold text-xs">[ACTIVE]</span>}
                    </div>
                    <div className="font-bold text-xs uppercase">
                      ENGLISH (US)
                    </div>
                    <div className="text-[11px] opacity-80 mt-1">
                      Full English syllabus breakdown, active recall drills, and calendar integration.
                    </div>
                  </button>
                </div>

                <div className="p-4 border border-[#111111] bg-white space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold uppercase text-[#111111]">
                        {t("settingsDateFormat")}
                      </div>
                      <div className="text-[11px] text-[#666666]">
                        {language === "zh" ? "日历与任务列表时间戳显示方式" : "Calendar and daily task timestamp style"}
                      </div>
                    </div>
                    <select
                      value={settings.dateFormat}
                      onChange={(e) => {
                        const upd = { ...settings, dateFormat: e.target.value as any };
                        onUpdateSettings(upd);
                        showToast(t("settingsSavedSuccess"));
                      }}
                      className="px-3 py-1.5 bg-white border border-[#111111] text-xs font-mono text-[#111111] focus:outline-none"
                    >
                      <option value="YYYY-MM-DD">YYYY-MM-DD (2026-08-18)</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY (08/18/2026)</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY (18/08/2026)</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#111111]">
                    <div>
                      <div className="text-xs font-bold uppercase text-[#111111]">
                        {t("settingsFirstDay")}
                      </div>
                      <div className="text-[11px] text-[#666666]">
                        {language === "zh" ? "月视图与排程日历每周起始日" : "First day of week for review calendar"}
                      </div>
                    </div>
                    <select
                      value={settings.firstDayOfWeek}
                      onChange={(e) => {
                        const upd = { ...settings, firstDayOfWeek: e.target.value as any };
                        onUpdateSettings(upd);
                        showToast(t("settingsSavedSuccess"));
                      }}
                      className="px-3 py-1.5 bg-white border border-[#111111] text-xs font-mono text-[#111111] focus:outline-none"
                    >
                      <option value="monday">{language === "zh" ? "周一 (MONDAY)" : "MONDAY"}</option>
                      <option value="sunday">{language === "zh" ? "周日 (SUNDAY)" : "SUNDAY"}</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "version" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111] mb-1">
                    {t("versionTitle")}
                  </h3>
                  <p className="text-[11px] text-[#666666]">
                    {t("versionAppSubtitle")}
                  </p>
                </div>

                <div className="p-4 border border-[#111111] bg-white space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold uppercase text-[#111111]">
                        EXAM PLAN AI // SYSTEM RELEASE
                      </div>
                      <div className="text-[11px] text-[#666666]">
                        {APP_VERSION_DATA.releaseName}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 text-xs font-bold bg-[#111111] text-white">
                      v{APP_VERSION_DATA.version}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#111111] text-xs font-mono">
                    <div>
                      <span className="text-[#666666] block text-[10px] uppercase">{t("versionBuildDate")}</span>
                      <span className="text-[#111111] font-bold">{APP_VERSION_DATA.buildDate}</span>
                    </div>
                    <div>
                      <span className="text-[#666666] block text-[10px] uppercase">{t("versionBuildNumber")}</span>
                      <span className="text-[#111111] font-bold">{APP_VERSION_DATA.buildNumber}</span>
                    </div>
                    <div>
                      <span className="text-[#666666] block text-[10px] uppercase">{t("versionEnv")}</span>
                      <span className="text-[#111111] font-bold">{APP_VERSION_DATA.environment}</span>
                    </div>
                    <div>
                      <span className="text-[#666666] block text-[10px] uppercase">COURSES</span>
                      <span className="font-bold text-[#111111]">{plans.length}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 border border-[#111111] bg-white space-y-3">
                  <div className="text-xs font-bold uppercase text-[#111111]">
                    [DIAGNOSTICS]
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="p-2.5 bg-white border border-[#111111] flex items-center justify-between text-xs">
                      <span className="text-[#666666]">{t("versionDiagStorage")}</span>
                      <span className="font-bold text-[#111111]">[OK]</span>
                    </div>
                    <div className="p-2.5 bg-white border border-[#111111] flex items-center justify-between text-xs">
                      <span className="text-[#666666]">{t("versionDiagAI")}</span>
                      <span className="font-bold text-[#111111]">[OK]</span>
                    </div>
                    <div className="p-2.5 bg-white border border-[#111111] flex items-center justify-between text-xs">
                      <span className="text-[#666666]">{t("versionDiagSync")}</span>
                      <span className="font-bold text-[#111111]">[OK]</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 border border-[#111111] bg-white space-y-3">
                  <div className="flex items-center space-x-2">
                    <Database className="w-4 h-4 text-[#111111]" />
                    <span className="text-xs font-bold uppercase text-[#111111]">
                      {t("settingsDataManage")}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      onClick={handleExportJson}
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-[#111111] hover:bg-[#ededed] text-xs font-bold text-[#111111] transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>[{t("settingsExportJson")}]</span>
                    </button>

                    <label className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-[#111111] hover:bg-[#ededed] text-xs font-bold text-[#111111] transition-colors cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>[{t("settingsImportJson")}]</span>
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImportJsonFile}
                        className="hidden"
                      />
                    </label>

                    {onResetPlans && (
                      <button
                        onClick={() => {
                          if (
                            window.confirm(
                              language === "zh"
                                ? "确定要重置备考计划为官方示范数据吗？"
                                : "Reset all plans to sample datasets?"
                            )
                          ) {
                            onResetPlans();
                            showToast(
                              language === "zh"
                                ? "已重置为官方示范计划"
                                : "Reset to sample plans"
                            );
                          }
                        }}
                        className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-[#111111] hover:bg-[#ededed] text-xs font-bold text-[#111111] transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>[{t("settingsResetSample")}]</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-xs font-bold uppercase text-[#111111]">
                    [CHANGELOG]
                  </div>
                  <div className="space-y-3">
                    {APP_VERSION_DATA.changelog.map((log) => (
                      <div
                        key={log.version}
                        className="p-3.5 border border-[#111111] bg-white space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold px-1.5 py-0.2 bg-[#111111] text-white text-[10px]">
                              {log.version}
                            </span>
                            <span className="font-bold text-[#111111]">
                              {log.title}
                            </span>
                          </div>
                          <span className="text-[10px] text-[#666666]">
                            {log.date}
                          </span>
                        </div>
                        <ul className="space-y-1 pl-4 list-disc text-[11px] text-[#666666]">
                          {log.highlights.map((h, i) => (
                            <li key={i}>{h}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-3 border-t border-[#111111] bg-[#fafafa] flex items-center justify-between text-xs text-[#666666] font-mono">
          <div className="flex items-center space-x-2">
            <span>EXAM PLAN AI © 2026</span>
            <span>•</span>
            <span>BLKSWN AESTHETIC</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#111111] hover:bg-[#333333] text-white font-bold transition-colors cursor-pointer"
          >
            [{language === "zh" ? "完成并关闭" : "CLOSE"}]
          </button>
        </div>
      </div>
    </div>
  );
}
