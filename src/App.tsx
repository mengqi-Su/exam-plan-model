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
  
  // Settings & User Profile State
  const [appSettings, setAppSettings] = useState<AppSettings>(() => loadAppSettings());
  const [userProfile, setUserProfile] = useState<UserProfile>(() => loadUserProfile());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<"general" | "account" | "language" | "version">("general");

  // Firebase Auth & Cloud Sync Listener
  useEffect(() => {
    let unsubscribePlans: (() => void) | null = null;
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User logged in via Firebase
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

        // Listen for profile changes from Firestore
        unsubscribeProfile = subscribeToUserProfile(user.uid, (cloudProfile) => {
          if (cloudProfile) {
            setUserProfile((prev) => ({
              ...prev,
              ...cloudProfile,
              isLoggedIn: true,
            }));
          }
        });

        // Listen for plans from Firestore
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
        // User is logged out / offline guest
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

  // Sub-step when in "course" tab: "syllabus" vs "config"
  const [courseStep, setCourseStep] = useState<"syllabus" | "config">("syllabus");

  // Ingestion state for creating / editing syllabus & generating plan
  const [syllabusContent, setSyllabusContent] = useState<string>("");
  const [syllabusDocName, setSyllabusDocName] = useState<string>("");
  const [currentTopics, setCurrentTopics] = useState<SyllabusTopic[]>([]);
  const [materialsSummary, setMaterialsSummary] = useState<string>("");
  const [examName, setExamName] = useState<string>("CS 301：高级算法与数据结构期末考试");
  const [subject, setSubject] = useState<string>("计算机科学");

  // Selected date for Daily To-Do list
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Rebalance modal state
  const [isRebalanceModalOpen, setIsRebalanceModalOpen] = useState(false);

  // Deletion confirmation modal state
  const [planToDelete, setPlanToDelete] = useState<ExamStudyPlan | null>(null);

  // Sync plans to localStorage
  useEffect(() => {
    savePlans(plans);
  }, [plans]);

  // Sync settings to localStorage
  const handleUpdateSettings = (newSettings: AppSettings) => {
    setAppSettings(newSettings);
    saveAppSettings(newSettings);
  };

  // Sync profile to localStorage and cloud
  const handleUpdateUserProfile = (newProfile: UserProfile) => {
    setUserProfile(newProfile);
    saveUserProfile(newProfile);
    if (auth.currentUser) {
      saveUserProfileToCloud(auth.currentUser.uid, newProfile).catch((e) =>
        console.error("Failed to save profile to cloud:", e)
      );
    }
  };

  // Open settings with target tab
  const handleOpenSettings = (tab: "general" | "account" | "language" | "version" = "general") => {
    setSettingsInitialTab(tab);
    setIsSettingsOpen(true);
  };

  // Reset plans to sample
  const handleResetPlans = () => {
    setPlans(SAMPLE_PLANS);
    if (SAMPLE_PLANS.length > 0) {
      setActivePlanIdState(SAMPLE_PLANS[0].id);
      setActivePlanId(SAMPLE_PLANS[0].id);
    }
  };

  // Current active plan
  const activePlan = React.useMemo(() => {
    return plans.find((p) => p.id === activePlanId) || plans[0] || null;
  }, [plans, activePlanId]);

  // Handle plan selection
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

  // Handle "+ New Plan / Add Exam Subject" -> Jump to dedicated Add Exam Subject page
  const handleNewPlan = () => {
    setCurrentTab("add_subject");
  };

  // Update active plan or any plan
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

  // Delete plan
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

  // Handle newly generated plan
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

  // Navigation handler
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
      {/* Notion Sidebar */}
      <NotionSidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        plans={plans}
        activePlan={activePlan}
        onSelectPlan={(id) => {
          handleSelectPlan(id);
          if (currentTab === "dashboard") {
            // Keep on dashboard or switch to course
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

      {/* Main Content Area (shifts when sidebar is open) */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${
          isSidebarOpen ? "md:ml-64" : "ml-0"
        }`}
      >
        {/* Notion Header with Breadcrumbs, Cover Banner, Properties & Tab Switcher (Course Pages Only) */}
        {currentTab !== "dashboard" && currentTab !== "master_calendar" && currentTab !== "add_subject" && (
          <NotionPageHeader
            activePlan={activePlan}
            currentTab={currentTab}
            onTabChange={(tab) => {
              handleNavigateToTab(tab as any);
            }}
            onOpenRebalanceModal={() => setCurrentTab("realtime")}
            onNewPlan={handleNewPlan}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            userProfile={userProfile}
            onOpenSettings={handleOpenSettings}
          />
        )}

        {/* Tab Views */}
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
              {/* Master Calendar Component */}
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
                    setCurrentTab("todo");
                  }
                }}
                onStartQuiz={(task, planId) => {
                  const targetPlan = plans.find((p) => p.id === planId);
                  if (targetPlan) {
                    handleSelectPlan(planId);
                    setCurrentTab("todo");
                  }
                }}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />
            </div>
          )}

          {currentTab === "todo" && activePlan && (
            <DailyTodoList
              plan={activePlan}
              onUpdatePlan={handleUpdatePlan}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              searchQuery={searchQuery}
            />
          )}

          {currentTab === "realtime" && activePlan && (
            <RealTimeManager
              plan={activePlan}
              plans={plans}
              onSelectPlan={handleSelectPlan}
              onAddNewSubject={() => setCurrentTab("add_subject")}
              onUpdatePlan={handleUpdatePlan}
              onNavigateToTab={setCurrentTab}
              isRebalanceModalOpen={isRebalanceModalOpen}
              onCloseRebalanceModal={() => setIsRebalanceModalOpen(false)}
            />
          )}

          {currentTab === "add_subject" && (
            <AddExamSubjectWizard
              existingPlans={plans}
              onPlanCreated={handlePlanGenerated}
              onCancel={() => setCurrentTab("dashboard")}
            />
          )}

          {(currentTab === "course" || currentTab === "materials") && (
            courseStep === "syllabus" ? (
              <CourseKnowledgeHub
                plan={activePlan}
                examName={examName}
                onExamNameChange={setExamName}
                subject={subject}
                onSubjectChange={setSubject}
                syllabusContent={syllabusContent}
                onSyllabusContentChange={setSyllabusContent}
                syllabusDocName={syllabusDocName}
                onSyllabusDocNameChange={setSyllabusDocName}
                topics={currentTopics}
                onTopicsChange={setCurrentTopics}
                materialsSummary={materialsSummary}
                onMaterialsSummaryChange={setMaterialsSummary}
                onUpdatePlan={handleUpdatePlan}
                onDeleteCourse={() => activePlan && handleDeletePlan(activePlan.id)}
                onRequestDeleteCourse={(p) => setPlanToDelete(p || activePlan)}
                onProceedToPlanConfig={() => setCourseStep("config")}
                onNavigateToTab={(tab) => setCurrentTab(tab as any)}
              />
            ) : (
              <PlanPreferencesForm
                examName={examName}
                subject={subject}
                topics={currentTopics}
                materials={activePlan?.materials || []}
                materialsSummary={materialsSummary}
                onBackToMaterials={() => setCourseStep("syllabus")}
                onPlanGenerated={handlePlanGenerated}
              />
            )
          )}
        </main>
      </div>

      {/* Course Deletion Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!planToDelete}
        plan={planToDelete}
        onClose={() => setPlanToDelete(null)}
        onConfirm={(planId) => handleDeletePlan(planId)}
      />

      {/* Global Configuration, Login Profile, Language & Version Modal */}
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
