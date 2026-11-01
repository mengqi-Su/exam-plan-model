import React, { useState, useEffect } from "react";
import { NotionSidebar } from "./components/NotionSidebar";
import { MasterDashboard } from "./components/MasterDashboard";
import { CourseDetailPage } from "./components/CourseDetailPage";
import { AddExamSubjectWizard } from "./components/AddExamSubjectWizard";
import { MasterCalendarView } from "./components/MasterCalendarView";
import { SettingsModal } from "./components/SettingsModal";
import { DeleteConfirmModal } from "./components/DeleteConfirmModal";
import { LayoutDashboard, Plus, AlertTriangle } from "lucide-react";
import { ExamStudyPlan, AppSettings } from "./types";
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

type AppTab = "dashboard" | "master_calendar" | "todo" | "realtime" | "course" | "materials" | "add_subject";

export default function App() {
  const { language } = useI18n();
  const [plans, setPlans] = useState<ExamStudyPlan[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [appNotice, setAppNotice] = useState<string | null>(null);
  const [activePlanId, setActivePlanIdState] = useState<string>(() => getActivePlanId());
  const [currentTab, setCurrentTab] = useState<AppTab>("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [appSettings, setAppSettings] = useState<AppSettings>(() => loadAppSettings());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<"data" | "preferences" | "language" | "version">("data");

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

  const handleOpenSettings = (tab: "data" | "preferences" | "language" | "version" = "data") => {
    setSettingsInitialTab(tab);
    setIsSettingsOpen(true);
  };

  const handleClearAllData = async () => {
    await clearPlannerData();
    setPlans([]);
    setActivePlanIdState("");
    setActivePlanId("");
    setCurrentTab("dashboard");
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
          setCurrentTab("dashboard");
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
    setCurrentTab("dashboard");
    setSelectedDate(newPlan.startDate || toLocalDateString());
  };

  const handleNavigateToTab = (tab: AppTab, planId?: string) => {
    if (planId) {
      handleSelectPlan(planId);
    }
    setCurrentTab(tab);
  };

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-[#f8f7f4] text-[#111111] flex items-center justify-center font-mono text-xs">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 bg-[#111111] animate-pulse" />
          <span>{language === "zh" ? "正在读取本地备考数据..." : "Loading local planner data..."}</span>
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
        onOpenSettings={handleOpenSettings}
      />

      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${
          isSidebarOpen ? "md:ml-64" : "ml-0"
        }`}
      >
        {saveError && (
          <div className="sticky top-0 z-30 flex items-start justify-between gap-3 bg-[#FCD33B] border-b border-[#111111] px-4 py-2 text-[11px] font-mono text-[#111111]">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{saveError}</span>
            </span>
            <button
              onClick={() => handleOpenSettings("data")}
              className="shrink-0 underline font-bold cursor-pointer"
            >
              {language === "zh" ? "导出备份" : "EXPORT BACKUP"}
            </button>
          </div>
        )}
        {appNotice && (
          <div className="sticky top-0 z-30 flex items-start justify-between gap-3 bg-[#FCD33B] border-b border-[#111111] px-4 py-2 text-[11px] font-mono text-[#111111]">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{appNotice}</span>
            </span>
            <button
              onClick={() => setAppNotice(null)}
              className="shrink-0 underline font-bold cursor-pointer"
            >
              {language === "zh" ? "知道了" : "DISMISS"}
            </button>
          </div>
        )}
        <main className="flex-1 pb-16">
          {currentTab === "dashboard" && (
            <MasterDashboard
              plans={plans}
              activePlan={activePlan}
              onSelectPlan={handleSelectPlan}
              onNavigateToTab={handleNavigateToTab}
              onUpdatePlan={handleUpdatePlan}
              onDeletePlan={handleDeletePlan}
              onRequestDeletePlan={(p) => setPlanToDelete(p)}
              onAddNewSubject={handleNewPlan}
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
                  const targetPlan = plans.find((p) => p.id === planId);
                  if (targetPlan) {
                    handleSelectPlan(planId);
                    setCurrentTab("course");
                  }
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
              onCancel={() => setCurrentTab("dashboard")}
            />
          )}

          {(currentTab === "course" || currentTab === "todo" || currentTab === "realtime" || currentTab === "materials") &&
            (activePlan ? (
              <CourseDetailPage
                plan={activePlan}
                plans={plans}
                onUpdatePlan={handleUpdatePlan}
                onDeletePlan={handleDeletePlan}
                onRequestDeletePlan={(p) => setPlanToDelete(p)}
                onNavigateToTab={handleNavigateToTab}
                initialDrawer={currentTab === "realtime" ? "progress" : currentTab === "materials" ? "syllabus" : null}
              />
            ) : (
              <div className="max-w-xl mx-auto mt-16 p-8 bg-white border border-[#111111] shadow-xs text-center font-mono space-y-4 animate-fadeIn">
                <div className="w-12 h-12 bg-[#FCD33B] border border-[#111111] flex items-center justify-center mx-auto shadow-xs">
                  <LayoutDashboard className="w-6 h-6 text-[#111111]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#111111]">
                    {language === "zh"
                      ? "暂无可查看的备考科目 // NO ACTIVE SUBJECT"
                      : "NO ACTIVE SUBJECT"}
                  </h3>
                  <p className="text-xs text-[#666666] mt-1.5 leading-relaxed max-w-md mx-auto">
                    {language === "zh"
                      ? "您还没有添加任何备考科目。请先点击下方按钮新建您的首门备考计划，生成每日科学复习任务与考纲知识库。"
                      : "You have no exam subjects yet. Create your first study plan to generate daily tasks and a syllabus knowledge base."}
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    onClick={handleNewPlan}
                    className="inline-flex items-center space-x-2 px-5 py-2.5 bg-[#111111] text-white text-xs font-bold rounded-lg hover:bg-[#333333] transition-colors cursor-pointer shadow-xs active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{language === "zh" ? "新建备考科目 (Create Subject)" : "CREATE SUBJECT"}</span>
                  </button>
                </div>
              </div>
            ))}
        </main>
      </div>

      <DeleteConfirmModal
        isOpen={!!planToDelete}
        plan={planToDelete}
        onClose={() => setPlanToDelete(null)}
        onConfirm={(planId) => handleDeletePlan(planId)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        initialTab={settingsInitialTab}
        settings={appSettings}
        onUpdateSettings={handleUpdateSettings}
        plans={plans}
        onImportPlans={handleImportPlans}
        onClearAllData={handleClearAllData}
      />
    </div>
  );
}
