export type MaterialCategory = 'course_syllabus' | 'exam_question' | 'study_material';

export type AppTab =
  | 'today'
  | 'dashboard'
  | 'master_calendar'
  | 'course'
  | 'settings';

export interface DaySchedulePreference {
  dayOfWeek: number;
  dayName: string;
  availableHours: number;
  preferredTimeSlot: 'morning' | 'afternoon' | 'evening' | 'flexible';
  enabled: boolean;
}

export interface SyllabusSubtopicNode {
  id?: string;
  title: string;
  name?: string;
  keyPoints?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  examFrequency?: 'high' | 'medium' | 'low';
  formulaOrTrap?: string;
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
  subtopicTree?: SyllabusSubtopicNode[];
  estimatedHours: number;
  // 考点从哪来：资料提炼（默认）/ 教材目录回忆 / 手动添加。界面上要分得清，教材回忆的可以随时删。
  source?: 'material' | 'textbook' | 'manual';
}

/** 教材目录里的一章：用户在预览里勾选、改名后才展开成考点。 */
export interface TextbookChapter {
  id: string;
  index: number;
  title: string;
  sections: string[];
  weightPercentage: number;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedHours: number;
}

export interface TextbookOutline {
  textbook: string;
  summary: string;
  confidence: 'high' | 'medium' | 'low';
  note: string;
  chapters: TextbookChapter[];
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
  summaryNotes?: string;
  keyTraps?: string[];
  chunksCount?: number;
  /** 正文的 SHA-256（64 位十六进制）：去重看它，不看文件名。上线前的老资料没有这个字段。 */
  contentHash?: string;
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
  /**
   * Notion 式页面图标（一个 emoji）。留空则按学科关键词自动配，见 lib/pageIcon。
   * 它是「这份科目文档」的身份标记：侧栏、总览卡、页头都取同一个值。
   */
  icon?: string;
  /**
   * Notion 式页面封面：内置纹理存 "preset:<id>"，上传的图存压缩后的 data URL。
   * 只当页头那条背景带用，不承载信息；见 lib/pageCover。
   */
  cover?: string;
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

export interface AppSettings {
  defaultFocusDuration: number;
  enableSoundAlerts: boolean;
  enableDailyReminders: boolean;
  firstDayOfWeek: 'monday' | 'sunday';
  dateFormat: 'YYYY-MM-DD' | 'MM/DD/YYYY' | 'DD/MM/YYYY';
  rebalanceSensitivity: 'high' | 'balanced' | 'conservative';
  defaultStudyPace: 'balanced' | 'intensive_crash' | 'deep_mastery' | 'spaced_repetition';
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

export type DailyMoodType =
  | 'motivated' // 充满干劲
  | 'calm'      // 平静专注
  | 'anxious'   // 略有焦虑
  | 'inspired'  // 灵感迸发
  | 'tired'     // 疲惫蓄力
  | 'breakthrough'; // 突破瓶颈

export interface DailyMemoNote {
  date: string; // YYYY-MM-DD
  content: string;
  mood?: DailyMoodType;
  tags?: string[];
  updatedAt: string;
}

/**
 * 联动协议 v1 · 练习结果回流入站后落盘的一条事件。
 *
 * 事件只描述「StarQuiz 里发生的一次练习」，不直接改动计划数据：
 * 是否采纳为复习任务由用户决定（M3），所以这里绝不写 StudyTask。
 */

/** 内容路径：与出站链接参数一一对应，入站时用于重算 topicKey 并定位考点。 */
export interface PracticeEventPath {
  level: 'unit' | 'subtopic';
  /** 来源考试名，仅用于展示与定位，不参与钥匙 */
  exam: string;
  subject: string;
  unit: string;
  topic: string;
}

/** 出站的来源上下文（哪一天、哪条任务），只用于定位，不作为考点身份。 */
export interface PracticeEventSourceContext {
  date?: string;
  task?: string;
}

/** 入站定位到的计划内目标。 */
export interface PracticeEventResolution {
  planId: string;
  /** 父单元（SyllabusTopic.id） */
  topicId: string;
  /** 子考点标题；单元级目标时为空 */
  subtopicTitle?: string;
  /** M3 采纳后生成的复习任务 id */
  taskId?: string;
}

export type PracticeEventStatus =
  /** 已定位到目标考点，等待用户处理 */
  | 'pending'
  /** M3：已被采纳为复习任务 */
  | 'applied'
  /** 用户关掉了回执 */
  | 'dismissed'
  /** 参数合法但本地找不到对应计划/考点，绝不挂靠同名考点 */
  | 'unmatched';

export interface PracticeEvent {
  schemaVersion: 1;
  /** StarQuiz 历史里的 attempt.id，同时是去重与幂等键 */
  attemptId: string;
  linkId: string;
  planId: string;
  topicKey: string;
  path: PracticeEventPath;
  sourceContext: PracticeEventSourceContext;
  /** StarQuiz 题库 id，仅用于展示「练的是哪套题」 */
  setId: string;
  /** 归因到目标考点的计分题数 */
  graded: number;
  correct: number;
  /** 练习完成时间（ISO 字符串） */
  completedAt: string;
  /** 本机接收时间（ISO 字符串） */
  receivedAt: string;
  status: PracticeEventStatus;
  appliedAt?: string;
  resolution?: PracticeEventResolution;
}

/**
 * 新建科目向导里还没变成科目的那份填写。
 *
 * 值得落盘的只有资料正文：一份 PDF 解析要几十秒，刷新一下就没了等于让用户重传一遍。
 * 其余字段都是便宜的文字，留着是为了接回来时不用重答一遍考试信息。
 * 全站只有「当前这一份」草稿（id 固定），交出一门科目或用户主动丢掉时就清空。
 */
export interface WizardDraft {
  schemaVersion: 1;
  id: 'current';
  updatedAt: string;
  step: 1 | 2 | 3;
  examName: string;
  subject: string;
  startDate: string;
  examDate: string;
  examTime: string;
  targetScore: string;
  requirements: string;
  dailySchedules: DaySchedulePreference[];
  materials: StudyMaterial[];
  aiSelectedIds: string[];
  topics: SyllabusTopic[];
  textbookLabel: string;
  /** 超出草稿字数预算、这次没能存进来的资料份数：接回草稿时如实告诉用户。 */
  droppedMaterials?: number;
}

