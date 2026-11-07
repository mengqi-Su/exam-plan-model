/* 一批资料的读取，两端各只有一份实现：并发 2、看得见进度、能取消、失败能重来。
   过去这里是 for 循环一个个读，20 份资料里第 3 份卡住，界面只会转圈，
   用户既不知道读到哪、也停不下来，只能刷新页面把整批丢掉。
   「一批读了多少字」也在这里当场累加：到生成那一步才发现超预算，
   是旧问题从队列里往前挪出来的——预检就是要在文件落地之前说话。 */

import { pl, visibleChars } from "./text";

/** 同时读两份：解析是 CPU 活，再并发下去只会互相抢主线程，界面更卡。 */
export const UPLOAD_CONCURRENCY = 2;

/** 一批资料的可见字数预算，约等于一本 600 页的书。真超了该分两批传，而不是一次塞满内存。 */
export const UPLOAD_CHAR_BUDGET = 600_000;

export type UploadTaskState = "queued" | "working" | "done" | "failed" | "cancelled" | "over-budget";

export interface UploadTask {
  key: string;
  name: string;
  sizeBytes: number;
  state: UploadTaskState;
  /** 读出来的可见字数，只有 done 才有 */
  chars?: number;
  /** 失败原因，只有 failed 才有 */
  error?: string;
}

export interface QueueOutcome<T> {
  done: { key: string; name: string; value: T; chars: number }[];
  failed: UploadTask[];
  cancelled: UploadTask[];
  overBudget: UploadTask[];
  /** 这一批读出来的可见字数合计 */
  chars: number;
  /** 预算是否已经被填满（填满后剩下的份不再读） */
  budgetReached: boolean;
}

export interface RunQueueOptions<T> {
  /** 读一份文件；抛错即视为这一份失败 */
  run: (file: File, task: UploadTask) => Promise<T>;
  /** 从读出来的结果里取正文，用于累计字数 */
  textOf?: (value: T) => string;
  /** 每次状态变化后回一份快照，界面只管照着画 */
  onTasks?: (tasks: UploadTask[]) => void;
  /** 取消：已开工的那份会读完，排队的不再开始 */
  isCancelled?: () => boolean;
  charBudget?: number;
  concurrency?: number;
  /** 重试时沿用上一轮的 key，进度列表不会多出双胞胎 */
  keepKeys?: Map<string, string>;
}

export function uploadTaskKey(file: File): string {
  return `${file.name}:${file.size}`;
}

/** 排队用的初始状态：先把全部列出来，界面立刻有东西可显示，不用等第一份读完才结账。 */
export function toUploadTasks(files: File[], keepKeys?: Map<string, string>): UploadTask[] {
  return files.map((file, index) => ({
    key: keepKeys?.get(uploadTaskKey(file)) ?? `${uploadTaskKey(file)}#${index}`,
    name: file.name,
    sizeBytes: file.size,
    state: "queued" as UploadTaskState,
  }));
}

/** 还剩多少份没读：取消之后要说清这个数，只说「已取消」等于没说完。 */
export function pendingUploadCount(tasks: UploadTask[]): number {
  return tasks.filter((task) => task.state === "queued" || task.state === "working").length;
}

export async function runUploadQueue<T>(
  files: File[],
  options: RunQueueOptions<T>
): Promise<QueueOutcome<T>> {
  const concurrency = Math.max(1, options.concurrency ?? UPLOAD_CONCURRENCY);
  const budget = options.charBudget ?? UPLOAD_CHAR_BUDGET;
  const textOf = options.textOf ?? ((value: T) => String((value as { text?: unknown })?.text ?? ""));
  const tasks = toUploadTasks(files, options.keepKeys);
  /* 队列里放的是「第几号任务 + 对应文件」：靠下标配对，
     比在数组里反查稳当——同名同大小的两份文件本就该各算一份。 */
  const slots = tasks.map((task, index) => ({ task, file: files[index] }));
  const emit = () => options.onTasks?.(tasks.slice());
  emit();

  const results = new Map<string, { key: string; name: string; value: T; chars: number }>();
  let cursor = 0;
  let totalChars = 0;
  let budgetReached = false;
  let cancelRequested = false;

  const cancelled = () => cancelRequested || (options.isCancelled ? options.isCancelled() : false);

  async function worker() {
    for (;;) {
      if (cancelled()) {
        cancelRequested = true;
        break;
      }
      if (cursor >= slots.length) return;
      const slot = slots[cursor];
      cursor += 1;
      /* 预算用满之后不再往下读：剩下这些不是坏了，是这一批装不下，
         所以它们不能和被拒的文件共用一句「读不出来」。 */
      if (budgetReached) {
        slot.task.state = "over-budget";
        emit();
        continue;
      }
      slot.task.state = "working";
      emit();
      try {
        const value = await options.run(slot.file, slot.task);
        const chars = visibleChars(textOf(value));
        slot.task.chars = chars;
        slot.task.state = "done";
        totalChars += chars;
        results.set(slot.task.key, { key: slot.task.key, name: slot.task.name, value, chars });
        if (totalChars >= budget) budgetReached = true;
      } catch (err) {
        slot.task.state = "failed";
        slot.task.error = (err as Error)?.message || "读取失败";
      }
      emit();
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, slots.length) }, () => worker())
  );

  /* 取消时还剩两类：连开始都没开始的，和给预算让路的。两者都只是没轮到，不是出错。 */
  const settle = (state: UploadTaskState) => {
    let changed = false;
    slots.forEach(({ task }) => {
      if (task.state !== "queued") return;
      task.state = state;
      changed = true;
    });
    if (changed) emit();
  };
  if (cancelRequested) settle("cancelled");
  if (budgetReached) settle("over-budget");

  const inUploadOrder = (state: UploadTaskState) =>
    tasks.filter((task) => task.state === state);

  return {
    done: tasks
      .map((task) => results.get(task.key))
      .filter((item): item is { key: string; name: string; value: T; chars: number } => !!item),
    failed: inUploadOrder("failed"),
    cancelled: inUploadOrder("cancelled"),
    overBudget: inUploadOrder("over-budget"),
    chars: totalChars,
    budgetReached,
  };
}

/** 只重跑失败那几份：成功的不该被再读一遍，那既慢又会在资料库里造出双胞胎。 */
export function pickFailedFiles(files: File[], tasks: UploadTask[]): { files: File[]; keepKeys: Map<string, string> } {
  const keepKeys = new Map<string, string>();
  const byIndex = new Map<number, string>();
  tasks.forEach((task) => {
    if (task.state !== "failed") return;
    const match = /#(\d+)$/.exec(task.key);
    if (match) byIndex.set(Number(match[1]), task.key);
  });
  const picked: File[] = [];
  files.forEach((file, index) => {
    const key = byIndex.get(index);
    if (!key) return;
    picked.push(file);
    keepKeys.set(uploadTaskKey(file), key);
  });
  return { files: picked, keepKeys };
}

/* 一句结果话：失败与「没轮到」分开说，前者是这件事没做成，后者只是这一批的边界。
   红底还是纸底由调用方定——全站只在 NoticeBand 那一处分一次。
   英文的计数交给 text.pl：这里以前写 `${n} file(s)`，和练习端词典的 "Read 1 file" 各说一套。 */
export function uploadOutcomeNotice(outcome: QueueOutcome<unknown>, isZh = true): string | null {
  const parts: string[] = [];
  if (outcome.overBudget.length > 0) {
    parts.push(
      isZh
        ? `这一批读到 ${outcome.done.length} 份、共 ${outcome.chars.toLocaleString()} 字，单批预算已用满，剩下 ${outcome.overBudget.length} 份没有读，请分两批再传。`
        : `Read ${pl(outcome.done.length, "file", "files")} · ${outcome.chars.toLocaleString()} characters — one batch is full, ${pl(outcome.overBudget.length, "file", "files")} not read. Split them into a second batch.`
    );
  }
  if (outcome.cancelled.length > 0) {
    parts.push(
      isZh
        ? `已取消，剩下 ${outcome.cancelled.length} 份没有读。`
        : `Cancelled — ${pl(outcome.cancelled.length, "file", "files")} not read.`
    );
  }
  return parts.length > 0 ? parts.join(isZh ? "" : " ") : null;
}
