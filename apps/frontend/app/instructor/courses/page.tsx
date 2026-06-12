"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import InstructorLayout from "@/components/InstructorLayout";
import { courseService } from "@/services/course.service";
import { Archive, Plus, RotateCcw } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import SettingsButton from "@/components/SettingsButton";

const courseVisuals = [
  {
    bg: "bg-blue-500",
    text: "text-blue-700",
    border: "border-blue-500",
    icon: "💻",
    label: "Weekly plan available",
  },
  {
    bg: "bg-purple-500",
    text: "text-purple-700",
    border: "border-purple-500",
    icon: "🌐",
    label: "Weekly plan available",
  },
  {
    bg: "bg-emerald-500",
    text: "text-emerald-700",
    border: "border-emerald-500",
    icon: "🗄️",
    label: "Weekly plan available",
  },
  {
    bg: "bg-orange-500",
    text: "text-orange-700",
    border: "border-orange-500",
    icon: "⚡",
    label: "Weekly plan available",
  },
  {
    bg: "bg-red-500",
    text: "text-red-700",
    border: "border-red-500",
    icon: "🔗",
    label: "Weekly plan available",
  },
  {
    bg: "bg-indigo-500",
    text: "text-indigo-700",
    border: "border-indigo-500",
    icon: "🤖",
    label: "Weekly plan available",
  },
];

export default function InstructorCoursesPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [archivedCourses, setArchivedCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const [activeData, archivedData] = await Promise.all([
          courseService.getMyCourses(),
          courseService.getArchivedInstructorCourses(),
        ]);

        setCourses(Array.isArray(activeData) ? activeData : []);
        setArchivedCourses(Array.isArray(archivedData) ? archivedData : []);
      } catch (error) {
        console.error("Instructor courses fetch error:", error);
        setCourses([]);
        setArchivedCourses([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, []);

  const handleArchiveCourse = async (course: any) => {
    const confirmed = window.confirm(
      `Archive "${course.code} - ${course.title}"? Students will no longer see it in active courses.`
    );

    if (!confirmed) return;

    try {
      setArchivingId(course.id);
      const archivedCourse = await courseService.archiveCourse(course.id);

      setCourses((currentCourses) =>
        currentCourses.filter((item) => item.id !== course.id)
      );

      setArchivedCourses((currentArchivedCourses) => [
        archivedCourse || { ...course, archivedAt: new Date().toISOString() },
        ...currentArchivedCourses.filter((item) => item.id !== course.id),
      ]);
    } catch (error) {
      console.error("Archive course error:", error);
      window.alert("Course could not be archived. Please try again.");
    } finally {
      setArchivingId(null);
    }
  };

  const handleRestoreCourse = async (course: any) => {
    const confirmed = window.confirm(
      `Restore "${course.code} - ${course.title}"? It will be shown in active courses again.`
    );

    if (!confirmed) return;

    try {
      setRestoringId(course.id);
      const restoredCourse = await courseService.restoreCourse(course.id);

      setArchivedCourses((currentArchivedCourses) =>
        currentArchivedCourses.filter((item) => item.id !== course.id)
      );

      setCourses((currentCourses) => [
        restoredCourse || { ...course, archivedAt: null },
        ...currentCourses.filter((item) => item.id !== course.id),
      ]);
    } catch (error) {
      console.error("Restore course error:", error);
      window.alert("Course could not be restored. Please try again.");
    } finally {
      setRestoringId(null);
    }
  };

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

              <NotificationBell />

              <SettingsButton href="/instructor/settings" />
            </div>
          </div>
        </header>

        <main className="p-8">
          <div className="mb-6">
            <h2 className="mb-2 text-2xl font-semibold text-slate-900">
              My Courses
            </h2>
            <p className="text-sm text-slate-500">Spring 2026 Semester</p>
          </div>

          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
              Loading courses...
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {courses.map((course, index) => {
                const visual = courseVisuals[index % courseVisuals.length];
                const isArchiving = archivingId === course.id;

                return (
                  <article
                    key={course.id}
                    className="cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white transition-shadow hover:shadow-lg"
                  >
                    <div className={`${visual.bg} h-3`} />

                    <div className="relative p-6">
                      <div
                        className={`absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-bold text-white ${visual.bg}`}
                      >
                        {course.code}
                      </div>

                      <div className="mb-4 flex items-center gap-3">
                        <div
                          className={`flex h-12 w-12 items-center justify-center rounded-lg text-2xl ${visual.bg}`}
                        >
                          {visual.icon}
                        </div>
                      </div>

                      <div className="mb-5">
                        <h3 className="mb-1 text-lg font-semibold text-slate-900">
                          {course.title}
                        </h3>
                        <p className="text-sm text-slate-600">
                          {course.instructor?.name || "Instructor User"}
                        </p>
                      </div>

                      <div
                        className={`mb-5 border-l-4 py-1 pl-4 ${visual.border}`}
                      >
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          This Week&apos;s Topic
                        </div>
                        <div className="text-sm font-medium text-slate-900">
                          {visual.label}
                        </div>
                      </div>

                      <div className="flex items-center justify-center gap-3 border-t border-slate-200 pt-4">
                        <Link
                          href={`/instructor/courses/${course.id}`}
                          className={`rounded-lg border-2 bg-transparent px-4 py-2 text-sm font-medium transition-colors hover:text-white ${visual.text} ${visual.border} hover:${visual.bg}`}
                        >
                          View Course
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleArchiveCourse(course)}
                          disabled={isArchiving}
                          className="inline-flex items-center gap-2 rounded-lg border-2 border-slate-300 bg-transparent px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-amber-500 hover:bg-amber-50 hover:text-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Archive className="h-4 w-4" />
                          {isArchiving ? "Archiving..." : "Archive"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}

              <Link
                href="/instructor/courses/new"
                className="group cursor-pointer overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-white transition-all hover:border-blue-500 hover:shadow-lg"
              >
                <div className="h-3 bg-slate-50" />

                <div className="flex min-h-[320px] flex-col items-center justify-center p-6">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 transition-colors group-hover:bg-blue-50">
                    <Plus className="h-10 w-10 text-slate-400 transition-colors group-hover:text-blue-500" />
                  </div>

                  <h3 className="text-lg font-semibold text-slate-600 transition-colors group-hover:text-blue-600">
                    Add Course
                  </h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Create a new course
                  </p>
                </div>
              </Link>
            </div>
          )}

          {!loading && (
            <section className="mt-10">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    Archived Courses
                  </h2>
                  <p className="text-sm text-slate-500">
                    Courses you archived are listed here.
                  </p>
                </div>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {archivedCourses.length} archived
                </span>
              </div>

              {archivedCourses.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
                  No archived courses yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {archivedCourses.map((course, index) => {
                    const visual =
                      courseVisuals[(index + courses.length) % courseVisuals.length];

                    return (
                      <article
                        key={course.id}
                        className="overflow-hidden rounded-xl border border-slate-200 bg-white opacity-90"
                      >
                        <div className="h-3 bg-slate-300" />

                        <div className="relative p-6">
                          <div className="absolute right-4 top-4 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                            Archived
                          </div>

                          <div className="mb-4 flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-2xl">
                              {visual.icon}
                            </div>
                          </div>

                          <div className="mb-5">
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                              {course.code}
                            </p>
                            <h3 className="mb-1 text-lg font-semibold text-slate-900">
                              {course.title}
                            </h3>
                            <p className="text-sm text-slate-600">
                              {course.instructor?.name || "Instructor User"}
                            </p>
                          </div>

                          <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
                            <div className="text-sm text-slate-500">
                              {course.archivedAt
                                ? `Archived on ${new Date(course.archivedAt).toLocaleDateString()}`
                                : "Archived course"}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRestoreCourse(course)}
                              disabled={restoringId === course.id}
                              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <RotateCcw className="h-4 w-4" />
                              {restoringId === course.id ? "Restoring..." : "Restore"}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </main>
      </div>
    </InstructorLayout>
  );
}
