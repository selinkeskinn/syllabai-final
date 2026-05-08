"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import InstructorLayout from "@/components/InstructorLayout";
import { courseService } from "@/services/course.service";
import { Bell, Plus, Settings } from "lucide-react";
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const data = await courseService.getAllCourses();
        setCourses(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Instructor courses fetch error:", error);
        setCourses([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, []);

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
                  Academic Week
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
            <p className="text-sm text-slate-500">Current Semester</p>
          </div>

          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
              Loading courses...
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {courses.map((course, index) => {
                const visual = courseVisuals[index % courseVisuals.length];

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

                      <div className="flex justify-center border-t border-slate-200 pt-4">
                        <Link
                          href={`/instructor/courses/${course.id}`}
                          className={`rounded-lg border-2 bg-transparent px-4 py-2 text-sm font-medium transition-colors hover:text-white ${visual.text} ${visual.border} hover:${visual.bg}`}
                        >
                          View Course
                        </Link>
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
        </main>
      </div>
    </InstructorLayout>
  );
}
