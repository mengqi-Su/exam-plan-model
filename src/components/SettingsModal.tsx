import React, { useState } from "react";
import {
  X,
  Settings,
  User,
  Languages,
  Info,
  Check,
  Bell,
  Volume2,
  Calendar,
  Clock,
  RotateCcw,
  Download,
  Upload,
  Sparkles,
  ShieldCheck,
  Award,
  Layers,
  Database,
  Cpu,
  LogIn,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { useI18n, Language } from "../lib/i18n";
import {
  AppSettings,
  UserProfile,
  ExamStudyPlan,
} from "../types";
import {
  DEMO_ACCOUNTS,
  APP_VERSION_DATA,
} from "../lib/storage";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "general" | "account" | "language" | "version";
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  userProfile: UserProfile;
  onUpdateUserProfile: (newProfile: UserProfile) => void;
  plans: ExamStudyPlan[];
  onImportPlans?: (importedPlans: ExamStudyPlan[]) => void;
  onResetPlans?: () => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  initialTab = "general",
  settings,
  onUpdateSettings,
  userProfile,
  onUpdateUserProfile,
  plans,
  onImportPlans,
  onResetPlans,
}: SettingsModalProps) {
  const { t, language, setLanguage } = useI18n();
  const [activeTab, setActiveTab] = useState<"general" | "account" | "language" | "version">(initialTab);

  // Local state for editing user profile
  const [editingProfile, setEditingProfile] = useState<UserProfile>({ ...userProfile });
  const [isEditing, setIsEditing] = useState(false);

  // Login form state (if logged out or switching)
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginName, setLoginName] = useState("");
  const [loginMode, setLoginMode] = useState<"login" | "register">("login");
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setNotificationMsg(msg);
    setTimeout(() => setNotificationMsg(null), 3000);
  };

  const handleSaveProfile = () => {
    onUpdateUserProfile(editingProfile);
    setIsEditing(false);
    showToast(language === "zh" ? "个人资料已更新" : "Profile updated successfully");
  };

  const handleQuickLogin = (demo: typeof DEMO_ACCOUNTS[0]) => {
    const updated: UserProfile = {
      ...userProfile,
      id: demo.id,
      name: demo.name,
      email: demo.email,
      avatar: demo.avatar,
      institution: demo.institution,
      major: demo.major,
      targetDegreeOrGoal: demo.targetDegreeOrGoal,
      membershipTier: demo.membershipTier,
      totalStudyMinutes: demo.totalStudyMinutes,
      studyStreakDays: demo.studyStreakDays,
      completedExamsCount: demo.completedExamsCount,
      isLoggedIn: true,
    };
    setEditingProfile(updated);
    onUpdateUserProfile(updated);
    showToast(
      language === "zh"
        ? `已成功登录为 ${demo.name}`
        : `Signed in as ${demo.name}`
    );
  };

  const handleCustomLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim()) return;
    const name = loginName.trim() || loginEmail.split("@")[0] || "Student";
    const updated: UserProfile = {
      ...userProfile,
      id: `user-${Date.now()}`,
      name: name,
      email: loginEmail.trim(),
      avatar: "📚",
      institution: "University Academic Center",
      major: "Custom Program",
      targetDegreeOrGoal: "General Exam Preparation",
      membershipTier: "Pro Student",
      isLoggedIn: true,
    };
    setEditingProfile(updated);
    onUpdateUserProfile(updated);
    showToast(language === "zh" ? `欢迎回来，${name}！` : `Welcome, ${name}!`);
  };

  const handleLogout = () => {
    const updated: UserProfile = {
      ...userProfile,
      isLoggedIn: false,
    };
    setEditingProfile(updated);
    onUpdateUserProfile(updated);
    showToast(language === "zh" ? "已安全退出登录" : "Signed out successfully");
  };

  // Export full JSON
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

  // Import JSON
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-xl shadow-2xl border border-[#e9e9e7] w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden text-[#37352f]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e9e9e7] bg-[#f7f6f3]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#37352f] text-white flex items-center justify-center shadow-xs">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#37352f] flex items-center space-x-2">
                <span>{t("settingsTitle")}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#e9e9e7] text-[#5a5a57]">
                  {APP_VERSION_DATA.version}
                </span>
              </h2>
              <p className="text-xs text-[#787774]">
                {language === "zh"
                  ? "管理备考偏好、学员账号、多语言与系统环境"
                  : "Manage preferences, student profiles, localization, and system state"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[#9b9a97] hover:text-[#37352f] hover:bg-[#efefed] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Notification toast */}
        {notificationMsg && (
          <div className="bg-[#448361] text-white text-xs px-4 py-2 flex items-center justify-between transition-all">
            <span className="flex items-center space-x-1.5">
              <Check className="w-3.5 h-3.5" />
              <span>{notificationMsg}</span>
            </span>
          </div>
        )}

        {/* Content Body: Sidebar tabs + panel */}
        <div className="flex flex-1 overflow-hidden">
          {/* Navigation Sidebar */}
          <div className="w-52 bg-[#faf9f6] border-r border-[#e9e9e7] p-3 space-y-1 shrink-0 overflow-y-auto">
            <button
              onClick={() => setActiveTab("general")}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                activeTab === "general"
                  ? "bg-[#37352f] text-white shadow-xs"
                  : "text-[#5a5a57] hover:bg-[#efefed] hover:text-[#37352f]"
              }`}
            >
              <Settings className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{t("settingsTabGeneral")}</span>
            </button>

            <button
              onClick={() => setActiveTab("account")}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                activeTab === "account"
                  ? "bg-[#37352f] text-white shadow-xs"
                  : "text-[#5a5a57] hover:bg-[#efefed] hover:text-[#37352f]"
              }`}
            >
              <User className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{t("settingsTabAccount")}</span>
              {userProfile.isLoggedIn && (
                <span className="w-2 h-2 rounded-full bg-[#448361] ml-auto shrink-0" />
              )}
            </button>

            <button
              onClick={() => setActiveTab("language")}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                activeTab === "language"
                  ? "bg-[#37352f] text-white shadow-xs"
                  : "text-[#5a5a57] hover:bg-[#efefed] hover:text-[#37352f]"
              }`}
            >
              <Languages className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{t("settingsTabLanguage")}</span>
              <span className="text-[10px] ml-auto font-mono px-1 rounded bg-[#e9e9e7] text-[#5a5a57]">
                {language.toUpperCase()}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("version")}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                activeTab === "version"
                  ? "bg-[#37352f] text-white shadow-xs"
                  : "text-[#5a5a57] hover:bg-[#efefed] hover:text-[#37352f]"
              }`}
            >
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{t("settingsTabVersion")}</span>
            </button>
          </div>

          {/* Tab Panel Content */}
          <div className="flex-1 p-6 overflow-y-auto bg-white space-y-6">
            {/* 1. GENERAL CONFIGURATION TAB */}
            {activeTab === "general" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-[#37352f] mb-1">
                    {t("settingsTabGeneral")}
                  </h3>
                  <p className="text-xs text-[#787774]">
                    {language === "zh"
                      ? "定制每日专注节奏、音效提醒与备考重排策略。"
                      : "Configure Pomodoro focus rhythms, audio notifications, and adaptive rebalance algorithms."}
                  </p>
                </div>

                {/* Focus Duration */}
                <div className="p-4 rounded-lg border border-[#e9e9e7] bg-[#fbfbfa] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-[#2b78a0]" />
                      <span className="text-xs font-medium text-[#37352f]">
                        {t("settingsFocusDuration")}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-[#2b78a0]">
                      {settings.defaultFocusDuration} {language === "zh" ? "分钟 / 节" : "mins / session"}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[25, 45, 60, 90].map((mins) => (
                      <button
                        key={mins}
                        onClick={() => {
                          const upd = { ...settings, defaultFocusDuration: mins };
                          onUpdateSettings(upd);
                          showToast(t("settingsSavedSuccess"));
                        }}
                        className={`py-2 rounded-md text-xs font-medium border transition-all ${
                          settings.defaultFocusDuration === mins
                            ? "bg-[#37352f] text-white border-[#37352f] shadow-xs"
                            : "bg-white text-[#5a5a57] border-[#e9e9e7] hover:border-[#37352f]"
                        }`}
                      >
                        {mins} {language === "zh" ? "分钟" : "min"}
                        {mins === 25 && " (番茄)"}
                        {mins === 45 && " (标准)"}
                        {mins === 60 && " (深度)"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sound and Reminders */}
                <div className="space-y-3">
                  <div className="p-4 rounded-lg border border-[#e9e9e7] bg-[#fbfbfa] flex items-center justify-between">
                    <div className="flex items-start space-x-3">
                      <Volume2 className="w-4 h-4 text-[#448361] mt-0.5" />
                      <div>
                        <div className="text-xs font-medium text-[#37352f]">
                          {t("settingsSoundAlerts")}
                        </div>
                        <div className="text-[11px] text-[#787774]">
                          {t("settingsSoundAlertsDesc")}
                        </div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.enableSoundAlerts}
                      onChange={(e) => {
                        const upd = { ...settings, enableSoundAlerts: e.target.checked };
                        onUpdateSettings(upd);
                        showToast(t("settingsSavedSuccess"));
                      }}
                      className="w-4 h-4 accent-[#448361] rounded cursor-pointer"
                    />
                  </div>

                  <div className="p-4 rounded-lg border border-[#e9e9e7] bg-[#fbfbfa] flex items-center justify-between">
                    <div className="flex items-start space-x-3">
                      <Bell className="w-4 h-4 text-[#cb912f] mt-0.5" />
                      <div>
                        <div className="text-xs font-medium text-[#37352f]">
                          {t("settingsDailyReminders")}
                        </div>
                        <div className="text-[11px] text-[#787774]">
                          {t("settingsDailyRemindersDesc")}
                        </div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.enableDailyReminders}
                      onChange={(e) => {
                        const upd = { ...settings, enableDailyReminders: e.target.checked };
                        onUpdateSettings(upd);
                        showToast(t("settingsSavedSuccess"));
                      }}
                      className="w-4 h-4 accent-[#448361] rounded cursor-pointer"
                    />
                  </div>
                </div>

                {/* Adaptive Rebalance Sensitivity */}
                <div className="p-4 rounded-lg border border-[#e9e9e7] bg-[#fbfbfa] space-y-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <RotateCcw className="w-4 h-4 text-[#937264]" />
                      <span className="text-xs font-medium text-[#37352f]">
                        {t("settingsRebalanceSens")}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#787774] mt-0.5">
                      {t("settingsRebalanceSensDesc")}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { id: "high", label: t("settingsSensHigh") },
                      { id: "balanced", label: t("settingsSensBalanced") },
                      { id: "conservative", label: t("settingsSensConservative") },
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          const upd = {
                            ...settings,
                            rebalanceSensitivity: item.id as any,
                          };
                          onUpdateSettings(upd);
                          showToast(t("settingsSavedSuccess"));
                        }}
                        className={`p-2.5 rounded-lg text-left text-xs border transition-all ${
                          settings.rebalanceSensitivity === item.id
                            ? "bg-white border-[#37352f] ring-1 ring-[#37352f] shadow-xs"
                            : "bg-white border-[#e9e9e7] text-[#5a5a57] hover:border-[#dfdfde]"
                        }`}
                      >
                        <div className="font-medium text-[#37352f] flex items-center justify-between">
                          <span>{item.id === "high" ? "🔥 高效紧凑" : item.id === "balanced" ? "⚖️ 智能均衡" : "🛡️ 稳健缓冲"}</span>
                          {settings.rebalanceSensitivity === item.id && (
                            <Check className="w-3 h-3 text-[#448361]" />
                          )}
                        </div>
                        <div className="text-[10px] text-[#787774] mt-1 line-clamp-2">
                          {item.label}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Data Backup & Workspace Reset */}
                <div className="p-4 rounded-lg border border-[#e9e9e7] bg-[#fbfbfa] space-y-3">
                  <div className="flex items-center space-x-2">
                    <Database className="w-4 h-4 text-[#5a5a57]" />
                    <span className="text-xs font-medium text-[#37352f]">
                      {t("settingsDataManage")}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      onClick={handleExportJson}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-white border border-[#e9e9e7] hover:bg-[#efefed] text-xs font-medium text-[#37352f] transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-[#2b78a0]" />
                      <span>{t("settingsExportJson")}</span>
                    </button>

                    <label className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-white border border-[#e9e9e7] hover:bg-[#efefed] text-xs font-medium text-[#37352f] transition-colors cursor-pointer">
                      <Upload className="w-3.5 h-3.5 text-[#448361]" />
                      <span>{t("settingsImportJson")}</span>
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
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-white border border-[#e9e9e7] hover:bg-[#f4eeee] text-xs font-medium text-[#937264] transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{t("settingsResetSample")}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 2. USER AUTH & PROFILE TAB */}
            {activeTab === "account" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-[#37352f] mb-1">
                    {t("settingsTabAccount")}
                  </h3>
                  <p className="text-xs text-[#787774]">
                    {language === "zh"
                      ? "管理学员身份、登录状态与跨科目学习档案。"
                      : "Manage student account credentials, profile details, and multi-course records."}
                  </p>
                </div>

                {/* Logged in User Card */}
                {userProfile.isLoggedIn ? (
                  <div className="p-5 rounded-xl border border-[#e9e9e7] bg-[#fbfbfa] space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3.5">
                        <div className="w-12 h-12 rounded-xl bg-[#37352f] text-white flex items-center justify-center text-xl shadow-xs">
                          {userProfile.avatar || "🎓"}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-sm text-[#37352f]">
                              {userProfile.name}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#edf3ec] text-[#448361] border border-[#d2e3d0] flex items-center space-x-1">
                              <ShieldCheck className="w-3 h-3" />
                              <span>{userProfile.membershipTier || "Pro Student"}</span>
                            </span>
                          </div>
                          <div className="text-xs text-[#787774] mt-0.5">
                            {userProfile.email}
                          </div>
                          <div className="text-[11px] text-[#9b9a97] mt-0.5">
                            {userProfile.institution} · {userProfile.major}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={handleLogout}
                        className="flex items-center space-x-1 px-2.5 py-1.5 rounded-md border border-[#e9e9e7] hover:bg-[#f4eeee] text-xs text-[#937264] transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>{t("userLogout")}</span>
                      </button>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-3 gap-3 pt-2 border-t border-[#e9e9e7]">
                      <div className="p-2.5 rounded-lg bg-white border border-[#e9e9e7]">
                        <div className="text-[10px] text-[#787774]">
                          {t("userStudyStreak")}
                        </div>
                        <div className="text-base font-bold text-[#cb912f] mt-0.5">
                          🔥 {userProfile.studyStreakDays} {language === "zh" ? "天" : "days"}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white border border-[#e9e9e7]">
                        <div className="text-[10px] text-[#787774]">
                          {t("userTotalStudyHours")}
                        </div>
                        <div className="text-base font-bold text-[#2b78a0] mt-0.5">
                          ⏱️ {(userProfile.totalStudyMinutes / 60).toFixed(1)} h
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white border border-[#e9e9e7]">
                        <div className="text-[10px] text-[#787774]">
                          {language === "zh" ? "已完成待办" : "Tasks Done"}
                        </div>
                        <div className="text-base font-bold text-[#448361] mt-0.5">
                          ✅ {totalCompletedTasks}/{totalTasks}
                        </div>
                      </div>
                    </div>

                    {/* Edit Profile Form */}
                    {isEditing ? (
                      <div className="p-4 rounded-lg bg-white border border-[#e9e9e7] space-y-3">
                        <div className="font-semibold text-xs text-[#37352f]">
                          {language === "zh" ? "编辑学员档案" : "Edit Profile Info"}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] text-[#787774] block mb-1">
                              {t("userNameLabel")}
                            </label>
                            <input
                              type="text"
                              value={editingProfile.name}
                              onChange={(e) =>
                                setEditingProfile({ ...editingProfile, name: e.target.value })
                              }
                              className="w-full px-2.5 py-1.5 border border-[#e9e9e7] rounded text-xs text-[#37352f] focus:outline-none focus:border-[#2b78a0]"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-[#787774] block mb-1">
                              {t("userInstitutionLabel")}
                            </label>
                            <input
                              type="text"
                              value={editingProfile.institution || ""}
                              onChange={(e) =>
                                setEditingProfile({ ...editingProfile, institution: e.target.value })
                              }
                              className="w-full px-2.5 py-1.5 border border-[#e9e9e7] rounded text-xs text-[#37352f] focus:outline-none focus:border-[#2b78a0]"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-[#787774] block mb-1">
                              {t("userMajorLabel")}
                            </label>
                            <input
                              type="text"
                              value={editingProfile.major || ""}
                              onChange={(e) =>
                                setEditingProfile({ ...editingProfile, major: e.target.value })
                              }
                              className="w-full px-2.5 py-1.5 border border-[#e9e9e7] rounded text-xs text-[#37352f] focus:outline-none focus:border-[#2b78a0]"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-[#787774] block mb-1">
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
                              className="w-full px-2.5 py-1.5 border border-[#e9e9e7] rounded text-xs text-[#37352f] focus:outline-none focus:border-[#2b78a0]"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end space-x-2 pt-2">
                          <button
                            onClick={() => setIsEditing(false)}
                            className="px-3 py-1 text-xs text-[#5a5a57] hover:bg-[#efefed] rounded"
                          >
                            {t("cancel")}
                          </button>
                          <button
                            onClick={handleSaveProfile}
                            className="px-3 py-1 text-xs bg-[#37352f] text-white rounded font-medium shadow-xs"
                          >
                            {t("save")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-end">
                        <button
                          onClick={() => setIsEditing(true)}
                          className="text-xs text-[#2b78a0] hover:underline font-medium"
                        >
                          {language === "zh" ? "修改学员档案信息" : "Edit Profile Info"}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Login & Register Form */
                  <div className="p-5 rounded-xl border border-[#e9e9e7] bg-[#fbfbfa] space-y-4">
                    <div className="flex items-center space-x-2">
                      <LogIn className="w-4 h-4 text-[#2b78a0]" />
                      <span className="font-semibold text-xs text-[#37352f]">
                        {t("loginTitle")}
                      </span>
                    </div>
                    <p className="text-xs text-[#787774]">
                      {t("loginSubtitle")}
                    </p>

                    <form onSubmit={handleCustomLogin} className="space-y-3">
                      <div>
                        <label className="text-[11px] font-medium text-[#5a5a57] block mb-1">
                          {t("userEmailLabel")}
                        </label>
                        <input
                          type="email"
                          required
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          placeholder="your.email@university.edu"
                          className="w-full px-3 py-1.5 border border-[#e9e9e7] rounded-md text-xs text-[#37352f] focus:outline-none focus:border-[#2b78a0] bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-[#5a5a57] block mb-1">
                          {language === "zh" ? "登录密码" : "Password"}
                        </label>
                        <input
                          type="password"
                          required
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-3 py-1.5 border border-[#e9e9e7] rounded-md text-xs text-[#37352f] focus:outline-none focus:border-[#2b78a0] bg-white"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full py-2 bg-[#37352f] hover:bg-[#201f1d] text-white rounded-md text-xs font-semibold shadow-xs transition-colors"
                      >
                        {t("userLoginBtn")}
                      </button>
                    </form>
                  </div>
                )}

                {/* Quick Switch Demo Accounts */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-1.5 text-xs font-semibold text-[#37352f]">
                    <Sparkles className="w-3.5 h-3.5 text-[#cb912f]" />
                    <span>{t("userQuickSwitch")}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {DEMO_ACCOUNTS.map((demo) => {
                      const isCurrent = userProfile.isLoggedIn && userProfile.id === demo.id;
                      return (
                        <button
                          key={demo.id}
                          onClick={() => handleQuickLogin(demo)}
                          className={`p-3 rounded-lg border text-left transition-all ${
                            isCurrent
                              ? "bg-[#f0f7f9] border-[#2b78a0] ring-1 ring-[#2b78a0]"
                              : "bg-white border-[#e9e9e7] hover:border-[#dfdfde] hover:bg-[#fbfbfa]"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-lg">{demo.avatar}</span>
                            {isCurrent && (
                              <span className="text-[10px] font-semibold text-[#2b78a0] bg-white px-1.5 py-0.5 rounded border border-[#2b78a0]/30">
                                {language === "zh" ? "当前登录" : "Active"}
                              </span>
                            )}
                          </div>
                          <div className="font-semibold text-xs text-[#37352f] truncate">
                            {demo.name}
                          </div>
                          <div className="text-[10px] text-[#787774] truncate mt-0.5">
                            {demo.major}
                          </div>
                          <div className="text-[10px] text-[#cb912f] font-mono mt-1">
                            🔥 {demo.studyStreakDays} {language === "zh" ? "天打卡" : "days"} · {(demo.totalStudyMinutes / 60).toFixed(0)}h
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 3. LANGUAGE & REGION TAB */}
            {activeTab === "language" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-[#37352f] mb-1">
                    {t("settingsTabLanguage")}
                  </h3>
                  <p className="text-xs text-[#787774]">
                    {language === "zh"
                      ? "选择界面显示语言，全量文字、考纲视图与操作提示将实时刷新生效。"
                      : "Select the interface display language. All syllabus views and tools will update instantly."}
                  </p>
                </div>

                {/* Language Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      setLanguage("zh");
                      showToast("语言已切换为 简体中文");
                    }}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      language === "zh"
                        ? "bg-[#f0f7f9] border-[#2b78a0] ring-1 ring-[#2b78a0] shadow-xs"
                        : "bg-white border-[#e9e9e7] hover:border-[#dfdfde] hover:bg-[#fbfbfa]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-2xl">🇨🇳</div>
                      {language === "zh" && (
                        <div className="w-5 h-5 rounded-full bg-[#2b78a0] text-white flex items-center justify-center">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                    <div className="font-semibold text-sm text-[#37352f]">
                      简体中文 (Simplified Chinese)
                    </div>
                    <div className="text-xs text-[#787774] mt-1">
                      完整中文化考纲知识点提取、艾宾浩斯复习节奏与自适应重排。
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setLanguage("en");
                      showToast("Language changed to English (US)");
                    }}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      language === "en"
                        ? "bg-[#f0f7f9] border-[#2b78a0] ring-1 ring-[#2b78a0] shadow-xs"
                        : "bg-white border-[#e9e9e7] hover:border-[#dfdfde] hover:bg-[#fbfbfa]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-2xl">🇺🇸</div>
                      {language === "en" && (
                        <div className="w-5 h-5 rounded-full bg-[#2b78a0] text-white flex items-center justify-center">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                    <div className="font-semibold text-sm text-[#37352f]">
                      English (US)
                    </div>
                    <div className="text-xs text-[#787774] mt-1">
                      Full English syllabus breakdown, active recall drills, and calendar integration.
                    </div>
                  </button>
                </div>

                {/* Date & Week Preferences */}
                <div className="p-4 rounded-lg border border-[#e9e9e7] bg-[#fbfbfa] space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-[#37352f]">
                        {t("settingsDateFormat")}
                      </div>
                      <div className="text-[11px] text-[#787774]">
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
                      className="px-3 py-1.5 bg-white border border-[#e9e9e7] rounded text-xs text-[#37352f] focus:outline-none focus:border-[#2b78a0]"
                    >
                      <option value="YYYY-MM-DD">YYYY-MM-DD (2026-08-18)</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY (08/18/2026)</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY (18/08/2026)</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#e9e9e7]">
                    <div>
                      <div className="text-xs font-medium text-[#37352f]">
                        {t("settingsFirstDay")}
                      </div>
                      <div className="text-[11px] text-[#787774]">
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
                      className="px-3 py-1.5 bg-white border border-[#e9e9e7] rounded text-xs text-[#37352f] focus:outline-none focus:border-[#2b78a0]"
                    >
                      <option value="monday">{language === "zh" ? "周一 (Monday)" : "Monday"}</option>
                      <option value="sunday">{language === "zh" ? "周日 (Sunday)" : "Sunday"}</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* 4. VERSION INFO & DIAGNOSTICS TAB */}
            {activeTab === "version" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-[#37352f] mb-1">
                    {t("versionTitle")}
                  </h3>
                  <p className="text-xs text-[#787774]">
                    {t("versionAppSubtitle")}
                  </p>
                </div>

                {/* Version Card */}
                <div className="p-4 rounded-xl border border-[#e9e9e7] bg-gradient-to-br from-[#fbfbfa] to-[#f7f6f3] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#37352f] text-white flex items-center justify-center text-xs font-bold">
                        EP
                      </div>
                      <div>
                        <div className="text-sm font-bold text-[#37352f]">
                          Exam Plan AI (备考规划 AI)
                        </div>
                        <div className="text-xs text-[#787774]">
                          {APP_VERSION_DATA.releaseName}
                        </div>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#37352f] text-white">
                      {APP_VERSION_DATA.version}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#e9e9e7] text-xs">
                    <div>
                      <span className="text-[#9b9a97] block text-[10px]">{t("versionBuildDate")}</span>
                      <span className="font-mono text-[#37352f]">{APP_VERSION_DATA.buildDate}</span>
                    </div>
                    <div>
                      <span className="text-[#9b9a97] block text-[10px]">{t("versionBuildNumber")}</span>
                      <span className="font-mono text-[#37352f]">{APP_VERSION_DATA.buildNumber}</span>
                    </div>
                    <div>
                      <span className="text-[#9b9a97] block text-[10px]">{t("versionEnv")}</span>
                      <span className="text-[#37352f]">{APP_VERSION_DATA.environment}</span>
                    </div>
                    <div>
                      <span className="text-[#9b9a97] block text-[10px]">Active Subjects</span>
                      <span className="font-semibold text-[#2b78a0]">{plans.length} Courses</span>
                    </div>
                  </div>
                </div>

                {/* System Health Diagnostics */}
                <div className="p-4 rounded-lg border border-[#e9e9e7] bg-[#fbfbfa] space-y-3">
                  <div className="text-xs font-semibold text-[#37352f] flex items-center space-x-1.5">
                    <Cpu className="w-3.5 h-3.5 text-[#448361]" />
                    <span>{t("versionDiagnostics")}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="p-2.5 rounded bg-white border border-[#e9e9e7] flex items-center justify-between text-xs">
                      <span className="text-[#5a5a57]">{t("versionDiagStorage")}</span>
                      <span className="font-semibold text-[#448361] flex items-center space-x-1">
                        <span className="w-2 h-2 rounded-full bg-[#448361]" />
                        <span>{t("versionDiagOk")}</span>
                      </span>
                    </div>
                    <div className="p-2.5 rounded bg-white border border-[#e9e9e7] flex items-center justify-between text-xs">
                      <span className="text-[#5a5a57]">{t("versionDiagAI")}</span>
                      <span className="font-semibold text-[#448361] flex items-center space-x-1">
                        <span className="w-2 h-2 rounded-full bg-[#448361]" />
                        <span>{t("versionDiagOk")}</span>
                      </span>
                    </div>
                    <div className="p-2.5 rounded bg-white border border-[#e9e9e7] flex items-center justify-between text-xs">
                      <span className="text-[#5a5a57]">{t("versionDiagSync")}</span>
                      <span className="font-semibold text-[#448361] flex items-center space-x-1">
                        <span className="w-2 h-2 rounded-full bg-[#448361]" />
                        <span>{t("versionDiagOk")}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Changelog Timeline */}
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-[#37352f] flex items-center space-x-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#2b78a0]" />
                    <span>{t("versionChangelogTitle")}</span>
                  </div>
                  <div className="space-y-3">
                    {APP_VERSION_DATA.changelog.map((log, idx) => (
                      <div
                        key={log.version}
                        className="p-3.5 rounded-lg border border-[#e9e9e7] bg-white space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold font-mono px-2 py-0.5 rounded bg-[#37352f] text-white text-[11px]">
                              {log.version}
                            </span>
                            <span className="font-semibold text-[#37352f]">
                              {log.title}
                            </span>
                          </div>
                          <span className="text-[10px] text-[#9b9a97] font-mono">
                            {log.date}
                          </span>
                        </div>
                        <ul className="space-y-1 pl-4 list-disc text-[11px] text-[#5a5a57]">
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

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#e9e9e7] bg-[#f7f6f3] flex items-center justify-between text-xs text-[#787774]">
          <div className="flex items-center space-x-2">
            <span>Exam Plan AI © 2026</span>
            <span>·</span>
            <span>All Data Stored Locally & Privately</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md bg-[#37352f] hover:bg-[#201f1d] text-white font-medium shadow-xs transition-colors"
          >
            {language === "zh" ? "完成并关闭" : "Done & Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
