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
import {
  loginWithGoogle,
  loginWithEmail,
  registerWithEmail,
  logoutUser,
  uploadLocalPlansToCloud,
  saveUserProfileToCloud
} from "../lib/firebase";

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

  const [editingProfile, setEditingProfile] = useState<UserProfile>({ ...userProfile });
  const [isEditing, setIsEditing] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginName, setLoginName] = useState("");
  const [loginMode, setLoginMode] = useState<"login" | "register">("login");
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);
  const [isLoggingInWithGoogle, setIsLoggingInWithGoogle] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [isPopupBlocked, setIsPopupBlocked] = useState(false);
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);

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

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim()) return;
    setIsSubmittingEmail(true);
    const name = loginName.trim() || loginEmail.split("@")[0] || "Student";

    try {

      let user;
      try {
        user = await loginWithEmail(loginEmail.trim(), loginPassword || "StudyMaster123!");
      } catch (signInErr: any) {
        if (signInErr.code === "auth/user-not-found" || signInErr.code === "auth/invalid-credential") {
          user = await registerWithEmail(loginEmail.trim(), loginPassword || "StudyMaster123!", name);
        } else {
          throw signInErr;
        }
      }

      const updated: UserProfile = {
        ...userProfile,
        id: user.uid,
        name: user.displayName || name,
        email: user.email || loginEmail.trim(),
        avatar: "📚",
        institution: "University Academic Center",
        major: "Exam Candidate",
        targetDegreeOrGoal: "General Exam Preparation",
        membershipTier: "Pro Student",
        isLoggedIn: true,
      };
      setEditingProfile(updated);
      onUpdateUserProfile(updated);

      await saveUserProfileToCloud(user.uid, updated);
      if (plans.length > 0) {
        await uploadLocalPlansToCloud(user.uid, plans);
      }

      showToast(language === "zh" ? `已成功登录云端账号：${updated.name}！` : `Signed in as ${updated.name} with Cloud sync!`);
    } catch (err: any) {

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
    } finally {
      setIsSubmittingEmail(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsLoggingInWithGoogle(true);
      setIsPopupBlocked(false);
      const user = await loginWithGoogle();
      const updated: UserProfile = {
        ...userProfile,
        id: user.uid,
        name: user.displayName || user.email?.split("@")[0] || "Scholar",
        email: user.email || "",
        avatar: user.photoURL || "🎓",
        isLoggedIn: true,
        membershipTier: "Pro Student",
      };
      setEditingProfile(updated);
      onUpdateUserProfile(updated);

      await saveUserProfileToCloud(user.uid, updated);

      if (plans.length > 0) {
        await uploadLocalPlansToCloud(user.uid, plans);
      }

      showToast(
        language === "zh"
          ? `Google 账号 ${user.displayName || user.email} 已成功登录并同步！`
          : `Signed in as ${user.displayName || user.email} with Cloud Sync!`
      );
    } catch (err: any) {
      const errStr = String(err?.message || err?.code || "");
      if (errStr.includes("popup-blocked") || err?.code === "auth/popup-blocked") {
        setIsPopupBlocked(true);
        showToast(
          language === "zh"
            ? "浏览器拦截了弹出授权窗口，请点击下方提示在新标签页打开，或直接使用邮箱登录"
            : "Browser popup was blocked in this preview iframe. Please open in a new tab or use email."
        );
      } else if (err?.code === "auth/popup-closed-by-user") {
        showToast(language === "zh" ? "登录已取消" : "Sign in cancelled");
      } else {
        showToast(
          language === "zh"
            ? `登录提示: ${err.message || "请稍后重试"}`
            : `Login note: ${err.message || "Please try again"}`
        );
      }
    } finally {
      setIsLoggingInWithGoogle(false);
    }
  };

  const handleSyncLocalToCloud = async () => {
    if (!userProfile.isLoggedIn || !userProfile.id) {
      showToast(language === "zh" ? "请先登录账号" : "Please sign in first");
      return;
    }
    try {
      setIsSyncingCloud(true);
      await uploadLocalPlansToCloud(userProfile.id, plans);
      showToast(
        language === "zh"
          ? `已成功将 ${plans.length} 个备考科目的全部任务同步至云端！`
          : `Successfully synced ${plans.length} courses to Cloud!`
      );
    } catch (err: any) {
      showToast(language === "zh" ? "云端同步失败，请检查网络" : "Sync failed");
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (e) {
      console.warn("Logout error:", e);
    }
    const updated: UserProfile = {
      ...userProfile,
      isLoggedIn: false,
    };
    setEditingProfile(updated);
    onUpdateUserProfile(updated);
    showToast(language === "zh" ? "已安全退出登录" : "Signed out successfully");
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
                  ? "管理备考偏好、学员账号、多语言与系统环境"
                  : "Manage preferences, student profiles, localization, and system state"}
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
              onClick={() => setActiveTab("general")}
              className={`w-full flex items-center space-x-2 px-3 py-2 text-xs font-bold transition-colors text-left cursor-pointer border ${
                activeTab === "general"
                  ? "bg-[#111111] text-white border-[#111111]"
                  : "bg-white text-[#666666] border-[#e5e5e5] hover:border-[#111111] hover:text-[#111111]"
              }`}
            >
              <span className="truncate">{t("settingsTabGeneral")}</span>
            </button>

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

            {activeTab === "general" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111] mb-1">
                    {t("settingsTabGeneral")}
                  </h3>
                  <p className="text-[11px] text-[#666666]">
                    {language === "zh"
                      ? "定制每日专注节奏、音效提醒与备考重排策略。"
                      : "Configure Pomodoro focus rhythms, audio notifications, and adaptive rebalance algorithms."}
                  </p>
                </div>

                <div className="p-4 border border-[#111111] bg-white space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-[#111111]" />
                      <span className="text-xs font-bold uppercase text-[#111111]">
                        {t("settingsFocusDuration")}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-[#111111]">
                      {settings.defaultFocusDuration} {language === "zh" ? "分钟 / 节" : "MINS / SESSION"}
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
                        className={`py-2 text-xs font-bold border transition-all cursor-pointer ${
                          settings.defaultFocusDuration === mins
                            ? "bg-[#111111] text-white border-[#111111]"
                            : "bg-white text-[#666666] border-[#111111] hover:bg-[#ededed] hover:text-[#111111]"
                        }`}
                      >
                        {mins}M
                        {mins === 25 && " (POMO)"}
                        {mins === 45 && " (STD)"}
                        {mins === 60 && " (DEEP)"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="p-4 border border-[#111111] bg-white flex items-center justify-between">
                    <div className="flex items-start space-x-3">
                      <Volume2 className="w-4 h-4 text-[#111111] mt-0.5" />
                      <div>
                        <div className="text-xs font-bold uppercase text-[#111111]">
                          {t("settingsSoundAlerts")}
                        </div>
                        <div className="text-[11px] text-[#666666]">
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
                      className="w-4 h-4 accent-[#111111] cursor-pointer"
                    />
                  </div>

                  <div className="p-4 border border-[#111111] bg-white flex items-center justify-between">
                    <div className="flex items-start space-x-3">
                      <Bell className="w-4 h-4 text-[#111111] mt-0.5" />
                      <div>
                        <div className="text-xs font-bold uppercase text-[#111111]">
                          {t("settingsDailyReminders")}
                        </div>
                        <div className="text-[11px] text-[#666666]">
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
                      className="w-4 h-4 accent-[#111111] cursor-pointer"
                    />
                  </div>
                </div>

                <div className="p-4 border border-[#111111] bg-white space-y-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <RotateCcw className="w-4 h-4 text-[#111111]" />
                      <span className="text-xs font-bold uppercase text-[#111111]">
                        {t("settingsRebalanceSens")}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#666666] mt-0.5">
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
                        className={`p-2.5 text-left text-xs border transition-all cursor-pointer ${
                          settings.rebalanceSensitivity === item.id
                            ? "bg-[#111111] text-white border-[#111111]"
                            : "bg-white border-[#111111] text-[#666666] hover:bg-[#ededed] hover:text-[#111111]"
                        }`}
                      >
                        <div className="font-bold flex items-center justify-between">
                          <span>
                            {item.id === "high"
                              ? (language === "zh" ? "[高敏感度]" : "[HIGH]")
                              : item.id === "balanced"
                              ? (language === "zh" ? "[标准平衡]" : "[BALANCED]")
                              : (language === "zh" ? "[保守平稳]" : "[BUFFERED]")}
                          </span>
                          {settings.rebalanceSensitivity === item.id && (
                            <span className="text-xs font-bold">[✓]</span>
                          )}
                        </div>
                        <div className="text-[10px] opacity-80 mt-1 line-clamp-2">
                          {item.label}
                        </div>
                      </button>
                    ))}
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
              </div>
            )}

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

                {userProfile.isLoggedIn ? (
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
                              {userProfile.membershipTier || "PRO"}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#666666] mt-0.5">
                            {userProfile.email}
                          </div>
                          <div className="text-[10px] text-[#999999] mt-0.5">
                            {userProfile.institution || "Student"}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={handleLogout}
                        className="flex items-center space-x-1 px-2.5 py-1 bg-white border border-[#111111] hover:bg-[#ededed] text-xs font-bold text-[#111111] transition-colors cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>[{t("userLogout")}]</span>
                      </button>
                    </div>

                    <div className="p-3 bg-[#fafafa] border border-[#111111] flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div>
                          <div className="text-xs font-bold uppercase text-[#111111]">
                            [{language === "zh" ? "云端同步已激活" : "CLOUD SYNC ACTIVE"}]
                          </div>
                          <div className="text-[10px] text-[#666666]">
                            UID: {userProfile.id.slice(0, 12)}...
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={handleSyncLocalToCloud}
                        disabled={isSyncingCloud}
                        className="px-3 py-1 bg-white hover:bg-[#111111] hover:text-white border border-[#111111] text-xs font-bold text-[#111111] transition-colors flex items-center space-x-1 cursor-pointer"
                      >
                        <Upload className="w-3 h-3" />
                        <span>{isSyncingCloud ? (language === "zh" ? "同步中..." : "SYNCING...") : (language === "zh" ? "同步至云端" : "SYNC CLOUD")}</span>
                      </button>
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
                ) : (

                  <div className="p-5 border border-[#111111] bg-white space-y-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="px-1.5 py-0.5 bg-[#111111] text-white text-[10px] font-bold">[AUTH]</span>
                        <span className="font-bold text-xs uppercase text-[#111111]">
                          {language === "zh" ? "登录账号开启云端备考同步" : "Sign In for Cloud Sync"}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#666666] mt-1">
                        {language === "zh"
                          ? "接入真实 Google 账号与 Firebase 云端数据库，多设备实时同步备考计划、复习进度与知识库。"
                          : "Connect your real Google Account via Firebase Firestore to sync your syllabus and tasks across all devices."}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={isLoggingInWithGoogle}
                      className="w-full py-2.5 px-4 bg-white hover:bg-[#111111] hover:text-white text-[#111111] border border-[#111111] text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <span>
                        {isLoggingInWithGoogle
                          ? (language === "zh" ? "正在连接 Google 授权..." : "Signing in with Google...")
                          : (language === "zh" ? "[使用 Google 账号登录 (云端)]" : "[CONTINUE WITH GOOGLE]")}
                      </span>
                    </button>

                    {isPopupBlocked && (
                      <div className="p-3 border border-[#111111] bg-[#fafafa] text-xs space-y-2 text-[#111111]">
                        <div className="font-bold text-[#d44c47]">
                          [!] {language === "zh" ? "浏览器拦截了弹出授权窗口" : "Popup blocked by browser"}
                        </div>
                        <p className="text-[11px] leading-relaxed text-[#666666]">
                          {language === "zh"
                            ? "当前应用在内嵌预览窗口中运行，浏览器安全策略拦截了 Google 弹窗。您可以点击下方在新标签页中打开应用完成登录，或者直接在下方使用邮箱免弹窗快速登录。"
                            : "The preview iframe prevented the Google popup from opening. You can open the app in a new tab or sign in with email below."}
                        </p>
                        <button
                          type="button"
                          onClick={() => window.open(window.location.href, "_blank")}
                          className="w-full py-1.5 px-3 bg-[#111111] text-white border border-[#111111] font-bold text-xs cursor-pointer"
                        >
                          <span>{language === "zh" ? "[在新标签页打开并登录 ↗]" : "[OPEN IN NEW TAB & SIGN IN ↗]"}</span>
                        </button>
                      </div>
                    )}

                    <div className="relative flex py-1 items-center">
                      <div className="flex-grow border-t border-[#111111]"></div>
                      <span className="flex-shrink mx-3 text-[10px] font-bold text-[#666666] uppercase">
                        {language === "zh" ? "或使用邮箱登录" : "OR EMAIL"}
                      </span>
                      <div className="flex-grow border-t border-[#111111]"></div>
                    </div>

                    <form onSubmit={handleCustomLogin} className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase text-[#666666] block mb-1">
                          {t("userEmailLabel")}
                        </label>
                        <input
                          type="email"
                          required
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          placeholder="user@domain.com"
                          className="w-full px-3 py-1.5 border border-[#111111] text-xs text-[#111111] bg-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase text-[#666666] block mb-1">
                          {language === "zh" ? "登录密码" : "PASSWORD"}
                        </label>
                        <input
                          type="password"
                          required
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full px-3 py-1.5 border border-[#111111] text-xs text-[#111111] bg-white focus:outline-none"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isSubmittingEmail}
                        className="w-full py-2 bg-[#111111] hover:bg-[#333333] text-white border border-[#111111] text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isSubmittingEmail
                          ? (language === "zh" ? "正在登录..." : "SIGNING IN...")
                          : `[${t("userLoginBtn")}]`}
                      </button>
                    </form>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center space-x-1.5 text-xs font-bold uppercase text-[#111111]">
                    <span>[DEMO ACCOUNTS]</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {DEMO_ACCOUNTS.map((demo) => {
                      const isCurrent = userProfile.isLoggedIn && userProfile.id === demo.id;
                      return (
                        <button
                          key={demo.id}
                          onClick={() => handleQuickLogin(demo)}
                          className={`p-3 border text-left transition-all cursor-pointer ${
                            isCurrent
                              ? "bg-[#111111] text-white border-[#111111]"
                              : "bg-white border-[#111111] hover:bg-[#ededed]"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-xs uppercase">{demo.name}</span>
                            {isCurrent && (
                              <span className="text-[9px] font-bold border border-white px-1">
                                [ACTIVE]
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] opacity-75 truncate">
                            {demo.major}
                          </div>
                          <div className="text-[10px] opacity-75 font-mono mt-1">
                            {demo.studyStreakDays}D STREAK // {(demo.totalStudyMinutes / 60).toFixed(0)}H
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
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
