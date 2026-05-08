"use client";

import { useEffect, useMemo, useState } from "react";
import InstructorLayout from "@/components/InstructorLayout";
import {
  Announcement,
  announcementService,
} from "@/services/announcement.service";
import {
  Bell,
  Calendar,
  Edit2,
  Filter,
  Plus,
  Settings,
  X,
} from "lucide-react";

type AnnouncementFilter = "all" | "urgent" | "events" | "info";

const formatAnnouncementType = (type?: string | null) => {
  if (!type) return "INFO";

  return type.toUpperCase();
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "Date not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Date not available";

  const datePart = date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const timePart = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${datePart} - ${timePart}`;
};

const getContentPreview = (content?: string | null) => {
  if (!content) return "";

  return content.length > 190 ? `${content.slice(0, 190)}...` : content;
};

const getCourseLabel = (announcement: Announcement) => {
  if (announcement.course?.code) return announcement.course.code;
  if (announcement.course?.title) return announcement.course.title;
  if (announcement.courseId) return "Course";

  return "Course";
};

const getAnnouncementStyles = (type?: string | null) => {
  const normalized = type?.toUpperCase();

  if (normalized === "URGENT") {
    return {
      card: "border-red-100 bg-red-50",
      stripe: "bg-red-500",
      badge: "border-red-500 text-red-500",
      chip: "text-red-500",
    };
  }

  if (normalized === "EVENT") {
    return {
      card: "border-yellow-100 bg-yellow-50",
      stripe: "bg-orange-500",
      badge: "border-orange-500 text-orange-500",
      chip: "text-orange-500",
    };
  }

  return {
    card: "border-blue-100 bg-blue-50",
    stripe: "bg-blue-500",
    badge: "border-blue-500 text-blue-500",
    chip: "text-blue-500",
  };
};

export default function InstructorAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [activeFilter, setActiveFilter] = useState<AnnouncementFilter>("all");
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showNewAnnouncementModal, setShowNewAnnouncementModal] =
    useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const data = await announcementService.getAllAnnouncements();
        setAnnouncements(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Instructor announcements fetch error:", error);
        setAnnouncements([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAnnouncements();
  }, []);

  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((announcement) => {
      const type = announcement.type?.toUpperCase();

      if (activeFilter === "urgent") return type === "URGENT";
      if (activeFilter === "events") return type === "EVENT";
      if (activeFilter === "info") return type !== "URGENT" && type !== "EVENT";

      return true;
    });
  }, [announcements, activeFilter]);

  const filterButtons: {
    label: string;
    value: AnnouncementFilter;
    className: string;
  }[] = [
    {
      label: "All",
      value: "all",
      className:
        activeFilter === "all"
          ? "border-blue-300 bg-blue-50 text-blue-600"
          : "border-slate-200 bg-white text-slate-600",
    },
    {
      label: "Urgent",
      value: "urgent",
      className:
        activeFilter === "urgent"
          ? "border-red-300 bg-red-50 text-red-600"
          : "border-slate-200 bg-white text-red-600",
    },
    {
      label: "Events",
      value: "events",
      className:
        activeFilter === "events"
          ? "border-orange-300 bg-orange-50 text-orange-600"
          : "border-slate-200 bg-white text-orange-600",
    },
    {
      label: "Info",
      value: "info",
      className:
        activeFilter === "info"
          ? "border-blue-300 bg-blue-50 text-blue-600"
          : "border-slate-200 bg-white text-slate-600",
    },
  ];

  return (
    <InstructorLayout>
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white px-8 py-5">
          <div className="flex items-center justify-between">
            <h1 className="text-[28px] font-semibold text-slate-900">
              Announcements
            </h1>

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
          <div className="mb-6">
            <p className="text-sm text-slate-500">
              Create, review, and manage course announcements and important
              notices.
            </p>
          </div>

          <div className="mb-8 flex items-center justify-between gap-4">
            <div className="flex flex-wrap gap-3">
              {filterButtons.map((button) => (
                <button
                  key={button.value}
                  type="button"
                  onClick={() => setActiveFilter(button.value)}
                  className={`rounded-full border px-5 py-2 text-sm font-medium transition-colors ${button.className}`}
                >
                  {button.label}
                </button>
              ))}
            </div>

            <div className="relative flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowNewAnnouncementModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                New Announcement
              </button>

              <button
                type="button"
                onClick={() => setShowFilterMenu((value) => !value)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <Filter className="h-4 w-4" />
                Filter
              </button>

              {showFilterMenu ? (
                <div className="absolute right-0 top-12 z-10 w-72 rounded-xl border border-slate-200 bg-white p-5 shadow-lg">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-slate-900">
                      Filter Options
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowFilterMenu(false)}
                      className="rounded-lg p-1 transition-colors hover:bg-slate-100"
                    >
                      <X className="h-4 w-4 text-slate-500" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Announcement Type
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {filterButtons.map((button) => (
                          <button
                            key={`menu-${button.value}`}
                            type="button"
                            onClick={() => setActiveFilter(button.value)}
                            className={`rounded-lg border px-3 py-2 text-sm ${button.className}`}
                          >
                            {button.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setActiveFilter("all")}
                        className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowFilterMenu(false)}
                        className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
              Loading announcements...
            </div>
          ) : filteredAnnouncements.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-500">
              No announcements found.
            </div>
          ) : (
            <div className="space-y-5">
              {filteredAnnouncements.map((announcement, index) => {
                const styles = getAnnouncementStyles(announcement.type);

                return (
                  <article
                    key={
                      announcement.id ??
                      `${announcement.courseId ?? "announcement"}-${index}`
                    }
                    className={`relative overflow-hidden rounded-xl border p-6 ${styles.card}`}
                  >
                    <div
                      className={`absolute bottom-0 left-0 top-0 w-1.5 ${styles.stripe}`}
                    />

                    <div className="pl-4">
                      <div className="mb-4 flex items-start justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                            {getCourseLabel(announcement)}
                          </span>

                          <span
                            className={`rounded-full border bg-white px-3 py-1 text-xs font-medium ${styles.badge}`}
                          >
                            {formatAnnouncementType(announcement.type)}
                          </span>
                        </div>

                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          Edit
                        </button>
                      </div>

                      <h2 className="text-xl font-semibold text-slate-900">
                        {announcement.title || "Untitled Announcement"}
                      </h2>

                      {announcement.content ? (
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          {getContentPreview(announcement.content)}
                        </p>
                      ) : null}

                      <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDateTime(announcement.createdAt)}</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>

        {showNewAnnouncementModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
            <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">
                  Add New Announcement
                </h3>

                <button
                  type="button"
                  onClick={() => setShowNewAnnouncementModal(false)}
                  className="rounded-lg p-2 transition-colors hover:bg-slate-100"
                >
                  <X className="h-5 w-5 text-slate-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Title
                  </label>
                  <input
                    type="text"
                    placeholder="Announcement title"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Type
                  </label>
                  <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100">
                    <option value="info">Info</option>
                    <option value="urgent">Urgent</option>
                    <option value="event">Event</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Content
                  </label>
                  <textarea
                    rows={5}
                    placeholder="Write announcement details..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowNewAnnouncementModal(false)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowNewAnnouncementModal(false)}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Publish
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </InstructorLayout>
  );
}
