import { ExamStudyPlan, StudyTask } from "../types";

/**
 * Formats a Date object or date/time string to iCalendar UTC format (YYYYMMDDTHHMMSSZ) or local format (YYYYMMDDTHHMMSS)
 */
function formatDateToICS(dateStr: string, timeStr: string = "09:00"): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);
  
  const d = new Date(year, month - 1, day, hours, minutes, 0);
  
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

/**
 * Calculates end time based on start time and duration minutes
 */
function getEndTime(dateStr: string, startTimeStr: string = "09:00", durationMinutes: number = 60): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = startTimeStr.split(":").map(Number);
  
  const d = new Date(year, month - 1, day, hours, minutes + durationMinutes, 0);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

/**
 * Generates standard RFC 5545 iCalendar (.ics) string for Google Calendar, Apple Calendar, Outlook, etc.
 */
export function generateICSContent(plan: ExamStudyPlan, selectedTasks?: StudyTask[]): string {
  const tasksToExport = selectedTasks || plan.tasks;
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const dtStamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const events = tasksToExport.map((task) => {
    const startTime = task.startTime || "09:00";
    const dtStart = formatDateToICS(task.date, startTime);
    const dtEnd = getEndTime(task.date, startTime, task.durationMinutes);
    const summary = `[Study] ${task.title}`;
    const description = `Exam: ${plan.examName} (${plan.subject})\\nTopic: ${task.topicTitle}\\nCategory: ${task.category.toUpperCase()}\\nPriority: ${task.priority.toUpperCase()}\\nDuration: ${task.durationMinutes} mins\\n\\nObjectives:\\n${(task.keyObjectives || []).map(obj => `- ${obj}`).join('\\n')}\\n\\nDetails:\\n${task.description.replace(/\n/g, '\\n')}`;

    return `BEGIN:VEVENT
UID:study-task-${task.id}@examplan.ai
DTSTAMP:${dtStamp}
DTSTART:${dtStart}
DTEND:${dtEnd}
SUMMARY:${summary}
DESCRIPTION:${description}
STATUS:${task.status === 'completed' ? 'CONFIRMED' : 'TENTATIVE'}
CATEGORIES:Study,Exam Prep,${plan.subject}
BEGIN:VALARM
TRIGGER:-PT15M
ACTION:DISPLAY
DESCRIPTION:Reminder: ${task.title} starting in 15 mins
END:VALARM
END:VEVENT`;
  });

  // Also add the main Exam Day Event
  const examStartTime = plan.examTime || "09:00";
  const examDtStart = formatDateToICS(plan.examDate, examStartTime);
  const examDtEnd = getEndTime(plan.examDate, examStartTime, 180);
  const examEvent = `BEGIN:VEVENT
UID:exam-day-${plan.id}@examplan.ai
DTSTAMP:${dtStamp}
DTSTART:${examDtStart}
DTEND:${examDtEnd}
SUMMARY:🎯 EXAM DAY: ${plan.examName}
DESCRIPTION:Target Exam Day for ${plan.examName} (${plan.subject}). Good luck!
STATUS:CONFIRMED
PRIORITY:1
CATEGORIES:Exam,Milestone
BEGIN:VALARM
TRIGGER:-P1D
ACTION:DISPLAY
DESCRIPTION:Tomorrow is your ${plan.examName}!
END:VALARM
BEGIN:VALARM
TRIGGER:-PT2H
ACTION:DISPLAY
DESCRIPTION:${plan.examName} starts in 2 hours!
END:VALARM
END:VEVENT`;

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Exam Plan AI//Intelligent Study Planner//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:${plan.examName} Study Schedule
X-WR-TIMEZONE:UTC
X-WR-CALDESC:AI-Generated Exam Study Plan for ${plan.examName}
${examEvent}
${events.join("\n")}
END:VCALENDAR`;
}

/**
 * Triggers instant browser download of the .ics file
 */
export function downloadICSFile(plan: ExamStudyPlan, selectedTasks?: StudyTask[]) {
  const icsData = generateICSContent(plan, selectedTasks);
  const blob = new Blob([icsData], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `${plan.examName.toLowerCase().replace(/[^a-z0-9]/g, "_")}_study_plan.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates direct Google Calendar Web intent URL for an individual study task
 */
export function generateGoogleCalendarUrl(task: StudyTask, plan: ExamStudyPlan): string {
  const startTime = task.startTime || "09:00";
  const dtStart = formatDateToICS(task.date, startTime);
  const dtEnd = getEndTime(task.date, startTime, task.durationMinutes);
  
  const text = encodeURIComponent(`[Study] ${task.title}`);
  const details = encodeURIComponent(
    `Exam: ${plan.examName} (${plan.subject})\nTopic: ${task.topicTitle}\nDuration: ${task.durationMinutes} mins\n\nObjectives:\n${(task.keyObjectives || []).map(o => `• ${o}`).join('\n')}\n\nDescription:\n${task.description}`
  );
  
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dtStart}/${dtEnd}&details=${details}`;
}
