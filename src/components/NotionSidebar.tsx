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
  onDeletePlan?: (planId: string) => void;
  onRequestDeletePlan?: (plan: ExamStudyPlan) => void;
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
  onDeletePlan,
  onRequestDeletePlan,
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
    <aside className="w-64 bg-[#f2f0ea] border-r border-[#111111] flex flex-col h-screen fixed top-0 left-0 z-40 select-none text-[13px] text-[#111111] font-sans">
      {/* Workspace Editorial Masthead */}
      <div className="p-3.5 flex items-center justify-between border-b border-[#111111] bg-[#faf9f6]">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-6 h-6 bg-[#111111] text-white flex items-center justify-center text-[10px] font-mono font-bold shrink-0 tracking-tighter">
            EP
          </div>
          <div className="min-w-0">
            <span className="font-bold text-xs text-[#111111] tracking-tight font-sans block truncate">
              EXAM PLAN AI
            </span>
            <span className="text-[10px] text-[#666666] font-mono block truncate">
              // STUDY ENGINE
            </span>
          </div>
        </div>

        <button
          onClick={onToggle}
          className="p-1 text-[#666666] hover:text-[#111111] hover:bg-[#e4e1d8] transition-colors border border-transparent hover:border-[#111111] cursor-pointer"
          title="Collapse Sidebar"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Primary Navigation */}
      <div className="p-2 space-y-1 border-b border-[#dedad1]">
        <button
          onClick={() => onTabChange("dashboard")}
          className={`w-full flex items-center space-x-2 px-2.5 py-2 text-left transition-all cursor-pointer font-sans text-xs ${
            currentTab === "dashboard"
              ? "bg-[#111111] text-white font-semibold"
              : "hover:bg-[#e4e1d8] text-[#333333]"
          }`}
        >
          <span className="text-[10px] font-mono opacity-70">01</span>
          <LayoutDashboard className="w-3.5 h-3.5" />
          <span className="flex-1 truncate uppercase tracking-wider">{language === "zh" ? "科目看板" : "DASHBOARD"}</span>
        </button>

        <button
          onClick={() => onTabChange("master_calendar")}
          className={`w-full flex items-center space-x-2 px-2.5 py-2 text-left transition-all cursor-pointer font-sans text-xs ${
            currentTab === "master_calendar"
              ? "bg-[#111111] text-white font-semibold"
              : "hover:bg-[#e4e1d8] text-[#333333]"
          }`}
        >
          <span className="text-[10px] font-mono opacity-70">02</span>
          <Calendar className="w-3.5 h-3.5" />
          <span className="flex-1 truncate uppercase tracking-wider">{language === "zh" ? "全科日历" : "CALENDAR"}</span>
        </button>

        <button
          onClick={onNewPlan}
          className={`w-full flex items-center space-x-2 px-2.5 py-2 text-left transition-all cursor-pointer font-sans text-xs border border-dashed border-[#111111]/30 hover:border-[#111111] ${
            currentTab === "add_subject"
              ? "bg-[#111111] text-white font-semibold"
              : "hover:bg-[#e4e1d8] text-[#111111]"
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="flex-1 truncate uppercase tracking-wider">{language === "zh" ? "新建科目" : "NEW SUBJECT"}</span>
        </button>
      </div>

      {/* Courses / Exam Plans Hierarchy Tree */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <div className="flex items-center justify-between px-2 py-1.5 text-[10px] font-mono uppercase tracking-widest text-[#777777] border-b border-[#dedad1] mb-1">
          <span className="flex items-center space-x-1">
            <span>INDEX // {language === "zh" ? "备考科目" : "COURSES"}</span>
          </span>
          <span className="text-[10px] font-mono">[{plans.length}]</span>
        </div>

        {plans.map((p, idx) => {
          const isActivePlan = activePlan?.id === p.id && currentTab !== "dashboard" && currentTab !== "master_calendar" && currentTab !== "add_subject";

          return (
            <div
              key={p.id}
              className={`group flex items-center justify-between w-full transition-all border ${
                isActivePlan
                  ? "bg-white border-[#111111] font-semibold text-[#111111]"
                  : "border-transparent hover:border-[#dedad1] hover:bg-[#e4e1d8] text-[#333333]"
              }`}
            >
              <button
                onClick={() => {
                  onSelectPlan(p.id);
                  onTabChange("course", p.id);
                }}
                className="flex-1 flex items-center space-x-2 px-2 py-1.5 text-left truncate cursor-pointer min-w-0"
              >
                <span className="font-mono text-[10px] text-[#777777]">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 truncate text-xs font-sans">{p.examName}</span>
              </button>

              {(onRequestDeletePlan || onDeletePlan) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onRequestDeletePlan) {
                      onRequestDeletePlan(p);
                    } else if (onDeletePlan) {
                      onDeletePlan(p.id);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 mr-1 text-[#777777] hover:text-[#d44c47] transition-all shrink-0 cursor-pointer"
                  title={language === "zh" ? "删除此课程" : "Delete Course"}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Language Switcher, User Profile & Sidebar Footer Actions */}
      <div className="p-2.5 border-t border-[#111111] space-y-1.5 text-xs bg-[#faf9f6]">
        {/* User Account / Login Profile */}
        {userProfile && onOpenSettings && (
          <button
            onClick={() => onOpenSettings("account")}
            className="w-full flex items-center justify-between p-2 bg-white border border-[#dedad1] hover:border-[#111111] text-left transition-all group cursor-pointer"
          >
            <div className="flex items-center space-x-2 min-w-0">
              <div className="w-5 h-5 bg-[#111111] text-white flex items-center justify-center text-[10px] shrink-0 font-mono">
                {userProfile.isLoggedIn ? (userProfile.name[0] || "U").toUpperCase() : "G"}
              </div>
              <div className="min-w-0">
                <span className="font-sans text-[11px] font-bold text-[#111111] block truncate">
                  {userProfile.isLoggedIn ? userProfile.name : (language === "zh" ? "访客用户" : "Guest Scholar")}
                </span>
              </div>
            </div>
            <span className="font-mono text-[9px] text-[#777777] group-hover:text-[#111111]">
              [PROFILE]
            </span>
          </button>
        )}

        <div className="flex items-center space-x-1 pt-1 font-mono text-[11px]">
          <button
            onClick={() => onOpenSettings ? onOpenSettings("general") : null}
            className="flex-1 flex items-center justify-center space-x-1 py-1.5 bg-white border border-[#dedad1] hover:border-[#111111] text-[#111111] transition-all cursor-pointer"
          >
            <Settings className="w-3 h-3" />
            <span>CONFIG</span>
          </button>

          <button
            onClick={() => onOpenSettings ? onOpenSettings("language") : setLanguage(language === "zh" ? "en" : "zh")}
            className="flex-1 flex items-center justify-center space-x-1 py-1.5 bg-white border border-[#dedad1] hover:border-[#111111] text-[#111111] transition-all cursor-pointer"
          >
            <Languages className="w-3 h-3" />
            <span>{language === "zh" ? "ZH / EN" : "EN / ZH"}</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
