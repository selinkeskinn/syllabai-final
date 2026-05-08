"use client";

import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import {
  Announcement,
  announcementService,
} from "@/services/announcement.service";
import { Bell, Calendar, Filter, Settings, X } from "lucide-react";

type FilterType = "All" | "Urgent" | "Events" | "Info";

const normalizeType = (type?: string | null): "URGENT" | "EVENT" | "INFO" => {
  const upperType = type?.toUpperCase();

  if (upperType?.includes("URGENT")) return "URGENT";
  if (upperType?.includes("EVENT")) return "EVENT";
  return "INFO";
};

const formatDate = (value?: string | null) => {
  if (!value) return "Date not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not available";

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatTime = (value?: string | null) => {
  if (!value) return "Time not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time not available";

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
};

const getCourseLabel = (announcement: Announcement) => {
  if (announcement.course?.code) return announcement.course.code;
  if (announcement.course?.title) return announcement.course.title;
  if (announcement.courseId) return "IE 492";
  return "Course";
};

const getCardStyles = (type?: string | null) => {
  const normalizedType = normalizeType(type);

  if (normalizedType === "URGENT") {
    return {
      wrapper: "bg-red-50",
      stripe: "bg-red-500",
      badge: "border-red-500 text-red-600 bg-white",
    };
  }

  if (normalizedType === "EVENT") {
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

const getFilterClass = (filter: FilterType, activeFilter: FilterType) => {
  if (filter === "All") {
    return activeFilter === "All"
      ? "bg-blue-100 text-blue-600 border-blue-300"
      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50";
  }

  if (filter === "Urgent") {
    return activeFilter === "Urgent"
      ? "bg-red-100 text-red-600 border-red-300"
      : "bg-white text-red-600 border-slate-200 hover:bg-red-50";
  }

  if (filter === "Events") {
    return activeFilter === "Events"
      ? "bg-amber-100 text-amber-600 border-amber-300"
      : "bg-white text-amber-600 border-slate-200 hover:bg-amber-50";
  }

  return activeFilter === "Info"
    ? "bg-slate-100 text-slate-600 border-slate-300"
    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50";
};

export default function AnnouncementsPage() {
  const [activeFilter, setActiveFilter] = useState<FilterType>("All");
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        setLoading(true);
        setErrorMessage("");
        const data = await announcementService.getAllAnnouncements();
        setAnnouncements(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Announcements fetch error:", error);
        setErrorMessage("Announcements could not be loaded.");
        setAnnouncements([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAnnouncements();
  }, []);

  const uniqueCourses = useMemo(() => {
    return Array.from(new Set(announcements.map(getCourseLabel))).filter(Boolean);
  }, [announcements]);

  const filteredAnnouncements = useMemo(() => {
    return announcements
      .filter((item) => {
        const type = normalizeType(item.type);

        if (activeFilter === "Urgent" && type !== "URGENT") return false;
        if (activeFilter === "Events" && type !== "EVENT") return false;
        if (activeFilter === "Info" && type !== "INFO") return false;

        if (
          selectedCourses.length > 0 &&
          !selectedCourses.includes(getCourseLabel(item))
        ) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const order = { URGENT: 0, EVENT: 1, INFO: 2 };
        return order[normalizeType(a.type)] - order[normalizeType(b.type)];
      });
  }, [activeFilter, announcements, selectedCourses]);

  const toggleCourse = (courseCode: string) => {
    setSelectedCourses((previous) =>
      previous.includes(courseCode)
        ? previous.filter((code) => code !== courseCode)
        : [...previous, courseCode]
    );
  };

  return (
    <Layout>
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white px-8 py-5">
          <div className="flex items-center justify-between">
            <h1 className="text-[28px] font-semibold text-slate-900">
              Announcements
            </h1>

            <div className="flex items-center gap-3">
              <div className="mr-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2">
                <span className="text-sm font-medium text-blue-500">
                  Academic Week: 8
                </span>
              </div>

              <button
                className="relative rounded-lg p-2.5 transition hover:bg-slate-100"
                type="button"
              >
                <Bell className="h-5 w-5 text-slate-600" />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
              </button>

              <button
                className="rounded-lg p-2.5 transition hover:bg-slate-100"
                type="button"
              >
                <Settings className="h-5 w-5 text-slate-600" />
              </button>
            </div>
          </div>
        </header>

        <main className="px-8 py-8">
          <div className="mb-6">
            <p className="text-sm text-slate-500 md:text-base">
              Stay updated with the latest course announcements and important notices.
            </p>
          </div>

          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {(["All", "Urgent", "Events", "Info"] as FilterType[]).map(
                (filter) => (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${getFilterClass(
                      filter,
                      activeFilter
                    )}`}
                  >
                    {filter}
                  </button>
                )
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setShowFilterMenu((value) => !value)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                type="button"
              >
                <Filter className="h-4 w-4" />
                Filter
              </button>

              {showFilterMenu ? (
                <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-slate-900">
                      Filter Options
                    </h3>
                    <button
                      onClick={() => setShowFilterMenu(false)}
                      className="text-slate-400 transition-colors hover:text-slate-600"
                      type="button"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mb-5">
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Courses
                    </label>

                    {uniqueCourses.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        No courses available.
                      </p>
                    ) : (
                      <div className="max-h-32 space-y-2 overflow-y-auto">
                        {uniqueCourses.map((courseCode) => (
                          <label
                            key={courseCode}
                            className="flex cursor-pointer items-center gap-2"
                          >
                            <input
                              type="checkbox"
                              checked={selectedCourses.includes(courseCode)}
                              onChange={() => toggleCourse(courseCode)}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-slate-600">
                              {courseCode}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedCourses([]);
                        setShowFilterMenu(false);
                      }}
                      className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                      type="button"
                    >
                      Clear
                    </button>
                    <button
                      onClick={() => setShowFilterMenu(false)}
                      className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                      type="button"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-500 shadow-sm">
              Loading announcements...
            </div>
          ) : errorMessage ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-600 shadow-sm">
              {errorMessage}
            </div>
          ) : filteredAnnouncements.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-slate-500 shadow-sm">
              No announcements found.
            </div>
          ) : (
            <div className="space-y-5">
              {filteredAnnouncements.map((item, index) => {
                const type = normalizeType(item.type);
                const styles = getCardStyles(item.type);
                const key =
                  item.id ?? `${item.courseId ?? "announcement"}-${index}`;

                return (
                  <article
                    key={key}
                    className={`relative overflow-hidden rounded-2xl shadow-sm transition hover:shadow-md ${styles.wrapper}`}
                  >
                    <div
                      className={`absolute bottom-0 left-0 top-0 w-1.5 ${styles.stripe}`}
                    />

                    <div className="px-6 py-5 pl-8">
                      <div className="mb-4 flex flex-wrap items-center gap-3">
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                          {getCourseLabel(item)}
                        </span>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${styles.badge}`}
                        >
                          {type}
                        </span>
                      </div>

                      <h2 className="break-words text-2xl font-bold text-slate-900">
                        {item.title || "Untitled announcement"}
                      </h2>

                      {item.content ? (
                        <p className="mt-4 text-base leading-7 text-slate-600">
                          {item.content}
                        </p>
                      ) : null}

                      <p className="mt-5 inline-flex items-center gap-2 text-base text-slate-500">
                        <Calendar className="h-4 w-4" />
                        {formatDate(item.createdAt)} - {formatTime(item.createdAt)}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </Layout>
  );
}
