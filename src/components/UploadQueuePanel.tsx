import React from "react";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { type UploadTask, pendingUploadCount } from "../lib/uploadQueue";
import { MAX_UPLOAD_MB } from "../lib/documentParser";
import { MAX_LIBRARY_MATERIALS } from "../lib/aiClient";
import { pl } from "../lib/text";
import { useI18n } from "../lib/i18n";

interface UploadQueuePanelProps {
  tasks: UploadTask[];
  /** 队列还在跑：这时候给的是「取消」，跑完了才给「重试 / 收起」。 */
  isRunning: boolean;
  onCancel: () => void;
  onRetry: () => void;
  onDismiss: () => void;
}

/* 一批资料的读取状态，全站就这一份：向导里传资料、科目页补资料用的都是它。
   以前每个入口自己写一个转圈 + 一句「正在读取 (3/20)」——卡住时既停不下来，
   也不知道剩下几份没读，两处还各说一套话。 */
export const UploadQueuePanel: React.FC<UploadQueuePanelProps> = ({
  tasks,
  isRunning,
  onCancel,
  onRetry,
  onDismiss,
}) => {
  const { language } = useI18n();
  const tt = (zh: string, en: string) => (language === "zh" ? zh : en);
  if (tasks.length === 0) return null;

  const doneCount = tasks.filter((task) => task.state === "done").length;
  const failedCount = tasks.filter((task) => task.state === "failed").length;
  const pendingCount = pendingUploadCount(tasks);
  const stateLabel = (task: UploadTask) => {
    switch (task.state) {
      case "done":
        return `${(task.chars ?? 0).toLocaleString()} ${tt("字", "chars")}`;
      case "failed":
        return tt("读不出", "not readable");
      case "cancelled":
        return tt("没读", "not read");
      case "over-budget":
        return tt("留到下一批", "next batch");
      case "working":
        return tt("读取中", "reading");
      default:
        return tt("排队中", "queued");
    }
  };
  const actionClass = "ui-btn ui-btn-ghost shrink-0 items-center gap-1 text-[12px]";

  return (
    <div className="overflow-hidden rounded-xl border border-[#eae7e1] bg-white" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-2 border-b border-[#f0ede8] px-3 py-2">
        <span className="text-[12px] font-medium text-[#1c1b1a] tabular-nums">
          {isRunning
            ? tt(`读取资料 ${doneCount}/${tasks.length}`, `Reading ${doneCount}/${tasks.length}`)
            : tt(`这一批读了 ${doneCount} 份`, `Read ${pl(doneCount, "file", "files")}`)
          }
        </span>
        <span className="flex items-center gap-1">
          {isRunning && (
            <button onClick={onCancel} className={actionClass}>
              {tt(`取消（还剩 ${pendingCount} 份）`, `Cancel (${pendingCount} left)`)}
            </button>
          )}
          {!isRunning && failedCount > 0 && (
            <button onClick={onRetry} className={actionClass}>
              {tt(`重试失败的 ${failedCount} 份`, `Retry ${pl(failedCount, "failed file", "failed files")}`)}
            </button>
          )}
          {!isRunning && (
            <button onClick={onDismiss} className={actionClass}>
              {tt("收起", "Dismiss")}
            </button>
          )}
        </span>
      </div>
      <ul className="max-h-40 divide-y divide-[#f0ede8] overflow-y-auto">
        {tasks.map((task) => (
          <li key={task.key} className="flex items-center gap-2 px-3 py-1.5">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[#6b6660]">
              {task.state === "working" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {task.state === "done" && <Check className="h-3.5 w-3.5" />}
              {task.state === "failed" && <AlertCircle className="h-3.5 w-3.5 text-[#B42318]" />}
            </span>
            <span className="min-w-0 flex-1 truncate text-[12px] text-[#1c1b1a]">{task.name}</span>
            <span
              className={`shrink-0 text-[11px] tabular-nums ${
                task.state === "failed" ? "text-[#B42318]" : "text-[#6b6660]"
              }`}
            >
              {stateLabel(task)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/* 上传规格全站就这一行：向导第二步和科目页上传弹窗都挂它，两个入口不会各说一套数。
   数字由常量算出，改上限只改 documentParser 一处。这是规格读数（和页头「已存 N 门」同类），
   不是解释句，所以用 chip 而不是灰字段落——「次要灰字全清」清的是说明文，不是上限本身。
   一次生成用几份是另一件事，它绑在资料列表的勾选框上，不在这里重复一遍。 */
export const UploadLimitChips: React.FC<{ className?: string }> = ({ className = "" }) => {
  const { language } = useI18n();
  const tt = (zh: string, en: string) => (language === "zh" ? zh : en);
  return (
    <span className={`flex flex-wrap items-center justify-center gap-1.5 ${className}`}>
      <span className="ui-chip tabular-nums">
        {tt(`单份 ≤ ${MAX_UPLOAD_MB} MB`, `Up to ${MAX_UPLOAD_MB} MB each`)}
      </span>
      <span className="ui-chip tabular-nums">
        {tt(`资料库 ${MAX_LIBRARY_MATERIALS} 份`, `${MAX_LIBRARY_MATERIALS} per library`)}
      </span>
    </span>
  );
};
