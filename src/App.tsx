import React, { useState, useEffect } from "react";
import { NotionSidebar } from "./components/NotionSidebar";
import { NotionPageHeader } from "./components/NotionPageHeader";
import { MasterDashboard } from "./components/MasterDashboard";
import { CourseKnowledgeHub } from "./components/CourseKnowledgeHub";
import { PlanPreferencesForm } from "./components/PlanPreferencesForm";
import { DailyTodoList } from "./components/DailyTodoList";
import { RealTimeManager } from "./components/RealTimeManager";
import { AddExamSubjectWizard } from "./components/AddExamSubjectWizard";
import { MasterCalendarView } from "./components/MasterCalendarView";
import { CourseDetailPage } from "./components/CourseDetailPage";
import { SettingsModal } from "./components/SettingsModal";
import { DeleteConfirmModal } from "./components/DeleteConfirmModal";
import { ChevronLeft, LayoutDashboard, Calendar, Plus } from "lucide-react";
import { ExamStudyPlan, StudyMaterial, SyllabusTopic, AppSettings, UserProfile } from "./types";
import {
  loadSavedPlans,
  savePlans,
  getActivePlanId,
  setActivePlanId,
  DEFAULT_WEEK_SCHEDULE,
  loadAppSettings,
  saveAppSettings,
  loadUserProfile,
  saveUserProfile,
  clearUserSessionData,
  DEFAULT_USER_PROFILE
} from "./lib/storage";
import {
  auth,
  savePlanToCloud,
  deletePlanFromCloud,
  saveUserProfileToCloud,
  subscribeToUserPlans,
  subscribeToUserProfile,
  uploadLocalPlansToCloud
} from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function App() {
  const [plans, setPlans] = useState<ExamStudyPlan[]>(() => loadSavedPlans());
  const [activePlanId, setActivePlanIdState] = useState<string>(() => getActivePlanId());
  const [currentTab, setCurrentTab] = useState<"dashboard" | "master_calendar" | "todo" | "realtime" | "course" | "materials" | "add_subject">("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [appSettings, setAppSettings] = useState<AppSettings>(() => loadAppSettings());
  const [userProfile, setUserProfile] = useState<UserProfile>(() => loadUserProfile());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<"account" | "language" | "version">("account");

  useEffect(() => {
    let unsubscribePlans: (() => void) | null = null;
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const updatedProfile: UserProfile = {
          ...DEFAULT_USER_PROFILE,
          id: user.uid,
          name: user.displayName || user.email?.split("@")[0] || "Scholar",
          email: user.email || "",
          avatar: user.photoURL || "🎓",
          isLoggedIn: true,
          membershipTier: "Pro Student",
        };
        setUserProfile(updatedProfile);
        saveUserProfile(updatedProfile);

        unsubscribeProfile = subscribeToUserProfile(user.uid, (cloudProfile) => {
          if (cloudProfile) {
            setUserProfile((prev) => ({
              ...prev,
              ...cloudProfile,
              isLoggedIn: true,
            }));
          }
        });

        unsubscribePlans = subscribeToUserPlans(user.uid, (cloudPlans) => {
          if (cloudPlans) {
            setPlans(cloudPlans);
            savePlans(cloudPlans);
            if (cloudPlans.length > 0) {
              setActivePlanIdState((prev) => {
                if (!prev || !cloudPlans.some((p) => p.id === prev)) {
                  setActivePlanId(cloudPlans[0].id);
                  return cloudPlans[0].id;
                }
                return prev;
              });
            } else {
              setActivePlanIdState("");
              setActivePlanId("");
            }
          }
        });
      } else {
        if (unsubscribePlans) unsubscribePlans();
        if (unsubscribeProfile) unsubscribeProfile();

        setUserProfile((prev) => {
          if (prev.isLoggedIn) {
            clearUserSessionData();
            setPlans([]);
            savePlans([]);
            setActivePlanIdState("");
            setActivePlanId("");
            return DEFAULT_USER_PROFILE;
          }
          return prev;
        });
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribePlans) unsubscribePlans();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const [courseStep, setCourseStep] = useState<"syllabus" | "config">("syllabus");

  const [syllabusContent, setSyllabusContent] = useState<string>("");
  const [syllabusDocName, setSyllabusDocName] = useState<string>("");
  const [currentTopics, setCurrentTopics] = useState<SyllabusTopic[]>([]);
  const [materialsSummary, setMaterialsSummary] = useState<string>("");
  const [examName, setExamName] = useState<string>("");
  const [subject, setSubject] = useState<string>("");

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  const [isRebalanceModalOpen, setIsRebalanceModalOpen] = useState(false);

  const [planToDelete, setPlanToDelete] = useState<ExamStudyPlan | null>(null);

  useEffect(() => {
    savePlans(plans);
  }, [plans]);

  const handleUpdateSettings = (newSettings: AppSettings) => {
    setAppSettings(newSettings);
    saveAppSettings(newSettings);
  };

  const handleUpdateUserProfile = (newProfile: UserProfile) => {
    setUserProfile(newProfile);
    saveUserProfile(newProfile);
    if (auth.currentUser) {
      saveUserProfileToCloud(auth.currentUser.uid, newProfile).catch((e) =>
        console.error("Failed to save profile to cloud:", e)
      );
    }
  };

  const handleOpenSettings = (tab: "account" | "language" | "version" = "account") => {
    setSettingsInitialTab(tab);
    setIsSettingsOpen(true);
  };

  const handleResetPlans = () => {
    setPlans([]);
    setActivePlanIdState("");
    setActivePlanId("");
    savePlans([]);
  };

  const handleLogout = () => {
    setUserProfile(DEFAULT_USER_PROFILE);
    saveUserProfile(DEFAULT_USER_PROFILE);
    setPlans([]);
    savePlans([]);
    setActivePlanIdState("");
    setActivePlanId("");
    clearUserSessionData();
    setCurrentTab("dashboard");
  };

  const activePlan = React.useMemo(() => {
    return plans.find((p) => p.id === activePlanId) || plans[0] || null;
  }, [plans, activePlanId]);

  const handleSelectPlan = (planId: string) => {
    setActivePlanIdState(planId);
    setActivePlanId(planId);
    const target = plans.find((p) => p.id === planId);
    if (target) {
      setExamName(target.examName);
      setSubject(target.subject);
      setCurrentTopics(target.topics || []);
      setMaterialsSummary(target.materialsSummary || "");
    }
  };

  const handleNewPlan = () => {
    setCurrentTab("add_subject");
  };

  const handleUpdatePlan = (updatedPlan: ExamStudyPlan) => {
    setPlans((prev) =>
      prev.map((p) => (p.id === updatedPlan.id ? updatedPlan : p))
    );
    if (auth.currentUser) {
      savePlanToCloud(auth.currentUser.uid, updatedPlan).catch((e) =>
        console.error("Failed to sync plan to cloud:", e)
      );
    }
  };

  const handleDeletePlan = (planId: string) => {
    setPlans((prev) => {
      const next = prev.filter((p) => p.id !== planId);
      if (activePlanId === planId) {
        if (next.length > 0) {
          setActivePlanIdState(next[0].id);
          setActivePlanId(next[0].id);
          setExamName(next[0].examName);
          setSubject(next[0].subject);
          setCurrentTopics(next[0].topics || []);
          setMaterialsSummary(next[0].materialsSummary || "");
        } else {
          setActivePlanIdState("");
          setActivePlanId("");
          setCurrentTab("dashboard");
        }
      }
      return next;
    });
    if (auth.currentUser) {
      deletePlanFromCloud(auth.currentUser.uid, planId).catch((e) =>
        console.error("Failed to delete plan from cloud:", e)
      );
    }
  };

  const handlePlanGenerated = (newPlan: ExamStudyPlan) => {
    const nextPlans = [newPlan, ...plans.filter((p) => p.id !== newPlan.id)];
    setPlans(nextPlans);
    setActivePlanIdState(newPlan.id);
    setActivePlanId(newPlan.id);
    setCurrentTab("dashboard");
    setSelectedDate(newPlan.startDate || new Date().toISOString().split("T")[0]);

    if (auth.currentUser) {
      savePlanToCloud(auth.currentUser.uid, newPlan).catch((e) =>
        console.error("Failed to save new plan to cloud:", e)
      );
    }
  };

  const handleNavigateToTab = (tab: "dashboard" | "master_calendar" | "todo" | "realtime" | "course" | "materials" | "add_subject", planId?: string) => {
    if (planId) {
      handleSelectPlan(planId);
    }
    setCurrentTab(tab);
    if (tab === "course") {
      const target = planId ? plans.find((p) => p.id === planId) : activePlan;
      if (target) {
        setCurrentTopics(target.topics || []);
        setExamName(target.examName);
        setSubject(target.subject);
        setMaterialsSummary(target.materialsSummary || "");
        setCourseStep("syllabus");
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f7f4] text-[#111111] flex antialiased selection:bg-[#111111] selection:text-white font-sans">

      <NotionSidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        plans={plans}
        activePlan={activePlan}
        onSelectPlan={(id) => {
          handleSelectPlan(id);
          if (currentTab === "dashboard") {

          }
        }}
        onNewPlan={handleNewPlan}
        onDeletePlan={handleDeletePlan}
        onRequestDeletePlan={(p) => setPlanToDelete(p)}
        currentTab={currentTab}
        onTabChange={(tab, planId) => {
          handleNavigateToTab(tab, planId);
        }}
        onOpenRebalanceModal={() => {
          setCurrentTab("realtime");
        }}
        userProfile={userProfile}
        onOpenSettings={handleOpenSettings}
      />

      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${
          isSidebarOpen ? "md:ml-64" : "ml-0"
        }`}
      >
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
                  const targetPlan = plans.find((p) => p.id === planId);
                  if (!targetPlan) return;
                  const updatedTasks = targetPlan.tasks.map((t) =>
                    t.id === taskId
                      ? {
                          ...t,
                          status: (t.status === "completed" ? "pending" : "completed") as any,
                          completedAt: t.status === "completed" ? undefined : new Date().toISOString(),
                        }
                      : t
                  );
                  handleUpdatePlan({ ...targetPlan, tasks: updatedTasks });
                }}
                onStartFocusTimer={(task, planId) => {
                  const targetPlan = plans.find((p) => p.id === planId);
                  if (targetPlan) {
                    handleSelectPlan(planId);
                    setCurrentTab("course");
                  }
                }}
                onStartQuiz={(task, planId) => {
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

          {(currentTab === "course" || currentTab === "todo" || currentTab === "realtime" || currentTab === "materials") && (
            activePlan ? (
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
                    暂无可查看的备考科目 // NO ACTIVE SUBJECT
                  </h3>
                  <p className="text-xs text-[#666666] mt-1.5 leading-relaxed max-w-md mx-auto">
                    您还没有添加任何备考科目。请先点击下方按钮新建您的首门备考计划，生成每日科学复习任务与考纲知识库。
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    onClick={handleNewPlan}
                    className="inline-flex items-center space-x-2 px-5 py-2.5 bg-[#111111] text-white text-xs font-bold rounded-lg hover:bg-[#333333] transition-colors cursor-pointer shadow-xs active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>新建备考科目 (Create Subject)</span>
                  </button>
                </div>
              </div>
            )
          )}
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
        userProfile={userProfile}
        onUpdateUserProfile={handleUpdateUserProfile}
        plans={plans}
        onImportPlans={(importedPlans) => setPlans(importedPlans)}
        onResetPlans={handleResetPlans}
        onLogout={handleLogout}
      />
    </div>
  );
}
