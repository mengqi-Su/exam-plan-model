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
import { ChevronLeft, LayoutDashboard, Calendar } from "lucide-react";
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
  SAMPLE_PLANS
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
  const [settingsInitialTab, setSettingsInitialTab] = useState<"general" | "account" | "language" | "version">("general");

  useEffect(() => {
    let unsubscribePlans: (() => void) | null = null;
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {

        const updatedProfile: UserProfile = {
          ...userProfile,
          id: user.uid,
          name: user.displayName || user.email?.split("@")[0] || "Scholar",
          email: user.email || "",
          avatar: user.photoURL || "🎓",
          isLoggedIn: true,
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
          if (cloudPlans && cloudPlans.length > 0) {
            setPlans(cloudPlans);
            if (!activePlanId || !cloudPlans.some(p => p.id === activePlanId)) {
              setActivePlanIdState(cloudPlans[0].id);
              setActivePlanId(cloudPlans[0].id);
            }
          }
        });
      } else {

        if (unsubscribePlans) unsubscribePlans();
        if (unsubscribeProfile) unsubscribeProfile();
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
  const [examName, setExamName] = useState<string>("CS 301：高级算法与数据结构期末考试");
  const [subject, setSubject] = useState<string>("计算机科学");

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

  const handleOpenSettings = (tab: "general" | "account" | "language" | "version" = "general") => {
    setSettingsInitialTab(tab);
    setIsSettingsOpen(true);
  };

  const handleResetPlans = () => {
    setPlans(SAMPLE_PLANS);
    if (SAMPLE_PLANS.length > 0) {
      setActivePlanIdState(SAMPLE_PLANS[0].id);
      setActivePlanId(SAMPLE_PLANS[0].id);
    }
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

          {(currentTab === "course" || currentTab === "todo" || currentTab === "realtime" || currentTab === "materials") && activePlan && (
            <CourseDetailPage
              plan={activePlan}
              plans={plans}
              onUpdatePlan={handleUpdatePlan}
              onDeletePlan={handleDeletePlan}
              onRequestDeletePlan={(p) => setPlanToDelete(p)}
              onNavigateToTab={handleNavigateToTab}
              initialDrawer={currentTab === "realtime" ? "progress" : currentTab === "materials" ? "syllabus" : null}
            />
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
      />
    </div>
  );
}
