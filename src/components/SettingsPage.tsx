import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  ChevronDown,
  Download,
  ShieldCheck,
  Trash2,
  Upload,
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

function Switch({
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
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 cursor-pointer ${
        checked ? "bg-[#1c1b1a]" : "bg-[#ddd9d2]"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? "translate-x-[22px]" : "translate-x-[2px]"
        }`}
      />
    </button>
  );
}

function Segmented({
  options,
  value,
  onSelect,
  ariaLabel,
}: {
  options: { value: string; label: string }[];
  value: string;
  onSelect: (value: string) => void;
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex items-center rounded-lg bg-[#f1efe9] p-1">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSelect(opt.value)}
            className={`rounded-md px-3 py-1.5 text-[13px] transition-all duration-150 cursor-pointer ${
              active ? "bg-white font-medium text-[#1c1b1a] shadow-sm" : "text-[#8a8580] hover:text-[#1c1b1a]"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-[#eae7e1] bg-white shadow-[0_1px_2px_rgba(28,27,26,0.04)] ${className}`}>
      {children}
    </div>
  );
}

function SectionHeader({ id, title }: { id: string; title: string }) {
  return (
    <div className="mb-3">
      <h2 id={id} className="text-[15px] font-semibold tracking-tight text-[#1c1b1a]">
        {title}
      </h2>
    </div>
  );
}

function Row({
  title,
  children,
  stack,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  stack?: boolean;
}) {
  return (
    <div
      className={`flex gap-4 px-5 py-4 ${
        stack ? "flex-col items-start sm:flex-row sm:items-center sm:justify-between" : "items-center justify-between"
      }`}
    >
      <div className="min-w-0">
        <div className="text-[14px] font-medium text-[#1c1b1a]">{title}</div>
      </div>
      <div className="shrink-0">{children}</div>
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
  const [showRelease, setShowRelease] = useState(false);
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

  const navItems = [
    { id: "pref", label: isZh ? "学习偏好" : "Preferences" },
    { id: "lang", label: isZh ? "界面语言" : "Language" },
    { id: "data", label: isZh ? "数据管理" : "Data" },
  ];

  const stats = [
    { label: isZh ? "备考科目" : "Subjects", value: String(plans.length) },
    { label: isZh ? "任务" : "Tasks", value: String(totalTasks) },
    { label: isZh ? "资料" : "Files", value: String(totalMaterials) },
    { label: isZh ? "占用空间" : "Storage", value: storageInfo ? formatBytes(storageInfo.usage) : "—" },
  ];

  const ghostButton =
    "inline-flex items-center gap-2 rounded-lg border border-[#e5e2dc] bg-white px-4 py-2 text-[13px] font-medium text-[#1c1b1a] transition-colors hover:bg-[#faf9f6] cursor-pointer";

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 animate-fadeIn pb-12 text-[#1c1b1a]">
      <header className="sticky top-[56px] z-20 -mx-4 mb-8 border-b border-[#e7e4de] bg-[#f8f7f4]/85 px-4 py-3.5 backdrop-blur sm:-mx-6 sm:px-6 md:top-0 lg:-mx-8 lg:px-8">
        <h1 className="text-[15px] font-semibold tracking-tight text-[#1c1b1a]">{isZh ? "设置" : "Settings"}</h1>
      </header>

      <div className="lg:grid lg:grid-cols-[150px_minmax(0,1fr)] lg:gap-10">
        <nav className="hidden lg:block" aria-label={isZh ? "设置导航" : "Settings navigation"}>
          <div className="sticky top-[76px] space-y-0.5">
            {navItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="block rounded-md px-3 py-1.5 text-[12px] text-[#a39e97] transition-colors hover:bg-black/[0.03] hover:text-[#1c1b1a]"
              >
                {item.label}
              </a>
            ))}
          </div>
        </nav>

        <div className="min-w-0 space-y-10">
          {/* Preferences */}
          <section id="pref" className="scroll-mt-[136px] md:scroll-mt-24" aria-labelledby="settings-preferences-heading">
            <SectionHeader id="settings-preferences-heading" title={isZh ? "学习偏好" : "Study preferences"} />
            <Card>
              <div className="divide-y divide-[#f0ede8]">
                <Row stack title={isZh ? "专注计时初始时长" : "Focus timer duration"}>
                  <Segmented
                    ariaLabel={isZh ? "专注计时初始时长" : "Focus timer duration"}
                    value={String(settings.defaultFocusDuration)}
                    onSelect={(v) => updateSetting("defaultFocusDuration", Number(v))}
                    options={[25, 45, 60, 90].map((m) => ({ value: String(m), label: `${m} min` }))}
                  />
                </Row>
                <Row title={isZh ? "提示音" : "Sound alerts"}>
                  <Switch
                    checked={settings.enableSoundAlerts}
                    onChange={(next) => updateSetting("enableSoundAlerts", next)}
                    ariaLabel={isZh ? "提示音" : "Sound alerts"}
                  />
                </Row>
                <Row stack title={isZh ? "默认复习节奏" : "Default study pace"}>
                  <div className="relative">
                    <select
                      value={settings.defaultStudyPace}
                      onChange={(e) =>
                        updateSetting("defaultStudyPace", e.target.value as AppSettings["defaultStudyPace"])
                      }
                      aria-label={isZh ? "默认复习节奏" : "Default study pace"}
                      className="min-w-[180px] cursor-pointer appearance-none rounded-lg border border-[#e5e2dc] bg-white py-2 pl-3 pr-9 text-[13px] text-[#1c1b1a] focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[#1c1b1a]"
                    >
                      <option value="spaced_repetition">{isZh ? "间隔复习" : "Spaced Repetition"}</option>
                      <option value="balanced">{isZh ? "稳健平衡" : "Balanced"}</option>
                      <option value="deep_mastery">{isZh ? "深度精通" : "Deep Mastery"}</option>
                      <option value="intensive_crash">{isZh ? "考前冲刺" : "Intensive Sprint"}</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8580]" />
                  </div>
                </Row>
              </div>
            </Card>
          </section>

          {/* Language */}
          <section id="lang" className="scroll-mt-[136px] md:scroll-mt-24" aria-labelledby="settings-language-heading">
            <SectionHeader id="settings-language-heading" title={isZh ? "界面语言" : "Language"} />
            <Card>
              <Row stack title={isZh ? "显示语言" : "Display language"}>
                <Segmented
                  ariaLabel={isZh ? "显示语言" : "Display language"}
                  value={language}
                  onSelect={(v) => setLanguage(v as "zh" | "en")}
                  options={[
                    { value: "zh", label: "简体中文" },
                    { value: "en", label: "English" },
                  ]}
                />
              </Row>
            </Card>
          </section>

          {/* Data */}
          <section id="data" className="scroll-mt-[136px] md:scroll-mt-24" aria-labelledby="settings-data-heading">
            <SectionHeader id="settings-data-heading" title={isZh ? "数据管理" : "Data"} />
            <div className="space-y-4">
              <Card className="overflow-hidden">
                <div className="grid grid-cols-2 gap-px bg-[#f0ede8] sm:grid-cols-4">
                  {stats.map((item) => (
                    <div key={item.label} className="bg-white px-5 py-4">
                      <div className="text-[12px] text-[#8a8580]">{item.label}</div>
                      <div className="mt-1 text-xl font-semibold tabular-nums text-[#1c1b1a]">{item.value}</div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#f0ede8] px-5 py-3 text-[12px] text-[#8a8580]">
                  <span>
                    {storageInfo && storageInfo.quota > 0
                      ? `${isZh ? "浏览器配额" : "Quota"}: ${formatBytes(storageInfo.quota)}`
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
                          : "Persistence: on"
                        : isZh
                          ? "持久化存储：未启用"
                          : "Persistence: off"}
                  </span>
                </div>
              </Card>

              <Card>
                <div className="divide-y divide-[#f0ede8]">
                  <Row stack title={isZh ? "备份与恢复" : "Backup & restore"}>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={handleExport} className={ghostButton}>
                        <Download className="h-4 w-4" />
                        {isZh ? "导出" : "Export"}
                      </button>
                      <button onClick={() => fileInputRef.current?.click()} className={ghostButton}>
                        <Upload className="h-4 w-4" />
                        {isZh ? "导入" : "Import"}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json,application/json"
                        onChange={handleImportFile}
                        className="hidden"
                      />
                    </div>
                  </Row>

                  {importError && (
                    <div className="px-5 py-3">
                      <div className="flex items-start gap-2 rounded-lg bg-[#FDF0EE] px-3 py-2.5 text-[13px] leading-relaxed text-[#B42318]">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{importError}</span>
                      </div>
                    </div>
                  )}

                  {!isPersisted && (
                    <Row stack title={isZh ? "持久化存储" : "Persistent storage"}>
                      <button onClick={handleRequestPersistence} className={ghostButton}>
                        <ShieldCheck className="h-4 w-4" />
                        {isZh ? "申请权限" : "Request"}
                      </button>
                    </Row>
                  )}
                </div>
              </Card>

              <Card className="border-[#f0d8d4]">
                <Row
                  stack
                  title={<span className="text-[#B42318]">{isZh ? "清除全部本地数据" : "Clear all local data"}</span>}
                >
                  <button
                    onClick={handleConfirmClear}
                    disabled={isClearing}
                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium transition-colors cursor-pointer disabled:opacity-50 ${
                      confirmClear
                        ? "bg-[#B42318] text-white"
                        : "border border-[#f0d0cc] bg-white text-[#B42318] hover:bg-[#FDF0EE]"
                    }`}
                  >
                    <Trash2 className="h-4 w-4" />
                    {isClearing
                      ? isZh
                        ? "正在清除…"
                        : "Clearing…"
                      : confirmClear
                        ? isZh
                          ? "再次点击确认清除"
                          : "Click again to confirm"
                        : isZh
                          ? "清除数据"
                          : "Clear data"}
                  </button>
                </Row>
              </Card>
            </div>
          </section>

          {/* Release info — deliberately quiet footer area */}
          <footer className="border-t border-[#f0ede8] pt-5">
            <a
              href={STARQUIZ_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[12px] font-medium text-[#8a8580] underline underline-offset-2 transition-colors hover:text-[#1c1b1a]"
            >
              {isZh ? "前往 StarQuiz 练习" : "Go to StarQuiz for practice"}
              <ArrowUpRight className="h-3 w-3" />
            </a>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setShowRelease((prev) => !prev)}
                aria-expanded={showRelease}
                aria-controls="settings-release-details"
                className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12px] text-[#a39e97] transition-colors hover:bg-black/[0.03] hover:text-[#6b6660] cursor-pointer"
              >
                {isZh ? "版本与更新信息" : "Version & release notes"}
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${showRelease ? "rotate-180" : ""}`}
                />
              </button>
              <span className="flex items-center gap-1.5 text-[12px] tabular-nums text-[#a39e97]">
                <span className={`h-1.5 w-1.5 rounded-full ${navigator.onLine ? "bg-[#3F6B4F]" : "bg-[#B42318]"}`} />
                {APP_VERSION_DATA.version}
              </span>
            </div>

            {showRelease && (
              <div id="settings-release-details" className="mt-3 space-y-4 animate-fadeIn">
                <p className="text-[12px] leading-relaxed text-[#a39e97]">
                  {APP_VERSION_DATA.releaseName} · {APP_VERSION_DATA.buildDate} · {APP_VERSION_DATA.buildNumber} ·{" "}
                  {APP_VERSION_DATA.environment}
                </p>
                <div className="space-y-3">
                  {APP_VERSION_DATA.changelog.map((entry) => (
                    <div key={entry.version}>
                      <div className="text-[12px] font-medium text-[#8a8580]">
                        {entry.title}
                        <span className="ml-1.5 tabular-nums text-[#a39e97]">
                          {entry.version} · {entry.date}
                        </span>
                      </div>
                      <ul className="mt-1 space-y-0.5">
                        {entry.highlights.map((highlight) => (
                          <li key={highlight} className="flex gap-2 text-[12px] leading-relaxed text-[#a39e97]">
                            <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-[#e0dcd4]" />
                            <span>{highlight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </footer>
        </div>
      </div>

      {notification && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-[#1c1b1a] px-4 py-2.5 text-[13px] font-medium text-white shadow-lg animate-fadeIn"
        >
          <Check className="h-4 w-4 shrink-0" />
          <span>{notification}</span>
        </div>
      )}
    </div>
  );
}