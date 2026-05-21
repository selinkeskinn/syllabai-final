"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import InstructorLayout from "@/components/InstructorLayout";
import { courseService } from "@/services/course.service";
import {
  aiService,
  CourseAiResource,
  CourseAiSyllabusSummary,
} from "@/services/ai.service";
import {
  getSyllabusDescriptionText,
  getSyllabusDocumentMetadata,
  Syllabus,
  SyllabusManualOverrides,
  syllabusService,
} from "@/services/syllabus.service";
import { api } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";
import SettingsButton from "@/components/SettingsButton";
import {
  ArrowLeft,
  AlertCircle,
  Bell,
  Bot,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Edit2,
  FileText,
  KeyRound,
  Loader2,
  LucideIcon,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Trash2,
  UploadCloud,
  XCircle,
} from "lucide-react";
import {
  Cell,
  Legend,
  LegendPayload,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

type TabType =
  | "overview"
  | "instructor"
  | "courseInfo"
  | "calendar"
  | "resources"
  | "grading"
  | "policies"
  | "moreInfo";

type PolicyTab =
  | "communication"
  | "aiTools"
  | "deadlines"
  | "attendance"
  | "disability"
  | "ethics"
  | "privacy"
  | "academicIntegrity";

type InstructorCourse = {
  id: string;
  code: string;
  title: string;
  semester?: string | null;
  deliveryMethod?: string | null;
  description?: string | null;
  joinKey?: string | null;
  instructor?: {
    name?: string;
    email?: string;
  } | null;
  deadlines?: {
    id: string;
    title?: string | null;
    dueDate?: string | null;
    type?: string | null;
    description?: string | null;
  }[];
  syllabus?: Syllabus | null;
};

type AnnouncementItem = {
  id: string;
  title?: string | null;
  content?: string | null;
  type?: string | null;
  createdAt?: string | null;
  courseId?: string | null;
};

type ResourceFile = {
  id: string;
  name: string;
  type: string;
  size: string;
  uploadDate: string;
  status: CourseAiResource["status"] | "LEGACY";
  chunkCount: number;
  errorMessage?: string | null;
  isAiResource: boolean;
};

type DisplayWeek = {
  id: string;
  weekNo: number;
  place?: string | null;
  topic: string;
  details?: string | null;
  todo?: string | null;
};

type WeekFormState = {
  weekNo: string;
  topic: string;
  details: string;
  todo: string;
};

type GradingFormRow = {
  id: string;
  assignment: string;
  description: string;
  scoring: string;
  weight: string;
};

const emptyWeekForm: WeekFormState = {
  weekNo: "",
  topic: "",
  details: "",
  todo: "",
};

type OverrideSection =
  | "instructorInfo"
  | "courseDetails"
  | "prerequisites"
  | "courseObjectives"
  | "resources"
  | "grading"
  | "policy"
  | "learningOutcomes"
  | "contribution"
  | "courseStructure";

type OverrideEditorState = {
  section: OverrideSection;
  title: string;
  fields: Array<{
    key: string;
    label: string;
    type?: "input" | "textarea" | "select";
    options?: string[];
  }>;
};

type GradingPieLabelProps = {
  name?: string;
  value?: number;
};

type GradingLegendPayload = LegendPayload & {
  payload?: {
    value?: number;
  };
};

const tabs: { id: TabType; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Overview", icon: FileText },
  { id: "instructor", label: "Instructor Info", icon: MessageSquare },
  { id: "courseInfo", label: "Course Info", icon: FileText },
  { id: "calendar", label: "Course Calendar", icon: Calendar },
  { id: "resources", label: "Resources", icon: FileText },
  { id: "grading", label: "Grading", icon: FileText },
  { id: "policies", label: "Policies", icon: FileText },
  { id: "moreInfo", label: "More Info", icon: FileText },
];

const gradingColors = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444"];

const policyTopics: { id: PolicyTab; label: string; group: "policies" | "ethics" }[] = [
  { id: "communication", label: "Communication Channels and Methods", group: "policies" },
  { id: "aiTools", label: "Usage of AI & Digital Tools", group: "policies" },
  { id: "deadlines", label: "Deadlines", group: "policies" },
  { id: "attendance", label: "Attendance", group: "policies" },
  { id: "disability", label: "Disabled Student Support", group: "policies" },
  { id: "ethics", label: "Oral and Written Communication Ethics", group: "policies" },
  { id: "privacy", label: "Privacy and Copyright", group: "policies" },
  { id: "academicIntegrity", label: "Academic Integrity, Cheating and Plagiarism", group: "ethics" },
];

const policyOverrideKeyByTab: Record<
  PolicyTab,
  keyof NonNullable<SyllabusManualOverrides["policySections"]>
> = {
  communication: "communication",
  aiTools: "aiDigitalTools",
  deadlines: "deadlines",
  attendance: "attendance",
  disability: "disabledStudentSupport",
  ethics: "communicationEthics",
  privacy: "privacyCopyright",
  academicIntegrity: "academicIntegrity",
};

const isValidExternalUrl = (value?: string | null) => {
  if (!value) return false;

  try {
    if (value.includes("...")) return false;
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname !== "..." &&
      !url.hostname.includes("..")
    );
  } catch {
    return false;
  }
};

const formatDate = (value?: string | null) => {
  if (!value) return "Not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const formatShortDate = (value?: string | null) => {
  if (!value) return "Not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

const formatTime = (value?: string | null) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const normalizeType = (type?: string | null) => {
  if (!type) return "Info";

  return type
    .toLowerCase()
    .split("_")
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1))
    .join(" ");
};

const getDeadlineBadgeClass = (type?: string | null) => {
  const normalized = type?.toUpperCase();

  if (normalized === "QUIZ") return "bg-yellow-100 text-yellow-700";
  if (normalized === "EXAM") return "bg-red-100 text-red-600";
  if (normalized === "PROJECT") return "bg-purple-100 text-purple-700";
  if (normalized === "ASSIGNMENT") return "bg-blue-100 text-blue-600";

  return "bg-slate-100 text-slate-600";
};

const getAnnouncementStyles = (type?: string | null) => {
  const normalized = type?.toUpperCase();

  if (normalized === "URGENT") {
    return {
      bg: "bg-red-50",
      stripe: "bg-red-500",
      badge: "border-red-400 text-red-500",
    };
  }

  if (normalized === "EVENT") {
    return {
      bg: "bg-yellow-50",
      stripe: "bg-orange-500",
      badge: "border-orange-400 text-orange-500",
    };
  }

  return {
    bg: "bg-blue-50",
    stripe: "bg-blue-500",
    badge: "border-blue-500 text-blue-500",
  };
};

const getLabeledRows = (value?: string | null) => {
  if (!value) return [];

  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const cleaned = line.replace(/^[-•]\s*/, "");
      const [label, ...rest] = cleaned.split(":");

      return {
        id: `${label}-${index}`,
        label: rest.length > 0 ? label.trim() : `Component ${index + 1}`,
        value: rest.length > 0 ? rest.join(":").trim() : cleaned,
      };
    });
};

const extractPercentValue = (value?: string | null) => {
  if (!value) return 0;

  const match = value.match(/(\d+(?:\.\d+)?)\s*%/);
  return match ? Number(match[1]) : 0;
};

const getGradingDisplayParts = (value?: string | null) => {
  const rawValue = value?.trim() || "";
  const [descriptionPart, scoringPart, weightPart] = rawValue
    .split("|")
    .map((part) => part.trim());
  const detectedPercent = extractPercentValue(rawValue);
  const description =
    descriptionPart.replace(/\(?\d+(?:\.\d+)?\s*%\)?/g, "").trim() ||
    "Assessment component from the syllabus";
  const scoring = scoringPart || "0-100 points";
  const weight = weightPart || (detectedPercent > 0 ? `${detectedPercent}%` : rawValue);

  return { description, scoring, weight };
};

const getGradingChartData = (
  rows: Array<{ id: string; label: string; value: string }>
) => {
  const rowsWithPercent = rows
    .map((row, index) => ({
      name: row.label,
      value: extractPercentValue(row.value),
      color: gradingColors[index % gradingColors.length],
    }))
    .filter((item) => item.value > 0);

  if (rowsWithPercent.length > 0) return rowsWithPercent;

  return rows.map((row, index) => ({
    name: row.label,
    value: Math.round(100 / Math.max(rows.length, 1)),
    color: gradingColors[index % gradingColors.length],
  }));
};

const getFileType = (fileName?: string | null) => {
  if (!fileName || !fileName.includes(".")) return "file";
  return fileName.split(".").pop()?.toLowerCase() || "file";
};

const formatFileSize = (sizeBytes?: number | null) => {
  if (!sizeBytes || sizeBytes <= 0) return "Unknown";
  if (sizeBytes < 1024 * 1024) return `${Math.round(sizeBytes / 1024)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getResourceStatusClass = (status: ResourceFile["status"]) => {
  if (status === "READY") return "bg-emerald-100 text-emerald-700";
  if (status === "PROCESSING") return "bg-amber-100 text-amber-700";
  if (status === "FAILED") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-600";
};

const getResourceStatusLabel = (status: ResourceFile["status"]) => {
  if (status === "READY") return "Ready";
  if (status === "PROCESSING") return "Processing";
  if (status === "FAILED") return "Failed";
  return "Document";
};

const formatAiErrorMessage = (message: string) => {
  if (
    message.includes("AI provider is not reachable") ||
    message.includes("AI_BASE_URL") ||
    message.includes("local model server")
  ) {
    return "AI indexing is not available right now. Please start the AI service and upload again.";
  }

  return message;
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
    if (typeof message === "string") return formatAiErrorMessage(message);
  }

  return fallback;
};

const getWeekPlace = (weekNo: number) =>
  [3, 6, 9, 12].includes(weekNo) ? "Online" : "F2F";

const getCalendarTone = (topic?: string | null, assignment?: string | null) => {
  const value = `${topic || ""} ${assignment || ""}`.toLowerCase();

  if (value.includes("final")) {
    return {
      row: "bg-red-50",
      topic: "text-red-900 font-semibold",
      todo: "text-red-700",
      assignment: "text-red-900 font-bold",
    };
  }

  if (value.includes("midterm")) {
    return {
      row: "bg-orange-50",
      topic: "text-orange-900 font-semibold",
      todo: "text-orange-700",
      assignment: "text-orange-900 font-bold",
    };
  }

  if (value.includes("quiz")) {
    return {
      row: "",
      topic: "text-slate-700",
      todo: "text-slate-600",
      assignment: "text-[rgb(45,175,24)] font-medium",
    };
  }

  if (value.includes("assignment")) {
    return {
      row: "",
      topic: "text-slate-700",
      todo: "text-slate-600",
      assignment: "text-slate-900 font-medium",
    };
  }

  if (value.includes("add-drop")) {
    return {
      row: "",
      topic: "text-slate-700",
      todo: "text-slate-600",
      assignment: "text-amber-700 font-medium",
    };
  }

  return {
    row: "",
    topic: "text-slate-700",
    todo: "text-slate-600",
    assignment: "text-slate-600",
  };
};

const renderMultilineText = (value?: string | null) => {
  if (!value) {
    return (
      <p className="text-sm text-slate-500">
        No information has been published yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {value
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, index) => (
          <p
            key={`${line}-${index}`}
            className="text-sm leading-relaxed text-slate-700"
          >
            {line}
          </p>
        ))}
    </div>
  );
};

const renderSyllabusLoading = () => (
  <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
    Loading syllabus...
  </div>
);

const noIndexedResourcesMessage =
  "No indexed resources yet. Upload a syllabus PDF to enable AI answers.";

const hasCompleteCourseWeeks = (weeks: Array<{ weekNo?: number | null }>) =>
  Array.from({ length: 15 }, (_, index) => index + 1).every((weekNo) =>
    weeks.some((week) => week.weekNo === weekNo)
  );

const createFinalExamWeek = (): DisplayWeek => ({
  id: "auto-final-week-16",
  weekNo: 16,
  place: null,
  topic: "Final Exam Week",
  details: "Final exam schedule will be announced by the university.",
  todo: "Review all chapters and prepare for the final exam.",
});

const isGeneratedWeek = (week: DisplayWeek) =>
  String(week.id).startsWith("ai-week-") ||
  String(week.id).startsWith("auto-final-week-");

export default function InstructorCourseDetailPage() {
  const params = useParams();
  const courseId = params.id as string;

  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [activePolicyTab, setActivePolicyTab] =
    useState<PolicyTab>("communication");
  const [course, setCourse] = useState<InstructorCourse | null>(null);
  const [loadingCourse, setLoadingCourse] = useState(true);
  const [syllabus, setSyllabus] = useState<Syllabus | null>(null);
  const [loadingSyllabus, setLoadingSyllabus] = useState(true);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [copiedJoinKey, setCopiedJoinKey] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [aiResources, setAiResources] = useState<CourseAiResource[]>([]);
  const [loadingAiResources, setLoadingAiResources] = useState(true);
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(
    null
  );
  const [uploadingResource, setUploadingResource] = useState(false);
  const [resourceUploadError, setResourceUploadError] = useState("");
  const [resourceUploadMessage, setResourceUploadMessage] = useState("");
  const [deletingResourceIds, setDeletingResourceIds] = useState<Set<string>>(
    new Set()
  );
  const [aiSummary, setAiSummary] = useState<CourseAiSyllabusSummary | null>(
    null
  );
  const [loadingAiSummary, setLoadingAiSummary] = useState(false);
  const [showWeekModal, setShowWeekModal] = useState(false);
  const [editingWeek, setEditingWeek] = useState<DisplayWeek | null>(null);
  const [weekForm, setWeekForm] = useState<WeekFormState>(emptyWeekForm);
  const [savingWeek, setSavingWeek] = useState(false);
  const [deletingWeekId, setDeletingWeekId] = useState<string | null>(null);
  const [weekMessage, setWeekMessage] = useState("");
  const [overrideEditor, setOverrideEditor] =
    useState<OverrideEditorState | null>(null);
  const [overrideForm, setOverrideForm] = useState<Record<string, string>>({});
  const [gradingFormRows, setGradingFormRows] = useState<GradingFormRow[]>([]);
  const [savingOverride, setSavingOverride] = useState(false);
  const [overrideMessage, setOverrideMessage] = useState("");

  const handleCopyJoinKey = async () => {
    if (!course?.joinKey) return;

    try {
      await navigator.clipboard.writeText(course.joinKey);
      setCopiedJoinKey(true);
      setTimeout(() => setCopiedJoinKey(false), 1800);
    } catch {
      setCopiedJoinKey(false);
    }
  };

  useEffect(() => {
    const fetchCourse = async () => {
      try {
        const data = await courseService.getCourseById(courseId);
        setCourse(data);
      } catch {
        setCourse(null);
      } finally {
        setLoadingCourse(false);
      }
    };

    fetchCourse();
  }, [courseId]);

  useEffect(() => {
    const fetchSyllabus = async () => {
      try {
        const data = await syllabusService.getSyllabusByCourseId(courseId);
        setSyllabus(data);
      } catch {
        setSyllabus(null);
      } finally {
        setLoadingSyllabus(false);
      }
    };

    fetchSyllabus();
  }, [courseId]);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const response = await api.get("/announcements");
        const items = Array.isArray(response.data) ? response.data : [];
        setAnnouncements(
          items.filter((item: AnnouncementItem) => item.courseId === courseId)
        );
      } catch {
        setAnnouncements([]);
      }
    };

    fetchAnnouncements();
  }, [courseId]);

  useEffect(() => {
    const fetchAiResources = async () => {
      try {
        const data = await aiService.getCourseResources(courseId);
        setAiResources(data);
      } catch {
        setAiResources([]);
      } finally {
        setLoadingAiResources(false);
      }
    };

    fetchAiResources();
  }, [courseId]);

  useEffect(() => {
    if (!aiResources.some((resource) => resource.status === "PROCESSING")) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      try {
        const data = await aiService.getCourseResources(courseId);
        setAiResources(data);
      } catch {
        window.clearInterval(intervalId);
      }
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [aiResources, courseId]);

  const hasProcessingAiResource = aiResources.some(
    (resource) => resource.status === "PROCESSING"
  );
  const readyAiResourceKey = aiResources
    .filter((resource) => resource.status === "READY")
    .map(
      (resource) =>
        `${resource.resourceId}:${resource.updatedAt}:${resource.chunkCount}`
    )
    .join("|");
  const isAiSyllabusLoading =
    loadingAiSummary || (hasProcessingAiResource && !aiSummary);

  useEffect(() => {
    if (hasProcessingAiResource) return;

    if (!readyAiResourceKey) {
      setAiSummary(null);
      return;
    }

    const fetchAiSummary = async () => {
      try {
        setLoadingAiSummary(true);
        const data = await aiService.getSyllabusSummary(courseId);
        setAiSummary(data);
      } catch {
        setAiSummary(null);
      } finally {
        setLoadingAiSummary(false);
      }
    };

    fetchAiSummary();
  }, [courseId, hasProcessingAiResource, readyAiResourceKey]);

  const resolvedSyllabus = syllabus ?? course?.syllabus ?? null;
  const syllabusDescription =
    aiSummary?.courseSummary || getSyllabusDescriptionText(resolvedSyllabus);
  const syllabusDocument = getSyllabusDocumentMetadata(resolvedSyllabus);
  const sortedDeadlines = [...(course?.deadlines || [])].sort((a, b) => {
    const first = a.dueDate ? new Date(a.dueDate).getTime() : 0;
    const second = b.dueDate ? new Date(b.dueDate).getTime() : 0;
    return first - second;
  });

  const visibleAnnouncements = announcements.slice(0, 2);
  const visibleDeadlines = sortedDeadlines.slice(0, 3);
  const savedGradingText = resolvedSyllabus?.grading || "";
  const savedGradingLooksOverExtracted =
    /See policy|Grading note|attendance is not going to be graded|relative grading system/i.test(
      savedGradingText
    );
  const manualGradingRows = savedGradingLooksOverExtracted
    ? []
    : getLabeledRows(savedGradingText);
  const aiGradingRows =
    aiSummary?.gradingItems.map((item, index) => ({
      id: `${item.label || "grading"}-${index}`,
      label: item.label || `Component ${index + 1}`,
      value: item.description?.includes("|")
        ? item.description
        : [item.description, item.value].filter(Boolean).join(" | "),
    })) ?? [];
  const gradingRows =
    manualGradingRows.length > 0 ? manualGradingRows : aiGradingRows;
  const gradingChartData = getGradingChartData(gradingRows);
  const readyAiResources = aiResources.filter(
    (resource) => resource.status === "READY"
  );
  const aiResourcesText =
    aiSummary?.resources?.length ? aiSummary.resources.join("\n") : "";
  const readyResourceNamesText = readyAiResources
    .map((resource) => `Uploaded PDF: ${resource.resourceName}`)
    .join("\n");
  const savedResourcesText = resolvedSyllabus?.resources || "";
  const savedResourcesLooksOverExtracted =
    /Course Learning Outcomes|Teaching Methods and Techniques Used in the Course|Course Policies/i.test(
      savedResourcesText
    );
  const displayedResourcesText =
    savedResourcesLooksOverExtracted && aiResourcesText
      ? aiResourcesText
      : savedResourcesText || aiResourcesText || readyResourceNamesText;
  const aiPoliciesText =
    aiSummary?.policies?.length ? aiSummary.policies.join("\n") : "";
  const savedWeekItems: DisplayWeek[] =
    resolvedSyllabus?.weeks?.map((week) => ({
      id: week.id,
      weekNo: week.weekNo,
      place: week.place,
      topic: week.topic,
      details: week.details,
      todo: week.todo,
    })) ?? [];
  const aiWeekItems: DisplayWeek[] = (aiSummary?.weeklyTopics ?? []).map(
    (week, index) => ({
      id: `ai-week-${week.weekNo ?? index + 1}`,
      weekNo: week.weekNo ?? index + 1,
      place: week.place,
      topic: week.topic || "Not published yet",
      details: week.details,
      todo: week.todo,
    })
  );
  const shouldShowFinalExamWeek =
    hasCompleteCourseWeeks(savedWeekItems) || hasCompleteCourseWeeks(aiWeekItems);
  const calendarWeekCount = shouldShowFinalExamWeek ? 16 : 15;
  const displayedWeeks: DisplayWeek[] = Array.from(
    { length: calendarWeekCount },
    (_, index) => {
      const weekNo = index + 1;
      const savedWeek = savedWeekItems.find((week) => week.weekNo === weekNo);
      const aiWeek = aiWeekItems.find((week) => week.weekNo === weekNo);

      if (weekNo === 16 && !savedWeek && !aiWeek) {
        return createFinalExamWeek();
      }

      return (
        savedWeek ||
        aiWeek || {
          id: `empty-week-${weekNo}`,
          weekNo,
          place: null,
          topic: "Not published yet",
          details: "",
          todo: "",
        }
      );
    }
  );

  const syncWeekState = (weeks: DisplayWeek[]) => {
    const sortedWeeks = [...weeks].sort((a, b) => a.weekNo - b.weekNo);

    setSyllabus((prev) =>
      prev
        ? {
            ...prev,
            weeks: sortedWeeks,
          }
        : prev
    );

    setCourse((prev) =>
      prev?.syllabus
        ? {
            ...prev,
            syllabus: {
              ...prev.syllabus,
              weeks: sortedWeeks,
            },
          }
        : prev
    );
  };

  const openCreateWeekModal = () => {
    if (!resolvedSyllabus?.id) {
      setWeekMessage("Create or upload a syllabus before adding weekly topics.");
      return;
    }

    const savedWeekNos = new Set(savedWeekItems.map((week) => week.weekNo));
    const nextWeekNo = Array.from({ length: 16 }, (_, index) => index + 1).find(
      (weekNo) => !savedWeekNos.has(weekNo)
    );

    if (!nextWeekNo) {
      setWeekMessage("All 16 calendar weeks already exist.");
      return;
    }

    setEditingWeek(null);
    setWeekForm({
      ...emptyWeekForm,
      weekNo: String(nextWeekNo),
    });
    setWeekMessage("");
    setShowWeekModal(true);
  };

  const openEditWeekModal = (week: DisplayWeek) => {
    if (!resolvedSyllabus?.id || isGeneratedWeek(week)) {
      setWeekMessage("Generated weeks cannot be edited directly.");
      return;
    }

    setEditingWeek(week);
    setWeekForm({
      weekNo: String(week.weekNo),
      topic: week.topic || "",
      details: week.details || "",
      todo: week.todo || "",
    });
    setWeekMessage("");
    setShowWeekModal(true);
  };

  const closeWeekModal = () => {
    if (savingWeek) return;
    setShowWeekModal(false);
    setEditingWeek(null);
    setWeekForm(emptyWeekForm);
  };

  const handleWeekSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!resolvedSyllabus?.id) {
      setWeekMessage("Create or upload a syllabus before saving weeks.");
      return;
    }

    const parsedWeekNo = Number(weekForm.weekNo);

    if (!Number.isInteger(parsedWeekNo) || parsedWeekNo < 1) {
      setWeekMessage("Week number must be a positive number.");
      return;
    }

    if (!weekForm.topic.trim()) {
      setWeekMessage("Topic is required.");
      return;
    }

    try {
      setSavingWeek(true);
      setWeekMessage("");

      const payload = {
        weekNo: parsedWeekNo,
        topic: weekForm.topic.trim(),
        details: weekForm.details.trim() || undefined,
        todo: weekForm.todo.trim() || undefined,
      };

      if (editingWeek) {
        const updated = await syllabusService.updateWeek(
          resolvedSyllabus.id,
          editingWeek.id,
          payload
        );

        syncWeekState(
          displayedWeeks.map((week) =>
            week.id === updated.id ? updated : week
          )
        );
        setWeekMessage("Week updated successfully.");
      } else {
        const created = await syllabusService.createWeek(
          resolvedSyllabus.id,
          payload
        );

        syncWeekState([...displayedWeeks, created]);
        setWeekMessage("Week added successfully.");
      }

      closeWeekModal();
    } catch (error) {
      console.error("Week save error:", error);
      setWeekMessage("Week could not be saved.");
    } finally {
      setSavingWeek(false);
    }
  };

  const handleDeleteWeek = async (week: DisplayWeek) => {
    if (!resolvedSyllabus?.id || isGeneratedWeek(week)) {
      setWeekMessage("Generated weeks cannot be deleted directly.");
      return;
    }

    const confirmed = window.confirm(
      `Delete Week ${week.weekNo}? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setDeletingWeekId(week.id);
      setWeekMessage("");

      await syllabusService.deleteWeek(resolvedSyllabus.id, week.id);

      syncWeekState(displayedWeeks.filter((item) => item.id !== week.id));
      setWeekMessage("Week deleted successfully.");
    } catch (error) {
      console.error("Week delete error:", error);
      setWeekMessage("Week could not be deleted.");
    } finally {
      setDeletingWeekId(null);
    }
  };

  const handleDeleteSelectedResources = async () => {
    const selectedResourceFiles = resourceFiles.filter(
      (file) => selectedFiles.has(file.id) && file.isAiResource
    );

    if (selectedResourceFiles.length === 0) {
      setResourceUploadError("Only AI-indexed PDF resources can be deleted from this list.");
      return;
    }

    const confirmed = window.confirm(
      `Delete ${selectedResourceFiles.length} selected AI document(s)? This action cannot be undone.`
    );

    if (!confirmed) return;

    const selectedIds = new Set(selectedResourceFiles.map((file) => file.id));

    setDeletingResourceIds((current) => {
      const next = new Set(current);
      selectedIds.forEach((id) => next.add(id));
      return next;
    });
    setResourceUploadError("");
    setResourceUploadMessage("");

    try {
      await Promise.all(
        selectedResourceFiles.map((file) =>
          aiService.deleteCourseResource(courseId, file.id)
        )
      );

      setAiResources((current) =>
        current.filter((resource) => !selectedIds.has(resource.resourceId))
      );
      setSelectedFiles(new Set());
      setAiSummary(null);
      setResourceUploadMessage(
        `${selectedResourceFiles.length} document(s) deleted.`
      );
    } catch (error) {
      setResourceUploadError(
        getApiErrorMessage(error, "Selected documents could not be deleted.")
      );
    } finally {
      setDeletingResourceIds((current) => {
        const next = new Set(current);
        selectedIds.forEach((id) => next.delete(id));
        return next;
      });
    }
  };

  const resourceFiles: ResourceFile[] = [
    ...aiResources.map((resource) => ({
      id: resource.resourceId,
      name: resource.resourceName,
      type: getFileType(resource.resourceName),
      size: formatFileSize(resource.sizeBytes),
      uploadDate: formatShortDate(resource.createdAt),
      status: resource.status,
      chunkCount: resource.chunkCount,
      errorMessage: resource.errorMessage,
      isAiResource: true,
    })),
    ...(syllabusDocument.fileName &&
    !aiResources.some(
      (resource) => resource.resourceName === syllabusDocument.fileName
    )
      ? [
          {
            id: "syllabus-document",
            name: syllabusDocument.fileName,
            type: getFileType(syllabusDocument.fileName),
            size:
              typeof syllabusDocument.sizeKb === "number"
                ? `${syllabusDocument.sizeKb} KB`
                : "Uploaded file",
            uploadDate: formatShortDate(
              resolvedSyllabus?.documentUploadedAt || resolvedSyllabus?.updatedAt
            ),
            status: "LEGACY" as const,
            chunkCount: 0,
            errorMessage: null,
            isAiResource: false,
          },
        ]
      : []),
  ];
  const failedResourceFiles = resourceFiles.filter(
    (file) => file.status === "FAILED"
  );

  const filteredResourceFiles = resourceFiles
    .filter((file) =>
      file.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "type") return a.type.localeCompare(b.type);
      if (sortBy === "size") return a.size.localeCompare(b.size);
      return a.uploadDate.localeCompare(b.uploadDate);
    });

  const toggleFileSelection = (fileId: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);

      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }

      return next;
    });
  };

  const toggleSelectAll = () => {
    if (
      filteredResourceFiles.length > 0 &&
      selectedFiles.size === filteredResourceFiles.length
    ) {
      setSelectedFiles(new Set());
      return;
    }

    setSelectedFiles(new Set(filteredResourceFiles.map((file) => file.id)));
  };

  const handleResourceUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedUploadFile) {
      setResourceUploadError("Please choose a PDF file first.");
      return;
    }

    const isPdf =
      selectedUploadFile.type === "application/pdf" ||
      selectedUploadFile.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      setResourceUploadError("Only PDF files can be indexed for AI.");
      return;
    }

    setUploadingResource(true);
    setResourceUploadError("");
    setResourceUploadMessage("");

    try {
      const uploadedResource = await aiService.uploadCourseResource(
        courseId,
        selectedUploadFile
      );
      setAiResources((current) => [
        uploadedResource,
        ...current.filter(
          (resource) => resource.resourceId !== uploadedResource.resourceId
        ),
      ]);
      setSelectedUploadFile(null);
      event.currentTarget.reset();
      setResourceUploadMessage("Document uploaded. AI indexing is running.");
    } catch (error) {
      setResourceUploadError(
        getApiErrorMessage(error, "Document could not be uploaded.")
      );
    } finally {
      setUploadingResource(false);
    }
  };

  const handleDeleteResource = async (file: ResourceFile) => {
    if (!file.isAiResource || deletingResourceIds.has(file.id)) return;

    const confirmed = window.confirm(
      `Delete "${file.name}" and remove it from AI search?`
    );

    if (!confirmed) return;

    setDeletingResourceIds((current) => new Set(current).add(file.id));
    setResourceUploadError("");
    setResourceUploadMessage("");

    try {
      await aiService.deleteCourseResource(courseId, file.id);
      setAiResources((current) =>
        current.filter((resource) => resource.resourceId !== file.id)
      );
      setSelectedFiles((current) => {
        const next = new Set(current);
        next.delete(file.id);
        return next;
      });
      setAiSummary(null);
      setResourceUploadMessage("Document deleted.");
    } catch (error) {
      setResourceUploadError(
        getApiErrorMessage(error, "Document could not be deleted.")
      );
    } finally {
      setDeletingResourceIds((current) => {
        const next = new Set(current);
        next.delete(file.id);
        return next;
      });
    }
  };

  const splitSummaryText = (value?: string | null) =>
    value
      ?.split(/\n|(?<=\.)\s+(?=[A-Z])/)
      .map((line) => line.trim())
      .filter(Boolean) ?? [];
  const getSummaryParagraphs = (value: string | undefined, fallback: string[]) => {
    const extracted = splitSummaryText(value);
    return extracted.length ? extracted : fallback;
  };
  const aiInstructorInfo = aiSummary?.instructorInfo;
  const aiCourseInfo = aiSummary?.courseInfo;
  const aiPolicySections = aiSummary?.policySections;
  const manualOverrides = resolvedSyllabus?.manualOverrides ?? {};
  const displayedInstructorInfo = {
    office:
      manualOverrides.instructorInfo?.office || aiInstructorInfo?.office || "",
    officeHours:
      manualOverrides.instructorInfo?.officeHours ||
      aiInstructorInfo?.officeHours ||
      "",
    cvLink:
      manualOverrides.instructorInfo?.cvLink || aiInstructorInfo?.cvLink || "",
  };
  const displayedCourseInfo = {
    credits: manualOverrides.courseInfo?.credits || aiCourseInfo?.credits || "",
    classSchedule:
      manualOverrides.courseInfo?.classSchedule ||
      aiCourseInfo?.classSchedule ||
      "",
    classroom:
      manualOverrides.courseInfo?.classroom || aiCourseInfo?.classroom || "",
    deliveryMethod:
      course?.deliveryMethod ||
      manualOverrides.courseInfo?.deliveryMethod ||
      "In-Person",
    courseType:
      manualOverrides.courseInfo?.courseType || aiCourseInfo?.courseType || "",
    prerequisites:
      manualOverrides.courseInfo?.prerequisites ||
      aiCourseInfo?.prerequisites ||
      "",
    courseObjectives:
      manualOverrides.courseInfo?.courseObjectives ||
      aiCourseInfo?.courseObjectives ||
      "",
  };
  const displayedPolicySections = {
    communication:
      manualOverrides.policySections?.communication ||
      aiPolicySections?.communication ||
      "",
    aiDigitalTools:
      manualOverrides.policySections?.aiDigitalTools ||
      aiPolicySections?.aiDigitalTools ||
      "",
    deadlines:
      manualOverrides.policySections?.deadlines ||
      aiPolicySections?.deadlines ||
      "",
    attendance:
      manualOverrides.policySections?.attendance ||
      aiPolicySections?.attendance ||
      "",
    disabledStudentSupport:
      manualOverrides.policySections?.disabledStudentSupport ||
      aiPolicySections?.disabledStudentSupport ||
      "",
    communicationEthics:
      manualOverrides.policySections?.communicationEthics ||
      aiPolicySections?.communicationEthics ||
      "",
    privacyCopyright:
      manualOverrides.policySections?.privacyCopyright ||
      aiPolicySections?.privacyCopyright ||
      "",
    academicIntegrity:
      manualOverrides.policySections?.academicIntegrity ||
      aiPolicySections?.academicIntegrity ||
      "",
  };
  const displayedMoreInfo = {
    learningOutcomes:
      manualOverrides.moreInfo?.learningOutcomes ||
      aiSummary?.moreInfo?.learningOutcomes ||
      [],
    contributionToProgram:
      manualOverrides.moreInfo?.contributionToProgram ||
      aiSummary?.moreInfo?.contributionToProgram ||
      "",
    courseStructure:
      manualOverrides.moreInfo?.courseStructure ||
      aiSummary?.moreInfo?.courseStructure ||
      "",
    teachingMethods:
      manualOverrides.moreInfo?.teachingMethods ||
      aiSummary?.moreInfo?.teachingMethods ||
      [],
  };
  const manualPolicyText = resolvedSyllabus?.policies || aiPoliciesText;

  const policySections: Record<
    PolicyTab,
    {
      title: string;
      paragraphs: string[];
      noteTone: "blue" | "amber" | "red";
      note: string;
    }
  > = {
    communication: {
      title: "Communication Channels and Methods",
      paragraphs: getSummaryParagraphs(
        displayedPolicySections.communication || manualPolicyText,
        [
            "Please use the university mail address for official course communication.",
            "All official course announcements will be posted through the course portal.",
            "Email responses can be expected within 24-48 hours during weekdays.",
        ],
      ),
      noteTone: "blue",
      note: "For urgent matters during office hours, in-person visits are preferred over email communication.",
    },
    aiTools: {
      title: "Usage of AI & Digital Tools",
      paragraphs: getSummaryParagraphs(displayedPolicySections.aiDigitalTools, [
        "Digital tools may be used only according to the instructor's syllabus policy.",
      ]),
      noteTone: "amber",
      note: "During exams and quizzes, all AI tools and digital assistance are prohibited unless explicitly stated otherwise.",
    },
    deadlines: {
      title: "Deadlines",
      paragraphs: getSummaryParagraphs(displayedPolicySections.deadlines, [
        "All assignments must be submitted by the stated due date unless otherwise specified.",
        "Late submissions may be penalized according to the instructor's syllabus policy.",
        "Extension requests should be submitted before the deadline with valid justification.",
      ]),
      noteTone: "blue",
      note: "Plan ahead and start assignments early to avoid technical issues close to the deadline.",
    },
    attendance: {
      title: "Attendance",
      paragraphs: getSummaryParagraphs(displayedPolicySections.attendance, [
        "Regular attendance is expected and will be tracked throughout the semester.",
        "Students should notify the instructor in advance when they are unable to attend.",
      ]),
      noteTone: "red",
      note: "Repeated unexcused absences may affect participation and course performance.",
    },
    disability: {
      title: "Disabled Student Support",
      paragraphs: getSummaryParagraphs(displayedPolicySections.disabledStudentSupport, [
        "Students with disabilities are entitled to appropriate accommodations to ensure equal access to course materials and assessments.",
        "Please contact the university's Disability Support Services office to arrange accommodations.",
      ]),
      noteTone: "blue",
      note: "Accommodation requests will be handled confidentially and according to university policies.",
    },
    ethics: {
      title: "Oral and Written Communication Ethics",
      paragraphs: getSummaryParagraphs(displayedPolicySections.communicationEthics, [
        "All written and oral communications must be respectful, professional, and free from plagiarism.",
        "Proper citation is required for all external sources used in assignments.",
      ]),
      noteTone: "amber",
      note: "Collaborative work is encouraged, but all submissions must represent your own understanding and effort.",
    },
    privacy: {
      title: "Privacy and Copyright",
      paragraphs: getSummaryParagraphs(displayedPolicySections.privacyCopyright, [
        "Course materials are protected by copyright and are for personal educational use only.",
        "Recording lectures or sharing course materials outside the class without permission is prohibited.",
      ]),
      noteTone: "blue",
      note: "Respecting intellectual property rights is essential for maintaining academic integrity.",
    },
    academicIntegrity: {
      title: "Academic Integrity, Cheating and Plagiarism",
      paragraphs: getSummaryParagraphs(displayedPolicySections.academicIntegrity, [
        "Academic integrity is fundamental to the educational process.",
        "Cheating includes unauthorized use of materials during exams and submitting work that is not your own.",
        "Plagiarism is the use of another person's ideas, words, or work without proper attribution.",
      ]),
      noteTone: "red",
      note: "Violations of academic integrity may result in disciplinary action according to university policies.",
    },
  };

  const activePolicy = policySections[activePolicyTab];
  const noteStyles = {
    blue: "border-blue-500 bg-blue-50 text-blue-900",
    amber: "border-amber-500 bg-amber-50 text-amber-900",
    red: "border-red-500 bg-red-50 text-red-900",
  }[activePolicy.noteTone];

  const moreInfoLearningOutcomes = displayedMoreInfo.learningOutcomes.length
    ? displayedMoreInfo.learningOutcomes
    : syllabusDescription
      ? splitSummaryText(syllabusDescription)
      : [
        "Describe the role of this course in the broader academic program.",
        "Understand the core concepts, expectations, and weekly learning structure.",
        "Apply course knowledge through assignments, deadlines, and class activities.",
        "Use course resources, announcements, and feedback channels effectively.",
        course?.description ||
          "Demonstrate understanding of the course objectives and assessment structure.",
      ];
  const moreInfoLearningOutcomesText = moreInfoLearningOutcomes.join(" ");

  const courseStructureDescription =
    displayedMoreInfo.courseStructure ||
    "This course employs a variety of teaching and learning methods to ensure comprehensive understanding and practical application of course concepts.";
  const courseStructureItems = displayedMoreInfo.teachingMethods.length
    ? displayedMoreInfo.teachingMethods
    : [
        "Collaborative Learning",
        "Discussion",
        "Guest Speaker",
        "Lecture",
        "Observation",
        "Problem Solving",
        "Reading",
        "Technology-Enhanced Learning",
      ];

  const prerequisiteItems = splitSummaryText(displayedCourseInfo.prerequisites).length
    ? splitSummaryText(displayedCourseInfo.prerequisites)
    : [
        "Enrollment in the course workspace",
        "Review of the official syllabus",
        "Completion of required weekly tasks",
      ];

  const courseObjectiveItems = splitSummaryText(displayedCourseInfo.courseObjectives)
    .length
    ? splitSummaryText(displayedCourseInfo.courseObjectives).slice(0, 5)
    : [
        "Course objectives are defined by the instructor and official syllabus.",
      ];

  const syncSyllabusState = (updated: Syllabus) => {
    const normalized = {
      ...updated,
      weeks: updated.weeks ?? resolvedSyllabus?.weeks ?? [],
    };

    setSyllabus(normalized);
    setCourse((prev) =>
      prev
        ? {
            ...prev,
            syllabus: normalized,
          }
        : prev
    );
  };

  const openOverrideEditor = (section: OverrideSection) => {
    const makeInput = (key: string, label: string) => ({
      key,
      label,
      type: "input" as const,
    });
    const makeTextArea = (key: string, label: string) => ({
      key,
      label,
      type: "textarea" as const,
    });

    setOverrideMessage("");

    if (section === "instructorInfo") {
      setOverrideEditor({
        section,
        title: "Edit Instructor Information",
        fields: [
          makeInput("office", "Office"),
          makeInput("officeHours", "Office Hours"),
          makeInput("cvLink", "CV Link"),
        ],
      });
      setOverrideForm({
        office: displayedInstructorInfo.office,
        officeHours: displayedInstructorInfo.officeHours,
        cvLink: displayedInstructorInfo.cvLink,
      });
      return;
    }

    if (section === "courseDetails") {
      setOverrideEditor({
        section,
        title: "Edit Course Details",
        fields: [
          makeInput("credits", "Credits"),
          makeInput("classSchedule", "Class Schedule"),
          makeInput("classroom", "Classroom"),
          {
            key: "deliveryMethod",
            label: "Delivery Method",
            type: "select",
            options: ["In-Person", "Online", "Hybrid"],
          },
          makeInput("courseType", "Course Type"),
        ],
      });
      setOverrideForm({
        credits: displayedCourseInfo.credits,
        classSchedule: displayedCourseInfo.classSchedule,
        classroom: displayedCourseInfo.classroom,
        deliveryMethod: displayedCourseInfo.deliveryMethod,
        courseType: displayedCourseInfo.courseType,
      });
      return;
    }

    if (section === "prerequisites") {
      setOverrideEditor({
        section,
        title: "Edit Prerequisites",
        fields: [makeTextArea("prerequisites", "Prerequisites")],
      });
      setOverrideForm({
        prerequisites: displayedCourseInfo.prerequisites || prerequisiteItems.join("\n"),
      });
      return;
    }

    if (section === "courseObjectives") {
      setOverrideEditor({
        section,
        title: "Edit Course Objectives",
        fields: [makeTextArea("courseObjectives", "Course Objectives")],
      });
      setOverrideForm({
        courseObjectives:
          displayedCourseInfo.courseObjectives || courseObjectiveItems.join("\n"),
      });
      return;
    }

    if (section === "resources") {
      setOverrideEditor({
        section,
        title: "Edit Course Resources",
        fields: [makeTextArea("resources", "Course Resources")],
      });
      setOverrideForm({
        resources: displayedResourcesText,
      });
      return;
    }

    if (section === "grading") {
      const rows = gradingRows.length
        ? gradingRows.map((row, index) => {
            const parts = getGradingDisplayParts(row.value);
            return {
              id: `${row.id}-${index}`,
              assignment: row.label,
              description: parts.description,
              scoring: parts.scoring,
              weight: parts.weight,
            };
          })
        : [
            {
              id: `grading-${Date.now()}`,
              assignment: "",
              description: "",
              scoring: "0-100 points",
              weight: "",
            },
          ];

      setOverrideEditor({
        section,
        title: "Edit Grading Breakdown",
        fields: [],
      });
      setGradingFormRows(rows);
      setOverrideForm({});
      return;
    }

    if (section === "policy") {
      setOverrideEditor({
        section,
        title: `Edit ${activePolicy.title}`,
        fields: [makeTextArea("policyText", activePolicy.title)],
      });
      setOverrideForm({
        policyText: activePolicy.paragraphs.join("\n"),
      });
      return;
    }

    if (section === "learningOutcomes") {
      setOverrideEditor({
        section,
        title: "Edit Course Learning Outcomes",
        fields: [makeTextArea("learningOutcomes", "Learning Outcomes")],
      });
      setOverrideForm({
        learningOutcomes: moreInfoLearningOutcomes.join("\n"),
      });
      return;
    }

    if (section === "contribution") {
      setOverrideEditor({
        section,
        title: "Edit Contribution to Program",
        fields: [makeTextArea("contributionToProgram", "Contribution")],
      });
      setOverrideForm({
        contributionToProgram:
          displayedMoreInfo.contributionToProgram ||
          aiSummary?.courseSummary ||
          course?.description ||
          "",
      });
      return;
    }

    if (section === "courseStructure") {
      setOverrideEditor({
        section,
        title: "Edit Course Structure",
        fields: [
          makeTextArea("courseStructure", "Course Structure"),
          makeTextArea("teachingMethods", "Teaching Methods"),
        ],
      });
      setOverrideForm({
        courseStructure: courseStructureDescription,
        teachingMethods: courseStructureItems.join("\n"),
      });
      return;
    }
  };

  const closeOverrideEditor = () => {
    if (savingOverride) return;
    setOverrideEditor(null);
    setOverrideForm({});
    setGradingFormRows([]);
    setOverrideMessage("");
  };

  const updateOverrideForm = (key: string, value: string) => {
    setOverrideForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const updateGradingFormRow = (
    rowId: string,
    key: keyof Omit<GradingFormRow, "id">,
    value: string
  ) => {
    setGradingFormRows((rows) =>
      rows.map((row) => (row.id === rowId ? { ...row, [key]: value } : row))
    );
  };

  const addGradingFormRow = () => {
    setGradingFormRows((rows) => [
      ...rows,
      {
        id: `grading-${Date.now()}`,
        assignment: "",
        description: "",
        scoring: "0-100 points",
        weight: "",
      },
    ]);
  };

  const removeGradingFormRow = (rowId: string) => {
    setGradingFormRows((rows) =>
      rows.length > 1 ? rows.filter((row) => row.id !== rowId) : rows
    );
  };

  const parseOverrideList = (value: string) =>
    value
      .split(/\n/)
      .map((item) => item.trim())
      .filter(Boolean);

  const handleOverrideSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!overrideEditor) return;

    if (overrideEditor.section === "resources") {
      try {
        setSavingOverride(true);
        setOverrideMessage("");

        const resources = overrideForm.resources?.trim() || "";
        const updated = resolvedSyllabus?.id
          ? await syllabusService.updateSyllabus(resolvedSyllabus.id, {
              resources,
            })
          : await syllabusService.createSyllabus({
              courseId,
              title: `${course?.code || "Course"} Syllabus`,
              resources,
            });

        syncSyllabusState(updated);
        setOverrideEditor(null);
        setOverrideForm({});
      } catch (error) {
        console.error("Resources save error:", error);
        setOverrideMessage("Course resources could not be saved.");
      } finally {
        setSavingOverride(false);
      }
      return;
    }

    if (overrideEditor.section === "grading") {
      try {
        setSavingOverride(true);
        setOverrideMessage("");

        const grading = gradingFormRows
          .map((row) => ({
            assignment: row.assignment.trim(),
            description: row.description.trim(),
            scoring: row.scoring.trim(),
            weight: row.weight.trim(),
          }))
          .filter(
            (row) =>
              row.assignment || row.description || row.scoring || row.weight
          )
          .map((row, index) => {
            const assignment = row.assignment || `Component ${index + 1}`;
            const details = [row.description, row.scoring, row.weight]
              .filter(Boolean)
              .join(" | ");
            return `${assignment}: ${details}`;
          })
          .join("\n");

        const updated = resolvedSyllabus?.id
          ? await syllabusService.updateSyllabus(resolvedSyllabus.id, {
              grading,
            })
          : await syllabusService.createSyllabus({
              courseId,
              title: `${course?.code || "Course"} Syllabus`,
              grading,
            });

        syncSyllabusState(updated);
        setOverrideEditor(null);
        setOverrideForm({});
        setGradingFormRows([]);
      } catch (error) {
        console.error("Grading save error:", error);
        setOverrideMessage("Grading could not be saved.");
      } finally {
        setSavingOverride(false);
      }
      return;
    }

    const currentOverrides = resolvedSyllabus?.manualOverrides ?? {};
    const nextOverrides: SyllabusManualOverrides = {
      ...currentOverrides,
      instructorInfo: { ...currentOverrides.instructorInfo },
      courseInfo: { ...currentOverrides.courseInfo },
      policySections: { ...currentOverrides.policySections },
      moreInfo: { ...currentOverrides.moreInfo },
    };
    let courseDeliveryMethodToSave: string | null = null;

    if (overrideEditor.section === "instructorInfo") {
      nextOverrides.instructorInfo = {
        ...nextOverrides.instructorInfo,
        office: overrideForm.office?.trim() || undefined,
        officeHours: overrideForm.officeHours?.trim() || undefined,
        cvLink: overrideForm.cvLink?.trim() || undefined,
      };
    }

    if (overrideEditor.section === "courseDetails") {
      const nextDeliveryMethod =
        overrideForm.deliveryMethod?.trim() || "In-Person";
      nextOverrides.courseInfo = {
        ...nextOverrides.courseInfo,
        credits: overrideForm.credits?.trim() || undefined,
        classSchedule: overrideForm.classSchedule?.trim() || undefined,
        classroom: overrideForm.classroom?.trim() || undefined,
        deliveryMethod: nextDeliveryMethod,
        courseType: overrideForm.courseType?.trim() || undefined,
      };
      courseDeliveryMethodToSave = nextDeliveryMethod;
    }

    if (overrideEditor.section === "prerequisites") {
      nextOverrides.courseInfo = {
        ...nextOverrides.courseInfo,
        prerequisites: overrideForm.prerequisites?.trim() || undefined,
      };
    }

    if (overrideEditor.section === "courseObjectives") {
      nextOverrides.courseInfo = {
        ...nextOverrides.courseInfo,
        courseObjectives: overrideForm.courseObjectives?.trim() || undefined,
      };
    }

    if (overrideEditor.section === "policy") {
      const policyKey = policyOverrideKeyByTab[activePolicyTab];
      nextOverrides.policySections = {
        ...nextOverrides.policySections,
        [policyKey]: overrideForm.policyText?.trim() || undefined,
      };
    }

    if (overrideEditor.section === "learningOutcomes") {
      nextOverrides.moreInfo = {
        ...nextOverrides.moreInfo,
        learningOutcomes: parseOverrideList(overrideForm.learningOutcomes || ""),
      };
    }

    if (overrideEditor.section === "contribution") {
      nextOverrides.moreInfo = {
        ...nextOverrides.moreInfo,
        contributionToProgram:
          overrideForm.contributionToProgram?.trim() || undefined,
      };
    }

    if (overrideEditor.section === "courseStructure") {
      nextOverrides.moreInfo = {
        ...nextOverrides.moreInfo,
        courseStructure: overrideForm.courseStructure?.trim() || undefined,
        teachingMethods: parseOverrideList(overrideForm.teachingMethods || ""),
      };
    }

    try {
      setSavingOverride(true);
      setOverrideMessage("");

      if (
        course?.id &&
        courseDeliveryMethodToSave &&
        courseDeliveryMethodToSave !== course.deliveryMethod
      ) {
        const updatedCourse = await courseService.updateCourse(course.id, {
          deliveryMethod: courseDeliveryMethodToSave,
        });

        setCourse((prev) =>
          prev
            ? {
                ...prev,
                deliveryMethod: updatedCourse.deliveryMethod,
              }
            : prev
        );
      }

      const updated = resolvedSyllabus?.id
        ? await syllabusService.updateSyllabus(resolvedSyllabus.id, {
            manualOverrides: nextOverrides,
          })
        : await syllabusService.createSyllabus({
            courseId,
            title: `${course?.code || "Course"} Syllabus`,
            manualOverrides: nextOverrides,
          });

      syncSyllabusState(updated);
      setOverrideMessage("Changes saved.");
      setOverrideEditor(null);
      setOverrideForm({});
    } catch (error) {
      console.error("Manual override save error:", error);
      setOverrideMessage("Changes could not be saved.");
    } finally {
      setSavingOverride(false);
    }
  };

  return (
    <InstructorLayout>
      <div className="min-h-screen bg-slate-50">
        {loadingCourse ? (
          <div className="p-8">
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-500">
              Loading course...
            </div>
          </div>
        ) : !course ? (
          <div className="p-8">
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-500">
              Course not found.
            </div>
          </div>
        ) : (
          <>
            <header className="border-b border-slate-200 bg-white px-8 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-[24px] font-semibold text-slate-900">
                    {course.code} - {course.title}
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">
                    {course.instructor?.name || "Instructor User"} •{" "}
                    {course.semester || "Spring 2026"}
                  </p>
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

            <div className="border-b border-slate-200 bg-white px-8">
              <div className="flex gap-3 overflow-x-auto">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 transition-colors ${
                        isActive
                          ? "border-blue-500 font-semibold text-blue-600"
                          : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="text-[15px]">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <main className="px-8 py-8">
              <div className="mb-6 flex items-center justify-between gap-4">
                <Link
                  href="/instructor/courses"
                  className="flex items-center gap-2 text-slate-600 transition-colors hover:text-slate-900"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="text-sm font-medium">Back to Courses</span>
                </Link>

                <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-blue-600">
                    <KeyRound className="h-4 w-4" />
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-blue-900">
                      Course Key
                    </p>
                    <p className="text-xs text-blue-700">
                      Share with students
                    </p>
                  </div>

                  <code className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-bold tracking-widest text-blue-700">
                    {course.joinKey || "N/A"}
                  </code>

                  <button
                    type="button"
                    onClick={handleCopyJoinKey}
                    disabled={!course.joinKey}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
                  >
                    {copiedJoinKey ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>

              <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
                <Link
                  href={`/instructor/courses/${course.id}/syllabus/edit`}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 transition-colors hover:border-blue-300 hover:bg-blue-50"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Manage PDFs
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Upload course documents
                    </p>
                  </div>
                  <FileText className="h-5 w-5 text-blue-600" />
                </Link>

                <button
                  type="button"
                  onClick={() => setActiveTab("grading")}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 transition-colors hover:border-blue-300 hover:bg-blue-50"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      AI Syllabus
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Ask grading and policies
                    </p>
                  </div>
                  <Bot className="h-5 w-5 text-blue-600" />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("calendar")}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 transition-colors hover:border-blue-300 hover:bg-blue-50"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Weekly Topics
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Retrieved from PDF
                    </p>
                  </div>
                  <Calendar className="h-5 w-5 text-blue-600" />
                </button>
              </div>

              {activeTab === "overview" && (
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
                  <section className="rounded-xl border border-slate-200 bg-white p-6">
                    <div className="mb-5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bell className="h-5 w-5 text-blue-600" />
                        <h2 className="text-lg font-semibold text-slate-900">
                          Latest Announcements
                        </h2>
                      </div>

                      <Link
                        href={`/instructor/courses/${course.id}/announcements/new`}
                        className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                      >
                        <Plus className="h-4 w-4" />
                        New
                      </Link>
                    </div>

                    {visibleAnnouncements.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                        No announcements yet.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {visibleAnnouncements.map((announcement) => {
                          const styles = getAnnouncementStyles(announcement.type);

                          return (
                            <article
                              key={announcement.id}
                              className={`relative overflow-hidden rounded-lg shadow-sm ${styles.bg}`}
                            >
                              <div
                                className={`absolute bottom-0 left-0 top-0 w-1.5 ${styles.stripe}`}
                              />

                              <div className="py-4 pl-6 pr-5">
                                <div className="mb-3 flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <span
                                      className={`rounded-full border bg-white px-3 py-1 text-xs font-semibold uppercase ${styles.badge}`}
                                    >
                                      {announcement.type || "INFO"}
                                    </span>
                                    <span className="text-sm font-medium text-slate-600">
                                      {course.code}
                                    </span>
                                  </div>

                                  <Link
                                    href="/instructor/announcements"
                                    className="flex items-center gap-1 text-sm text-slate-400 transition-colors hover:text-slate-600"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                    Edit
                                  </Link>
                                </div>

                                <h3 className="mb-3 text-base font-bold text-slate-900">
                                  {announcement.title || "Announcement"}
                                </h3>

                                <div className="flex items-center gap-2 text-sm text-slate-500">
                                  <Calendar className="h-4 w-4" />
                                  <span>
                                    {formatDate(announcement.createdAt)}
                                    {formatTime(announcement.createdAt)
                                      ? ` - ${formatTime(announcement.createdAt)}`
                                      : ""}
                                  </span>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  <section className="rounded-xl border border-slate-200 bg-white p-6">
                    <div className="mb-5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-blue-600" />
                        <h2 className="text-lg font-semibold text-slate-900">
                          Upcoming Deadlines
                        </h2>
                      </div>

                      <Link
                        href={`/instructor/courses/${course.id}/deadlines/new`}
                        className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                      >
                        <Plus className="h-4 w-4" />
                        Add
                      </Link>
                    </div>

                    {visibleDeadlines.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                        No deadlines yet.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {visibleDeadlines.map((deadline) => (
                          <article
                            key={deadline.id}
                            className="rounded-lg border border-slate-200 bg-white p-4 transition-shadow hover:shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <h3 className="text-base font-semibold text-slate-900">
                                  {deadline.title || "Deadline"}
                                </h3>
                                <p className="mt-2 text-sm text-slate-500">
                                  {formatShortDate(deadline.dueDate)}
                                  {formatTime(deadline.dueDate)
                                    ? ` at ${formatTime(deadline.dueDate)}`
                                    : ""}
                                </p>
                              </div>

                              <span
                                className={`rounded-full px-3 py-1 text-sm font-semibold ${getDeadlineBadgeClass(
                                  deadline.type
                                )}`}
                              >
                                {normalizeType(deadline.type)}
                              </span>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>

                </div>
              )}

              {activeTab === "instructor" && (
                isAiSyllabusLoading ? (
                  renderSyllabusLoading()
                ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="p-8">
                    <div className="mb-6 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900">
                        Instructor Information
                      </h3>

                      <button
                        type="button"
                        onClick={() => openOverrideEditor("instructorInfo")}
                        className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <Edit2 className="h-4 w-4" />
                        <span className="text-sm">Edit</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <p className="mb-1 text-xs text-slate-500">Name</p>
                        <p className="text-sm font-medium text-slate-900">
                          {course.instructor?.name || "Instructor User"}
                        </p>
                      </div>

                      <div>
                        <p className="mb-1 text-xs text-slate-500">Office</p>
                        <p className="text-sm text-slate-900">
                          {displayedInstructorInfo.office || "Not published yet"}
                        </p>
                      </div>

                      <div>
                        <p className="mb-1 text-xs text-slate-500">
                          Email Address
                        </p>
                        <p className="text-sm text-blue-600">
                          {course.instructor?.email || "Not available"}
                        </p>
                      </div>

                      <div>
                        <p className="mb-1 text-xs text-slate-500">
                          Office Hours
                        </p>
                        <p className="text-sm text-slate-900">
                          {displayedInstructorInfo.officeHours ||
                            "Not published yet"}
                        </p>
                      </div>

                      <div className="col-span-2">
                        <p className="mb-1 text-xs text-slate-500">CV</p>
                        {isValidExternalUrl(displayedInstructorInfo.cvLink) ? (
                          <a
                            href={displayedInstructorInfo.cvLink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-blue-600 hover:underline"
                          >
                            View Curriculum Vitae
                          </a>
                        ) : (
                          <p className="text-sm text-slate-900">
                            {displayedInstructorInfo.cvLink ||
                              "Not published yet"}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                )
              )}

              {activeTab === "courseInfo" && (
                isAiSyllabusLoading ? (
                  renderSyllabusLoading()
                ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 p-8">
                    <div className="mb-6 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900">
                        Course Details
                      </h3>

                      <button
                        type="button"
                        onClick={() => openOverrideEditor("courseDetails")}
                        className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <Edit2 className="h-4 w-4" />
                        <span className="text-sm">Edit</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <p className="mb-1 text-xs text-slate-500">
                          Course Code
                        </p>
                        <p className="text-sm text-slate-900">{course.code}</p>
                      </div>

                      <div>
                        <p className="mb-1 text-xs text-slate-500">
                          Credits
                        </p>
                        <p className="text-sm text-slate-900">
                          {displayedCourseInfo.credits || "Not published yet"}
                        </p>
                      </div>

                      <div>
                        <p className="mb-1 text-xs text-slate-500">
                          Class Schedule
                        </p>
                        <p className="text-sm text-slate-900">
                          {displayedCourseInfo.classSchedule ||
                            "Not published yet"}
                        </p>
                      </div>

                      <div>
                        <p className="mb-1 text-xs text-slate-500">
                          Classroom
                        </p>
                        <p className="text-sm text-slate-900">
                          {displayedCourseInfo.classroom || "Not published yet"}
                        </p>
                      </div>

                      <div>
                        <p className="mb-1 text-xs text-slate-500">
                          Delivery Method
                        </p>
                        <p className="text-sm text-slate-900">
                          {displayedCourseInfo.deliveryMethod ||
                            "Not published yet"}
                        </p>
                      </div>

                      <div>
                        <p className="mb-1 text-xs text-slate-500">
                          Course Type
                        </p>
                        <p className="text-sm text-slate-900">
                          {displayedCourseInfo.courseType ||
                            "Not published yet"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="border-b border-slate-200 p-8">
                    <div className="mb-6 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900">
                        Prerequisites
                      </h3>

                      <button
                        type="button"
                        onClick={() => openOverrideEditor("prerequisites")}
                        className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <Edit2 className="h-4 w-4" />
                        <span className="text-sm">Edit</span>
                      </button>
                    </div>

                    <div className="space-y-3">
                      {prerequisiteItems.map((item) => (
                        <div key={item} className="flex items-start gap-3">
                          <div className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                          <p className="text-sm text-slate-900">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-b border-slate-200 p-8">
                    <div className="mb-6 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900">
                        Course Objectives
                      </h3>

                      <button
                        type="button"
                        onClick={() => openOverrideEditor("courseObjectives")}
                        className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <Edit2 className="h-4 w-4" />
                        <span className="text-sm">Edit</span>
                      </button>
                    </div>

                    <div className="space-y-3">
                      {courseObjectiveItems.map((item, index) => (
                        <div
                          key={`${item}-${index}`}
                          className="flex items-start gap-3"
                        >
                          <div className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                          <p className="text-sm leading-relaxed text-slate-900">
                            {item}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-8">
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-slate-900">
                        Important Information
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="rounded-lg border-l-4 border-blue-500 bg-blue-50 p-4">
                        <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-900">
                          <span className="text-blue-600">📋</span>
                          Attendance Rules
                        </h4>
                        <p className="text-xs leading-relaxed text-blue-800">
                          Attendance expectations and participation rules are
                          defined by the instructor and official syllabus.
                        </p>
                      </div>

                      <div className="rounded-lg border-l-4 border-amber-500 bg-amber-50 p-4">
                        <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900">
                          <span className="text-amber-600">⏰</span>
                          Deadline Rules
                        </h4>
                        <p className="text-xs leading-relaxed text-amber-800">
                          Students are responsible for tracking deadlines and
                          submitting work before the due date.
                        </p>
                      </div>

                      <div className="rounded-lg border-l-4 border-purple-500 bg-purple-50 p-4">
                        <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-purple-900">
                          <span className="text-purple-600">💬</span>
                          Communication
                        </h4>
                        <p className="text-xs leading-relaxed text-purple-800">
                          Students should follow announcements and use official
                          communication channels for course-related questions.
                        </p>
                      </div>

                      <div className="rounded-lg border-l-4 border-emerald-500 bg-emerald-50 p-4">
                        <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-900">
                          <span className="text-emerald-600">✅</span>
                          Academic Integrity
                        </h4>
                        <p className="text-xs leading-relaxed text-emerald-800">
                          All submitted work must follow academic integrity and
                          citation expectations.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                )
              )}

              {activeTab === "calendar" && (
                <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="flex items-center justify-between border-b border-slate-200 px-8 py-6">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        Course Calendar
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Weekly schedule and important dates for{" "}
                        {course.semester || "Spring 2026"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={openCreateWeekModal}
                        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                      >
                        <Plus className="h-4 w-4" />
                        <span className="text-sm font-medium">Add Week</span>
                      </button>

                      <Link
                        href={`/instructor/courses/${course.id}/syllabus/edit`}
                        className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
                      >
                        <FileText className="h-4 w-4" />
                        <span className="text-sm font-medium">Manage PDFs</span>
                      </Link>
                    </div>
                  </div>

                  {weekMessage ? (
                    <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm font-medium text-blue-700">
                      {weekMessage}
                    </div>
                  ) : null}

                  {loadingSyllabus || isAiSyllabusLoading ? (
                    <div className="p-8 text-sm text-slate-500">
                      Loading syllabus...
                    </div>
                  ) : displayedWeeks.length === 0 ? (
                    <div className="p-8 text-sm text-slate-500">
                      Use the floating AI chat for weekly topics after the PDF is ready.
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50">
                              <th className="w-32 px-6 py-4 text-left text-sm font-semibold text-slate-700">
                                Week & Place
                              </th>
                              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                                Course Topic
                              </th>
                              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                                To Do
                              </th>
                              <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">
                                Assignment/Deadline
                              </th>
                              <th className="w-36 px-6 py-4 text-right text-sm font-semibold text-slate-700">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...displayedWeeks]
                              .sort((a, b) => a.weekNo - b.weekNo)
                              .map((week) => {
                                const tone = getCalendarTone(
                                  week.topic,
                                  week.details
                                );
                                const place = week.place || getWeekPlace(week.weekNo);

                                return (
                                  <tr
                                    key={week.id}
                                    className={`border-b border-slate-200 transition-colors hover:bg-slate-50 ${tone.row}`}
                                  >
                                    <td className="px-6 py-5 text-sm">
                                      <div className="font-semibold text-slate-900">
                                        W{week.weekNo}
                                      </div>
                                      <div
                                        className={`mt-1 text-xs ${
                                          place === "Online"
                                            ? "text-purple-600"
                                            : "text-blue-600"
                                        }`}
                                      >
                                        {place}
                                      </div>
                                    </td>

                                    <td className={`px-6 py-5 text-sm ${tone.topic}`}>
                                      {week.topic}
                                    </td>

                                    <td className={`px-6 py-5 text-sm ${tone.todo}`}>
                                      {week.todo || "Review course materials"}
                                    </td>

                                    <td
                                      className={`px-6 py-5 text-sm ${tone.assignment}`}
                                    >
                                      {week.details || "—"}
                                    </td>

                                    <td className="px-6 py-5 text-right">
                                      <div className="flex justify-end gap-2">
                                        <button
                                          type="button"
                                          onClick={() => openEditWeekModal(week)}
                                          disabled={isGeneratedWeek(week)}
                                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          <Edit2 className="h-3.5 w-3.5" />
                                          Edit
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => handleDeleteWeek(week)}
                                          disabled={
                                            deletingWeekId === week.id ||
                                            isGeneratedWeek(week)
                                          }
                                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                          {deletingWeekId === week.id ? "Deleting..." : "Delete"}
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>

                      <div className="border-t border-slate-200 bg-slate-50 px-8 py-4">
                        <div className="flex flex-wrap items-center gap-6 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="h-3 w-3 rounded-full bg-blue-600" />
                            <span className="text-slate-600">
                              F2F: Face-to-Face
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="h-3 w-3 rounded-full bg-purple-600" />
                            <span className="text-slate-600">
                              Online: Remote Session
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="h-3 w-3 rounded-full bg-green-600" />
                            <span className="text-slate-600">Quiz</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="h-3 w-3 rounded-full bg-orange-600" />
                            <span className="text-slate-600">
                              Midterm Exam Week
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="h-3 w-3 rounded-full bg-red-600" />
                            <span className="text-slate-600">
                              Final Exam Week
                            </span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </section>
              )}

              {activeTab === "resources" && (
                <div className="rounded-xl border border-slate-200 bg-white p-6">
                  <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        AI Course Documents
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Upload syllabus PDFs for course-scoped AI answers.
                      </p>
                    </div>

                    <form
                      onSubmit={handleResourceUpload}
                      className="flex flex-col gap-3 sm:flex-row sm:items-center"
                    >
                      <div className="flex min-w-0 items-center overflow-hidden rounded-lg border border-slate-300 bg-white text-sm text-slate-700">
                        <label className="shrink-0 cursor-pointer bg-slate-100 px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-200">
                          Choose File
                          <input
                            type="file"
                            accept="application/pdf,.pdf"
                            disabled={uploadingResource}
                            onChange={(event) => {
                              setSelectedUploadFile(event.target.files?.[0] ?? null);
                              setResourceUploadError("");
                              setResourceUploadMessage("");
                            }}
                            className="hidden"
                          />
                        </label>
                        <span className="truncate px-3 text-slate-500">
                          {selectedUploadFile?.name || "No file chosen"}
                        </span>
                      </div>
                      <button
                        type="submit"
                        disabled={!selectedUploadFile || uploadingResource}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {uploadingResource ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UploadCloud className="h-4 w-4" />
                        )}
                        <span>{uploadingResource ? "Indexing" : "Upload"}</span>
                      </button>
                    </form>
                  </div>

                  {resourceUploadError ? (
                    <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{resourceUploadError}</span>
                    </div>
                  ) : null}

                  {resourceUploadMessage ? (
                    <div className="mb-4 flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{resourceUploadMessage}</span>
                    </div>
                  ) : null}

                  {failedResourceFiles.length > 0 ? (
                    <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        {failedResourceFiles[0]?.errorMessage ||
                          "PDF indexing failed. Please upload a text-based PDF and try again."}
                      </span>
                    </div>
                  ) : null}

                  <div className="mb-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search files..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-4 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="mb-6 flex flex-wrap items-center gap-3">
                    <Link
                      href={`/instructor/courses/${course.id}/syllabus/edit`}
                      className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-600"
                    >
                      <UploadCloud className="h-4 w-4" />
                      <span>Manage PDFs</span>
                    </Link>

                    <button
                      type="button"
                      onClick={handleDeleteSelectedResources}
                      disabled={selectedFiles.size === 0}
                      className="flex items-center gap-2 rounded-lg border-2 border-red-500 px-4 py-2 font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Delete Selected ({selectedFiles.size})</span>
                    </button>

                    <div className="relative">
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="cursor-pointer appearance-none rounded-lg border border-slate-300 bg-white px-4 py-2 pr-10 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="date">Sort by Date</option>
                        <option value="name">Sort by Name</option>
                        <option value="size">Sort by Size</option>
                        <option value="type">Sort by Type</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-lg border border-slate-200">
                    <div className="grid grid-cols-12 items-center gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="col-span-1">
                        <input
                          type="checkbox"
                          checked={
                            filteredResourceFiles.length > 0 &&
                            selectedFiles.size === filteredResourceFiles.length
                          }
                          onChange={toggleSelectAll}
                          className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </div>
                      <div className="col-span-1" />
                      <div className="col-span-4 text-xs font-semibold uppercase tracking-wide text-slate-700">
                        File Name
                      </div>
                      <div className="col-span-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
                        Size
                      </div>
                      <div className="col-span-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
                        AI Status
                      </div>
                      <div className="col-span-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                        Upload Date
                      </div>
                      <div className="col-span-1 text-right text-xs font-semibold uppercase tracking-wide text-slate-700">
                        Actions
                      </div>
                    </div>

                    {loadingAiResources ? (
                      <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Loading documents...</span>
                      </div>
                    ) : filteredResourceFiles.length === 0 ? (
                      <div className="px-4 py-6 text-sm text-slate-500">
                        {noIndexedResourcesMessage}
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-200">
                        {filteredResourceFiles.map((file) => (
                          <div
                            key={file.id}
                            onClick={() => toggleFileSelection(file.id)}
                            className="grid cursor-pointer grid-cols-12 items-center gap-4 px-4 py-4 transition-colors hover:bg-slate-50"
                          >
                            <div className="col-span-1">
                              <input
                                type="checkbox"
                                checked={selectedFiles.has(file.id)}
                                onChange={() => toggleFileSelection(file.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                            </div>

                            <div className="col-span-1">
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                                <FileText className="h-5 w-5 text-red-600" />
                              </div>
                            </div>

                            <div className="col-span-4">
                              <div className="text-sm font-medium text-slate-900">
                                {file.name}
                              </div>
                              <div className="mt-1 text-xs uppercase text-slate-500">
                                {file.type.toUpperCase()}
                              </div>
                            </div>

                            <div className="col-span-2">
                              <span className="text-sm text-slate-600">
                                {file.size}
                              </span>
                            </div>

                            <div className="col-span-2">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${getResourceStatusClass(
                                  file.status
                                )}`}
                              >
                                {file.status === "READY" ? (
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                ) : file.status === "FAILED" ? (
                                  <XCircle className="h-3.5 w-3.5" />
                                ) : file.status === "PROCESSING" ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <FileText className="h-3.5 w-3.5" />
                                )}
                                {getResourceStatusLabel(file.status)}
                              </span>
                              {file.status === "READY" ? (
                                <div className="mt-1 text-xs text-slate-500">
                                  {file.chunkCount} chunks
                                </div>
                              ) : null}
                              {file.errorMessage ? (
                                <div className="mt-1 line-clamp-2 text-xs text-red-600">
                                  {file.errorMessage}
                                </div>
                              ) : null}
                            </div>

                            <div className="col-span-1">
                              <span className="text-sm text-slate-600">
                                {file.uploadDate}
                              </span>
                            </div>

                            <div className="col-span-1 flex justify-end">
                              <button
                                type="button"
                                disabled={
                                  !file.isAiResource ||
                                  file.status === "PROCESSING" ||
                                  deletingResourceIds.has(file.id)
                                }
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleDeleteResource(file);
                                }}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300 disabled:hover:bg-transparent"
                                title={
                                  file.status === "PROCESSING"
                                    ? "Wait until indexing finishes before deleting"
                                    : "Delete PDF"
                                }
                                aria-label={`Delete ${file.name}`}
                              >
                                {deletingResourceIds.has(file.id) ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 text-sm text-slate-500">
                    Showing {filteredResourceFiles.length} file
                    {filteredResourceFiles.length !== 1 ? "s" : ""}
                  </div>

                  <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
                    <div className="mb-6 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900">
                        Course Resources
                      </h3>
                      <button
                        type="button"
                        onClick={() => openOverrideEditor("resources")}
                        className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <Edit2 className="h-4 w-4" />
                        <span className="text-sm font-medium">Edit</span>
                      </button>
                    </div>

                    {isAiSyllabusLoading
                      ? renderMultilineText("Loading syllabus...")
                      : displayedResourcesText
                        ? renderMultilineText(displayedResourcesText)
                        : renderMultilineText(noIndexedResourcesMessage)}
                  </div>
                </div>
              )}

              {activeTab === "grading" && (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="flex items-center justify-between border-b border-slate-200 px-8 py-6">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        Grading Breakdown
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Course evaluation components and their respective weights
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => openOverrideEditor("grading")}
                      className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      <Edit2 className="h-4 w-4" />
                      <span className="text-sm font-medium">Edit</span>
                    </button>
                  </div>

                  {gradingRows.length === 0 ? (
                    <div className="p-8 text-sm text-slate-500">
                      {isAiSyllabusLoading
                        ? "Loading syllabus..."
                        : readyAiResources.length === 0
                          ? noIndexedResourcesMessage
                          : "No grading information was found in the uploaded PDFs yet."}
                    </div>
                  ) : (
                    <>
                      <div className="border-b border-slate-200 bg-slate-50 px-8 py-8 pb-12">
                        <div className="flex justify-center">
                          <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                              <Pie
                                data={gradingChartData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={(props) => {
                                  const labelProps =
                                    props as GradingPieLabelProps;
                                  return `${labelProps.name ?? ""}: ${
                                    labelProps.value ?? 0
                                  }%`;
                                }}
                                outerRadius={100}
                                dataKey="value"
                              >
                                {gradingChartData.map((entry) => (
                                  <Cell key={entry.name} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip />
                              <Legend
                                verticalAlign="bottom"
                                height={36}
                                formatter={(value, entry) => {
                                  const legendEntry =
                                    entry as GradingLegendPayload;
                                  return `${value} (${
                                    legendEntry.payload?.value ?? 0
                                  }%)`;
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50">
                              <th className="px-8 py-4 text-left text-sm font-semibold text-slate-700">
                                Assignment
                              </th>
                              <th className="px-8 py-4 text-left text-sm font-semibold text-slate-700">
                                Description
                              </th>
                              <th className="px-8 py-4 text-left text-sm font-semibold text-slate-700">
                                Scoring
                              </th>
                              <th className="px-8 py-4 text-right text-sm font-semibold text-slate-700">
                                Weight
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {gradingRows.map((row) => {
                              const parts = getGradingDisplayParts(row.value);
                              const percent = extractPercentValue(
                                parts.weight || row.value
                              );

                              return (
                                <tr
                                  key={row.id}
                                  className="border-b border-slate-200 transition-colors hover:bg-slate-50"
                                >
                                  <td className="px-8 py-5 text-sm font-medium text-slate-900">
                                    {row.label}
                                  </td>
                                  <td className="px-8 py-5 text-sm text-slate-600">
                                    {parts.description}
                                  </td>
                                  <td className="px-8 py-5 text-sm text-slate-600">
                                    {parts.scoring}
                                  </td>
                                  <td className="px-8 py-5 text-right text-sm font-semibold text-slate-900">
                                    {percent > 0 ? `${percent}%` : parts.weight}
                                  </td>
                                </tr>
                              );
                            })}

                            <tr className="border-t-2 border-slate-300 bg-slate-100">
                              <td className="px-8 py-5 text-sm font-bold text-slate-900">
                                Total
                              </td>
                              <td className="px-8 py-5 text-sm text-slate-600" />
                              <td className="px-8 py-5 text-sm text-slate-600" />
                              <td className="px-8 py-5 text-right text-sm font-bold text-slate-900">
                                100%
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  <div className="mt-8 px-8 pb-6 pt-6">
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-slate-900">
                        Make-up Exam Rules
                      </h3>
                    </div>

                    <div className="space-y-3">
                      <p className="text-sm leading-relaxed text-slate-600">
                        Students are eligible to take a make-up exam under the
                        following circumstances:
                      </p>

                      <ul className="ml-5 space-y-2">
                        {[
                          "Medical Emergency: Documented illness or medical condition preventing attendance.",
                          "Family Emergency: Serious family emergency or bereavement with supporting documentation.",
                          "University-Sanctioned Activities: Official university events or academic competitions.",
                          "Technical Issues: Documented technical difficulties during online examinations.",
                        ].map((item) => (
                          <li
                            key={item}
                            className="flex items-start text-sm text-slate-700"
                          >
                            <span className="mr-3 mt-1.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-600" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>

                      <div className="mt-4 border-l-4 border-amber-500 bg-amber-50 p-4">
                        <p className="text-sm text-amber-900">
                          <strong>Important:</strong> Make-up exam requests must
                          be submitted within 3 business days of the original exam
                          date.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "policies" && (
                isAiSyllabusLoading ? (
                  renderSyllabusLoading()
                ) : (
                <div className="flex min-h-[600px] overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="flex-1 p-8">
                    <div className="mb-6 flex items-center justify-between">
                      <h3 className="text-xl font-semibold text-slate-900">
                        {activePolicy.title}
                      </h3>

                      <button
                        type="button"
                        onClick={() => openOverrideEditor("policy")}
                        className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <Edit2 className="h-4 w-4" />
                        <span className="text-sm font-medium">Edit</span>
                      </button>
                    </div>

                    <div className="space-y-4">
                      {activePolicy.paragraphs.map((paragraph) => {
                        const isBullet = paragraph.startsWith("- ");
                        const text = isBullet
                          ? paragraph.replace(/^-\s*/, "")
                          : paragraph;

                        return (
                          <p
                            key={paragraph}
                            className="text-sm leading-relaxed text-slate-700"
                          >
                            {isBullet ? (
                              <span className="mr-2 text-slate-900">•</span>
                            ) : null}
                            {text}
                          </p>
                        );
                      })}
                    </div>
                  </div>

                  <aside className="w-80 border-l border-slate-200 bg-slate-50 p-6">
                    <h4 className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Policy Topics
                    </h4>

                    <div className="space-y-2">
                      {policyTopics
                        .filter((topic) => topic.group === "policies")
                        .map((topic) => {
                          const selected = activePolicyTab === topic.id;

                          return (
                            <button
                              key={topic.id}
                              type="button"
                              onClick={() => setActivePolicyTab(topic.id)}
                              className={`w-full rounded-lg px-4 py-3 text-left text-sm transition-colors ${
                                selected
                                  ? "bg-blue-500 font-semibold text-white shadow-sm"
                                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                              }`}
                            >
                              {topic.label}
                            </button>
                          );
                        })}
                    </div>

                    <h4 className="mb-4 mt-8 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Ethics
                    </h4>

                    <div className="space-y-2">
                      {policyTopics
                        .filter((topic) => topic.group === "ethics")
                        .map((topic) => {
                          const selected = activePolicyTab === topic.id;

                          return (
                            <button
                              key={topic.id}
                              type="button"
                              onClick={() => setActivePolicyTab(topic.id)}
                              className={`w-full rounded-lg px-4 py-3 text-left text-sm transition-colors ${
                                selected
                                  ? "bg-blue-500 font-semibold text-white shadow-sm"
                                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                              }`}
                            >
                              {topic.label}
                            </button>
                          );
                        })}
                    </div>
                  </aside>
                </div>
                )
              )}

              {activeTab === "moreInfo" && (
                isAiSyllabusLoading ? (
                  renderSyllabusLoading()
                ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 p-8">
                    <div className="mb-6 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900">
                        Course Learning Outcomes
                      </h3>

                      <button
                        type="button"
                        onClick={() => openOverrideEditor("learningOutcomes")}
                        className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <Edit2 className="h-4 w-4" />
                        <span className="text-sm">Edit</span>
                      </button>
                    </div>

                    <p className="leading-relaxed text-slate-700">
                      {moreInfoLearningOutcomesText}
                    </p>
                  </div>

                  <div className="border-b border-slate-200 p-8">
                    <div className="mb-6 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900">
                        Contribution of the Course to the Program
                      </h3>

                      <button
                        type="button"
                        onClick={() => openOverrideEditor("contribution")}
                        className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <Edit2 className="h-4 w-4" />
                        <span className="text-sm">Edit</span>
                      </button>
                    </div>

                    <p className="leading-relaxed text-slate-700">
                      {displayedMoreInfo.contributionToProgram ||
                        aiSummary?.courseSummary ||
                        course.description ||
                        "This course contributes to the program by helping students build practical knowledge, follow structured academic resources, complete course deliverables, and connect weekly learning outcomes with program-level expectations."}
                    </p>
                  </div>

                  <div className="p-8">
                    <div className="mb-6 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900">
                        Course Structure
                      </h3>

                      <button
                        type="button"
                        onClick={() => openOverrideEditor("courseStructure")}
                        className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <Edit2 className="h-4 w-4" />
                        <span className="text-sm">Edit</span>
                      </button>
                    </div>

                    <p className="mb-6 text-slate-700">
                      {courseStructureDescription}
                    </p>

                    <div className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-4">
                      {courseStructureItems.map((method) => (
                        <div key={method} className="flex items-start gap-3">
                          <div className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                          <span className="text-sm text-slate-700">
                            {method}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                )
              )}
            </main>
          </>
        )}
      {showWeekModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <form
            onSubmit={handleWeekSubmit}
            className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingWeek ? "Edit Week" : "Add Week"}
              </h3>

              <button
                type="button"
                onClick={closeWeekModal}
                className="rounded-lg p-2 transition hover:bg-slate-100"
              >
                <XCircle className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Week Number
                </label>
                <input
                  type="number"
                  min="1"
                  value={weekForm.weekNo}
                  onChange={(event) =>
                    setWeekForm((prev) => ({
                      ...prev,
                      weekNo: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Topic
                </label>
                <input
                  type="text"
                  value={weekForm.topic}
                  onChange={(event) =>
                    setWeekForm((prev) => ({
                      ...prev,
                      topic: event.target.value,
                    }))
                  }
                  placeholder="Weekly topic"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  To Do
                </label>
                <textarea
                  rows={3}
                  value={weekForm.todo}
                  onChange={(event) =>
                    setWeekForm((prev) => ({
                      ...prev,
                      todo: event.target.value,
                    }))
                  }
                  placeholder="Student tasks or preparation notes"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Assignment / Deadline
                </label>
                <textarea
                  rows={3}
                  value={weekForm.details}
                  onChange={(event) =>
                    setWeekForm((prev) => ({
                      ...prev,
                      details: event.target.value,
                    }))
                  }
                  placeholder="Assignment, exam, quiz, or deadline details"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeWeekModal}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingWeek}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingWeek ? "Saving..." : "Save Week"}
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}

      {overrideEditor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <form
            onSubmit={handleOverrideSubmit}
            className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white p-6 shadow-xl ${
              overrideEditor.section === "grading" ? "max-w-5xl" : "max-w-2xl"
            }`}
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {overrideEditor.title}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Manual changes override AI extracted values on this page.
                </p>
              </div>

              <button
                type="button"
                onClick={closeOverrideEditor}
                className="rounded-lg p-2 transition hover:bg-slate-100"
              >
                <XCircle className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <div className="space-y-4">
              {overrideEditor.section === "grading" ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-[1fr_1.4fr_1fr_120px_36px] gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <span>Assignment</span>
                    <span>Description</span>
                    <span>Scoring</span>
                    <span>Weight</span>
                    <span />
                  </div>

                  {gradingFormRows.map((row) => (
                    <div
                      key={row.id}
                      className="grid grid-cols-[1fr_1.4fr_1fr_120px_36px] gap-2"
                    >
                      <input
                        type="text"
                        value={row.assignment}
                        onChange={(event) =>
                          updateGradingFormRow(
                            row.id,
                            "assignment",
                            event.target.value
                          )
                        }
                        placeholder="Midterm"
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                      />
                      <input
                        type="text"
                        value={row.description}
                        onChange={(event) =>
                          updateGradingFormRow(
                            row.id,
                            "description",
                            event.target.value
                          )
                        }
                        placeholder="Exam or project description"
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                      />
                      <input
                        type="text"
                        value={row.scoring}
                        onChange={(event) =>
                          updateGradingFormRow(
                            row.id,
                            "scoring",
                            event.target.value
                          )
                        }
                        placeholder="0-100 points"
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                      />
                      <input
                        type="text"
                        value={row.weight}
                        onChange={(event) =>
                          updateGradingFormRow(
                            row.id,
                            "weight",
                            event.target.value
                          )
                        }
                        placeholder="30%"
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                      />
                      <button
                        type="button"
                        onClick={() => removeGradingFormRow(row.id)}
                        disabled={gradingFormRows.length === 1}
                        className="flex h-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Remove grading row"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addGradingFormRow}
                    className="inline-flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-50"
                  >
                    <Plus className="h-4 w-4" />
                    Add Row
                  </button>
                </div>
              ) : (
                overrideEditor.fields.map((field) => (
                <div key={field.key}>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    {field.label}
                  </label>

                  {field.type === "textarea" ? (
                    <textarea
                      rows={6}
                      value={overrideForm[field.key] || ""}
                      onChange={(event) =>
                        updateOverrideForm(field.key, event.target.value)
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                    />
                  ) : field.type === "select" ? (
                    <select
                      value={overrideForm[field.key] || ""}
                      onChange={(event) =>
                        updateOverrideForm(field.key, event.target.value)
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="">Not published yet</option>
                      {field.options?.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={overrideForm[field.key] || ""}
                      onChange={(event) =>
                        updateOverrideForm(field.key, event.target.value)
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                    />
                  )}
                </div>
                ))
              )}

              {overrideMessage ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {overrideMessage}
                </p>
              ) : null}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeOverrideEditor}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingOverride}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingOverride ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}

      </div>
    </InstructorLayout>
  );
}
