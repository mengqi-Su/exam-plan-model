export type MaterialCategory = 'course_syllabus' | 'exam_question' | 'study_material';

export interface DaySchedulePreference {
  dayOfWeek: number;
  dayName: string;
  availableHours: number;
  preferredTimeSlot: 'morning' | 'afternoon' | 'evening' | 'flexible';
  enabled: boolean;
}

export interface SyllabusTopic {
  id: string;
  title: string;
  category?: string;
  description?: string;
  weightPercentage: number;
  difficulty: 'easy' | 'medium' | 'hard';
  userKnowledgeLevel?: 'beginner' | 'intermediate' | 'advanced';
  subtopics: string[];
  estimatedHours: number;
}

export interface RagSourceCitation {
  documentId?: string;
  documentName: string;
  documentType?: string;
  sectionTitle?: string;
  pageOrChapter?: string;
  excerptSnippet: string;
  keyConcepts?: string[];
  relevanceReason?: string;
}

export interface StudyMaterial {
  id: string;
  name: string;
  type: 'syllabus' | 'notes' | 'lecture_slides' | 'past_exam' | 'textbook_outline' | 'custom';
  categoryGroup?: MaterialCategory;
  content: string;
  sizeBytes?: number;
  uploadedAt: string;
  extractedTopicsCount?: number;
  topicTag?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  yearOrTerm?: string;
  questionCount?: number;
  summaryNotes?: string;
  keyTraps?: string[];
  chunksCount?: number;
}

export interface UserStudyPreferences {
  examName: string;
  subject: string;
  examDate: string;
  examTime?: string;
  startDate: string;
  targetScoreOrGrade?: string;
  dailySchedules: DaySchedulePreference[];
  studyPace: 'balanced' | 'intensive_crash' | 'deep_mastery' | 'spaced_repetition';
  sessionLengthMinutes: number;
  includePracticeExams: boolean;
  includeBufferDays: boolean;
  bufferDaysCount: number;
  weakTopicsFocus: string[];
  userNeedFocusArea?: 'comprehensive' | 'heavy_calculation' | 'concepts_and_theory' | 'past_exam_drills' | 'rush_sprint' | 'weak_spot_remedy';
  customPromptRequirement?: string;
  additionalNotes?: string;
}

export type TaskCategory =
  | 'theory'
  | 'reading'
  | 'practice_problems'
  | 'active_recall'
  | 'flashcards'
  | 'mock_exam'
  | 'review_weak_spots'
  | 'summary_cheat_sheet';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export interface StudyTask {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  topicId?: string;
  topicTitle: string;
  date: string;
  startTime?: string;
  endTime?: string;
  durationMinutes: number;
  priority: 'high' | 'medium' | 'low';
  status: TaskStatus;
  keyObjectives: string[];
  activeRecallPrompt?: string;
  notes?: string;
  actualMinutesSpent?: number;
  confidenceRating?: 1 | 2 | 3 | 4 | 5;
  completedAt?: string;

  ragSource?: RagSourceCitation;
  groundedUserNeed?: string;
  formulaOrRules?: string[];
  practiceQuestionRef?: string;
}

export interface StudyPlanPhase {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  focus: string;
}

export interface ExamStudyPlan {
  id: string;
  userId?: string;
  createdAt: string;
  updatedAt: string;
  examName: string;
  subject: string;
  examDate: string;
  examTime?: string;
  startDate: string;
  totalPlannedHours: number;
  phases: StudyPlanPhase[];
  topics: SyllabusTopic[];
  tasks: StudyTask[];
  preferences: UserStudyPreferences;
  materialsSummary?: string;
  materials?: StudyMaterial[];
}

export interface ActiveRecallQuizQuestion {
  id: string;
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  topicTitle: string;
}

export interface PlanAnalytics {
  totalTasks: number;
  completedTasks: number;
  totalPlannedMinutes: number;
  completedMinutes: number;
  daysRemaining: number;
  completionRate: number;
  paceStatus: 'ahead' | 'on_track' | 'behind';
  currentStreakDays: number;
  averageMasteryScore: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  institution?: string;
  major?: string;
  targetDegreeOrGoal?: string;
  isLoggedIn: boolean;
  memberSince: string;
  membershipTier: 'Free' | 'Pro Student' | 'Master Scholar';
  totalStudyMinutes: number;
  studyStreakDays: number;
  completedExamsCount: number;
}

export interface AppSettings {
  defaultFocusDuration: number;
  enableSoundAlerts: boolean;
  enableDailyReminders: boolean;
  firstDayOfWeek: 'monday' | 'sunday';
  dateFormat: 'YYYY-MM-DD' | 'MM/DD/YYYY' | 'DD/MM/YYYY';
  rebalanceSensitivity: 'high' | 'balanced' | 'conservative';
  defaultStudyPace: 'balanced' | 'intensive_crash' | 'deep_mastery' | 'spaced_repetition';
  autoSaveCloud: boolean;
  themeMode: 'light' | 'dark' | 'system';
}

export interface AppVersionInfo {
  version: string;
  releaseName: string;
  buildDate: string;
  buildNumber: string;
  environment: string;
  changelog: {
    version: string;
    date: string;
    title: string;
    highlights: string[];
  }[];
}
