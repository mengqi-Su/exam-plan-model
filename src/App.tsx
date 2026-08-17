import React, { useState, useEffect } from "react";
import { NotionSidebar } from "./components/NotionSidebar";
import { NotionPageHeader } from "./components/NotionPageHeader";
import { MasterDashboard } from "./components/MasterDashboard";
import { CourseKnowledgeHub } from "./components/CourseKnowledgeHub";
import { PlanPreferencesForm } from "./components/PlanPreferencesForm";
import { DailyTodoList } from "./components/DailyTodoList";
import { CalendarView } from "./components/CalendarView";
import { RealTimeManager } from "./components/RealTimeManager";
import { AddExamSubjectWizard } from "./components/AddExamSubjectWizard";
import { ExamStudyPlan, StudyMaterial, SyllabusTopic } from "./types";
import { 
  loadSavedPlans, 
  savePlans, 
  getActivePlanId, 
  setActivePlanId, 
  DEFAULT_WEEK_SCHEDULE 
} from "./lib/storage";

export default function App() {
  const [plans, setPlans] = useState<ExamStudyPlan[]>(() => loadSavedPlans());
  const [activePlanId, setActivePlanIdState] = useState<string>(() => getActivePlanId());
  const [currentTab, setCurrentTab] = useState<"dashboard" | "todo" | "calendar" | "realtime" | "course" | "materials" | "add_subject">("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
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

  // Sync plans to localStorage
  useEffect(() => {
    savePlans(plans);
  }, [plans]);

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
  };

  // Delete plan
  const handleDeletePlan = (planId: string) => {
    setPlans((prev) => {
      const next = prev.filter((p) => p.id !== planId);
      if (activePlanId === planId && next.length > 0) {
        setActivePlanIdState(next[0].id);
        setActivePlanId(next[0].id);
      }
      return next;
    });
  };

  // Handle newly generated plan
  const handlePlanGenerated = (newPlan: ExamStudyPlan) => {
    const nextPlans = [newPlan, ...plans.filter((p) => p.id !== newPlan.id)];
    setPlans(nextPlans);
    setActivePlanIdState(newPlan.id);
    setActivePlanId(newPlan.id);
    setCurrentTab("dashboard");
    setSelectedDate(newPlan.startDate || new Date().toISOString().split("T")[0]);
  };

  // Navigation handler
  const handleNavigateToTab = (tab: "dashboard" | "todo" | "calendar" | "realtime" | "course" | "add_subject", planId?: string) => {
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
    <div className="min-h-screen bg-white text-[#37352f] flex antialiased selection:bg-[#cce2ff] font-sans">
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
        currentTab={currentTab}
        onTabChange={(tab) => {
          handleNavigateToTab(tab);
        }}
        onOpenRebalanceModal={() => {
          setCurrentTab("realtime");
        }}
      />

      {/* Main Content Area (shifts when sidebar is open) */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${
          isSidebarOpen ? "md:ml-64" : "ml-0"
        }`}
      >
        {/* Notion Header with Breadcrumbs, Cover Banner, Properties & Tab Switcher */}
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
        />

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
              onAddNewSubject={handleNewPlan}
            />
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

          {currentTab === "calendar" && activePlan && (
            <CalendarView
              plan={activePlan}
              onSelectDate={setSelectedDate}
              onGoToDailyView={(dateStr) => {
                setSelectedDate(dateStr);
                setCurrentTab("todo");
              }}
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
    </div>
  );
}
