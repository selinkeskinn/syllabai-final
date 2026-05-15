"use client";

import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { Bell, ChevronLeft, ChevronRight, Settings } from "lucide-react";
import { Deadline, deadlineService } from "@/services/deadline.service";
import NotificationBell from "@/components/NotificationBell";
import SettingsButton from "@/components/SettingsButton";

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const formatDate = (value?: string | null) => {
  if (!value) return "No due date";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No due date";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

const formatTime = (value?: string | null) => {
  if (!value) return "--:--";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";

  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const getCourseLabel = (deadline: Deadline) => {
  if (deadline.course?.code) return deadline.course.code;
  if (deadline.course?.title) return deadline.course.title;
  return "IE 492";
};

const getDotColor = (type?: string | null) => {
  switch (type) {
    case "PROJECT":
      return "bg-violet-500";
    case "ASSIGNMENT":
      return "bg-blue-500";
    case "EXAM":
      return "bg-red-500";
    case "QUIZ":
      return "bg-amber-500";
    default:
      return "bg-slate-500";
  }
};

const isSameDate = (first: Date, second: Date) => {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
};

const buildMonthDays = (currentMonth: Date) => {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startingDayOfWeek = firstDay.getDay();

  const days: Array<Date | null> = [];

  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null);
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    days.push(new Date(year, month, day));
  }

  return days;
};

export default function DeadlinesPage() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date());

  useEffect(() => {
    const fetchDeadlines = async () => {
      try {
        setLoading(true);
        setErrorMessage("");

        const data = await deadlineService.getAllDeadlines();
        const list = Array.isArray(data) ? data : [];
        setDeadlines(list);

        const firstDeadline = [...list]
          .filter((item) => item.dueDate)
          .sort(
            (a, b) =>
              new Date(a.dueDate || "").getTime() -
              new Date(b.dueDate || "").getTime()
          )[0];

        if (firstDeadline?.dueDate) {
          const firstDate = new Date(firstDeadline.dueDate);
          setSelectedDate(firstDate);
          setCurrentMonth(
            new Date(firstDate.getFullYear(), firstDate.getMonth(), 1)
          );
        }
      } catch (error) {
        console.error("Deadlines fetch error:", error);
        setErrorMessage("Deadlines could not be loaded.");
        setDeadlines([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDeadlines();
  }, []);

  const sortedDeadlines = useMemo(() => {
    return [...deadlines].sort((a, b) => {
      const first = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      const second = b.dueDate ? new Date(b.dueDate).getTime() : 0;
      return first - second;
    });
  }, [deadlines]);

  const selectedDateDeadlines = useMemo(() => {
    return sortedDeadlines.filter((deadline) => {
      if (!deadline.dueDate) return false;
      return isSameDate(new Date(deadline.dueDate), selectedDate);
    });
  }, [selectedDate, sortedDeadlines]);

  const comingUpDeadlines = useMemo(() => {
    const endOfSelectedDate = new Date(selectedDate);
    endOfSelectedDate.setHours(23, 59, 59, 999);

    return sortedDeadlines
      .filter((deadline) => {
        if (!deadline.dueDate) return false;
        return new Date(deadline.dueDate).getTime() > endOfSelectedDate.getTime();
      })
      .slice(0, 2);
  }, [selectedDate, sortedDeadlines]);

  const monthDays = useMemo(() => buildMonthDays(currentMonth), [currentMonth]);

  const monthName = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const selectedDateLabel = selectedDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });

  const handlePreviousMonth = () => {
    setCurrentMonth(
      (previous) => new Date(previous.getFullYear(), previous.getMonth() - 1, 1)
    );
  };

  const handleNextMonth = () => {
    setCurrentMonth(
      (previous) => new Date(previous.getFullYear(), previous.getMonth() + 1, 1)
    );
  };

  const getDeadlinesForDate = (date: Date | null) => {
    if (!date) return [];

    return sortedDeadlines.filter((deadline) => {
      if (!deadline.dueDate) return false;
      return isSameDate(new Date(deadline.dueDate), date);
    });
  };

  return (
    <Layout>
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white px-8 py-5">
          <div className="flex items-center justify-between">
            <h1 className="text-[28px] font-semibold text-slate-900">
              Deadlines
            </h1>

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

        <main className="px-8 py-8">
          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-500 shadow-sm">
              Loading deadlines...
            </div>
          ) : errorMessage ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-600 shadow-sm">
              {errorMessage}
            </div>
          ) : sortedDeadlines.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-slate-500 shadow-sm">
              No deadlines found.
            </div>
          ) : (
            <div className="grid gap-8 xl:grid-cols-2">
              <section className="min-h-[620px] rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
                <div className="mb-8 flex items-center justify-between">
                  <h2 className="text-[28px] font-semibold text-slate-900">
                    {monthName}
                  </h2>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePreviousMonth}
                      className="rounded-lg p-2 transition-colors hover:bg-slate-100"
                      type="button"
                      aria-label="Previous month"
                    >
                      <ChevronLeft className="h-5 w-5 text-slate-600" />
                    </button>
                    <button
                      onClick={handleNextMonth}
                      className="rounded-lg p-2 transition-colors hover:bg-slate-100"
                      type="button"
                      aria-label="Next month"
                    >
                      <ChevronRight className="h-5 w-5 text-slate-600" />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-7 gap-3">
                    {weekDays.map((day) => (
                      <div
                        key={day}
                        className="py-2 text-center text-xs font-semibold text-slate-500"
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-x-3 gap-y-7">
                    {monthDays.map((date, index) => {
                      const dayDeadlines = getDeadlinesForDate(date);
                      const isSelected =
                        date && isSameDate(date, selectedDate);
                      const hasDeadline = dayDeadlines.length > 0;
                      const firstDeadline = dayDeadlines[0];
                      const dotColor = getDotColor(firstDeadline?.type);

                      return (
                        <button
                          key={date?.toISOString() ?? `empty-${index}`}
                          onClick={() => date && setSelectedDate(date)}
                          disabled={!date}
                          className={`mx-auto flex h-16 w-16 flex-col items-center justify-center rounded-lg transition-colors ${
                            date ? "cursor-pointer hover:bg-slate-50" : "invisible"
                          } ${
                            isSelected
                              ? "bg-blue-500 font-bold text-white"
                              : "text-slate-700"
                          }`}
                          type="button"
                        >
                          {date ? (
                            <>
                              <span className="text-[20px]">
                                {date.getDate()}
                              </span>
                              {hasDeadline ? (
                                <span
                                  className={`mt-1.5 h-1.5 w-1.5 rounded-full ${
                                    isSelected ? "bg-white" : dotColor
                                  }`}
                                />
                              ) : null}
                            </>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>

              <section className="min-h-[620px] rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
                <h2 className="mb-8 text-[24px] font-semibold text-slate-900">
                  Tasks for {selectedDateLabel}
                </h2>

                <div className="space-y-4">
                  {selectedDateDeadlines.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 p-5 text-sm text-slate-500">
                      No tasks for this date.
                    </div>
                  ) : (
                    selectedDateDeadlines.map((deadline) => (
                      <article
                        key={deadline.id}
                        className="rounded-lg border border-slate-200 p-5 transition-shadow hover:shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="mb-2 text-[13px] font-bold text-slate-400">
                              {getCourseLabel(deadline)}
                            </div>

                            <h3 className="mb-3 text-[18px] font-semibold text-slate-900">
                              {deadline.title}
                            </h3>

                            <p className="text-sm text-slate-500">
                              Due {formatDate(deadline.dueDate)}
                            </p>

                            {deadline.description ? (
                              <p className="mt-4 text-sm leading-6 text-slate-600">
                                {deadline.description}
                              </p>
                            ) : null}
                          </div>

                          <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">
                            {formatTime(deadline.dueDate)}
                          </span>
                        </div>
                      </article>
                    ))
                  )}
                </div>

                <div className="my-8 border-t border-slate-200" />

                <h2 className="mb-5 text-[20px] font-semibold text-slate-900">
                  Coming Up Next
                </h2>

                <div className="space-y-4">
                  {comingUpDeadlines.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 p-5 text-sm text-slate-500">
                      No upcoming tasks.
                    </div>
                  ) : (
                    comingUpDeadlines.map((deadline) => (
                      <article
                        key={deadline.id}
                        className="rounded-lg border border-slate-200 p-5 transition-shadow hover:shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="mb-2 text-[13px] font-bold text-slate-400">
                              {getCourseLabel(deadline)}
                            </div>

                            <h3 className="mb-3 text-[17px] font-semibold text-slate-700">
                              {deadline.title}
                            </h3>

                            <p className="text-sm text-slate-500">
                              Due {formatDate(deadline.dueDate)}
                            </p>
                          </div>

                          <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">
                            {formatTime(deadline.dueDate)}
                          </span>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </Layout>
  );
}
