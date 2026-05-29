"use client";

import Layout from "@/components/Layout";
import { useEffect, useState } from "react";
import { submitFeedback } from "@/services/feedback.service";
import { CourseSummary, courseService } from "@/services/course.service";
import NotificationBell from "@/components/NotificationBell";
import SettingsButton from "@/components/SettingsButton";
import {
Binary,
  Brain,
  Database,
  Globe,
  LucideIcon,
  Monitor,
  Settings,
  Star,
} from "lucide-react";

const quickTags = [
  "Clear Explanations",
  "Difficult Exams",
  "Helpful Slides",
  "Engaging Content",
  "Good Pacing",
  "Heavy Workload",
];

const courseVisuals: {
  color: string;
  bg: string;
  icon: LucideIcon;
}[] = [
  {
    color: "rgb(109, 156, 245)",
    bg: "rgba(109, 156, 245, 0.18)",
    icon: Monitor,
  },
  {
    color: "rgb(34, 197, 94)",
    bg: "rgba(34, 197, 94, 0.18)",
    icon: Globe,
  },
  {
    color: "rgb(245, 158, 11)",
    bg: "rgba(245, 158, 11, 0.18)",
    icon: Database,
  },
  {
    color: "rgb(236, 72, 153)",
    bg: "rgba(236, 72, 153, 0.18)",
    icon: Brain,
  },
  {
    color: "rgb(139, 92, 246)",
    bg: "rgba(139, 92, 246, 0.18)",
    icon: Binary,
  },
];

export default function FeedbackPage() {
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [selectedTags, setSelectedTags] = useState<Record<string, string[]>>({});
  const [anonymous, setAnonymous] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [submittingCourseId, setSubmittingCourseId] = useState<string | null>(
    null
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setLoading(true);
        setMessage("");
        const data = await courseService.getEnrolledCourses();
        setCourses(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Feedback courses fetch error:", error);
        setMessage("Courses could not be loaded for feedback.");
        setCourses([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, []);

  const setRating = (courseId: string, value: number) => {
    setRatings((prev) => ({
      ...prev,
      [courseId]: value,
    }));
  };

  const toggleTag = (courseId: string, tag: string) => {
    setSelectedTags((prev) => {
      const currentTags = prev[courseId] || [];
      const alreadySelected = currentTags.includes(tag);

      return {
        ...prev,
        [courseId]: alreadySelected
          ? currentTags.filter((item) => item !== tag)
          : [...currentTags, tag],
      };
    });
  };

  const toggleAnonymous = (courseId: string) => {
    setAnonymous((prev) => ({
      ...prev,
      [courseId]: !prev[courseId],
    }));
  };

  const handleSubmit = async (course: CourseSummary) => {
    const rating = ratings[course.id] || 0;

    if (rating === 0) {
      setMessage("Please select a rating before submitting feedback.");
      return;
    }

    try {
      setSubmittingCourseId(course.id);
      setMessage("");

      await submitFeedback({
        courseId: course.id,
        rating,
        tags: selectedTags[course.id] || [],
        isAnonymous: Boolean(anonymous[course.id]),
      });

      setMessage(`Course evaluation submitted for ${course.code}.`);
      setRatings((prev) => ({ ...prev, [course.id]: 0 }));
      setSelectedTags((prev) => ({ ...prev, [course.id]: [] }));
      setAnonymous((prev) => ({ ...prev, [course.id]: false }));
    } catch (error) {
      console.error("Feedback submit error:", error);
      setMessage("Feedback could not be submitted.");
    } finally {
      setSubmittingCourseId(null);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white px-8 py-5">
          <div className="flex items-center justify-between">
            <h1 className="text-[28px] font-semibold text-slate-900">
              Course Feedback
            </h1>

            <div className="flex items-center gap-3">
              <div className="mr-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2">
                <span className="text-sm font-medium text-blue-500">
                  Academic Week
                </span>
              </div>

              <NotificationBell />

              <SettingsButton href="/settings" />
            </div>
          </div>
        </header>

        <main className="px-8 py-8">
          <div className="mb-8">
            <h2 className="mb-2 text-2xl font-semibold text-slate-900">
              Course Evaluations
            </h2>
            <p className="text-sm text-slate-500">
              Rate your enrolled courses and choose quick tags that describe your
              learning experience.
            </p>
          </div>

          {message ? (
            <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm font-medium text-blue-700">
              {message}
            </div>
          ) : null}

          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-500">
              Loading courses...
            </div>
          ) : courses.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-slate-500">
              No enrolled courses found for feedback.
            </div>
          ) : (
            <div className="space-y-6">
              {courses.map((course, index) => {
                const visual = courseVisuals[index % courseVisuals.length];
                const Icon = visual.icon;
                const rating = ratings[course.id] || 0;
                const selected = selectedTags[course.id] || [];

                return (
                  <section
                    key={course.id}
                    className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
                  >
                    <div className="mb-6 flex items-start justify-between gap-4">
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
                              {course.code}
                            </span>
                          </div>
                          <h3 className="font-semibold text-slate-900">
                            {course.title}
                          </h3>
                          <p className="text-sm text-slate-500">
                            {course.semester || "Current Semester"}
                          </p>
                        </div>
                      </div>

                      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                        <input
                          type="checkbox"
                          checked={Boolean(anonymous[course.id])}
                          onChange={() => toggleAnonymous(course.id)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        Anonymous
                      </label>
                    </div>

                    <div className="mb-6">
                      <p className="mb-3 text-sm font-medium text-slate-700">
                        Overall Rating
                      </p>

                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setRating(course.id, star)}
                            aria-label={`Rate ${star} stars`}
                          >
                            <Star
                              className={`h-7 w-7 transition ${
                                star <= rating
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-slate-300"
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="mb-3 text-sm font-medium text-slate-700">
                        Quick Tags Optional
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {quickTags.map((tag) => {
                          const isSelected = selected.includes(tag);

                          return (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => toggleTag(course.id, tag)}
                              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                                isSelected
                                  ? "bg-blue-50 text-blue-600 ring-1 ring-blue-200"
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              }`}
                            >
                              {tag}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleSubmit(course)}
                        disabled={submittingCourseId === course.id}
                        className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {submittingCourseId === course.id
                          ? "Submitting..."
                          : "Submit Evaluation"}
                      </button>
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </Layout>
  );
}
