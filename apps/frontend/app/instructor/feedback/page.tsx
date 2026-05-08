"use client";

import { useEffect, useState } from "react";
import InstructorLayout from "@/components/InstructorLayout";
import { FeedbackItem, getFeedback } from "@/services/feedback.service";
import {
  Bell,
  Binary,
  Brain,
  Database,
  Globe,
  LucideIcon,
  Monitor,
  Settings,
  Star,
} from "lucide-react";

type CourseFeedbackGroup = {
  courseId: string;
  course: {
    code: string;
    title: string;
  };
  averageRating: number;
  feedbackItems: FeedbackItem[];
};

const courseVisuals: {
  color: string;
  bg: string;
  icon: LucideIcon;
}[] = [
  {
    color: "rgb(109, 156, 245)",
    bg: "rgba(109, 156, 245, 0.2)",
    icon: Monitor,
  },
  {
    color: "rgb(245, 158, 11)",
    bg: "rgba(245, 158, 11, 0.2)",
    icon: Database,
  },
  {
    color: "rgb(34, 197, 94)",
    bg: "rgba(34, 197, 94, 0.2)",
    icon: Globe,
  },
  {
    color: "rgb(139, 92, 246)",
    bg: "rgba(139, 92, 246, 0.2)",
    icon: Binary,
  },
  {
    color: "rgb(236, 72, 153)",
    bg: "rgba(236, 72, 153, 0.2)",
    icon: Brain,
  },
];

function groupFeedbackByCourse(feedbackItems: FeedbackItem[]): CourseFeedbackGroup[] {
  const grouped = feedbackItems.reduce<Record<string, CourseFeedbackGroup>>(
    (acc, item) => {
      const courseId = item.courseId;

      if (!acc[courseId]) {
        acc[courseId] = {
          courseId,
          course: {
            code: item.course?.code || "Course",
            title: item.course?.title || "Untitled Course",
          },
          averageRating: 0,
          feedbackItems: [],
        };
      }

      acc[courseId].feedbackItems.push(item);
      return acc;
    },
    {}
  );

  return Object.values(grouped).map((group) => {
    const totalRating = group.feedbackItems.reduce(
      (sum, item) => sum + item.rating,
      0
    );

    return {
      ...group,
      averageRating:
        group.feedbackItems.length > 0
          ? totalRating / group.feedbackItems.length
          : 0,
    };
  });
}

function formatDate(value?: string) {
  if (!value) return "Date not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Date not available";

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getStudentName(item: FeedbackItem, index: number) {
  const extended = item as FeedbackItem & {
    anonymous?: boolean;
    user?: {
      name?: string | null;
      email?: string | null;
    } | null;
  };

  if (extended.anonymous) return "Anonymous Student";

  return (
    extended.user?.name ||
    extended.user?.email ||
    `Student Rating ${index + 1}`
  );
}

function getInitials(name: string) {
  if (name === "Anonymous Student") return "?";

  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return initials || "SR";
}

function Stars({ rating, size = "h-5 w-5" }: { rating: number; size?: string }) {
  const roundedRating = Math.max(0, Math.min(5, Math.round(rating)));

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${size} ${
            star <= roundedRating
              ? "fill-amber-400 text-amber-400"
              : "text-slate-300"
          }`}
        />
      ))}
    </div>
  );
}

export default function InstructorFeedbackPage() {
  const [feedbackGroups, setFeedbackGroups] = useState<CourseFeedbackGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const fetchFeedback = async () => {
      try {
        setLoading(true);
        setErrorMessage("");

        const data = await getFeedback();
        setFeedbackGroups(groupFeedbackByCourse(Array.isArray(data) ? data : []));
      } catch (error) {
        console.error("Instructor feedback fetch error:", error);
        setErrorMessage("Feedback could not be loaded.");
        setFeedbackGroups([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFeedback();
  }, []);

  return (
    <InstructorLayout>
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white px-8 py-5">
          <div className="flex items-center justify-between">
            <h1 className="text-[28px] font-semibold text-slate-900">
              Course Feedback
            </h1>

            <div className="flex items-center gap-3">
              <div className="mr-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2">
                <span className="text-sm font-medium text-blue-500">
                  Academic Week: 8
                </span>
              </div>

              <button
                type="button"
                className="relative rounded-lg p-2.5 transition hover:bg-slate-100"
              >
                <Bell className="h-5 w-5 text-slate-600" />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
              </button>

              <button
                type="button"
                className="rounded-lg p-2.5 transition hover:bg-slate-100"
              >
                <Settings className="h-5 w-5 text-slate-600" />
              </button>
            </div>
          </div>
        </header>

        <main className="px-8 py-8">
          <div className="mb-8">
            <h2 className="mb-2 text-2xl font-semibold text-slate-900">
              Course Feedback Received
            </h2>
            <p className="text-sm text-slate-500">
              View and analyze student feedback for your courses.
            </p>
          </div>

          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
              Loading feedback...
            </div>
          ) : errorMessage ? (
            <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-sm text-red-600">
              {errorMessage}
            </div>
          ) : feedbackGroups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-500">
              No feedback found.
            </div>
          ) : (
            <div className="space-y-8">
              {feedbackGroups.map((group, groupIndex) => {
                const visual = courseVisuals[groupIndex % courseVisuals.length];
                const Icon = visual.icon;

                return (
                  <section key={group.courseId}>
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-xl"
                          style={{ backgroundColor: visual.bg }}
                        >
                          <Icon
                            className="h-6 w-6"
                            style={{ color: visual.color }}
                          />
                        </div>

                        <div>
                          <div className="mb-1 flex items-center gap-2">
                            <span
                              className="rounded-full px-2.5 py-1 text-xs font-semibold"
                              style={{
                                backgroundColor: visual.bg,
                                color: visual.color,
                              }}
                            >
                              {group.course.code}
                            </span>
                          </div>
                          <h3 className="font-semibold text-slate-900">
                            {group.course.title}
                          </h3>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm text-slate-500">
                          Average Rating
                        </div>
                        <div className="flex items-center gap-2">
                          <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                          <span className="text-xl font-semibold text-slate-900">
                            {group.averageRating.toFixed(1)}
                          </span>
                          <span className="text-sm text-slate-500">
                            ({group.feedbackItems.length} response
                            {group.feedbackItems.length === 1 ? "" : "s"})
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {group.feedbackItems.map((item, itemIndex) => {
                        const studentName = getStudentName(item, itemIndex);
                        const initials = getInitials(studentName);

                        return (
                          <article
                            key={item.id}
                            className="rounded-xl border border-slate-200 bg-white p-6"
                          >
                            <div className="mb-4 flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-sm font-semibold text-white">
                                  {initials}
                                </div>

                                <div>
                                  <p className="font-medium text-slate-900">
                                    {studentName}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {formatDate(item.createdAt)}
                                  </p>
                                </div>
                              </div>

                              <Stars rating={item.rating} />
                            </div>

                            {item.tags.length > 0 ? (
                              <div className="mb-3 flex flex-wrap gap-2">
                                {item.tags.map((tag) => (
                                  <span
                                    key={tag}
                                    className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            ) : null}

                            {item.comment ? (
                              <p className="mt-3 text-sm leading-6 text-slate-600">
                                {item.comment}
                              </p>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </InstructorLayout>
  );
}
