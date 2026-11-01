import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Clock,
  Cpu,
  Database,
  Download,
  FileJson,
  FolderOpen,
  HardDrive,
  Languages,
  ListChecks,
  RefreshCw,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useI18n } from "../lib/i18n";
import { AppSettings, DailyMemoNote, ExamStudyPlan } from "../types";
import {
  APP_VERSION_DATA,
  getDailyMemos,
  getStorageEstimate,
  mergeDailyMemos,
} from "../lib/storage";
import { toLocalDateString } from "../lib/date";
import { STARQUIZ_URL } from "../lib/links";

interface SettingsPageProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  plans: ExamStudyPlan[];
  onImportPlans?: (importedPlans: ExamStudyPlan[], importedSettings?: AppSettings) => void;
  onClearAllData?: () => Promise<void> | void;
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function Toggle({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-6 border border-[#111111] transition-colors cursor-pointer shrink-0 ${
        checked ? "bg-[#111111]" : "bg-white"
      }`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 transition-all ${
          checked ? "left-[20px] bg-white" : "left-0.5 bg-[#111111]"
        }`}
      />
    </button>
  );
}

function SectionHeading({
  index,
  title,
  description,
}: {
  index: string;
  title: string;
  description: string;
}) {
  return (
    <div className="pb-2.5 border-b border-[#111111]">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[10px] font-bold text-[#666666]">[{index}]</span>
        <h2 className="text-sm font-bold text-[#111111]">{title}</h2>
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-[#666666]">{description}</p>
    </div>
  );
}

export function SettingsPage({
  settings,
  onUpdateSettings,
  plans,
  onImportPlans,
  onClearAllData,
}: SettingsPageProps) {
  const { language, setLanguage } = useI18n();
  const isZh = language === "zh";

  const [notification, setNotification] = useState<string | null>(null);
  const [storageInfo, setStorageInfo] = useState<{ usage: number; quota: number } | null>(null);
  const [isPersisted, setIsPersisted] = useState<boolean | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    getStorageEstimate().then(setStorageInfo);
    if (navigator.storage?.persisted) {
      navigator.storage.persisted().then(setIsPersisted).catch(() => setIsPersisted(null));
    }
  }, [plans]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = (message: string) => {
    setNotification(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setNotification(null), 3500);
  };

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    onUpdateSettings({ ...settings, [key]: value });
  };

  const totalTasks = plans.reduce((sum, plan) => sum + (plan.tasks?.length || 0), 0);
  const totalMaterials = plans.reduce((sum, plan) => sum + (plan.materials?.length || 0), 0);

  const handleExport = () => {
    const data = {
      app: "Exam Plan AI",
      schemaVersion: 3,
      exportDate: new Date().toISOString(),
      version: APP_VERSION_DATA.version,
      settings,
      plans,
      dailyMemos: getDailyMemos(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `exam-plan-ai-backup-${toLocalDateString()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast(isZh ? "备份文件已导出。" : "Backup exported.");
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImportError(null);

    if (file.size > 50 * 1024 * 1024) {
      setImportError(isZh ? "备份文件超过 50 MB，无法导入。" : "Backup file exceeds 50 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const parsed = JSON.parse(String(loadEvent.target?.result || ""));
        const rawPlans = Array.isArray(parsed) ? parsed : parsed?.plans;
        if (!Array.isArray(rawPlans)) {
          setImportError(isZh ? "备份文件缺少 plans 数据，无法识别。" : "No plan data found in this backup.");
          return;
        }
        const validPlans = rawPlans.filter(
          (plan: ExamStudyPlan) =>
            plan && typeof plan.id === "string" && typeof plan.examName === "string" && Array.isArray(plan.tasks)
        );
        if (validPlans.length === 0) {
          setImportError(isZh ? "备份文件中没有有效的备考计划。" : "The backup contains no valid study plans.");
          return;
        }
        if (parsed?.dailyMemos && typeof parsed.dailyMemos === "object") {
          mergeDailyMemos(parsed.dailyMemos as Record<string, DailyMemoNote>);
        }
        onImportPlans?.(validPlans, parsed?.settings);
        showToast(
          isZh
            ? `已导入 ${validPlans.length} 个备考计划。`
            : `Imported ${validPlans.length} study plan(s).`
        );
      } catch (error) {
        console.error("Failed to import backup", error);
        setImportError(isZh ? "无法解析该 JSON 文件，请确认文件完整未损坏。" : "Could not parse this JSON backup.");
      }
    };
    reader.onerror = () => {
      setImportError(isZh ? "读取文件失败，请重试。" : "Failed to read the file. Please retry.");
    };
    reader.readAsText(file);
  };

  const handleConfirmClear = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      window.setTimeout(() => setConfirmClear(false), 5000);
      return;
    }
    setIsClearing(true);
    try {
      await onClearAllData?.();
      showToast(isZh ? "本地备考数据已全部清除。" : "All local study data cleared.");
      setConfirmClear(false);
    } catch (error) {
      console.error("Failed to clear planner data", error);
      showToast(isZh ? "清除失败，请检查浏览器存储权限。" : "Failed to clear local data.");
    } finally {
      setIsClearing(false);
    }
  };

  const handleRequestPersistence = async () => {
    if (!navigator.storage?.persist) return;
    try {
      const granted = await navigator.storage.persist();
      setIsPersisted(granted);
      showToast(
        granted
          ? isZh
            ? "已获得持久化存储权限，浏览器不会自动清理备考数据。"
            : "Persistent storage granted."
          : isZh
            ? "浏览器未授予持久化权限，请定期导出备份。"
            : "Persistence not granted. Please export backups regularly."
      );
    } catch (error) {
      console.error("Failed to request persistent storage", error);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-7 animate-fadeIn text-[#111111] font-mono">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-3 border-b border-[#111111]">
        <div>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#666666]">
            WORKSPACE // {isZh ? "本机设置" : "LOCAL SETTINGS"}
          </div>
          <h1 className="mt-1 text-3xl sm:text-4xl font-bold tracking-tight flex items-center gap-2.5">
            <Settings className="w-7 h-7" />
            <span>{isZh ? "设置" : "Settings"}</span>
          </h1>
          <p className="mt-1 text-[13px] text-[#555555] leading-relaxed">
            {isZh
              ? "本地优先，无需账号。修改会立即保存在此浏览器。"
              : "Local-first, no account. Changes save in this browser immediately."}
          </p>
        </div>
        <span className="shrink-0 border border-[#111111] bg-white px-2.5 py-1 font-mono text-[11px] font-bold">
          {APP_VERSION_DATA.version}
        </span>
      </header>

      {notification && (
        <div
          role="status"
          className="flex items-center gap-2 border border-[#111111] bg-[#FCD33B] px-3.5 py-2.5 text-[12px] font-bold animate-fadeIn"
        >
          <Check className="w-4 h-4 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      <section className="space-y-3" aria-labelledby="settings-preferences-heading">
        <SectionHeading
          index="01"
          title={isZh ? "学习偏好" : "STUDY PREFERENCES"}
          description={
            isZh
              ? "控制专注计时与提示音，以及新建科目时使用的复习节奏。"
              : "Control the focus timer, sound alerts, and the pace used for new subjects."
          }
        />

        <div className="grid md:grid-cols-2 gap-3.5">
          <div className="border border-[#111111] bg-white p-4 space-y-4">
            <div>
              <div className="flex items-center space-x-1.5 text-[12.5px] font-bold mb-2">
                <Clock className="w-3.5 h-3.5" />
                <span id="settings-preferences-heading">{isZh ? "专注计时初始时长" : "FOCUS TIMER"}</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[25, 45, 60, 90].map((minutes) => (
                  <button
                    key={minutes}
                    onClick={() => updateSetting("defaultFocusDuration", minutes)}
                    aria-pressed={settings.defaultFocusDuration === minutes}
                    className={`py-2 min-h-10 font-mono text-[12px] font-bold border transition-colors cursor-pointer ${
                      settings.defaultFocusDuration === minutes
                        ? "bg-[#111111] text-white border-[#111111]"
                        : "bg-white text-[#666666] border-[#e5e5e5] hover:border-[#111111] hover:text-[#111111]"
                    }`}
                  >
                    {minutes} min
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-[#777777]">
                {isZh ? "打开任务计时器时从该时长开始。" : "The timer starts at this duration."}
              </p>
            </div>

            <div className="flex items-start justify-between gap-4 pt-3 border-t border-[#e5e5e5]">
              <div>
                <div className="text-[13px] font-bold">{isZh ? "提示音" : "SOUND ALERTS"}</div>
                <p className="text-[12px] text-[#666666] mt-0.5 leading-relaxed">
                  {isZh ? "任务完成与计时结束时播放提示音。" : "Play a chime when tasks are checked off or the timer ends."}
                </p>
              </div>
              <Toggle
                checked={settings.enableSoundAlerts}
                onChange={(next) => updateSetting("enableSoundAlerts", next)}
                ariaLabel={isZh ? "提示音" : "Sound alerts"}
              />
            </div>
          </div>

          <div className="border border-[#111111] bg-white p-4">
            <div className="flex items-center space-x-1.5 text-[12.5px] font-bold mb-2">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{isZh ? "默认复习节奏" : "DEFAULT STUDY PACE"}</span>
            </div>
            <select
              value={settings.defaultStudyPace}
              onChange={(e) =>
                updateSetting("defaultStudyPace", e.target.value as AppSettings["defaultStudyPace"])
              }
              aria-label={isZh ? "默认复习节奏" : "Default study pace"}
              className="w-full min-h-10 px-2.5 py-2 border border-[#111111] text-[13px] bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] cursor-pointer"
            >
              <option value="spaced_repetition">{isZh ? "间隔复习" : "Spaced Repetition"}</option>
              <option value="balanced">{isZh ? "稳健平衡" : "Balanced"}</option>
              <option value="deep_mastery">{isZh ? "深度精通" : "Deep Mastery"}</option>
              <option value="intensive_crash">{isZh ? "考前冲刺" : "Intensive Sprint"}</option>
            </select>
            <p className="mt-1.5 text-[11px] leading-relaxed text-[#777777]">
              {isZh
                ? "新建科目时按该节奏生成复习计划。"
                : "New subjects generate their study plan with this pace."}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="settings-language-heading">
        <SectionHeading
          index="02"
          title={isZh ? "界面语言" : "LANGUAGE"}
          description={isZh ? "仅影响本机界面显示。" : "Affects this browser only."}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
          {[
            { id: "zh" as const, title: "简体中文", subtitle: "Simplified Chinese" },
            { id: "en" as const, title: "English", subtitle: "English" },
          ].map((option) => (
            <button
              key={option.id}
              onClick={() => setLanguage(option.id)}
              aria-pressed={language === option.id}
              id={option.id === "zh" ? "settings-language-heading" : undefined}
              className={`p-4 min-h-16 border text-left transition-colors cursor-pointer ${
                language === option.id
                  ? "border-[#111111] bg-[#111111] text-white"
                  : "border-[#111111] bg-white hover:bg-[#f2f0ea]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-bold">{option.title}</span>
                {language === option.id && <Check className="w-4 h-4" />}
              </div>
              <div className={`text-[12px] mt-1 ${language === option.id ? "text-white/70" : "text-[#666666]"}`}>
                {option.subtitle}
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="settings-data-heading">
        <SectionHeading
          index="03"
          title={isZh ? "数据管理" : "DATA MANAGEMENT"}
          description={
            isZh
              ? "计划与资料保存在当前浏览器。只有在你主动使用 AI 时，所选内容才会发送给已配置的 AI 服务。"
              : "Plans live in this browser. Selected content is sent to the configured AI service only when you explicitly use AI."
          }
        />

        <div className="border border-[#111111] bg-white p-4 space-y-4">
          <div id="settings-data-heading" className="p-3 border border-[#111111] bg-[#FCD33B] flex items-start space-x-2.5">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="text-[12px] leading-relaxed">
              <div className="font-bold mb-0.5">{isZh ? "本地模式 / 无需登录" : "LOCAL MODE / NO SIGN-IN"}</div>
              <p>
                {isZh
                  ? "清除浏览器站点数据或使用无痕模式会丢失计划，建议定期导出 JSON 备份。"
                  : "Clearing site data or using private browsing erases plans. Export a JSON backup regularly."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: isZh ? "备考科目" : "SUBJECTS", value: plans.length, icon: <FolderOpen className="w-3.5 h-3.5" /> },
              { label: isZh ? "任务总数" : "TASKS", value: totalTasks, icon: <ListChecks className="w-3.5 h-3.5" /> },
              { label: isZh ? "资料总数" : "FILES", value: totalMaterials, icon: <FileJson className="w-3.5 h-3.5" /> },
              {
                label: isZh ? "占用空间" : "STORAGE",
                value: storageInfo ? formatBytes(storageInfo.usage) : "—",
                icon: <HardDrive className="w-3.5 h-3.5" />,
              },
            ].map((item) => (
              <div key={item.label} className="p-2.5 bg-[#fafafa] border border-[#111111]">
                <div className="text-[10px] text-[#666666] uppercase font-mono flex items-center space-x-1">
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </div>
                <div className="font-mono text-base font-bold mt-1">{item.value}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#666666] font-mono border-b border-[#e5e5e5] pb-3">
            <span>
              {storageInfo && storageInfo.quota > 0
                ? `${isZh ? "浏览器配额" : "QUOTA"}: ${formatBytes(storageInfo.quota)}`
                : isZh
                  ? "浏览器未提供存储配额信息"
                  : "Storage quota unavailable"}
            </span>
            <span>
              {isPersisted === null
                ? ""
                : isPersisted
                  ? isZh
                    ? "持久化存储：已启用"
                    : "PERSISTENCE: ON"
                  : isZh
                    ? "持久化存储：未启用"
                    : "PERSISTENCE: OFF"}
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <button
              onClick={handleExport}
              className="flex items-start space-x-3 p-3 border border-[#111111] bg-white hover:bg-[#fafafa] transition-colors cursor-pointer text-left"
            >
              <Download className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                <span className="block text-[13px] font-bold">
                  {isZh ? "导出备份 (.JSON)" : "EXPORT BACKUP (.JSON)"}
                </span>
                <span className="block text-[12px] text-[#666666] mt-0.5 leading-relaxed">
                  {isZh ? "包含全部计划、资料、设置与每日随记" : "Plans, materials, settings and daily memos"}
                </span>
              </span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-start space-x-3 p-3 border border-[#111111] bg-white hover:bg-[#fafafa] transition-colors cursor-pointer text-left"
            >
              <Upload className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                <span className="block text-[13px] font-bold">
                  {isZh ? "导入备份 (.JSON)" : "IMPORT BACKUP (.JSON)"}
                </span>
                <span className="block text-[12px] text-[#666666] mt-0.5 leading-relaxed">
                  {isZh ? "按计划 ID 合并，不会覆盖其他课程" : "Merge by plan ID without duplicating courses"}
                </span>
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportFile}
              className="hidden"
            />
          </div>

          {importError && (
            <div className="p-3 border border-[#d44c47] bg-[#fdf2f2] text-[#a12d27] text-[13px] leading-relaxed flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{importError}</span>
            </div>
          )}

          {!isPersisted && (
            <button
              onClick={handleRequestPersistence}
              className="w-full flex items-center justify-center space-x-2 px-3 min-h-10 border border-[#111111] bg-white hover:bg-[#fafafa] text-[12px] font-bold transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{isZh ? "申请持久化存储，防止浏览器自动清理" : "REQUEST PERSISTENT STORAGE"}</span>
            </button>
          )}

          <div className="pt-4 border-t border-[#111111] space-y-2">
            <div className="font-mono text-[11px] uppercase font-bold text-[#d44c47]">
              [{isZh ? "危险操作" : "DANGER ZONE"}]
            </div>
            <button
              onClick={handleConfirmClear}
              disabled={isClearing}
              className={`w-full flex items-center justify-center space-x-2 px-3 min-h-10 text-[13px] font-bold border transition-colors cursor-pointer disabled:opacity-50 ${
                confirmClear
                  ? "bg-[#d44c47] text-white border-[#d44c47]"
                  : "bg-white text-[#d44c47] border-[#d44c47] hover:bg-[#fdf2f2]"
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>
                {isClearing
                  ? isZh
                    ? "正在清除..."
                    : "CLEARING..."
                  : confirmClear
                    ? isZh
                      ? "再次点击确认：清除全部本地数据"
                      : "CLICK AGAIN TO CONFIRM DELETION"
                    : isZh
                      ? "清除全部本地备考数据"
                      : "CLEAR ALL LOCAL STUDY DATA"}
              </span>
            </button>
            <p className="text-[12px] text-[#666666] leading-relaxed">
              {isZh
                ? "此操作会删除所有科目、任务、资料与每日随记，且无法撤销。请先导出备份。"
                : "This permanently deletes all subjects, tasks, materials and memos. Export a backup first."}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="settings-about-heading">
        <SectionHeading
          index="04"
          title={isZh ? "关于与诊断" : "ABOUT & DIAGNOSTICS"}
          description={APP_VERSION_DATA.releaseName}
        />

        <div className="grid grid-cols-2 gap-2 max-w-2xl">
          {[
            { label: isZh ? "当前版本" : "VERSION", value: APP_VERSION_DATA.version },
            { label: isZh ? "发布日期" : "RELEASE DATE", value: APP_VERSION_DATA.buildDate },
            { label: isZh ? "构建编号" : "BUILD", value: APP_VERSION_DATA.buildNumber },
            { label: isZh ? "运行环境" : "RUNTIME", value: APP_VERSION_DATA.environment },
          ].map((item) => (
            <div key={item.label} className="p-2.5 border border-[#111111] bg-white">
              <div className="font-mono text-[10px] text-[#666666] uppercase">{item.label}</div>
              <div className="font-mono text-[12px] font-bold mt-0.5 break-all">{item.value}</div>
            </div>
          ))}
        </div>

        <div id="settings-about-heading" className="border border-[#111111] bg-white divide-y divide-[#e5e5e5]">
          {[
            {
              icon: <Database className="w-3.5 h-3.5" />,
              label: isZh ? "本地数据存储" : "LOCAL STORAGE",
              value: isZh ? "IndexedDB · 已启用" : "IndexedDB · Active",
              ok: true,
            },
            {
              icon: <Cpu className="w-3.5 h-3.5" />,
              label: isZh ? "AI 规划服务" : "AI PLANNER SERVICE",
              value: isZh ? "服务端 Gemini · 按需调用" : "Server-side Gemini · On demand",
              ok: true,
            },
            {
              icon: <ShieldCheck className="w-3.5 h-3.5" />,
              label: isZh ? "账号与云同步" : "ACCOUNT & CLOUD",
              value: isZh ? "已移除 · 无需登录" : "Removed · No sign-in",
              ok: true,
            },
            {
              icon: navigator.onLine ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />,
              label: isZh ? "网络状态" : "NETWORK",
              value: navigator.onLine
                ? isZh
                  ? "在线 · AI 功能可用"
                  : "Online · AI available"
                : isZh
                  ? "离线 · 仍可查看与编辑本地计划"
                  : "Offline · Local plans remain editable",
              ok: navigator.onLine,
            },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3 p-2.5">
              <span className="flex items-center space-x-2 text-[13px]">
                {item.icon}
                <span>{item.label}</span>
              </span>
              <span className={`text-[11px] font-mono text-right ${item.ok ? "text-[#15803d]" : "text-[#d44c47]"}`}>
                {item.value}
              </span>
            </div>
          ))}
        </div>

        <div className="border border-[#111111] bg-white p-4">
          <div className="font-mono text-[11px] uppercase font-bold text-[#666666] mb-2">
            {isZh ? "更新日志" : "CHANGELOG"}
          </div>
          <div className="space-y-3">
            {APP_VERSION_DATA.changelog.map((entry) => (
              <div key={entry.version}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[13px] font-bold">{entry.title}</span>
                  <span className="font-mono text-[11px] text-[#666666]">
                    {entry.version} · {entry.date}
                  </span>
                </div>
                <ul className="mt-1.5 space-y-1">
                  {entry.highlights.map((highlight) => (
                    <li key={highlight} className="text-[12px] text-[#666666] leading-relaxed flex items-start space-x-1.5">
                      <span className="shrink-0">-</span>
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3.5 border border-[#111111] bg-[#FAF9F6] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-start space-x-2 text-[13px] text-[#555555] leading-relaxed">
            <Languages className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              {isZh
                ? "这里只负责规划与执行安排；题库练习、模拟考试请前往 StarQuiz。"
                : "This app handles planning and execution. Practice and mock exams live in StarQuiz."}
            </span>
          </div>
          <a
            href={STARQUIZ_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-3 min-h-9 shrink-0 border border-[#111111] bg-[#111111] text-white text-[12px] font-bold hover:bg-[#333333]"
          >
            {isZh ? "去 StarQuiz 刷题" : "OPEN STARQUIZ"}
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </section>
    </div>
  );
}
