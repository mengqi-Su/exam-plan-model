import React, { useState, useEffect } from "react";
import { NotionSidebar } from "./components/NotionSidebar";
import { MasterDashboard } from "./components/MasterDashboard";
import { CourseDetailPage } from "./components/CourseDetailPage";
import { AddExamSubjectWizard } from "./components/AddExamSubjectWizard";
import { MasterCalendarView } from "./components/MasterCalendarView";
import { TodayFocusView } from "./components/TodayFocusView";
import { SettingsPage } from "./components/SettingsPage";
import { DeleteConfirmModal } from "./components/DeleteConfirmModal";
import {
  AlertTriangle,
  Calendar,
  LayoutDashboard,
  Plus,
  Settings,
  Sun,
} from "lucide-react";
import { AppSettings, AppTab, ExamStudyPlan } from "./types";
import {
  loadSavedPlans,
  savePlans,
  getActivePlanId,
  setActivePlanId,
  loadAppSettings,
  saveAppSettings,
  clearPlannerData,
} from "./lib/storage";
import { toLocalDateString } from "./lib/date";
import { useI18n } from "./lib/i18n";

export default function App() {
  const { language } = useI18n();
  const [plans, setPlans] = useState<ExamStudyPlan[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [appNotice, setAppNotice] = useState<string | null>(null);
  const [activePlanId, setActivePlanIdState] = useState<string>(() => getActivePlanId());
  const [currentTab, setCurrentTab] = useState<AppTab>("today");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [appSettings, setAppSettings] = useState<AppSettings>(() => loadAppSettings());

  useEffect(() => {
    let cancelled = false;
    loadSavedPlans()
      .then((loadedPlans) => {
        if (cancelled) return;
        setPlans(loadedPlans);
        setActivePlanIdState((prev) => {
          if (prev && loadedPlans.some((p) => p.id === prev)) return prev;
          const nextId = loadedPlans[0]?.id || "";
          setActivePlanId(nextId);
          return nextId;
        });
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to load local plans", err);
          setSaveError(
            language === "zh"
              ? "读取本地备考数据失败，请检查浏览器存储权限。"
              : "Failed to read local planner data. Check your browser storage permissions."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    const timer = window.setTimeout(() => {
      savePlans(plans)
        .then(() => setSaveError(null))
        .catch((err: Error) => setSaveError(err.message));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [plans, isHydrated]);

  const [selectedDate, setSelectedDate] = useState<string>(() => toLocalDateString());

  const [planToDelete, setPlanToDelete] = useState<ExamStudyPlan | null>(null);

  const handleUpdateSettings = (newSettings: AppSettings) => {
    setAppSettings(newSettings);
    saveAppSettings(newSettings);
  };

  const handleClearAllData = async () => {
    await clearPlannerData();
    setPlans([]);
    setActivePlanIdState("");
    setActivePlanId("");
    setCurrentTab("today");
  };

  const handleImportPlans = (importedPlans: ExamStudyPlan[], importedSettings?: AppSettings) => {
    if (!Array.isArray(importedPlans)) return;
    const validPlans = importedPlans.filter(
      (p): p is ExamStudyPlan =>
        !!p && typeof p.id === "string" && typeof p.examName === "string" && Array.isArray(p.tasks)
    );
    if (validPlans.length === 0) return;
    setPlans((prev) => {
      const merged = [...prev];
      validPlans.forEach((imported) => {
        const index = merged.findIndex((p) => p.id === imported.id);
        if (index >= 0) merged[index] = imported;
        else merged.unshift(imported);
      });
      return merged;
    });
    if (!activePlanId) {
      setActivePlanIdState(validPlans[0].id);
      setActivePlanId(validPlans[0].id);
    }
    if (importedSettings) {
      handleUpdateSettings({ ...appSettings, ...importedSettings });
    }
  };

  const activePlan = React.useMemo(() => {
    return plans.find((p) => p.id === activePlanId) || plans[0] || null;
  }, [plans, activePlanId]);

  const handleSelectPlan = (planId: string) => {
    setActivePlanIdState(planId);
    setActivePlanId(planId);
  };

  const handleNewPlan = () => {
    setCurrentTab("add_subject");
  };

  const handleUpdatePlan = (updatedPlan: ExamStudyPlan) => {
    setPlans((prev) => prev.map((p) => (p.id === updatedPlan.id ? updatedPlan : p)));
  };

  const handleDeletePlan = (planId: string) => {
    setPlans((prev) => {
      const next = prev.filter((p) => p.id !== planId);
      if (activePlanId === planId) {
        if (next.length > 0) {
          setActivePlanIdState(next[0].id);
          setActivePlanId(next[0].id);
        } else {
          setActivePlanIdState("");
          setActivePlanId("");
          setCurrentTab("today");
        }
      }
      return next;
    });
  };

  const handlePlanGenerated = (newPlan: ExamStudyPlan, notice?: string | null) => {
    setPlans((prev) => [newPlan, ...prev.filter((p) => p.id !== newPlan.id)]);
    setActivePlanIdState(newPlan.id);
    setActivePlanId(newPlan.id);
    setAppNotice(notice || null);
    setCurrentTab("today");
    setSelectedDate(newPlan.startDate || toLocalDateString());
  };

  const handleNavigateToTab = (tab: AppTab, planId?: string) => {
    if (planId) {
      handleSelectPlan(planId);
    }
    if (tab === "today") {
      setSelectedDate(toLocalDateString());
    }
    setCurrentTab(tab);
  };

  const mobileNavItems = [
    { id: "today" as AppTab, label: language === "zh" ? "今日" : "Today", icon: Sun },
    { id: "dashboard" as AppTab, label: language === "zh" ? "科目" : "Subjects", icon: LayoutDashboard },
    { id: "master_calendar" as AppTab, label: language === "zh" ? "日历" : "Calendar", icon: Calendar },
    { id: "settings" as AppTab, label: language === "zh" ? "设置" : "Settings", icon: Settings },
  ];

  const isMobileNavActive = (tab: AppTab) => {
    if (tab === "dashboard") {
      return ["dashboard", "course", "add_subject"].includes(currentTab);
    }
    return currentTab === tab;
  };

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-[#f8f7f4] text-[#8a8580] flex items-center justify-center text-[13px]">
        <div className="flex items-center gap-2.5">
          <span className="w-4 h-4 rounded-full border-2 border-[#ddd9d2] border-t-[#1c1b1a] animate-spin" />
          <span>{language === "zh" ? "正在读取本地备考数据…" : "Loading local planner data…"}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f7f4] text-[#111111] flex antialiased selection:bg-[#111111] selection:text-white font-sans">
      <NotionSidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        plans={plans}
        activePlan={activePlan}
        onSelectPlan={handleSelectPlan}
        onNewPlan={handleNewPlan}
        onDeletePlan={handleDeletePlan}
        onRequestDeletePlan={(p) => setPlanToDelete(p)}
        currentTab={currentTab}
        onTabChange={(tab, planId) => {
          handleNavigateToTab(tab, planId);
        }}
      />

      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${
          isSidebarOpen ? "md:ml-64" : "ml-0"
        }`}
      >
        <div className="md:hidden sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[#e7e4de] bg-[#f8f7f4]/90 backdrop-blur px-4 py-2.5">
          <button
            onClick={() => handleNavigateToTab("today")}
            className="flex items-center gap-2 cursor-pointer"
            aria-label={language === "zh" ? "回到今日" : "Back to today"}
          >
            <span className="w-6 h-6 rounded-md bg-[#1c1b1a] text-white flex items-center justify-center text-[10px] font-semibold tracking-tight">
              EP
            </span>
            <span className="text-[13px] font-semibold tracking-tight text-[#1c1b1a]">EXAM PLAN AI</span>
          </button>
          <button
            onClick={handleNewPlan}
            className="p-2 min-w-9 min-h-9 rounded-lg border border-[#e5e2dc] bg-white text-[#1c1b1a] hover:bg-[#faf9f6] transition-colors cursor-pointer"
            aria-label={language === "zh" ? "新建备考科目" : "Create subject"}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {saveError && (
          <div className="sticky top-0 z-30 flex items-start justify-between gap-3 border-b border-[#f0e2c0] bg-[#FFF6DD] px-4 py-2.5 text-[13px] text-[#8A5A00]">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{saveError}</span>
            </span>
            <button
              onClick={() => handleNavigateToTab("settings")}
              className="shrink-0 font-medium underline underline-offset-2 cursor-pointer"
            >
              {language === "zh" ? "前往设置导出备份" : "Export a backup"}
            </button>
          </div>
        )}
        {appNotice && (
          <div className="sticky top-0 z-30 flex items-start justify-between gap-3 border-b border-[#e7e4de] bg-[#f1efe9] px-4 py-2.5 text-[13px] text-[#6b6660]">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{appNotice}</span>
            </span>
            <button
              onClick={() => setAppNotice(null)}
              className="shrink-0 font-medium underline underline-offset-2 cursor-pointer"
            >
              {language === "zh" ? "知道了" : "Dismiss"}
            </button>
          </div>
        )}
        <main className="flex-1 pb-24 md:pb-16">
          {currentTab === "today" && (
            <TodayFocusView
              plans={plans}
              onNavigateToTab={handleNavigateToTab}
              onUpdatePlan={handleUpdatePlan}
              onAddNewSubject={handleNewPlan}
              onNotice={setAppNotice}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              soundAlertsEnabled={appSettings.enableSoundAlerts}
              defaultFocusDuration={appSettings.defaultFocusDuration}
            />
          )}

          {currentTab === "dashboard" && (
            <MasterDashboard
              plans={plans}
              activePlan={activePlan}
              onSelectPlan={handleSelectPlan}
              onNavigateToTab={handleNavigateToTab}
              onDeletePlan={handleDeletePlan}
              onRequestDeletePlan={(p) => setPlanToDelete(p)}
              onAddNewSubject={handleNewPlan}
            />
          )}

          {currentTab === "settings" && (
            <SettingsPage
              settings={appSettings}
              onUpdateSettings={handleUpdateSettings}
              plans={plans}
              onImportPlans={handleImportPlans}
              onClearAllData={handleClearAllData}
            />
          )}

          {currentTab === "master_calendar" && (
            <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 space-y-6 animate-fadeIn">
              <MasterCalendarView
                plans={plans}
                onToggleTaskStatus={(planId, taskId) => {
                  setPlans((prev) =>
                    prev.map((plan) => {
                      if (plan.id !== planId) return plan;
                      return {
                        ...plan,
                        tasks: plan.tasks.map((t) =>
                          t.id === taskId
                            ? {
                                ...t,
                                status: t.status === "completed" ? "pending" : "completed",
                                completedAt: t.status === "completed" ? undefined : new Date().toISOString(),
                              }
                            : t
                        ),
                      };
                    })
                  );
                }}
                onStartFocusTimer={(task, planId) => {
                  handleSelectPlan(planId);
                  setSelectedDate(task.date);
                  setCurrentTab("today");
                }}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />
            </div>
          )}

          {currentTab === "add_subject" && (
            <AddExamSubjectWizard
              existingPlans={plans}
              onPlanCreated={handlePlanGenerated}
              onCancel={() => setCurrentTab("today")}
              defaultStudyPace={appSettings.defaultStudyPace}
            />
          )}

          {currentTab === "course" &&
            (activePlan ? (
              <CourseDetailPage
                plan={activePlan}
                onUpdatePlan={handleUpdatePlan}
                onRequestDeletePlan={(p) => setPlanToDelete(p)}
                onNavigateToTab={handleNavigateToTab}
              />
            ) : (
              <div className="max-w-md mx-auto mt-16 ui-card p-8 text-center space-y-4 animate-fadeIn">
                <div className="w-12 h-12 rounded-xl bg-[#f1efe9] flex items-center justify-center mx-auto">
                  <LayoutDashboard className="w-6 h-6 text-[#8a8580]" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-[#1c1b1a]">
                    {language === "zh" ? "暂无备考科目" : "No subjects yet"}
                  </h3>
                  <p className="text-[13px] text-[#8a8580] mt-1.5 leading-relaxed max-w-sm mx-auto">
                    {language === "zh"
                      ? "新建你的首门备考计划，AI 会整理考点并生成每日复习任务。"
                      : "Create your first study plan to generate daily tasks and a syllabus knowledge base."}
                  </p>
                </div>
                <div className="pt-2">
                  <button onClick={handleNewPlan} className="ui-btn ui-btn-primary">
                    <Plus className="w-4 h-4" />
                    <span>{language === "zh" ? "新建备考科目" : "Create subject"}</span>
                  </button>
                </div>
              </div>
            ))}
        </main>
      </div>

      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#f8f7f4]/95 backdrop-blur border-t border-[#e7e4de] grid grid-cols-4"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label={language === "zh" ? "移动端主导航" : "Mobile navigation"}
      >
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const active = isMobileNavActive(item.id);
          return (
            <button
              key={item.id}
              onClick={() => handleNavigateToTab(item.id)}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-1 min-h-[56px] text-[11px] transition-colors cursor-pointer ${
                active ? "text-[#1c1b1a] font-semibold" : "text-[#a39e97] font-medium"
              }`}
            >
              <Icon className="w-[18px] h-[18px]" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <DeleteConfirmModal
        isOpen={!!planToDelete}
        plan={planToDelete}
        onClose={() => setPlanToDelete(null)}
        onConfirm={(planId) => handleDeletePlan(planId)}
      />
    </div>
  );
}
