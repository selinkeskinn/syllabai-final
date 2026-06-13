"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileSearch,
  Files,
  Loader2,
  MessageCircle,
  SendHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import {
  aiService,
  CourseAiResource,
  CourseAiSource,
  InstructorAdviceType,
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

const quickQuestions = [
  "What is the grading policy?",
  "Which week is the final exam?",
  "What is the Week 3 topic?",
  "What are the office hours?",
];

const instructorAdvisorActions: Array<{
  title: string;
  description: string;
  question: string;
  adviceType: InstructorAdviceType;
  icon: typeof AlertTriangle;
}> = [
  {
    title: "Gap Analysis",
    description: "Find missing or unclear syllabus areas.",
    question:
      "Run a syllabus gap analysis. Which areas are missing, weak, or unclear?",
    adviceType: "SYLLABUS_GAP_ANALYSIS",
    icon: AlertTriangle,
  },
  {
    title: "Grading Check",
    description: "Check weights, descriptions, and consistency.",
    question:
      "Check the grading consistency. Do the weights, scoring, and descriptions match?",
    adviceType: "GRADING_CONSISTENCY_CHECK",
    icon: CheckCircle2,
  },
  {
    title: "Resources",
    description: "Suggest optional books or study resources.",
    question:
      "Recommend optional course resources based on the syllabus topics. Mark them as instructor-review-required.",
    adviceType: "RESOURCE_RECOMMENDATION",
    icon: Files,
  },
  {
    title: "Announcement",
    description: "Draft a short course announcement.",
    question:
      "Draft useful announcement options for upcoming syllabus events or important course reminders.",
    adviceType: "ANNOUNCEMENT_DRAFT_GENERATOR",
    icon: MessageCircle,
  },
];

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
  const messageListRef = useRef<HTMLDivElement>(null);
  const messageIdRef = useRef(0);
  const messages = messagesByCourse[selectedCourseId] ?? [];

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

  useEffect(() => {
    if (!open) return;

    messageListRef.current?.scrollTo({
      top: messageListRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, asking, open, selectedCourseId]);

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
  const totalChunks = readyResources.reduce(
    (total, resource) => total + resource.chunkCount,
    0
  );
  const statusTone = assistantReady
    ? {
        icon: CheckCircle2,
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      }
    : processingResources.length > 0 || loadingResources
      ? {
          icon: Clock3,
          className: "border-amber-200 bg-amber-50 text-amber-700",
        }
      : failedResources.length > 0
        ? {
            icon: AlertTriangle,
            className: "border-red-200 bg-red-50 text-red-700",
          }
        : {
            icon: FileSearch,
            className: "border-slate-200 bg-slate-50 text-slate-600",
          };
  const StatusIcon = statusTone.icon;

  const askAssistant = async (
    rawQuestion: string,
    adviceType?: InstructorAdviceType
  ) => {
    const cleanQuestion = rawQuestion.trim();
    if (!selectedCourseId || !cleanQuestion || asking) return;

    if (!assistantReady) {
      setError(assistantEmptyText);
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${(messageIdRef.current += 1)}`,
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
        cleanQuestion,
        adviceType
      );

      setMessagesByCourse((current) => ({
        ...current,
        [selectedCourseId]: [
          ...(current[selectedCourseId] ?? []),
          {
            id: `assistant-${(messageIdRef.current += 1)}`,
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

  const handleAsk = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await askAssistant(question);
  };

  return (
    <div className="fixed bottom-5 right-5 z-40">
      {open ? (
        <div className="max-h-[calc(100vh-40px)] w-[min(460px,calc(100vw-32px))] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.22)]">
          <div className="h-1 bg-blue-600" />

          <div className="border-b border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 gap-3">
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                  <Bot className="h-5 w-5" />
                  <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" />
                </div>
                <div className="min-w-0 pt-0.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <h2 className="truncate text-base font-semibold text-slate-950">
                      Course Assistant
                    </h2>
                    <Sparkles className="h-4 w-4 shrink-0 text-blue-500" />
                  </div>
                  <p className="truncate text-xs font-medium text-slate-500">
                    {selectedCourse
                      ? `${selectedCourse.code} - ${selectedCourse.title}`
                      : "Select a course"}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <div
                  className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold sm:flex ${statusTone.className}`}
                >
                  <StatusIcon className="h-3.5 w-3.5" />
                  {assistantStatus}
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close course assistant"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
              <div className="relative min-w-0 flex-1">
                <select
                  value={selectedCourseId}
                  onChange={(event) => {
                    setSelectedCourseId(event.target.value);
                    setQuestion("");
                    setError("");
                  }}
                  disabled={loadingCourses || courses.length === 0}
                  className="h-11 w-full appearance-none rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 pr-9 text-sm font-medium text-slate-700 outline-none transition hover:bg-white focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
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

              <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                <div className="min-w-[72px] border-r border-slate-200 px-3 py-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    PDFs
                  </p>
                  <p className="text-sm font-semibold text-slate-900">
                    {readyResources.length}
                  </p>
                </div>
                <div className="min-w-[72px] px-3 py-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Chunks
                  </p>
                  <p className="text-sm font-semibold text-slate-900">
                    {totalChunks}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3 bg-slate-50 p-4">
            <div
              ref={messageListRef}
              className="h-[360px] space-y-4 overflow-y-auto rounded-lg border border-slate-200 bg-white p-4"
            >
              {messages.length === 0 ? (
                <div className="flex min-h-full flex-col justify-between gap-4">
                  <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-white text-blue-600 ring-1 ring-blue-100">
                      <FileSearch className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-semibold text-slate-900">
                      {assistantEmptyText}
                    </p>
                  </div>

                  {role === "instructor" ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                        Instructor Advisor
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {instructorAdvisorActions.map((action) => {
                          const ActionIcon = action.icon;

                          return (
                            <button
                              key={action.adviceType}
                              type="button"
                              onClick={() =>
                                askAssistant(action.question, action.adviceType)
                              }
                              disabled={!assistantReady || asking}
                              className="rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-900">
                                <ActionIcon className="h-4 w-4 text-blue-600" />
                                {action.title}
                              </div>
                              <p className="text-[11px] leading-4 text-slate-500">
                                {action.description}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {role === "student" ? (
                    <div className="grid grid-cols-1 gap-2">
                      {quickQuestions.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setQuestion(item)}
                          disabled={!assistantReady}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-xs font-medium text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex items-start gap-2 ${
                      message.role === "user"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                        <Bot className="h-4 w-4" />
                      </div>
                    ) : null}
                    <div
                      className={`max-w-[84%] rounded-lg px-3.5 py-3 text-sm shadow-sm ${
                        message.role === "user"
                          ? "bg-blue-600 text-white"
                          : "border border-slate-200 bg-slate-50 text-slate-700"
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
                              className="overflow-hidden rounded-lg border border-slate-200 bg-white text-xs text-slate-600"
                            >
                              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-2.5 py-2 font-semibold text-slate-800">
                                <FileSearch className="h-3.5 w-3.5 text-blue-600" />
                                <span className="min-w-0 truncate">
                                  {source.resourceName}
                                  {source.pageNumber
                                    ? `, page ${source.pageNumber}`
                                    : ""}
                                </span>
                              </div>
                              <div className="line-clamp-3 px-2.5 py-2 leading-relaxed">
                                {source.contentPreview}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
              {asking ? (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 shadow-sm">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      Thinking...
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {error ? (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <form
              onSubmit={handleAsk}
              className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white p-2 shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100"
            >
              <input
                type="text"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                disabled={!assistantReady || asking}
                placeholder={
                  assistantReady ? "Ask about this course..." : assistantStatus
                }
                className="min-w-0 flex-1 border-none bg-transparent px-1 py-1.5 text-sm outline-none disabled:text-slate-400"
              />
              <button
                type="submit"
                disabled={!assistantReady || asking || !question.trim()}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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
          className="relative inline-flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-blue-700"
          aria-label="Open course assistant"
        >
          <MessageCircle className="h-6 w-6" />
          <span className="absolute right-1 top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" />
        </button>
      )}
    </div>
  );
}
