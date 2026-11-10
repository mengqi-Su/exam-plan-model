import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Layers,
  Pencil,
  Sparkles,
  Target,
  Upload,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ExamStudyPlan, PracticeEvent } from "../types";
import type { FocusTarget } from "../lib/inbound";
import { useI18n } from "../lib/i18n";
import { toLocalDateString } from "../lib/date";
import { planReadiness, readinessCopy } from "../lib/planReadiness";
import { pl, unitNoun } from "../lib/text";
import { SectionBlock } from "./SectionBlock";
import { PageIconGlyph } from "./PageIconGlyph";
import { PageCover } from "./PageCover";
import { hasCover } from "../lib/pageCover";
import { EditSubjectModal, type ExamDraft } from "./EditSubjectModal";
import { PhaseRoadmapSection } from "./PhaseRoadmapSection";
import { TopicMasterySection } from "./TopicMasterySection";
import { RebalanceSection } from "./RebalanceSection";
import { CourseKnowledgeHub } from "./CourseKnowledgeHub";
import { PracticeReceiptCard } from "./PracticeReceiptCard";

interface CourseDetailPageProps {
  plan: ExamStudyPlan;
  onUpdatePlan: (updatedPlan: ExamStudyPlan) => void;
  onRequestDeletePlan?: (plan: ExamStudyPlan) => void;
  onNavigateToTab: (tab: "today" | "dashboard" | "master_calendar" | "course" | "settings") => void;
  /**
   * 「先建科目、资料回头再传」的后半程：这门科目已经存好了，还差一次生成。
   * 生成动作只归新建向导那一处，这里只负责把它带着这门科目叫回来。
   */
  onRequestPlanGeneration?: (plan: ExamStudyPlan) => void;
  /** 回程联动定位到的考点；只有属于当前计划时才展开知识区并滚动 */
  focusTarget?: FocusTarget | null;
  /** 同一考点重复点「定位」时用它重新触发滚动 */
  focusNonce?: number;
  /** 本机已落盘的练习回执（仅当前计划） */
  practiceEvents?: PracticeEvent[];
  onLocateReceipt?: (event: PracticeEvent) => void;
  onDismissReceipt?: (attemptId: string) => void;
}

export function CourseDetailPage({
  plan,
  onUpdatePlan,
  onRequestDeletePlan,
  onNavigateToTab,
  onRequestPlanGeneration,
  focusTarget = null,
  focusNonce = 0,
  practiceEvents = [],
  onLocateReceipt,
  onDismissReceipt,
}: CourseDetailPageProps) {
  const { language, t } = useI18n();
  const isZh = language === "zh";

  // Secondary reference detail is disclosed on demand; progress stays primary.
  const [showKnowledge, setShowKnowledge] = useState(false);

  // 考试信息是低频动作，收进悬浮窗，页头只留身份与事实。
  const [editOpen, setEditOpen] = useState(false);
  const [scheduleNotice, setScheduleNotice] = useState<string | null>(null);

  const activeFocus = focusTarget && focusTarget.planId === plan.id ? focusTarget : null;

  // 知识区默认收起，只切到本标签页并不会露出考点树：回程定位必须显式展开
  useEffect(() => {
    if (activeFocus) setShowKnowledge(true);
  }, [activeFocus?.planId, activeFocus?.topicId, activeFocus?.subtopicTitle, focusNonce]);

  // 切换科目时收起上一份草稿与提示，页头事实跟着当前计划
  useEffect(() => {
    setEditOpen(false);
    setScheduleNotice(null);
  }, [plan.id]);

  // 倒计时只由「备考路线」那条轴的考试日节点说一次（D-N），页头不再挂一条属性。
  // 原来这里还跑着一个 setInterval 每秒重渲染整页，只为把小时分秒读下去——
  // 天数在一天之内不会变，一秒一跳的读数反而让同一门考试在三个页面报出三种样子。

  // 日期和时间合成一条属性：属性行按「事实」分行，不按录入字段分行。
  const examWhenText = useMemo(() => {
    if (!plan.examDate) return notSet(isZh);
    return `${plan.examDate} ${plan.examTime || "09:00"}`;
  }, [plan.examDate, plan.examTime, isZh]);

  // 有没有封面决定页头怎么排：有就把图标压在带子下沿、编辑挪到右上角，没有就沿用原来的三段。
  const pageHasCover = hasCover(plan);

  const stats = useMemo(() => {
    const completedCount = plan.tasks.filter((task) => task.status === "completed").length;
    const totalCount = plan.tasks.length;
    const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    const totalPlannedMinutes = plan.tasks.reduce((sum, task) => sum + (task.durationMinutes || 0), 0);
    const completedMinutes = plan.tasks
      .filter((task) => task.status === "completed")
      .reduce((sum, task) => sum + (task.actualMinutesSpent || task.durationMinutes || 0), 0);

    return {
      totalCount,
      progressPercent,
      plannedHours: Math.round((totalPlannedMinutes / 60) * 10) / 10,
      investedHours: Math.round((completedMinutes / 60) * 10) / 10,
      materialsCount: plan.materials?.length || 0,
      /* 考点的个数不在这里数：轮盘中心已经写了「N 个考点」，资料段标题再数一次，
         同一批考点就在同一页印两遍，两处还容易长成两个数（清单 HTTV 那批算了不用的计数）。 */
    };
  }, [plan.tasks, plan.materials]);

  const todayStr = useMemo(() => toLocalDateString(), []);

  // 本页只列今天的任务；执行与勾选仍然只有「今日」一处。
  const todayTasks = useMemo(
    () =>
      plan.tasks
        .filter((task) => task.date === todayStr)
        .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || "")),
    [plan.tasks, todayStr]
  );

  const nextBatch = useMemo(() => {
    const upcoming = plan.tasks
      .filter((task) => task.date > todayStr && task.status !== "completed" && task.status !== "skipped")
      .sort((a, b) => a.date.localeCompare(b.date));
    if (upcoming.length === 0) return null;
    return { date: upcoming[0].date, count: upcoming.filter((task) => task.date === upcoming[0].date).length };
  }, [plan.tasks, todayStr]);

  // 今天没有任务时只留一条数据读数：下一批排在哪天、几项。
  // 排不出下一批就整行不渲染，避免一个空的 <p> 占位。
  const emptyTodayLine = nextBatch
    ? isZh
      ? `今天没有安排任务，下一批在 ${nextBatch.date}（${nextBatch.count} 项）。`
      : `Nothing today. Next batch is ${nextBatch.date} (${nextBatch.count} tasks).`
    : null;

  /**
   * 「科目已经建好、计划还没生成」时，这一页唯一该回答的问题是「现在差什么」：
   * 差资料就把人领到知识库的上传口，差计划就把新建向导叫回来补最后一步。
   * 判断口径和文案都在 lib/planReadiness 一处，这页只负责摆出来。
   */
  const readiness = planReadiness(plan);
  const pendingCopy = readinessCopy(readiness, isZh);
  const knowledgeRef = useRef<HTMLDivElement>(null);
  // 展开知识库之后要滚到它，但那一刻 DOM 还没提交；用 nonce 交给 effect，
  // 比 rAF 稳：后台标签页里 rAF 会被暂停，滚动就永远等不到。
  const [knowledgeReveal, setKnowledgeReveal] = useState(0);

  /**
   * 「去上传资料」点一次算一次：它是一次请求，不是一种状态。
   * 换科目时必须在渲染这一趟就清零——留到 effect 里，按 plan.id 重建的资料区
   * 会先带着上一门那份未消化的请求挂载，弹窗就替一门没点过的科目打开了。
   */
  const [uploadRequest, setUploadRequest] = useState(0);
  const [uploadRequestFrom, setUploadRequestFrom] = useState(plan.id);
  if (plan.id !== uploadRequestFrom) {
    setUploadRequestFrom(plan.id);
    setUploadRequest(0);
  }

  useEffect(() => {
    if (!knowledgeReveal || !showKnowledge) return;
    knowledgeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [knowledgeReveal, showKnowledge]);

  const revealKnowledge = () => {
    setShowKnowledge(true);
    setKnowledgeReveal((n) => n + 1);
  };

  // 按钮写的是「去上传资料」，那就该把人送到上传口：先展开资料区，再把上传弹窗打开，
  // 不该让人在展开之后自己找那颗「上传文件」。页头主动作和待办卡那颗按钮共用这一份，
  // 同一个标签不许一处送到弹窗、另一处只展开半件事。
  const revealUpload = () => {
    revealKnowledge();
    setUploadRequest((n) => n + 1);
  };

  const toggleTask = (taskId: string) => {
    const task = plan.tasks.find((item) => item.id === taskId);
    if (!task) return;
    const willComplete = task.status !== "completed";
    onUpdatePlan({
      ...plan,
      updatedAt: new Date().toISOString(),
      tasks: plan.tasks.map((item) =>
        item.id === taskId
          ? { ...item, status: willComplete ? "completed" : "pending", completedAt: willComplete ? new Date().toISOString() : undefined }
          : item
      ),
    });
  };

  const primaryAction = (() => {
    if (pendingCopy) {
      return {
        label: pendingCopy.action,
        onClick: readiness === "awaiting-materials" ? revealUpload : () => onRequestPlanGeneration?.(plan),
      };
    }
    const hasOpenToday = todayTasks.some((task) => task.status !== "completed" && task.status !== "skipped");
    return {
      label: hasOpenToday ? (isZh ? "继续今日" : "Continue today") : isZh ? "查看今日" : "Open today",
      onClick: () => onNavigateToTab("today"),
    };
  })();

  const handleSaveExam = (draft: ExamDraft) => {
    const dateChanged = draft.examDate !== plan.examDate;

    onUpdatePlan({
      ...plan,
      examName: draft.examName,
      subject: draft.subject || plan.subject,
      icon: draft.icon,
      cover: draft.cover,
      examDate: draft.examDate,
      examTime: draft.examTime,
      preferences: {
        ...plan.preferences,
        examName: draft.examName,
        subject: draft.subject || plan.subject,
        examDate: draft.examDate,
        examTime: draft.examTime,
        targetScoreOrGrade: draft.target,
      },
      updatedAt: new Date().toISOString(),
    });

    setEditOpen(false);
    if (dateChanged) {
      const stranded = plan.tasks.filter(
        (task) => task.date > draft.examDate && task.status !== "completed" && task.status !== "skipped"
      ).length;
      setScheduleNotice(
        stranded > 0
          ? isZh
            ? `考试日期已改到 ${draft.examDate}，仍有 ${stranded} 项任务排在它之后，可在下方「计划动态重排」重新平摊。`
            : `Exam moved to ${draft.examDate}, but ${stranded} tasks fall after it. Use Adaptive rebalance below.`
          : isZh
            ? `考试日期已更新为 ${draft.examDate} ${draft.examTime}。`
            : `Exam date updated to ${draft.examDate} ${draft.examTime}.`
      );
    }
  };

  // 返回和编辑各自全站只有一颗：有封面时浮在封面带上沿的左右角（垫一层半透明白才读得清），
  // 没封面时退回图标上方那两行常驻小字。按钮本身只在这里定义一次，两个分支只会渲染其中一个。
  const backButton = (
    <button
      onClick={() => onNavigateToTab("dashboard")}
      className={
        pageHasCover
          ? "ui-btn-text ui-cover-chip"
          : "inline-flex items-center gap-1.5 text-[13px] ui-muted hover:text-[#1c1b1a] transition-colors cursor-pointer mb-4"
      }
    >
      <ArrowLeft className="w-4 h-4" />
      {isZh ? "科目" : "Subjects"}
    </button>
  );

  const editButton = (
    <button
      onClick={() => setEditOpen(true)}
      className={pageHasCover ? "ui-btn-text ui-cover-chip" : "ui-btn-text -ml-2"}
    >
      <Pencil className="w-3.5 h-3.5" />
      {t("edit")}
    </button>
  );

  return (
    <div className="relative min-h-screen bg-[#f8f7f4] text-[#1c1b1a] pb-20 animate-fadeIn">
      {/* 封面带满宽贴顶，占的是整个页面区，不是内容列里的一张卡；
          所以它是这一层的第一个块，返回 / 编辑压在它上沿的左右角。 */}
      {pageHasCover && (
        <div className="relative">
          <PageCover plan={plan} />
          <div className="absolute inset-x-0 top-0 z-10 mx-auto flex max-w-6xl items-start justify-between px-4 pt-3 sm:px-8">
            {backButton}
            {editButton}
          </div>
        </div>
      )}

      {/* 内容列往上压 1/4 个图标盒高，页图标就骑在封面下沿上；没封面时才是普通的顶部留白。 */}
      <div
        className={`mx-auto max-w-6xl px-4 sm:px-8 ${pageHasCover ? "-mt-3 sm:-mt-4" : "pt-6 sm:pt-8"}`}
      >
        {!pageHasCover && backButton}

        <header className="relative">
          {/* Notion 三段：页面图标 → 文档标题 → 属性。
              封面只是底，不承载信息也不放内容；科目身份仍然是 planIcon。
              属性一条是「图标+标签+取值」，标签定宽所以取值对齐成列；日期和时间合成一条，
              因为它们是同一个事实。这里只剩三条（学科 / 考试 / 目标）：倒计时不在属性行里，
              它属于「备考路线」那条轴的考试日节点，写两遍就会有两个天数口径。 */}
          {!pageHasCover && <div className="mb-1 flex h-6 items-center">{editButton}</div>}

          <PageIconGlyph plan={plan} className="ui-page-icon relative z-20" />

          <h1 className="ui-doc-title mt-2 break-words">{plan.examName}</h1>

          <div className="mt-4 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
            <PropItem
              icon={Layers}
              label={isZh ? "学科" : "Subject"}
              value={plan.subject || notSet(isZh)}
              muted={!plan.subject}
            />
            <PropItem
              icon={CalendarDays}
              label={isZh ? "考试" : "Exam"}
              value={examWhenText}
              muted={!plan.examDate}
            />
            <PropItem
              icon={Target}
              label={isZh ? "目标" : "Target"}
              value={plan.preferences?.targetScoreOrGrade || notSet(isZh)}
              muted={!plan.preferences?.targetScoreOrGrade}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button onClick={primaryAction.onClick} className="ui-btn ui-btn-primary inline-flex items-center gap-1.5">
              <span>{primaryAction.label}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {scheduleNotice && (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-[#f0e2c0] bg-[#FFF6DD] px-3.5 py-2.5 text-[12px] text-[#8A5A00] animate-fadeIn">
              <span className="leading-relaxed">{scheduleNotice}</span>
              <button
                onClick={() => setScheduleNotice(null)}
                className="shrink-0 font-medium underline underline-offset-2 cursor-pointer"
              >
                {isZh ? "知道了" : "Dismiss"}
              </button>
            </div>
          )}

        </header>

        <EditSubjectModal
          open={editOpen}
          plan={plan}
          onClose={() => setEditOpen(false)}
          onSave={handleSaveExam}
        />
      </div>

      {/* 页头和正文之间留一整段呼吸（全站块间距 24），发丝分隔线才不会紧贴在属性行底下。 */}
      <main className="max-w-6xl mx-auto px-4 sm:px-8 mt-6">
        {/* 段与段之间只靠发丝分隔线断开，标题和它的计数写在同一行；
            白卡只留给内容本身，不再一块块等宽平铺，也不再左边立一栏标签。 */}
        <div className="border-t border-[#eeece6] divide-y divide-[#eeece6]">
          {/* 顺序按「整体走到哪 → 今天做什么 → 哪里没掌握 → 凭什么」排。
              轴先给全景，今日任务才是当下这一格；反过来排会让人先看见五行任务，
              却不知道这五行站在整个计划的前头还是尾巴上。 */}
          <PhaseRoadmapSection plan={plan} />

          <SectionBlock
            title={isZh ? "今日任务" : "Today"}
            hint={todayStr}
            aside={
              pendingCopy ? null : (
                <span className="ui-chip tabular-nums">
                  {todayTasks.filter((task) => task.status === "completed").length}/{todayTasks.length}
                </span>
              )
            }
          >
            {pendingCopy ? (
              /* 待办只说「还差什么」，动作交给页头那颗按钮。
                 原来这张卡里又复刻一颗同名同逻辑的主按钮：同一页两个入口，
                 第二个还多包一层白卡，而它只装得下一行字和一个按钮。 */
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EEF4EF] text-[#3F6B4F]">
                  {readiness === "awaiting-materials" ? (
                    <Upload className="h-4 w-4" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </span>
                <p className="ui-row-title min-w-0 pt-1 leading-relaxed">{pendingCopy.title}</p>
              </div>
            ) : todayTasks.length > 0 ? (
              <ul className="ui-card divide-y divide-[#f0ede8] overflow-hidden">
                {todayTasks.map((task) => {
                  const done = task.status === "completed";
                  return (
                    <li key={task.id} className="flex items-start gap-3 px-4 sm:px-5 py-3.5">
                      <span className="mt-[3px] w-[46px] shrink-0 ui-row-value">{task.startTime || "—"}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`ui-row-title ${done ? "text-[#6b6660]" : ""}`}>{task.title}</p>
                        <p className="mt-1 ui-row-meta truncate">
                          {task.topicTitle}
                          {task.durationMinutes ? ` · ${task.durationMinutes} ${isZh ? "分钟" : "min"}` : ""}
                          {done && ` · ${isZh ? "已完成" : "done"}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleTask(task.id)}
                        aria-label={done ? (isZh ? "标记为未完成" : "Mark incomplete") : (isZh ? "标记完成" : "Mark complete")}
                        className="mt-0.5 shrink-0 rounded-full text-[#6b6660] transition-colors hover:text-[#1c1b1a] cursor-pointer"
                      >
                        {done ? (
                          <CheckCircle2 className="w-4 h-4 text-[#3F6B4F]" />
                        ) : (
                          <span className="block h-4 w-4 rounded-full border border-[#d8d4cc]" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : emptyTodayLine ? (
              <p className="ui-note">{emptyTodayLine}</p>
            ) : null}

            {/* 整门科目的进度挂在今天下面，收成一行读数 + 一条 bar。
                原来这里是两个 30px 大数字各带一条 bar 的白卡：进度这一件事在页头、
                任务卡页脚、这里各说一遍，而且它自己就占了两层（卡 + 两条计量），
                读起来比上面的任务列表还重。
                「已完成 12/40」也不再说一次：它和 32% 是同一个数两种写法，
                标题旁边那枚 chip 说的是今天，分母不同，只有这一处是整门科目。 */}
            {!pendingCopy && stats.totalCount > 0 && (
              <div className="mt-4">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 ui-row-meta tabular-nums">
                  <span>
                    {isZh ? "总进度" : "Overall"} <span className="ui-row-value">{stats.progressPercent}%</span>
                  </span>
                  <span>
                    {isZh ? "投入" : "Invested"}{" "}
                    <span className="ui-row-value">
                      {stats.investedHours}/{stats.plannedHours}{" "}
                      {isZh ? "小时" : unitNoun(stats.plannedHours, { one: "hr", many: "hrs" })}
                    </span>
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#f1efe9]">
                  <div
                    className="h-full rounded-full bg-[#1c1b1a] transition-all duration-300"
                    style={{ width: `${stats.progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            <PracticeReceiptCard
              events={practiceEvents}
              onLocate={(event) => onLocateReceipt?.(event)}
              onDismiss={(attemptId) => onDismissReceipt?.(attemptId)}
            />
          </SectionBlock>

          <TopicMasterySection plan={plan} />

          <SectionBlock
            title={isZh ? "课程资料与考点体系" : "Materials & topics"}
            hint={
              /* 这一段只报资料的份数：考点的个数由上面「考点掌握度」那段说，
                 两栏各数自己的东西，原来同一批考点在这里和那里各印一次。
                 英文的单复数仍由 pl() 管，一份资料不会显示成 "1 files"（清单 UI-04）。 */
              <span className="tabular-nums">
                {isZh ? `${stats.materialsCount} 份资料` : pl(stats.materialsCount, "file", "files")}
              </span>
            }
            action={
              <button
                onClick={() => setShowKnowledge((prev) => !prev)}
                aria-expanded={showKnowledge}
                className="inline-flex items-center gap-1 ui-row-meta hover:text-[#1c1b1a] transition-colors cursor-pointer"
              >
                <span className="font-medium">
                  {showKnowledge ? (isZh ? "收起" : "Collapse") : isZh ? "展开" : "Expand"}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[#6b6660] transition-transform ${showKnowledge ? "rotate-180" : ""}`}
                />
              </button>
            }
          >
            {showKnowledge ? (
              /* 展开之后这里不再包白卡：资料区自己就是一段一段的卡，
                 外面再套一层就成了「页 → 段 → 卡 → 卡」，里面的卡反而读不出边界。
                 收起态那一颗条状按钮仍然是卡，它是这一段里唯一的一层。 */
              <div ref={knowledgeRef} className="animate-fadeIn">
                {/* 资料区整块按科目重建：它内部记着上一门的提示、当前文件夹、勾选与草稿，
                    换一门科目还留着，就是拿另一门的进度说这一门的事。 */}
                <CourseKnowledgeHub
                  key={plan.id}
                  plan={plan}
                  onUpdatePlan={onUpdatePlan}
                  onRequestDeleteCourse={onRequestDeletePlan}
                  uploadRequest={uploadRequest}
                  focusUnitId={activeFocus?.topicId ?? null}
                  focusSubtopicTitle={activeFocus?.subtopicTitle ?? ""}
                  focusNonce={focusNonce}
                />
              </div>
            ) : (
              <button
                onClick={() => setShowKnowledge(true)}
                className="w-full ui-card ui-card-hover px-4 sm:px-5 py-4 text-left flex items-center justify-between gap-3 cursor-pointer"
              >
                <span className="ui-note min-w-0 truncate">
                  {isZh ? "考点树与资料归档" : "Topic tree and material archive"}
                </span>
                <span className="ui-row-meta shrink-0">
                  {isZh ? "展开" : "Expand"}
                  <ChevronDown className="w-3.5 h-3.5 inline ml-1" />
                </span>
              </button>
            )}
          </SectionBlock>

          {/* 还没排出任务就没有「积压」可平摊，重排这一栏对空科目只是噪音。 */}
          {!pendingCopy && <RebalanceSection plan={plan} onUpdatePlan={onUpdatePlan} />}
        </div>
      </main>
    </div>
  );
}

/**
 * 文档页头的一条属性：前导图标（ui-prop-icon，纯标记不可点）+ 定宽浅标签 + 同一档取值。
 * 三者的字号、标签列宽、取值字重都在 ui-prop-* token 里，组件只管内容不管排版。
 */
function PropItem({
  icon: Icon,
  label,
  value,
  muted,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Icon className="ui-prop-icon" aria-hidden="true" />
      <span className="ui-prop-label">{label}</span>
      <span className={muted ? "ui-prop-empty" : "ui-prop-value"}>{value}</span>
    </span>
  );
}

/** 属性还没填时的占位取值，与空状态同一档灰。 */
function notSet(isZh: boolean) {
  return isZh ? "未设定" : "Not set";
}

