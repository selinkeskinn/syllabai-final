"use client";

import InstructorLayout from "@/components/InstructorLayout";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Settings,
} from "lucide-react";
import { courseService } from "@/services/course.service";
import { deadlineService } from "@/services/deadline.service";
import { announcementService } from "@/services/announcement.service";

const addDays = (date: Date, amount: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
};

const getStartOfWeek = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const formatTime = (value?: string | null) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatAnnouncementDate = (value?: string | null) => {
  if (!value) return "Date not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not available";

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const formatAnnouncementTime = (value?: string | null) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatDeadlineType = (type?: string | null) => {
  if (!type) return "Deadline";

  return type
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const getAnnouncementPreview = (content?: string | null) => {
  if (!content) return "No details available.";

  return content.length > 150 ? `${content.slice(0, 150)}...` : content;
};

const getDeadlineCardStyles = (type?: string | null) => {
  const normalized = type?.toUpperCase();

  if (normalized === "QUIZ") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (normalized === "EXAM") {
    return "bg-red-100 text-red-700";
  }

  if (normalized === "ASSIGNMENT") {
    return "bg-orange-100 text-orange-700";
  }

  return "bg-purple-100 text-purple-700";
};

const getAnnouncementStyles = (type?: string | null) => {
  const normalized = type?.toUpperCase();

  if (normalized === "URGENT") {
    return {
      card: "bg-red-50 border-red-100",
      stripe: "bg-red-500",
      badge: "border-red-500 text-red-500",
    };
  }

  if (normalized === "EVENT") {
    return {
      card: "bg-yellow-50 border-yellow-100",
      stripe: "bg-orange-500",
      badge: "border-orange-500 text-orange-500",
    };
  }

  return {
    card: "bg-blue-50 border-blue-100",
    stripe: "bg-blue-500",
    badge: "border-blue-500 text-blue-500",
  };
};

export default function InstructorDashboardPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [deadlines, setDeadlines] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [weekStart, setWeekStart] = useState(() => getStartOfWeek(new Date()));
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingDeadlines, setLoadingDeadlines] = useState(true);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const data = await courseService.getAllCourses();
        setCourses(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Instructor dashboard courses fetch error:", error);
        setCourses([]);
      } finally {
        setLoadingCourses(false);
      }
    };

    const fetchDeadlines = async () => {
      try {
        const data = await deadlineService.getAllDeadlines();
        const safeData = Array.isArray(data) ? data : [];
        setDeadlines(safeData);

        const upcoming = safeData
          .map((deadline) => (deadline.dueDate ? new Date(deadline.dueDate) : null))
          .filter((date): date is Date => date !== null)
          .filter((date) => !Number.isNaN(date.getTime()))
          .sort((a, b) => a.getTime() - b.getTime())[0];

        if (upcoming) {
          setWeekStart(getStartOfWeek(upcoming));
        }
      } catch (error) {
        console.error("Instructor dashboard deadlines fetch error:", error);
        setDeadlines([]);
      } finally {
        setLoadingDeadlines(false);
      }
    };

    const fetchAnnouncements = async () => {
      try {
        const data = await announcementService.getAllAnnouncements();
        setAnnouncements(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Instructor dashboard announcements fetch error:", error);
        setAnnouncements([]);
      } finally {
        setLoadingAnnouncements(false);
      }
    };

    fetchCourses();
    fetchDeadlines();
    fetchAnnouncements();
  }, []);

  const courseIds = useMemo(
    () => new Set(courses.map((course) => course.id)),
    [courses]
  );

  const instructorDeadlines = deadlines.filter(
    (deadline) => !deadline.courseId || courseIds.has(deadline.courseId)
  );

  const instructorAnnouncements = announcements
    .filter(
      (announcement) =>
        !announcement.courseId || courseIds.has(announcement.courseId)
    )
    .slice(0, 3);

  const weekDays = Array.from({ length: 7 }, (_, index) =>
    addDays(weekStart, index)
  );

  const getDeadlinesForDate = (date: Date) =>
    instructorDeadlines.filter((deadline) => {
      if (!deadline.dueDate) return false;

      const deadlineDate = new Date(deadline.dueDate);
      if (Number.isNaN(deadlineDate.getTime())) return false;

      return isSameDay(deadlineDate, date);
    });

  return (
    <InstructorLayout>
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="mb-1 text-2xl font-semibold text-slate-900">
                Welcome Back, Instructor!
              </h1>
              <p className="text-sm text-slate-500">Here is your overview</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="mr-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2">
                <span className="text-sm font-medium text-[rgb(109,156,245)]">
                  Academic Week: 8
                </span>
              </div>

              <button
                type="button"
                className="relative rounded-lg p-2.5 transition-colors hover:bg-slate-100"
              >
                <Bell className="h-5 w-5 text-slate-600" />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
              </button>

              <button
                type="button"
                className="rounded-lg p-2.5 transition-colors hover:bg-slate-100"
              >
                <Settings className="h-5 w-5 text-slate-600" />
              </button>
            </div>
          </div>
        </header>

        <main className="px-8 py-8">
          <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="flex items-center gap-2 font-semibold text-slate-900 text-[24px]">
                  <span>🗓️</span>
                  This Week&apos;s Deadlines
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-100"
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span>Month</span>
                </button>

                <div className="ml-1 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setWeekStart((current) => addDays(current, -7))}
                    className="rounded-lg p-2 transition-colors hover:bg-slate-100"
                    aria-label="Previous week"
                  >
                    <ChevronLeft className="h-5 w-5 text-slate-600" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setWeekStart((current) => addDays(current, 7))}
                    className="rounded-lg p-2 transition-colors hover:bg-slate-100"
                    aria-label="Next week"
                  >
                    <ChevronRight className="h-5 w-5 text-slate-600" />
                  </button>
                </div>
              </div>
            </div>

            <p className="mb-5 text-xs text-slate-500">
              Only showing actionable items (assignments, projects)
            </p>

            {loadingCourses || loadingDeadlines ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                Loading deadlines...
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-3">
                {weekDays.map((date) => {
                  const dayDeadlines = getDeadlinesForDate(date);
                  const isFirstDay = isSameDay(date, weekStart);
                  const dayName = date
                    .toLocaleDateString("en-US", { weekday: "short" })
                    .toUpperCase();

                  return (
                    <div
                      key={date.toISOString()}
                      className={`min-h-[178px] rounded-xl border-2 bg-slate-50 p-4 text-center ${
                        isFirstDay
                          ? "border-blue-500"
                          : "border-slate-200"
                      }`}
                    >
                      <div className="mb-4">
                        <div className="text-xs font-semibold text-slate-500">
                          {dayName}
                        </div>
                        <div className="text-2xl font-semibold text-slate-900">
                          {date.getDate()}
                        </div>
                      </div>

                      {dayDeadlines.length === 0 ? (
                        <div className="flex h-[82px] items-center justify-center text-sm text-slate-400">
                          No deadlines
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {dayDeadlines.slice(0, 2).map((deadline) => (
                            <div
                              key={deadline.id}
                              className={`rounded-lg p-2 text-left text-xs ${getDeadlineCardStyles(
                                deadline.type
                              )}`}
                            >
                              <div className="font-semibold">
                                {deadline.course?.code || "Course"}
                              </div>
                              <div className="truncate font-medium">
                                {deadline.title}
                              </div>
                              <div className="mt-1 text-right">
                                Due {formatTime(deadline.dueDate)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="mb-6">
              <h2 className="flex items-center gap-2 font-semibold text-slate-900 text-[24px]">
                <span>🔔</span>
                Your Announcements
              </h2>
              <p className="mt-4 text-sm text-slate-500">
                Recent updates from your courses
              </p>
            </div>

            {loadingCourses || loadingAnnouncements ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                Loading announcements...
              </div>
            ) : instructorAnnouncements.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                No announcements yet.
              </div>
            ) : (
              <div className="space-y-4">
                {instructorAnnouncements.map((announcement, index) => {
                  const styles = getAnnouncementStyles(announcement.type);

                  return (
                    <article
                      key={
                        announcement.id ??
                        `${announcement.courseId ?? "announcement"}-${index}`
                      }
                      className={`relative overflow-hidden rounded-xl border p-5 ${styles.card}`}
                    >
                      <div
                        className={`absolute bottom-0 left-0 top-0 w-1.5 ${styles.stripe}`}
                      />

                      <div className="pl-4">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border bg-white px-3 py-1 text-xs font-medium ${styles.badge}`}
                          >
                            {announcement.type || "INFO"}
                          </span>

                          <span className="text-sm font-medium text-slate-500">
                            {announcement.course?.code || "Course"}
                          </span>
                        </div>

                        <h3 className="font-semibold text-slate-900">
                          {announcement.title || "Untitled Announcement"}
                        </h3>

                        <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                          <CalendarDays className="h-4 w-4" />
                          <span>
                            {formatAnnouncementDate(announcement.createdAt)}
                            {formatAnnouncementTime(announcement.createdAt)
                              ? ` - ${formatAnnouncementTime(
                                  announcement.createdAt
                                )}`
                              : ""}
                          </span>
                        </div>

                        {announcement.content ? (
                          <p className="mt-3 text-sm leading-6 text-slate-600">
                            {getAnnouncementPreview(announcement.content)}
                          </p>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </div>
    </InstructorLayout>
  );
}
