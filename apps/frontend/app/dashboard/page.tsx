"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Layout from "@/components/Layout";
import { announcementService, Announcement } from "@/services/announcement.service";
import { Deadline, deadlineService } from "@/services/deadline.service";
import NotificationBell from "@/components/NotificationBell";
import SettingsButton from "@/components/SettingsButton";
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Settings,
  FileText,
} from "lucide-react";

const DASHBOARD_ITEM_LIMIT = 3;

const formatDeadlineType = (type?: string | null) => {
  if (!type) return "Deadline";

  return type
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const getCourseCode = (deadline: Deadline) => {
  return deadline.course?.code || "IE 492";
};

const getAnnouncementCourseCode = (announcement: Announcement) => {
  return announcement.course?.code || "IE 492";
};

const getAnnouncementPreview = (content?: string) => {
  if (!content) return "No details available.";
  return content.length > 120 ? `${content.slice(0, 120)}...` : content;
};

const formatTime = (value?: string | null) => {
  if (!value) return "No time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No time";

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
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const getDeadlineStyle = (type?: string | null) => {
  switch (type) {
    case "PROJECT":
      return {
        card: "bg-purple-100 text-purple-700",
        icon: "text-purple-700",
      };
    case "ASSIGNMENT":
      return {
        card: "bg-orange-100 text-orange-700",
        icon: "text-orange-700",
      };
    case "EXAM":
      return {
        card: "bg-red-100 text-red-700",
        icon: "text-red-700",
      };
    case "QUIZ":
      return {
        card: "bg-blue-100 text-blue-700",
        icon: "text-blue-700",
      };
    default:
      return {
        card: "bg-slate-100 text-slate-700",
        icon: "text-slate-700",
      };
  }
};

const normalizeAnnouncementType = (type?: string | null) => {
  const normalized = (type || "INFO").toUpperCase();

  if (normalized.includes("URGENT")) return "URGENT";
  if (normalized.includes("EVENT")) return "EVENT";
  return "INFO";
};

const getAnnouncementStyle = (type?: string | null) => {
  const normalized = normalizeAnnouncementType(type);

  if (normalized === "URGENT") {
    return {
      wrapper: "bg-red-50",
      stripe: "bg-red-500",
      badge: "border-red-500 text-red-600 bg-white",
    };
  }

  if (normalized === "EVENT") {
    return {
      wrapper: "bg-yellow-50",
      stripe: "bg-amber-500",
      badge: "border-amber-500 text-amber-600 bg-white",
    };
  }

  return {
    wrapper: "bg-blue-50",
    stripe: "bg-blue-500",
    badge: "border-blue-500 text-blue-600 bg-white",
  };
};

const buildWeekDays = (deadlines: Deadline[]) => {
  const validDates = deadlines
    .map((deadline) => (deadline.dueDate ? new Date(deadline.dueDate) : null))
    .filter((date): date is Date => date !== null && !Number.isNaN(date.getTime()));

  const start = validDates.length > 0 ? new Date(validDates[0]) : new Date();
  start.setHours(0, 0, 0, 0);

  const dayIndex = start.getDay();
  start.setDate(start.getDate() - dayIndex);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
};

const isSameDate = (first: Date, second: Date) => {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
};

export default function DashboardPage() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingDeadlines, setLoadingDeadlines] = useState(true);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);

  useEffect(() => {
    const fetchDeadlines = async () => {
      try {
        const data = await deadlineService.getAllDeadlines();
        setDeadlines(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Dashboard deadlines fetch error:", error);
      } finally {
        setLoadingDeadlines(false);
      }
    };

    const fetchAnnouncements = async () => {
      try {
        const data = await announcementService.getAllAnnouncements();
        setAnnouncements(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Dashboard announcements fetch error:", error);
      } finally {
        setLoadingAnnouncements(false);
      }
    };

    fetchDeadlines();
    fetchAnnouncements();
  }, []);

  const actionableDeadlines = useMemo(() => {
    return [...deadlines]
      .filter((deadline) => deadline.type === "ASSIGNMENT" || deadline.type === "PROJECT")
      .sort((a, b) => {
        const first = a.dueDate ? new Date(a.dueDate).getTime() : 0;
        const second = b.dueDate ? new Date(b.dueDate).getTime() : 0;
        return first - second;
      });
  }, [deadlines]);

  const weekDays = useMemo(() => buildWeekDays(actionableDeadlines), [actionableDeadlines]);

  return (
    <Layout>
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white px-6 py-5 md:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 md:text-[28px]">
                Welcome Back, Student!
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Here is your academic dashboard
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2">
                <span className="text-sm font-medium text-blue-500">
                  Academic Week: 8
                </span>
              </div>

              <NotificationBell />

              <SettingsButton href="/settings" />
            </div>
          </div>
        </header>

        <main className="space-y-8 px-6 py-8 md:px-8">
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-blue-200 text-xs text-white">
                    📅
                  </div>
                  <h2 className="text-[24px] font-semibold text-slate-900">
                    This Week&apos;s Deadlines
                  </h2>
                </div>
                <p className="mt-5 text-xs text-slate-500">
                  Only showing actionable items assignments, projects
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/deadlines"
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-600 transition hover:bg-slate-100"
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  Month
                </Link>

                <button className="rounded-lg p-2 transition hover:bg-slate-100" type="button">
                  <ChevronLeft className="h-5 w-5 text-slate-600" />
                </button>
                <button className="rounded-lg p-2 transition hover:bg-slate-100" type="button">
                  <ChevronRight className="h-5 w-5 text-slate-600" />
                </button>
              </div>
            </div>

            {loadingDeadlines ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                Loading deadlines...
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
                {weekDays.map((date) => {
                  const dayDeadlines = actionableDeadlines.filter((deadline) => {
                    if (!deadline.dueDate) return false;
                    const dueDate = new Date(deadline.dueDate);
                    return isSameDate(dueDate, date);
                  });

                  const isToday =
                    new Date().toDateString() === date.toDateString();

                  return (
                    <div
                      key={date.toISOString()}
                      className={`min-h-[178px] rounded-xl border p-4 text-center transition ${
                        isToday
                          ? "border-blue-400 shadow-sm"
                          : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <p className="text-xs font-semibold text-slate-500">
                        {date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}
                      </p>
                      <p className="mt-1 text-2xl font-semibold text-slate-900">
                        {date.getDate()}
                      </p>

                      <div className="mt-6 space-y-2">
                        {dayDeadlines.length === 0 ? (
                          <p className="pt-4 text-sm text-slate-400">
                            No deadlines
                          </p>
                        ) : (
                          dayDeadlines.slice(0, 2).map((deadline) => {
                            const style = getDeadlineStyle(deadline.type);

                            return (
                              <Link
                                href={`/courses/${deadline.courseId}`}
                                key={deadline.id}
                                className={`block rounded-md px-3 py-2 text-left text-xs ${style.card}`}
                              >
                                <div className="flex items-center gap-1 font-semibold">
                                  <FileText className={`h-3 w-3 ${style.icon}`} />
                                  <span>{getCourseCode(deadline)}</span>
                                </div>
                                <p className="mt-1 truncate font-medium">
                                  {deadline.title}
                                </p>
                                <p className="mt-1 text-center">
                                  Due {formatTime(deadline.dueDate)}
                                </p>
                              </Link>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded bg-blue-200 text-xs text-white">
                  🔔
                </div>
                <h2 className="text-[24px] font-semibold text-slate-900">
                  Announcements
                </h2>
              </div>
              <p className="mt-5 text-[13px] text-slate-500">
                Recent updates from your courses
              </p>
            </div>

            {loadingAnnouncements ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                Loading announcements...
              </div>
            ) : announcements.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
                No announcements found.
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {announcements
                    .slice(0, DASHBOARD_ITEM_LIMIT)
                    .map((announcement) => {
                      const style = getAnnouncementStyle(announcement.type);
                      const type = normalizeAnnouncementType(announcement.type);

                      return (
                        <Link
                          href="/announcements"
                          key={announcement.id}
                          className={`relative block overflow-hidden rounded-lg transition hover:shadow-sm ${style.wrapper}`}
                        >
                          <div className={`absolute bottom-0 left-0 top-0 w-1.5 ${style.stripe}`} />

                          <div className="py-3 pl-5 pr-4">
                            <div className="mb-2 flex items-center gap-2">
                              <span
                                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${style.badge}`}
                              >
                                {type}
                              </span>
                              <span className="text-[13px] font-medium text-slate-600">
                                {getAnnouncementCourseCode(announcement)}
                              </span>
                            </div>

                            <h3 className="mb-2 text-[15px] font-bold text-slate-900">
                              {announcement.title || "Untitled Announcement"}
                            </h3>

                            <p className="mb-2 text-sm text-slate-600">
                              {getAnnouncementPreview(announcement.content)}
                            </p>

                            <p className="text-[13px] text-slate-500">
                              {formatAnnouncementDate(announcement.createdAt)}
                            </p>
                          </div>
                        </Link>
                      );
                    })}
                </div>

                <div className="mt-4 flex justify-center">
                  <Link
                    href="/announcements"
                    className="rounded-lg px-4 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-50 hover:text-blue-700"
                  >
                    View More
                  </Link>
                </div>
              </>
            )}
          </section>
        </main>
      </div>
    </Layout>
  );
}
