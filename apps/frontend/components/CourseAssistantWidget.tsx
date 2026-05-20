"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Bot,
  ChevronDown,
  FileSearch,
  Loader2,
  MessageCircle,
  SendHorizontal,
  X,
} from "lucide-react";
import {
  aiService,
  CourseAiResource,
  CourseAiSource,
} from "@/services/ai.service";
import { courseService, CourseSummary } from "@/services/course.service";

type CourseAssistantWidgetProps = {
  role: "student" | "instructor";
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: CourseAiSource[];
};

const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    (error as { response?: { data?: { message?: unknown } } }).response?.data
      ?.message
  ) {
    const message = (error as { response: { data: { message: unknown } } })
      .response.data.message;
    if (typeof message === "string") return message;
  }

  return fallback;
};

const getCourseIdFromPath = (pathname: string, role: "student" | "instructor") => {
  const pattern =
    role === "instructor"
      ? /^\/instructor\/courses\/([^/]+)/
      : /^\/courses\/([^/]+)/;
  return pathname.match(pattern)?.[1] ?? "";
};

const noIndexedResourcesMessage =
  "No indexed resources yet. Upload a syllabus PDF to enable AI answers.";

const formatResourceError = (message?: string | null) =>
  message?.trim() ||
  "PDF indexing failed. Please upload a text-based PDF and try again.";

export default function CourseAssistantWidget({
  role,
}: CourseAssistantWidgetProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [resources, setResources] = useState<CourseAiResource[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingResources, setLoadingResources] = useState(false);
  const [question, setQuestion] = useState("");
  const [messagesByCourse, setMessagesByCourse] = useState<
    Record<string, ChatMessage[]>
  >({});
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const data =
          role === "instructor"
            ? await courseService.getMyCourses()
            : await courseService.getEnrolledCourses();
        setCourses(data);

        const pathCourseId = getCourseIdFromPath(pathname, role);
        const preferredCourse = data.find((course) => course.id === pathCourseId);
        setSelectedCourseId(preferredCourse?.id ?? data[0]?.id ?? "");
      } catch {
        setCourses([]);
        setSelectedCourseId("");
      } finally {
        setLoadingCourses(false);
      }
    };

    fetchCourses();
  }, [pathname, role]);

  useEffect(() => {
    if (!selectedCourseId) {
      return;
    }

    const fetchResources = async () => {
      try {
        setLoadingResources(true);
        const data = await aiService.getCourseResources(selectedCourseId);
        setResources(data);
      } catch {
        setResources([]);
      } finally {
        setLoadingResources(false);
      }
    };

    fetchResources();
  }, [selectedCourseId]);

  useEffect(() => {
    if (!resources.some((resource) => resource.status === "PROCESSING")) return;

    const intervalId = window.setInterval(async () => {
      try {
        const data = await aiService.getCourseResources(selectedCourseId);
        setResources(data);
      } catch {
        window.clearInterval(intervalId);
      }
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [resources, selectedCourseId]);

  const selectedCourse = courses.find((course) => course.id === selectedCourseId);
  const readyResources = useMemo(
    () => resources.filter((resource) => resource.status === "READY"),
    [resources]
  );
  const processingResources = useMemo(
    () => resources.filter((resource) => resource.status === "PROCESSING"),
    [resources]
  );
  const failedResources = useMemo(
    () => resources.filter((resource) => resource.status === "FAILED"),
    [resources]
  );
  const messages = messagesByCourse[selectedCourseId] ?? [];
  const assistantReady = readyResources.length > 0;
  const assistantStatus = assistantReady
    ? "Ready"
    : loadingResources
      ? "Checking"
      : processingResources.length > 0
        ? "Loading syllabus..."
        : failedResources.length > 0
          ? "Indexing failed"
          : "No indexed resources yet";
  const assistantEmptyText = assistantReady
    ? "Ask from this course's PDFs."
    : processingResources.length > 0
      ? "Loading syllabus..."
      : failedResources.length > 0
        ? formatResourceError(failedResources[0]?.errorMessage)
        : noIndexedResourcesMessage;

  const handleAsk = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const cleanQuestion = question.trim();
    if (!selectedCourseId || !cleanQuestion || asking) return;

    if (!assistantReady) {
      setError(assistantEmptyText);
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: cleanQuestion,
    };

    setMessagesByCourse((current) => ({
      ...current,
      [selectedCourseId]: [...(current[selectedCourseId] ?? []), userMessage],
    }));
    setQuestion("");
    setError("");
    setAsking(true);

    try {
      const response = await aiService.askCourseQuestion(
        selectedCourseId,
        cleanQuestion
      );

      setMessagesByCourse((current) => ({
        ...current,
        [selectedCourseId]: [
          ...(current[selectedCourseId] ?? []),
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: response.answer,
            sources: response.sources,
          },
        ],
      }));
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "Course assistant could not answer right now."
        )
      );
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-40">
      {open ? (
        <div className="w-[min(420px,calc(100vw-40px))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Course Assistant
                </h2>
                <p className="text-xs text-slate-500">
                  {selectedCourse?.code || "Select a course"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close course assistant"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3 p-4">
            <div className="relative">
              <select
                value={selectedCourseId}
                onChange={(event) => {
                  setSelectedCourseId(event.target.value);
                  setQuestion("");
                  setError("");
                }}
                disabled={loadingCourses || courses.length === 0}
                className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2 pr-9 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
              >
                {courses.length === 0 ? (
                  <option value="">No courses</option>
                ) : (
                  courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.code} - {course.title}
                    </option>
                  ))
                )}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Status
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {assistantStatus}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Chunks
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {readyResources.reduce(
                    (total, resource) => total + resource.chunkCount,
                    0
                  )}
                </p>
              </div>
            </div>

            <div className="max-h-80 space-y-3 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
              {messages.length === 0 ? (
                <div className="flex items-start gap-3 rounded-lg bg-white p-3 text-sm text-slate-500">
                  <FileSearch className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <span>
                    {assistantEmptyText}
                  </span>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-lg p-3 text-sm ${
                      message.role === "user"
                        ? "bg-blue-600 text-white"
                        : "border border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    <p className="whitespace-pre-line leading-relaxed">
                      {message.content}
                    </p>
                    {message.sources?.length ? (
                      <div className="mt-3 space-y-2">
                        {message.sources.map((source) => (
                          <div
                            key={`${source.resourceId}-${source.pageNumber}-${source.contentPreview}`}
                            className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600"
                          >
                            <div className="font-semibold text-slate-800">
                              {source.resourceName}
                              {source.pageNumber ? `, page ${source.pageNumber}` : ""}
                            </div>
                            <div className="mt-1 line-clamp-3">
                              {source.contentPreview}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>

            {error ? (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <form onSubmit={handleAsk} className="flex gap-2">
              <input
                type="text"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                disabled={!assistantReady || asking}
                placeholder={
                  assistantReady ? "Ask about this course..." : assistantStatus
                }
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
              />
              <button
                type="submit"
                disabled={!assistantReady || asking || !question.trim()}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Ask course assistant"
              >
                {asking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <SendHorizontal className="h-4 w-4" />
                )}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl shadow-blue-200 transition hover:bg-blue-700"
          aria-label="Open course assistant"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}
