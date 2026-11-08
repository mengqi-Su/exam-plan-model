import React, { useMemo, lazy, Suspense } from "react";
import { ExamStudyPlan } from "../types";
import { useI18n } from "../lib/i18n";
import { SectionBlock } from "./SectionBlock";

/* 轮盘是一张自绘 SVG，只有展开掌握度这一段才用得上，按需取（清单 PERF-01）。 */
const DomainMasteryWheelChart = lazy(() =>
  import("./DomainMasteryWheelChart").then((m) => ({ default: m.DomainMasteryWheelChart }))
);

interface TopicMasterySectionProps {
  plan: ExamStudyPlan;
}

/** 掌握度：按考点聚合任务完成度与自评，轮盘本身自带指标切换与明细。 */
export function TopicMasterySection({ plan }: TopicMasterySectionProps) {
  const { language } = useI18n();
  const isZh = language === "zh";

  const topicMastery = useMemo(() => {
    return (plan.topics || []).map((top) => {
      const topicTasks = plan.tasks.filter((t) => t.topicTitle === top.title);
      const done = topicTasks.filter((t) => t.status === "completed");

      const ratings = done.map((t) => t.confidenceRating || 3);
      const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

      const progressPercent =
        topicTasks.length > 0 ? Math.round((done.length / topicTasks.length) * 100) : 0;

      return { ...top, totalTasks: topicTasks.length, completedTasks: done.length, progressPercent, avgRating };
    });
  }, [plan.topics, plan.tasks]);

  if (topicMastery.length === 0) return null;

  return (
    <SectionBlock
      title={isZh ? "考点掌握度" : "Topic mastery"}
    >
      <Suspense fallback={null}>
        <DomainMasteryWheelChart topics={topicMastery} language={language} />
      </Suspense>
    </SectionBlock>
  );
}
