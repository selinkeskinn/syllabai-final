"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Layout from "@/components/Layout";
import { courseService } from "@/services/course.service";
import { Bell, KeyRound, Settings } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import SettingsButton from "@/components/SettingsButton";

const colorStyles = [
  {
    strip: "bg-blue-500",
    text: "text-blue-700",
    border: "border-blue-500",
    buttonHover: "hover:bg-blue-500 hover:text-white",
    icon: "💻",
  },
  {
    strip: "bg-purple-500",
    text: "text-purple-700",
    border: "border-purple-500",
    buttonHover: "hover:bg-purple-500 hover:text-white",
    icon: "🌐",
  },
  {
    strip: "bg-emerald-500",
    text: "text-emerald-700",
    border: "border-emerald-500",
    buttonHover: "hover:bg-emerald-500 hover:text-white",
    icon: "🗄️",
  },
  {
    strip: "bg-orange-500",
    text: "text-orange-700",
    border: "border-orange-500",
    buttonHover: "hover:bg-orange-500 hover:text-white",
    icon: "⚡",
  },
  {
    strip: "bg-red-500",
    text: "text-red-700",
    border: "border-red-500",
    buttonHover: "hover:bg-red-500 hover:text-white",
    icon: "🔗",
  },
  {
    strip: "bg-indigo-500",
    text: "text-indigo-700",
    border: "border-indigo-500",
    buttonHover: "hover:bg-indigo-500 hover:text-white",
    icon: "🤖",
  },
];

const getWeekTopic = (course: any) => {
  const weeks = course.syllabus?.weeks || [];

  if (weeks.length > 0) {
    const sortedWeeks = [...weeks].sort((a, b) => a.weekNo - b.weekNo);
    const selectedWeek =
      sortedWeeks.find((week) => week.weekNo === 8) || sortedWeeks[0];

    return `Week ${selectedWeek.weekNo}: ${selectedWeek.topic}`;
  }

  return "Weekly plan available";
};

const getJoinErrorMessage = (error: unknown) => {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error
  ) {
    const response = (error as {
      response?: { status?: number; data?: { message?: string } };
    }).response;

    if (response?.status === 404) {
      return "Invalid course key. Please check the key and try again.";
    }

    if (response?.status === 409) {
      return "You are already enrolled in this course.";
    }

    if (response?.data?.message) {
      return response.data.message;
    }
  }

  return "Course could not be joined. Please try again.";
};

export default function CoursesPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [joinKey, setJoinKey] = useState("");
  const [joinMessage, setJoinMessage] = useState("");
  const [joinError, setJoinError] = useState("");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  const fetchCourses = useCallback(async () => {
    try {
      setLoading(true);
      const data = await courseService.getEnrolledCourses();
      setCourses(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Courses fetch error:", error);
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const handleJoinCourse = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedJoinKey = joinKey.trim().toUpperCase();

    if (!normalizedJoinKey) {
      setJoinError("Please enter a course key.");
      setJoinMessage("");
      return;
    }

    try {
      setJoining(true);
      setJoinError("");
      setJoinMessage("");

      const joinedCourse = await courseService.enrollWithJoinKey(
        normalizedJoinKey
      );

      setJoinKey("");
      setJoinMessage(
        `${joinedCourse.code} - ${joinedCourse.title} has been added to My Courses.`
      );

      await fetchCourses();
    } catch (error) {
      console.error("Join course error:", error);
      setJoinError(getJoinErrorMessage(error));
      setJoinMessage("");
    } finally {
      setJoining(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[28px] font-semibold text-slate-900">
                Welcome Back, Student!
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Here is your academic dashboard
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="mr-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2">
                <span className="text-sm font-medium text-blue-500">
                  Academic Week: 8
                </span>
              </div>

              <NotificationBell />

              <SettingsButton href="/settings" />
            </div>
          </div>
        </header>

        <main className="p-8">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="mb-2 text-2xl font-semibold text-slate-900">
                My Courses
              </h2>
              <p className="text-sm text-slate-500">Spring 2026 Semester</p>
            </div>

            <div className="flex w-full max-w-[430px] items-center gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2.5 shadow-sm lg:w-[430px]">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white text-blue-600">
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M15 7H16.5C18.433 7 20 8.567 20 10.5C20 12.433 18.433 14 16.5 14H14M9 17H7.5C5.567 17 4 15.433 4 13.5C4 11.567 5.567 10 7.5 10H10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M8.5 12H15.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              <div className="hidden min-w-[82px] sm:block">
                <p className="text-xs font-semibold leading-tight text-slate-900">
                  Course Key
                </p>
                <p className="text-[11px] leading-tight text-blue-700">
                  Join by key
                </p>
              </div>

              <input
                type="text"
                value={joinKey}
                onChange={(e) => setJoinKey(e.target.value.toUpperCase())}
                placeholder="ENTER KEY"
                className="h-9 min-w-0 flex-1 rounded-xl border border-blue-200 bg-white px-3 text-center text-[11px] font-bold tracking-[0.14em] text-blue-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />

              <button
                type="button"
                onClick={handleJoinCourse}
                disabled={joining || !joinKey.trim()}
                className="h-9 flex-shrink-0 rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {joining ? "..." : "Join"}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-500">
              Loading courses...
            </div>
          ) : courses.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-500">
              No courses found. Enter a course key above to join your first
              course.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {courses.map((course, index) => {
                const style = colorStyles[index % colorStyles.length];

                return (
                  <Link
                    key={course.id}
                    href={`/courses/${course.id}`}
                    className="group overflow-hidden rounded-xl border border-slate-200 bg-white transition-shadow hover:shadow-lg"
                  >
                    <div className={`${style.strip} h-3`} />

                    <div className="relative p-6">
                      <div
                        className={`absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-bold text-white ${style.strip}`}
                      >
                        {course.code}
                      </div>

                      <div className="mb-4 flex items-center gap-3">
                        <div
                          className={`flex h-12 w-12 items-center justify-center rounded-lg text-2xl ${style.strip}`}
                        >
                          {style.icon}
                        </div>
                      </div>

                      <div className="mb-5 pr-20">
                        <h3 className="mb-1 text-lg font-semibold text-slate-900">
                          {course.title}
                        </h3>
                        <p className="text-sm text-slate-600">
                          {course.instructor?.name || "Instructor User"}
                        </p>
                      </div>

                      <div className={`mb-5 border-l-4 py-1 pl-4 ${style.border}`}>
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          This Week&apos;s Topic
                        </div>
                        <div className="text-sm font-medium text-slate-900">
                          {getWeekTopic(course)}
                        </div>
                      </div>

                      <div className="flex justify-center border-t border-slate-200 pt-4">
                        <span
                          className={`rounded-lg border-2 bg-transparent px-4 py-2 text-sm font-medium transition-colors ${style.border} ${style.text} ${style.buttonHover}`}
                        >
                          View Course
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </Layout>
  );
}
