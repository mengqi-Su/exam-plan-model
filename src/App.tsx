import React, { useState, useEffect } from "react";
import { NotionSidebar } from "./components/NotionSidebar";
import { NotionPageHeader } from "./components/NotionPageHeader";
import { CourseSyllabusManager } from "./components/CourseSyllabusManager";
import { MaterialsAndQuestionsHub } from "./components/MaterialsAndQuestionsHub";
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
  const [currentTab, setCurrentTab] = useState<"todo" | "calendar" | "realtime" | "course" | "materials" | "add_subject">("todo");
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

  // Update active plan
  const handleUpdateActivePlan = (updatedPlan: ExamStudyPlan) => {
    setPlans((prev) =>
      prev.map((p) => (p.id === updatedPlan.id ? updatedPlan : p))
    );
  };

  // Handle newly generated plan
  const handlePlanGenerated = (newPlan: ExamStudyPlan) => {
    const nextPlans = [newPlan, ...plans.filter((p) => p.id !== newPlan.id)];
    setPlans(nextPlans);
    setActivePlanIdState(newPlan.id);
    setActivePlanId(newPlan.id);
    setCurrentTab("todo");
    setSelectedDate(newPlan.startDate || new Date().toISOString().split("T")[0]);
  };

  return (
    <div className="min-h-screen bg-white text-[#37352f] flex antialiased selection:bg-[#cce2ff] font-sans">
      {/* Notion Sidebar */}
      <NotionSidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        plans={plans}
        activePlan={activePlan}
        onSelectPlan={handleSelectPlan}
        onNewPlan={handleNewPlan}
        currentTab={currentTab}
        onTabChange={(tab) => {
          setCurrentTab(tab);
          if (tab === "course" && activePlan) {
            setCurrentTopics(activePlan.topics || []);
            setExamName(activePlan.examName);
            setSubject(activePlan.subject);
            setMaterialsSummary(activePlan.materialsSummary || "");
            setCourseStep("syllabus");
          }
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
            setCurrentTab(tab);
            if (tab === "course" && activePlan) {
              setCurrentTopics(activePlan.topics || []);
              setExamName(activePlan.examName);
              setSubject(activePlan.subject);
              setMaterialsSummary(activePlan.materialsSummary || "");
              setCourseStep("syllabus");
            }
          }}
          onOpenRebalanceModal={() => setCurrentTab("realtime")}
          onNewPlan={handleNewPlan}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Tab Views */}
        <main className="flex-1 pb-16">
          {currentTab === "todo" && activePlan && (
            <DailyTodoList
              plan={activePlan}
              onUpdatePlan={handleUpdateActivePlan}
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
              onUpdatePlan={handleUpdateActivePlan}
              onNavigateToTab={setCurrentTab}
              isRebalanceModalOpen={isRebalanceModalOpen}
              onCloseRebalanceModal={() => setIsRebalanceModalOpen(false)}
            />
          )}

          {currentTab === "add_subject" && (
            <AddExamSubjectWizard
              existingPlans={plans}
              onPlanCreated={handlePlanGenerated}
              onCancel={() => setCurrentTab(activePlan ? "todo" : "course")}
            />
          )}

          {currentTab === "course" && (
            courseStep === "syllabus" ? (
              <CourseSyllabusManager
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
                onProceedToPlanConfig={() => setCourseStep("config")}
                onGoToMaterialsAndQuestions={() => setCurrentTab("materials")}
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

          {currentTab === "materials" && activePlan && (
            <MaterialsAndQuestionsHub
              plan={activePlan}
              onUpdatePlan={handleUpdateActivePlan}
              onGoToCourseSyllabus={() => setCurrentTab("course")}
            />
          )}
        </main>
      </div>
    </div>
  );
}
