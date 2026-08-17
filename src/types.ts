export type MaterialCategory = 'course_syllabus' | 'exam_question' | 'study_material';

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
}

export interface SyllabusTopic {
  id: string;
  title: string;
  category?: string;
  description?: string;
  weightPercentage?: number; // e.g. 20% of exam
  difficulty: 'easy' | 'medium' | 'hard';
  userKnowledgeLevel?: 'beginner' | 'intermediate' | 'advanced';
  subtopics: string[];
  estimatedHours: number;
  isWeakTopic?: boolean;
}

export interface DaySchedulePreference {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  dayName: string;
  availableHours: number;
  preferredTimeSlot: 'morning' | 'afternoon' | 'evening' | 'flexible';
  enabled: boolean;
}

export interface UserStudyPreferences {
  examName: string;
  subject: string;
  examDate: string; // YYYY-MM-DD
  examTime?: string; // HH:MM
  startDate: string; // YYYY-MM-DD
  targetScoreOrGrade?: string;
  dailySchedules: DaySchedulePreference[];
  studyPace: 'balanced' | 'intensive_crash' | 'deep_mastery' | 'spaced_repetition';
  sessionLengthMinutes: number; // 25, 45, 60, 90
  includePracticeExams: boolean;
  includeBufferDays: boolean;
  bufferDaysCount: number;
  weakTopicsFocus: string[];
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
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:MM
  endTime?: string; // HH:MM
  durationMinutes: number;
  priority: 'high' | 'medium' | 'low';
  status: TaskStatus;
  keyObjectives: string[];
  activeRecallPrompt?: string;
  notes?: string;
  actualMinutesSpent?: number;
  confidenceRating?: 1 | 2 | 3 | 4 | 5; // 1 = Struggled, 5 = Mastered
  completedAt?: string;
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
