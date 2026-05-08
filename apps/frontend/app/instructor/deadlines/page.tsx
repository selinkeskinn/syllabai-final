"use client";

import { useEffect, useMemo, useState } from "react";
import InstructorLayout from "@/components/InstructorLayout";
import { Deadline, deadlineService } from "@/services/deadline.service";
import { courseService } from "@/services/course.service";
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Settings,
} from "lucide-react";

const formatDeadlineType = (type?: string | null) => {
  if (!type) return "Deadline";

  return type
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const formatTime = (value?: string | null) => {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatMonthYear = (date: Date) =>
  date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

const formatSelectedTitle = (date: Date) =>
  date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const getTypeDotClass = (type?: string | null) => {
  const normalized = type?.toUpperCase();

  if (normalized === "QUIZ") return "bg-emerald-500";
  if (normalized === "EXAM") return "bg-red-500";
  if (normalized === "ASSIGNMENT") return "bg-orange-500";

  return "bg-purple-500";
};

const getTypeBadgeClass = (type?: string | null) => {
  const normalized = type?.toUpperCase();

  if (normalized === "QUIZ") return "bg-emerald-50 text-emerald-700";
  if (normalized === "EXAM") return "bg-red-50 text-red-700";
  if (normalized === "ASSIGNMENT") return "bg-orange-50 text-orange-700";

  return "bg-purple-50 text-purple-700";
};

const getCalendarDays = (month: Date) => {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);
  const days = [];

  for (let i = 0; i < firstDay.getDay(); i += 1) {
    days.push(null);
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    days.push(new Date(year, monthIndex, day));
  }

  return days;
};

export default function InstructorDeadlinesPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeadlines = async () => {
      try {
        setLoading(true);

        const [courseData, deadlineData] = await Promise.all([
          courseService.getAllCourses(),
          deadlineService.getAllDeadlines(),
        ]);

        const safeCourses = Array.isArray(courseData) ? courseData : [];
        const safeDeadlines = Array.isArray(deadlineData) ? deadlineData : [];

        setCourses(safeCourses);
        setDeadlines(safeDeadlines);

        const firstUpcoming = safeDeadlines
          .map((deadline) => new Date(deadline.dueDate || ""))
          .filter((date) => !Number.isNaN(date.getTime()))
          .sort((a, b) => a.getTime() - b.getTime())[0];

        if (firstUpcoming) {
          setCurrentMonth(new Date(firstUpcoming.getFullYear(), firstUpcoming.getMonth(), 1));
          setSelectedDate(firstUpcoming);
        }
      } catch (error) {
        console.error("Instructor deadlines fetch error:", error);
        setCourses([]);
        setDeadlines([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDeadlines();
  }, []);

  const courseIds = useMemo(
    () => new Set(courses.map((course) => course.id)),
    [courses]
  );

  const instructorDeadlines = deadlines
    .filter((deadline) => !deadline.courseId || courseIds.has(deadline.courseId))
    .sort((a, b) => {
      const first = new Date(a.dueDate || "").getTime();
      const second = new Date(b.dueDate || "").getTime();
      return first - second;
    });

  const selectedDateDeadlines = instructorDeadlines.filter((deadline) => {
    if (!deadline.dueDate) return false;

    const date = new Date(deadline.dueDate);

    if (Number.isNaN(date.getTime())) return false;

    return isSameDay(date, selectedDate);
  });

  const comingUpNext = instructorDeadlines.filter((deadline) => {
    if (!deadline.dueDate) return false;

    const date = new Date(deadline.dueDate);

    if (Number.isNaN(date.getTime())) return false;

    return date.getTime() > selectedDate.getTime();
  });

  const days = getCalendarDays(currentMonth);

  const goToPreviousMonth = () => {
    setCurrentMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)
    );
  };

  const goToNextMonth = () => {
    setCurrentMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)
    );
  };

  return (
    <InstructorLayout>
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white px-8 py-5">
          <div className="flex items-center justify-between">
            <h1 className="text-[28px] font-semibold text-slate-900">
              Deadlines
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
          <div className="mb-8">
            <p className="text-sm text-slate-500">
              Track upcoming assignments, projects, quizzes, and exams across
              your courses.
            </p>
          </div>

          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
              Loading deadlines...
            </div>
          ) : (
            <>
              <div className="grid gap-6 xl:grid-cols-[1fr_0.96fr]">
                <section className="rounded-xl border border-slate-200 bg-white p-8">
                  <div className="mb-8 flex items-center justify-between">
                    <h2 className="text-2xl font-semibold text-slate-900">
                      {formatMonthYear(currentMonth)}
                    </h2>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={goToPreviousMonth}
                        className="rounded-lg p-2 transition-colors hover:bg-slate-100"
                        aria-label="Previous month"
                      >
                        <ChevronLeft className="h-5 w-5 text-slate-600" />
                      </button>

                      <button
                        type="button"
                        onClick={goToNextMonth}
                        className="rounded-lg p-2 transition-colors hover:bg-slate-100"
                        aria-label="Next month"
                      >
                        <ChevronRight className="h-5 w-5 text-slate-600" />
                      </button>
                    </div>
                  </div>

                  <div className="mb-6 grid grid-cols-7 text-center">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                      (day) => (
                        <div
                          key={day}
                          className="text-sm font-semibold text-slate-500"
                        >
                          {day}
                        </div>
                      )
                    )}
                  </div>

                  <div className="grid grid-cols-7 gap-y-8">
                    {days.map((date, index) => {
                      if (!date) {
                        return <div key={`empty-${index}`} className="h-16" />;
                      }

                      const dayDeadlines = instructorDeadlines.filter((deadline) => {
                        if (!deadline.dueDate) return false;

                        const deadlineDate = new Date(deadline.dueDate);

                        if (Number.isNaN(deadlineDate.getTime())) return false;

                        return isSameDay(deadlineDate, date);
                      });

                      const isSelected = isSameDay(date, selectedDate);

                      return (
                        <button
                          key={date.toISOString()}
                          type="button"
                          onClick={() => setSelectedDate(date)}
                          className={`mx-auto flex h-16 w-16 flex-col items-center justify-center rounded-xl text-center transition-colors ${
                            isSelected
                              ? "bg-blue-500 text-white"
                              : "text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <span className="text-xl font-medium">
                            {date.getDate()}
                          </span>

                          {dayDeadlines.length > 0 ? (
                            <span className="mt-1 flex items-center justify-center gap-1">
                              {dayDeadlines.slice(0, 3).map((deadline) => (
                                <span
                                  key={deadline.id}
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    isSelected
                                      ? "bg-white"
                                      : getTypeDotClass(deadline.type)
                                  }`}
                                />
                              ))}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-8">
                  <h2 className="mb-8 text-2xl font-semibold text-slate-900">
                    Tasks for {formatSelectedTitle(selectedDate)}
                  </h2>

                  {selectedDateDeadlines.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                      No tasks for this date.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {selectedDateDeadlines.map((deadline) => (
                        <article
                          key={deadline.id}
                          className="rounded-xl border border-slate-200 bg-white p-5"
                        >
                          <div className="mb-3 flex items-start justify-between gap-4">
                            <div>
                              <p className="text-sm font-semibold text-slate-500">
                                {deadline.course?.code || "Course"}
                              </p>
                              <h3 className="mt-2 font-semibold text-slate-900">
                                {deadline.title}
                              </h3>
                            </div>

                            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
                              {formatTime(deadline.dueDate)}
                            </span>
                          </div>

                          <div className="mb-3">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${getTypeBadgeClass(
                                deadline.type
                              )}`}
                            >
                              {formatDeadlineType(deadline.type)}
                            </span>
                          </div>

                          {deadline.description ? (
                            <p className="text-sm leading-6 text-slate-600">
                              {deadline.description}
                            </p>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              <section className="mt-8">
                <h2 className="mb-5 text-2xl font-semibold text-slate-900">
                  Coming Up Next
                </h2>

                {comingUpNext.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-white p-5 text-sm text-slate-500">
                    No upcoming deadlines.
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {comingUpNext.slice(0, 4).map((deadline) => (
                      <article
                        key={deadline.id}
                        className="rounded-xl border border-slate-200 bg-white p-5"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-400">
                              {deadline.course?.code || "Course"}
                            </p>
                            <h3 className="mt-2 font-semibold text-slate-700">
                              {deadline.title}
                            </h3>
                            <p className="mt-2 text-sm text-slate-500">
                              Due{" "}
                              {deadline.dueDate
                                ? new Date(deadline.dueDate).toLocaleDateString(
                                    "en-US",
                                    {
                                      month: "short",
                                      day: "numeric",
                                    }
                                  )
                                : "No date"}
                            </p>
                          </div>

                          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-500">
                            {formatTime(deadline.dueDate)}
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </InstructorLayout>
  );
}
