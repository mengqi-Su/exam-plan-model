import React, { useState, useEffect } from "react";
import { 
  BookOpen, 
  Calendar, 
  CheckSquare, 
  ChevronRight, 
  ChevronDown,
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
  Languages,
  LayoutDashboard,
  Layers,
  BarChart3,
  Sliders,
  User,
  Info
} from "lucide-react";
import { ExamStudyPlan, UserProfile } from "../types";
import { downloadICSFile } from "../lib/calendarExport";
import { useI18n } from "../lib/i18n";
import { APP_VERSION_DATA } from "../lib/storage";

interface NotionSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  plans: ExamStudyPlan[];
  activePlan: ExamStudyPlan | null;
  onSelectPlan: (planId: string) => void;
  onNewPlan: () => void;
  currentTab: "dashboard" | "master_calendar" | "todo" | "realtime" | "course" | "materials" | "add_subject";
  onTabChange: (tab: "dashboard" | "master_calendar" | "todo" | "realtime" | "course" | "add_subject", planId?: string) => void;
  onOpenRebalanceModal: () => void;
  userProfile?: UserProfile;
  onOpenSettings?: (tab?: "general" | "account" | "language" | "version") => void;
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
  userProfile,
  onOpenSettings,
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

      {/* Global Views: Master Dashboard, Master Calendar & Add Subject */}
      <div className="px-2 py-3 space-y-1 border-b border-[#e9e9e7]">
        <button
          onClick={() => onTabChange("dashboard")}
          className={`w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-md text-left transition-colors ${
            currentTab === "dashboard"
              ? "bg-[#efefed] font-semibold text-[#37352f]"
              : "hover:bg-[#efefed] text-[#5a5a57]"
          }`}
        >
          <LayoutDashboard className="w-4 h-4 text-[#2b78a0]" />
          <span className="flex-1 truncate">{language === "zh" ? "总览看板" : t("tabDashboard")}</span>
        </button>

        <button
          onClick={() => onTabChange("master_calendar")}
          className={`w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-md text-left transition-colors ${
            currentTab === "master_calendar"
              ? "bg-[#efefed] font-semibold text-[#37352f]"
              : "hover:bg-[#efefed] text-[#5a5a57]"
          }`}
        >
          <Calendar className="w-4 h-4 text-[#2b78a0]" />
          <span className="flex-1 truncate">{language === "zh" ? "全科日历" : "Master Calendar"}</span>
        </button>

        <button
          onClick={onNewPlan}
          className={`w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-md text-left transition-colors ${
            currentTab === "add_subject"
              ? "bg-[#efefed] font-semibold text-[#37352f]"
              : "hover:bg-[#efefed] text-[#5a5a57]"
          }`}
        >
          <Plus className="w-4 h-4 text-[#448361]" />
          <span className="flex-1 truncate">{language === "zh" ? "新建科目" : t("newPlan")}</span>
        </button>
      </div>

      {/* Courses / Exam Plans Hierarchy Tree */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        <div className="flex items-center justify-between px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#9b9a97]">
          <span className="flex items-center space-x-1.5">
            <Layers className="w-3 h-3 text-[#9b9a97]" />
            <span>{language === "zh" ? "备考科目" : t("examPlans")}</span>
          </span>
          <button
            onClick={onNewPlan}
            className="p-0.5 rounded hover:bg-[#e9e9e7] text-[#787774] hover:text-[#37352f]"
            title={t("addNewPlan")}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {plans.map((p) => {
          const isActivePlan = activePlan?.id === p.id && currentTab !== "dashboard" && currentTab !== "master_calendar" && currentTab !== "add_subject";

          return (
            <button
              key={p.id}
              onClick={() => {
                onSelectPlan(p.id);
                onTabChange("course", p.id);
              }}
              className={`w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-md text-left transition-colors cursor-pointer ${
                isActivePlan
                  ? "bg-[#efefed] font-semibold text-[#37352f]"
                  : "hover:bg-[#efefed] text-[#5a5a57]"
              }`}
            >
              <GraduationCap className={`w-4 h-4 shrink-0 ${isActivePlan ? "text-[#2b78a0]" : "text-[#787774]"}`} />
              <span className="flex-1 truncate text-xs">{p.examName}</span>
            </button>
          );
        })}
      </div>

      {/* Language Switcher, User Profile & Sidebar Footer Actions */}
      <div className="p-3 border-t border-[#e9e9e7] space-y-1.5 text-xs bg-[#f7f6f3]">
        {/* User Account / Login Profile */}
        {userProfile && onOpenSettings && (
          <button
            onClick={() => onOpenSettings("account")}
            className="w-full flex items-center justify-between p-2 rounded-lg bg-white border border-[#e9e9e7] hover:border-[#37352f] text-left transition-all shadow-2xs group"
          >
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-6 h-6 rounded-md bg-[#37352f] text-white flex items-center justify-center text-xs shrink-0">
                {userProfile.isLoggedIn ? (userProfile.avatar || "🎓") : "👤"}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-xs text-[#37352f] truncate flex items-center space-x-1">
                  <span>{userProfile.isLoggedIn ? userProfile.name : t("userLoginBtn")}</span>
                  {userProfile.isLoggedIn && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#448361]" />
                  )}
                </div>
                <div className="text-[10px] text-[#787774] truncate">
                  {userProfile.isLoggedIn ? (userProfile.major || userProfile.email) : (language === "zh" ? "点击登录同步" : "Click to sign in")}
                </div>
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-[#9b9a97] group-hover:text-[#37352f] transition-colors shrink-0" />
          </button>
        )}

        {/* Secondary entry buttons: Hidden when user is logged in to keep sidebar minimal & uncluttered */}
        {!userProfile?.isLoggedIn && (
          <>
            {/* Configuration & Preferences */}
            {onOpenSettings && (
              <button
                onClick={() => onOpenSettings("general")}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded text-[#5a5a57] hover:bg-[#efefed] hover:text-[#37352f] transition-colors"
              >
                <span className="flex items-center space-x-2">
                  <Settings className="w-3.5 h-3.5 text-[#787774]" />
                  <span>{t("settingsTitle")}</span>
                </span>
              </button>
            )}

            {/* Language selector toggle */}
            <button
              onClick={() => onOpenSettings ? onOpenSettings("language") : setLanguage(language === "zh" ? "en" : "zh")}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded text-[#5a5a57] hover:bg-[#efefed] hover:text-[#37352f] transition-colors"
            >
              <span className="flex items-center space-x-2">
                <Languages className="w-3.5 h-3.5 text-[#787774]" />
                <span>{language === "zh" ? "语言 / Language" : "Language / 语言"}</span>
              </span>
              <span className="font-semibold text-[11px] px-1.5 py-0.5 rounded bg-[#e9e9e7] text-[#37352f]">
                {language === "zh" ? "中文" : "English"}
              </span>
            </button>

            {/* Version Information & Diagnostics */}
            {onOpenSettings && (
              <button
                onClick={() => onOpenSettings("version")}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded text-[#5a5a57] hover:bg-[#efefed] hover:text-[#37352f] transition-colors"
              >
                <span className="flex items-center space-x-2">
                  <Info className="w-3.5 h-3.5 text-[#787774]" />
                  <span>{language === "zh" ? "版本信息与诊断" : "Version & About"}</span>
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#e9e9e7] text-[#787774]">
                  {APP_VERSION_DATA.version}
                </span>
              </button>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
