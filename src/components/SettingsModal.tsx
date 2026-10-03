import React, { useState } from "react";
import {
  X,
  Settings,
  User,
  Languages,
  Info,
  Check,
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
  Eye,
  EyeOff,
  Mail,
  Lock,
  AlertCircle,
  CheckCircle2,
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
import {
  loginWithGoogle,
  loginWithEmail,
  registerWithEmail,
  resetPasswordWithEmail,
  logoutUser,
  uploadLocalPlansToCloud,
  saveUserProfileToCloud
} from "../lib/firebase";

function getAuthErrorMessage(err: any, lang: Language): string {
  const code = err?.code || "";
  const msg = err?.message || "";
  if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
    return lang === "zh" ? "账号或密码不正确，请核对后重试。" : "Invalid email or password.";
  }
  if (code === "auth/user-not-found") {
    return lang === "zh" ? "未找到该邮箱对应的账号，请先点击「注册新账号」。" : "No account found with this email. Please sign up.";
  }
  if (code === "auth/email-already-in-use") {
    return lang === "zh" ? "该邮箱已被注册，请直接切换至「登录现有账号」。" : "This email is already registered. Please sign in.";
  }
  if (code === "auth/weak-password") {
    return lang === "zh" ? "密码强度不足，请至少设置 6 位字符。" : "Password is too weak. Please use at least 6 characters.";
  }
  if (code === "auth/invalid-email") {
    return lang === "zh" ? "请输入有效的邮箱地址。" : "Please enter a valid email address.";
  }
  if (code === "auth/too-many-requests") {
    return lang === "zh" ? "登录尝试过于频繁，请稍候片刻再试。" : "Too many requests. Please try again later.";
  }
  if (code === "auth/network-request-failed") {
    return lang === "zh" ? "网络连接异常，请检查网络后重试。" : "Network error, please check connection.";
  }
  if (code === "auth/popup-closed-by-user") {
    return lang === "zh" ? "已取消 Google 授权登录。" : "Google sign-in was cancelled.";
  }
  return msg || (lang === "zh" ? "认证失败，请重试。" : "Authentication failed.");
}

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

  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [registerInstitution, setRegisterInstitution] = useState("");
  const [registerMajor, setRegisterMajor] = useState("");

  const [authErrorMsg, setAuthErrorMsg] = useState<string | null>(null);
  const [authSuccessMsg, setAuthSuccessMsg] = useState<string | null>(null);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  // Password reset state
  const [showForgotDialog, setShowForgotDialog] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [isSendingForgot, setIsSendingForgot] = useState(false);

  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);
  const [isLoggingInWithGoogle, setIsLoggingInWithGoogle] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [isPopupBlocked, setIsPopupBlocked] = useState(false);

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

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim()) {
      setAuthErrorMsg(language === "zh" ? "请输入登录邮箱" : "Please enter email");
      return;
    }
    if (!loginPassword) {
      setAuthErrorMsg(language === "zh" ? "请输入登录密码" : "Please enter password");
      return;
    }

    setAuthErrorMsg(null);
    setAuthSuccessMsg(null);
    setIsSubmittingAuth(true);

    try {
      const user = await loginWithEmail(loginEmail.trim(), loginPassword);
      const updated: UserProfile = {
        ...userProfile,
        id: user.uid,
        name: user.displayName || loginEmail.split("@")[0] || "Student",
        email: user.email || loginEmail.trim(),
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

      showToast(language === "zh" ? `欢迎回来，${updated.name}！云端数据已同步。` : `Signed in as ${updated.name}`);
    } catch (err: any) {
      setAuthErrorMsg(getAuthErrorMessage(err, language));
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerEmail.trim()) {
      setAuthErrorMsg(language === "zh" ? "请输入注册邮箱" : "Please enter email");
      return;
    }
    if (!registerPassword) {
      setAuthErrorMsg(language === "zh" ? "请设置密码" : "Please enter password");
      return;
    }
    if (registerPassword.length < 6) {
      setAuthErrorMsg(language === "zh" ? "密码长度至少需要 6 位字符" : "Password must be at least 6 characters");
      return;
    }
    if (registerPassword !== registerConfirmPassword) {
      setAuthErrorMsg(language === "zh" ? "两次输入的密码不一致，请重新核对" : "Passwords do not match");
      return;
    }

    setAuthErrorMsg(null);
    setAuthSuccessMsg(null);
    setIsSubmittingAuth(true);

    try {
      const displayName = registerName.trim() || registerEmail.split("@")[0] || "Student";
      const user = await registerWithEmail(registerEmail.trim(), registerPassword, displayName);
      const updated: UserProfile = {
        ...userProfile,
        id: user.uid,
        name: displayName,
        email: user.email || registerEmail.trim(),
        avatar: "🎓",
        institution: registerInstitution.trim() || undefined,
        major: registerMajor.trim() || undefined,
        targetDegreeOrGoal: "General Exam Preparation",
        isLoggedIn: true,
        membershipTier: "Pro Student",
        memberSince: new Date().toISOString().slice(0, 10),
      };
      setEditingProfile(updated);
      onUpdateUserProfile(updated);

      await saveUserProfileToCloud(user.uid, updated);
      if (plans.length > 0) {
        await uploadLocalPlansToCloud(user.uid, plans);
      }

      showToast(language === "zh" ? `注册成功！欢迎加入，${displayName}` : `Registered successfully! Welcome, ${displayName}`);
    } catch (err: any) {
      setAuthErrorMsg(getAuthErrorMessage(err, language));
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleSendForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setAuthErrorMsg(language === "zh" ? "请输入需要重置密码的邮箱" : "Please enter email");
      return;
    }
    setIsSendingForgot(true);
    setAuthErrorMsg(null);
    try {
      await resetPasswordWithEmail(forgotEmail.trim());
      setAuthSuccessMsg(
        language === "zh"
          ? `密码重置邮件已发送至 ${forgotEmail.trim()}，请查阅邮件完成重置。`
          : `Password reset email sent to ${forgotEmail.trim()}.`
      );
      setShowForgotDialog(false);
    } catch (err: any) {
      setAuthErrorMsg(getAuthErrorMessage(err, language));
    } finally {
      setIsSendingForgot(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsLoggingInWithGoogle(true);
      setIsPopupBlocked(false);
      setAuthErrorMsg(null);
      setAuthSuccessMsg(null);
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
          ? `Google 账号 ${updated.name} 已成功登录并同步！`
          : `Signed in as ${updated.name} with Cloud Sync!`
      );
    } catch (err: any) {
      const errStr = String(err?.message || err?.code || "");
      if (errStr.includes("popup-blocked") || err?.code === "auth/popup-blocked") {
        setIsPopupBlocked(true);
        setAuthErrorMsg(
          language === "zh"
            ? "浏览器拦截了弹出授权窗口，请在下方点击在新标签页打开，或直接使用邮箱密码登录。"
            : "Browser popup was blocked in this preview iframe. Please open in a new tab or use email."
        );
      } else if (err?.code === "auth/popup-closed-by-user") {
        setAuthErrorMsg(language === "zh" ? "登录已取消" : "Sign in cancelled");
      } else {
        setAuthErrorMsg(getAuthErrorMessage(err, language));
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
      id: "",
      name: language === "zh" ? "备考学员" : "Student",
      email: "",
      avatar: "🎓",
      institution: "",
      major: "",
      targetDegreeOrGoal: "",
      isLoggedIn: false,
      membershipTier: "Free",
      totalStudyMinutes: 0,
      studyStreakDays: 0,
      completedExamsCount: 0,
    };
    setEditingProfile(updated);
    onUpdateUserProfile(updated);
    if (onLogout) {
      onLogout();
    }
    showToast(language === "zh" ? "已安全退出登录，个人备考数据与云端同步已清理" : "Signed out, personal data cleared");
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
                  <div className="space-y-4">
                    {/* Mode Switcher Tabs */}
                    <div className="flex border border-[#111111] overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode("login");
                          setAuthErrorMsg(null);
                          setAuthSuccessMsg(null);
                        }}
                        className={`flex-1 py-2.5 text-xs font-bold uppercase transition-all cursor-pointer border-r border-[#111111] flex items-center justify-center space-x-1.5 ${
                          authMode === "login"
                            ? "bg-[#111111] text-white"
                            : "bg-[#faf9f6] text-[#666666] hover:bg-[#e4e1d8] hover:text-[#111111]"
                        }`}
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        <span>{language === "zh" ? "登录现有账号" : "SIGN IN"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode("register");
                          setAuthErrorMsg(null);
                          setAuthSuccessMsg(null);
                        }}
                        className={`flex-1 py-2.5 text-xs font-bold uppercase transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                          authMode === "register"
                            ? "bg-[#111111] text-white"
                            : "bg-[#faf9f6] text-[#666666] hover:bg-[#e4e1d8] hover:text-[#111111]"
                        }`}
                      >
                        <User className="w-3.5 h-3.5" />
                        <span>{language === "zh" ? "注册新账号" : "CREATE ACCOUNT"}</span>
                      </button>
                    </div>

                    <div className="p-5 border border-[#111111] bg-white space-y-4">
                      {/* One-click Google Login */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-mono uppercase text-[#777777] font-bold">
                            [FAST OAUTH // 快速验证]
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleGoogleLogin}
                          disabled={isLoggingInWithGoogle}
                          className="w-full py-2.5 px-4 bg-white hover:bg-[#fafafa] text-[#111111] border border-[#111111] text-xs font-bold flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-xs active:translate-y-0.5 disabled:opacity-50"
                        >
                          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                            <path
                              fill="#4285F4"
                              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                            />
                            <path
                              fill="#34A853"
                              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"
                            />
                            <path
                              fill="#FBBC05"
                              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                            />
                            <path
                              fill="#EA4335"
                              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                            />
                          </svg>
                          <span>
                            {isLoggingInWithGoogle
                              ? (language === "zh" ? "正在连接 Google 授权..." : "Connecting to Google...")
                              : (language === "zh" ? "使用 Google 账号一键登录" : "Continue with Google")}
                          </span>
                        </button>
                      </div>

                      {/* Iframe popup blocked notice */}
                      {isPopupBlocked && (
                        <div className="p-3 border border-[#111111] bg-[#fafafa] text-xs space-y-2 text-[#111111]">
                          <div className="font-bold text-[#d44c47] flex items-center space-x-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>[!] {language === "zh" ? "浏览器拦截了弹出授权窗口" : "Popup blocked by browser"}</span>
                          </div>
                          <p className="text-[11px] leading-relaxed text-[#666666]">
                            {language === "zh"
                              ? "当前应用在内嵌预览窗口中运行，浏览器安全策略拦截了 Google 弹窗。您可以点击下方在新标签页中打开应用完成登录，或者直接在下方使用邮箱免弹窗直接登录。"
                              : "The preview iframe prevented the Google popup from opening. You can open the app in a new tab or sign in with email below."}
                          </p>
                          <button
                            type="button"
                            onClick={() => window.open(window.location.href, "_blank")}
                            className="w-full py-1.5 px-3 bg-[#111111] text-white border border-[#111111] font-bold text-xs cursor-pointer flex items-center justify-center space-x-1"
                          >
                            <span>{language === "zh" ? "[在新标签页打开并登录 ↗]" : "[OPEN IN NEW TAB & SIGN IN ↗]"}</span>
                          </button>
                        </div>
                      )}

                      {/* Divider */}
                      <div className="relative flex py-1 items-center">
                        <div className="flex-grow border-t border-[#dedad1]"></div>
                        <span className="flex-shrink mx-3 text-[10px] font-mono font-bold text-[#777777] uppercase">
                          {language === "zh" ? "或使用邮箱与密码" : "OR EMAIL & PASSWORD"}
                        </span>
                        <div className="flex-grow border-t border-[#dedad1]"></div>
                      </div>

                      {/* Error message */}
                      {authErrorMsg && (
                        <div className="p-3 border border-[#d44c47] bg-[#fdf2f2] text-xs text-[#d44c47] flex items-start space-x-2">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <span className="leading-tight">{authErrorMsg}</span>
                        </div>
                      )}

                      {/* Success message */}
                      {authSuccessMsg && (
                        <div className="p-3 border border-[#22c55e] bg-[#f0fdf4] text-xs text-[#15803d] flex items-start space-x-2">
                          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                          <span className="leading-tight">{authSuccessMsg}</span>
                        </div>
                      )}

                      {/* Login Form */}
                      {authMode === "login" && (
                        <form onSubmit={handleSignIn} className="space-y-3">
                          <div>
                            <label className="text-[10px] font-bold uppercase text-[#666666] block mb-1">
                              {language === "zh" ? "登录邮箱" : "EMAIL ADDRESS"}
                            </label>
                            <div className="relative">
                              <Mail className="w-3.5 h-3.5 text-[#888888] absolute left-3 top-1/2 -translate-y-1/2" />
                              <input
                                type="email"
                                required
                                value={loginEmail}
                                onChange={(e) => setLoginEmail(e.target.value)}
                                placeholder="student@example.com"
                                className="w-full pl-9 pr-3 py-2 border border-[#111111] text-xs text-[#111111] bg-white focus:outline-none focus:ring-1 focus:ring-[#111111]"
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] font-bold uppercase text-[#666666]">
                                {language === "zh" ? "登录密码" : "PASSWORD"}
                              </label>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowForgotDialog(!showForgotDialog);
                                  setForgotEmail(loginEmail);
                                }}
                                className="text-[10px] text-[#666666] hover:text-[#111111] underline cursor-pointer"
                              >
                                {language === "zh" ? "忘记密码？" : "Forgot Password?"}
                              </button>
                            </div>
                            <div className="relative">
                              <Lock className="w-3.5 h-3.5 text-[#888888] absolute left-3 top-1/2 -translate-y-1/2" />
                              <input
                                type={showPassword ? "text" : "password"}
                                required
                                value={loginPassword}
                                onChange={(e) => setLoginPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full pl-9 pr-9 py-2 border border-[#111111] text-xs text-[#111111] bg-white focus:outline-none focus:ring-1 focus:ring-[#111111]"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#888888] hover:text-[#111111] p-1 cursor-pointer"
                              >
                                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>

                          {/* Forgot password dialog */}
                          {showForgotDialog && (
                            <div className="p-3 bg-[#faf9f6] border border-[#dedad1] space-y-2">
                              <div className="text-[11px] font-bold text-[#111111]">
                                {language === "zh" ? "重置登录密码" : "Reset Password"}
                              </div>
                              <p className="text-[10px] text-[#666666]">
                                {language === "zh" ? "输入您的注册邮箱，系统将发送密码重置安全链接。" : "Enter your email to receive a password reset link."}
                              </p>
                              <div className="flex space-x-2">
                                <input
                                  type="email"
                                  value={forgotEmail}
                                  onChange={(e) => setForgotEmail(e.target.value)}
                                  placeholder="student@example.com"
                                  className="flex-1 px-2.5 py-1.5 border border-[#111111] text-xs bg-white focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={handleSendForgot}
                                  disabled={isSendingForgot}
                                  className="px-3 py-1.5 bg-[#111111] text-white text-xs font-bold hover:bg-[#333333] cursor-pointer disabled:opacity-50"
                                >
                                  {isSendingForgot ? "..." : (language === "zh" ? "发送" : "Send")}
                                </button>
                              </div>
                            </div>
                          )}

                          <button
                            type="submit"
                            disabled={isSubmittingAuth}
                            className="w-full py-2.5 bg-[#111111] hover:bg-[#333333] text-white border border-[#111111] text-xs font-bold transition-all cursor-pointer shadow-xs active:translate-y-0.5 disabled:opacity-50 flex items-center justify-center space-x-1.5"
                          >
                            <LogIn className="w-3.5 h-3.5" />
                            <span>
                              {isSubmittingAuth
                                ? (language === "zh" ? "正在验证登录..." : "SIGNING IN...")
                                : (language === "zh" ? "登录账号并开启同步" : "SIGN IN & SYNC")}
                            </span>
                          </button>

                          <div className="text-center pt-2">
                            <button
                              type="button"
                              onClick={() => {
                                setAuthMode("register");
                                setAuthErrorMsg(null);
                                setAuthSuccessMsg(null);
                              }}
                              className="text-[11px] text-[#666666] hover:text-[#111111] underline cursor-pointer"
                            >
                              {language === "zh" ? "还没有账号？立即免费注册 →" : "Don't have an account? Sign up now →"}
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Register Form */}
                      {authMode === "register" && (
                        <form onSubmit={handleRegister} className="space-y-3">
                          <div>
                            <label className="text-[10px] font-bold uppercase text-[#666666] block mb-1">
                              {language === "zh" ? "学员姓名 / 昵称" : "NAME / NICKNAME"}
                            </label>
                            <div className="relative">
                              <User className="w-3.5 h-3.5 text-[#888888] absolute left-3 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                required
                                value={registerName}
                                onChange={(e) => setRegisterName(e.target.value)}
                                placeholder={language === "zh" ? "如：李华 / Alex" : "e.g. Alex Chen"}
                                className="w-full pl-9 pr-3 py-2 border border-[#111111] text-xs text-[#111111] bg-white focus:outline-none focus:ring-1 focus:ring-[#111111]"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold uppercase text-[#666666] block mb-1">
                              {language === "zh" ? "注册邮箱" : "EMAIL ADDRESS"}
                            </label>
                            <div className="relative">
                              <Mail className="w-3.5 h-3.5 text-[#888888] absolute left-3 top-1/2 -translate-y-1/2" />
                              <input
                                type="email"
                                required
                                value={registerEmail}
                                onChange={(e) => setRegisterEmail(e.target.value)}
                                placeholder="student@example.com"
                                className="w-full pl-9 pr-3 py-2 border border-[#111111] text-xs text-[#111111] bg-white focus:outline-none focus:ring-1 focus:ring-[#111111]"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] font-bold uppercase text-[#666666] block mb-1">
                                {language === "zh" ? "设置密码 (至少 6 位)" : "PASSWORD (MIN 6 CHARS)"}
                              </label>
                              <div className="relative">
                                <Lock className="w-3.5 h-3.5 text-[#888888] absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                  type={showPassword ? "text" : "password"}
                                  required
                                  minLength={6}
                                  value={registerPassword}
                                  onChange={(e) => setRegisterPassword(e.target.value)}
                                  placeholder="••••••••"
                                  className="w-full pl-9 pr-9 py-2 border border-[#111111] text-xs text-[#111111] bg-white focus:outline-none focus:ring-1 focus:ring-[#111111]"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowPassword(!showPassword)}
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#888888] hover:text-[#111111] p-1 cursor-pointer"
                                >
                                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>

                            <div>
                              <label className="text-[10px] font-bold uppercase text-[#666666] block mb-1">
                                {language === "zh" ? "确认密码" : "CONFIRM PASSWORD"}
                              </label>
                              <div className="relative">
                                <Lock className="w-3.5 h-3.5 text-[#888888] absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                  type={showPassword ? "text" : "password"}
                                  required
                                  minLength={6}
                                  value={registerConfirmPassword}
                                  onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                                  placeholder="••••••••"
                                  className={`w-full pl-9 pr-3 py-2 border text-xs text-[#111111] bg-white focus:outline-none ${
                                    registerConfirmPassword && registerPassword !== registerConfirmPassword
                                      ? "border-[#d44c47]"
                                      : "border-[#111111]"
                                  }`}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] font-bold uppercase text-[#666666] block mb-1">
                                {language === "zh" ? "目标院校 / 机构 (选填)" : "INSTITUTION (OPTIONAL)"}
                              </label>
                              <input
                                type="text"
                                value={registerInstitution}
                                onChange={(e) => setRegisterInstitution(e.target.value)}
                                placeholder={language === "zh" ? "如：清华大学 / 北京大学" : "e.g. University Dept"}
                                className="w-full px-3 py-2 border border-[#dedad1] focus:border-[#111111] text-xs text-[#111111] bg-white focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold uppercase text-[#666666] block mb-1">
                                {language === "zh" ? "专业 / 考试类型 (选填)" : "MAJOR / GOAL (OPTIONAL)"}
                              </label>
                              <input
                                type="text"
                                value={registerMajor}
                                onChange={(e) => setRegisterMajor(e.target.value)}
                                placeholder={language === "zh" ? "如：计算机 / 考研统考" : "e.g. Computer Science"}
                                className="w-full px-3 py-2 border border-[#dedad1] focus:border-[#111111] text-xs text-[#111111] bg-white focus:outline-none"
                              />
                            </div>
                          </div>

                          <button
                            type="submit"
                            disabled={isSubmittingAuth}
                            className="w-full py-2.5 bg-[#111111] hover:bg-[#333333] text-white border border-[#111111] text-xs font-bold transition-all cursor-pointer shadow-xs active:translate-y-0.5 disabled:opacity-50 flex items-center justify-center space-x-1.5"
                          >
                            <User className="w-3.5 h-3.5" />
                            <span>
                              {isSubmittingAuth
                                ? (language === "zh" ? "正在创建账号..." : "CREATING ACCOUNT...")
                                : (language === "zh" ? "立即注册并创建学员档案" : "REGISTER & CREATE PROFILE")}
                            </span>
                          </button>

                          <div className="text-center pt-2">
                            <button
                              type="button"
                              onClick={() => {
                                setAuthMode("login");
                                setAuthErrorMsg(null);
                                setAuthSuccessMsg(null);
                              }}
                              className="text-[11px] text-[#666666] hover:text-[#111111] underline cursor-pointer"
                            >
                              {language === "zh" ? "已有账号？直接登录 →" : "Already have an account? Sign in →"}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
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
