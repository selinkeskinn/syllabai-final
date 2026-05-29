"use client";

import Layout from "@/components/Layout";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  Clock3,
  ChevronDown,
  Download,
  FileBadge2,
  FileText,
  FolderOpen,
  GraduationCap,
  Info,
  Layers3,
  Loader2,
  LucideIcon,
  Mail,
  NotebookText,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
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
import {
  Announcement,
  announcementService,
} from "@/services/announcement.service";
import {
  aiService,
  CourseAiResource,
  CourseAiSyllabusSummary,
} from "@/services/ai.service";
import { courseService } from "@/services/course.service";
import NotificationBell from "@/components/NotificationBell";
import SettingsButton from "@/components/SettingsButton";
import {
  getSyllabusDescriptionText,
  getSyllabusDocumentMetadata,
  Syllabus,
  SyllabusWeek,
  syllabusService,
} from "@/services/syllabus.service";

type TabKey =
  | "overview"
  | "instructorInfo"
  | "courseInfo"
  | "courseCalendar"
  | "resources"
  | "grading"
  | "policies"
  | "moreInfo";

type CourseDeadline = {
  id: string;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  type?: string | null;
};

type CourseDetail = {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  semester?: string | null;
  deliveryMethod?: string | null;
  joinKey?: string | null;
  createdAt?: string;
  updatedAt?: string;
  instructor?: {
    id?: string;
    name?: string;
    email?: string;
  } | null;
  syllabus?: Syllabus | null;
  deadlines: CourseDeadline[];
  _count?: {
    enrollments?: number;
  };
};

type GradingLegendPayload = LegendPayload & {
  payload?: {
    value?: number;
  };
};

type TabConfig = {
  key: TabKey;
  label: string;
  description: string;
  icon: LucideIcon;
};

const tabConfig: TabConfig[] = [
  {
    key: "overview",
    label: "Overview",
    description: "Portal, updates, and your next steps.",
    icon: Sparkles,
  },
  {
    key: "instructorInfo",
    label: "Instructor Info",
    description: "Contact and communication details.",
    icon: UserRound,
  },
  {
    key: "courseInfo",
    label: "Course Info",
    description: "Identity, summary, and syllabus context.",
    icon: Info,
  },
  {
    key: "courseCalendar",
    label: "Course Calendar",
    description: "Weekly plan and deadline timeline.",
    icon: CalendarDays,
  },
  {
    key: "resources",
    label: "Resources",
    description: "Materials, documents, and study aids.",
    icon: FolderOpen,
  },
  {
    key: "grading",
    label: "Grading",
    description: "Assessment structure and evaluation.",
    icon: FileBadge2,
  },
  {
    key: "policies",
    label: "Policies",
    description: "Rules, expectations, and guidance.",
    icon: ShieldCheck,
  },
  {
    key: "moreInfo",
    label: "More Info",
    description: "Metadata and technical course details.",
    icon: Layers3,
  },
];

const resourceIcons: LucideIcon[] = [
  BookOpen,
  NotebookText,
  FileText,
  FolderOpen,
];

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

const formatStableDateTime = (value?: string | null) => {
  if (!value) return "Not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toISOString().slice(0, 16).replace("T", " ");
};

const formatStableDate = (value?: string | null) => {
  if (!value) return "No due date";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No due date";

  return date.toISOString().slice(0, 16).replace("T", " ");
};

const formatFriendlyDateTime = (value?: string | null) => {
  if (!value) return "Date not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not available";

  return `${date.toISOString().slice(0, 16).replace("T", " ")}`;
};

const formatDeadlineType = (type?: string | null) => {
  if (!type) return "Deadline";

  return type
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const getDeadlineTypeStyles = (type?: string | null) => {
  switch (type) {
    case "EXAM":
      return "bg-red-100 text-red-700 ring-1 ring-red-200";
    case "QUIZ":
      return "bg-amber-100 text-amber-700 ring-1 ring-amber-200";
    case "PROJECT":
      return "bg-violet-100 text-violet-700 ring-1 ring-violet-200";
    case "ASSIGNMENT":
      return "bg-blue-100 text-blue-700 ring-1 ring-blue-200";
    default:
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  }
};

const getAnnouncementStyles = (type?: string) => {
  switch (type) {
    case "URGENT":
      return {
        wrapper: "border-red-200 bg-red-50/80",
        badge: "bg-red-100 text-red-700 ring-1 ring-red-200",
      };
    case "EVENT":
      return {
        wrapper: "border-amber-200 bg-amber-50/80",
        badge: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
      };
    default:
      return {
        wrapper: "border-blue-200 bg-blue-50/80",
        badge: "bg-blue-100 text-blue-700 ring-1 ring-blue-200",
      };
  }
};

const getAnnouncementPreview = (content?: string, expanded?: boolean) => {
  if (!content) return "No details available.";
  if (expanded || content.length <= 180) return content;
  return `${content.slice(0, 180)}...`;
};

const getStructuredItems = (value?: string | null) =>
  value
    ?.split("\n")
    .map((item) => item.trim())
    .filter(Boolean) ?? [];

const getLabeledItems = (value?: string | null) =>
  getStructuredItems(value).map((item, index) => {
    const [label, ...rest] = item.split(":");
    if (rest.length === 0) {
      return {
        id: `${item}-${index}`,
        label: `Item ${index + 1}`,
        value: item,
      };
    }

    return {
      id: `${label}-${index}`,
      label: label.trim(),
      value: rest.join(":").trim(),
    };
  });

const getInitials = (value?: string) => {
  if (!value) return "I";

  return value
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
};


const gradingColors = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#6366f1"];

const extractPercentValue = (value?: string | null) => {
  if (!value) return 0;
  const match = value.match(/(\d+(?:\.\d+)?)\s*%/);
  return match ? Number(match[1]) : 0;
};

const cleanGradingDescription = (value: string) =>
  value
    .replace(/(?:\b[A-Za-z]\b\s*){8,}/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

const getGradingDisplayParts = (value?: string | null) => {
  const rawValue = value?.trim() || "";
  const [descriptionPart, scoringPart, weightPart] = rawValue
    .split("|")
    .map((part) => part.trim());
  const detectedPercent = extractPercentValue(rawValue);
  const splitDigitWeight = weightPart?.match(/^(\d)\s*%$/);
  const numericScoring = scoringPart?.match(/^(\d+(?:\.\d+)?)$/);
  const likelyDroppedWeightZero =
    splitDigitWeight &&
    numericScoring &&
    numericScoring[1].endsWith("0") &&
    numericScoring[1].startsWith(splitDigitWeight[1]) &&
    Number(numericScoring[1]) >= 10 &&
    Number(numericScoring[1]) <= 100 &&
    !/^\d+(?:\.\d+)?\s*%?$/.test(descriptionPart);
  const likelyPdfPageNumberAsWeight =
    splitDigitWeight &&
    numericScoring &&
    Number(splitDigitWeight[1]) <= 5 &&
    Number(numericScoring[1]) >= 10 &&
    Number(numericScoring[1]) < 100 &&
    !/^\d+(?:\.\d+)?\s*%?$/.test(descriptionPart);
  const trailingScoring = descriptionPart.match(/\b(100)\s*$/);
  const normalizedDescriptionPart = likelyPdfPageNumberAsWeight
    ? descriptionPart.replace(/\b100\s*$/, "").trim()
    : descriptionPart;
  const cleanedDescription = cleanGradingDescription(normalizedDescriptionPart);
  const description =
    cleanedDescription && !/^\d+(?:\.\d+)?\s*%?$/.test(cleanedDescription)
      ? cleanedDescription
      : "Assessment component from the syllabus";
  const scoring =
    likelyDroppedWeightZero
      ? "100"
      : likelyPdfPageNumberAsWeight
      ? trailingScoring?.[1] || "100"
      : splitDigitWeight &&
          /^\d$/.test(scoringPart) &&
          /^\d+(?:\.\d+)?$/.test(descriptionPart)
      ? descriptionPart
      : scoringPart || "As described in syllabus";
  const weight =
    likelyDroppedWeightZero
      ? `${numericScoring[1]}%`
      : likelyPdfPageNumberAsWeight
      ? `${numericScoring[1]}%`
      : splitDigitWeight && /^\d$/.test(scoringPart)
      ? `${scoringPart}${splitDigitWeight[1]}%`
      : weightPart || (detectedPercent > 0 ? `${detectedPercent}%` : rawValue);

  return { description, scoring, weight };
};

const getGradingChartData = (
  rows: Array<{ label: string; value: string }>
) => {
  const rowsWithPercent = rows
    .map((row, index) => {
      const { weight } = getGradingDisplayParts(row.value);

      return {
        name: row.label,
        value: extractPercentValue(weight),
        color: gradingColors[index % gradingColors.length],
      };
    })
    .filter((item) => item.value > 0);

  if (rowsWithPercent.length > 0) return rowsWithPercent;

  return rows.map((row, index) => ({
    name: row.label,
    value: Math.round(100 / Math.max(rows.length, 1)),
    color: gradingColors[index % gradingColors.length],
  }));
};

const getGradingWeightTotal = (rows: Array<{ label: string; value: string }>) =>
  rows.reduce((sum, row) => {
    const { weight } = getGradingDisplayParts(row.value);

    return sum + extractPercentValue(weight);
  }, 0);

const repairFinalExamWeight = <T extends { label: string; value: string }>(
  rows: T[]
) => {
  const weights = rows.map((row) => ({
    row,
    weight: extractPercentValue(getGradingDisplayParts(row.value).weight),
  }));
  const total = weights.reduce((sum, item) => sum + item.weight, 0);

  if (total >= 95 || total === 0) return rows;

  const finalItem = weights.find(
    (item) => /final/i.test(item.row.label) && item.weight > 0 && item.weight <= 5
  );

  if (!finalItem) return rows;

  const otherTotal = weights
    .filter((item) => item !== finalItem)
    .reduce((sum, item) => sum + item.weight, 0);
  const inferredFinalWeight = 100 - otherTotal;

  if (inferredFinalWeight <= 5 || inferredFinalWeight > 100) return rows;

  return rows.map((row) =>
    row === finalItem.row
      ? {
          ...row,
          value: row.value.includes("|")
            ? row.value.replace(/\|\s*\d+(?:\.\d+)?\s*%?\s*$/, `| ${inferredFinalWeight}%`)
            : `Assessment component from the syllabus | 100 | ${inferredFinalWeight}%`,
        }
      : row
  );
};

const hasUsefulWeekContent = (week?: {
  topic?: string | null;
  details?: string | null;
  todo?: string | null;
}) => {
  if (!week) return false;

  const values = [week.topic, week.details, week.todo]
    .map((value) => value?.trim() || "")
    .filter(Boolean);

  return values.some(
    (value) => !/^not published yet$/i.test(value) && value !== "-"
  );
};

const getDeadlineTone = (dueDate?: string | null) => {
  if (!dueDate) return "text-slate-500";

  const now = Date.now();
  const due = new Date(dueDate).getTime();

  if (Number.isNaN(due)) return "text-slate-500";
  if (due < now) return "text-slate-500";

  const daysLeft = (due - now) / (1000 * 60 * 60 * 24);

  if (daysLeft <= 2) return "text-red-600";
  if (daysLeft <= 7) return "text-amber-600";
  return "text-emerald-600";
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

    return Array.isArray(message) ? message.join(", ") : String(message);
  }

  return fallback;
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

const createFinalExamWeek = (): SyllabusWeek => ({
  id: "auto-final-week-16",
  weekNo: 16,
  place: null,
  topic: "Final Exam Week",
  details: "Final exam schedule will be announced by the university.",
  todo: "Review all chapters and prepare for the final exam.",
});

export default function CourseDetailPage() {
  const params = useParams();
  const courseId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [syllabus, setSyllabus] = useState<Syllabus | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingCourse, setLoadingCourse] = useState(true);
  const [loadingSyllabus, setLoadingSyllabus] = useState(true);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [announcementsAvailable, setAnnouncementsAvailable] = useState(true);
  const [aiResources, setAiResources] = useState<CourseAiResource[]>([]);
  const [loadingAiResources, setLoadingAiResources] = useState(true);
  const [aiSummary, setAiSummary] = useState<CourseAiSyllabusSummary | null>(
    null
  );
  const [loadingAiSummary, setLoadingAiSummary] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [expandedAnnouncementId, setExpandedAnnouncementId] = useState<
    string | number | null
  >(null);
  const [activePolicyTab, setActivePolicyTab] = useState("communication");
  useEffect(() => {
    if (!courseId) return;

    const fetchCourse = async () => {
      try {
        const data = await courseService.getCourseById(courseId);
        setCourse(data);
      } catch (error) {
        console.error("Course fetch error:", error);
        setCourse(null);
      } finally {
        setLoadingCourse(false);
      }
    };

    fetchCourse();
  }, [courseId]);

  useEffect(() => {
    if (!courseId) return;

    const fetchSyllabus = async () => {
      try {
        const data = await syllabusService.getSyllabusByCourseId(courseId);
        setSyllabus(data);
      } catch (error) {
        console.error("Course syllabus fetch error:", error);
        setSyllabus(null);
      } finally {
        setLoadingSyllabus(false);
      }
    };

    fetchSyllabus();
  }, [courseId]);

  useEffect(() => {
    if (!courseId) return;

    const fetchAnnouncements = async () => {
      try {
        setAnnouncementsAvailable(true);
        const data = await announcementService.getAllAnnouncements(courseId);
        setAnnouncements(data);
      } catch (error) {
        console.error("Course announcements fetch error:", error);
        setAnnouncements([]);
        setAnnouncementsAvailable(false);
      } finally {
        setLoadingAnnouncements(false);
      }
    };

    fetchAnnouncements();
  }, [courseId]);

  useEffect(() => {
    if (!courseId) return;

    const fetchAiResources = async () => {
      try {
        const data = await aiService.getCourseResources(courseId);
        setAiResources(data);
      } catch (error) {
        console.error("AI resources fetch error:", error);
        setAiResources([]);
      } finally {
        setLoadingAiResources(false);
      }
    };

    fetchAiResources();
  }, [courseId]);

  useEffect(() => {
    const currentCourseId = courseId;

    if (
      !currentCourseId ||
      !aiResources.some((resource) => resource.status === "PROCESSING")
    ) {
      return;
    }

    const intervalId = window.setInterval(async () => {
      try {
        const data = await aiService.getCourseResources(currentCourseId);
        setAiResources(data);
      } catch {
        window.clearInterval(intervalId);
      }
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [aiResources, courseId]);

  const readyResourceKey = aiResources
    .filter((resource) => resource.status === "READY")
    .map(
      (resource) =>
        `${resource.resourceId}:${resource.updatedAt}:${resource.chunkCount}`
    )
    .join("|");
  const hasProcessingAiResource = aiResources.some(
    (resource) => resource.status === "PROCESSING"
  );
  const isAiSyllabusLoading =
    loadingAiSummary || (hasProcessingAiResource && !aiSummary);

  useEffect(() => {
    const currentCourseId = courseId;

    if (!currentCourseId) {
      setAiSummary(null);
      return;
    }

    if (hasProcessingAiResource) return;

    if (!readyResourceKey) {
      setAiSummary(null);
      return;
    }

    const fetchAiSummary = async () => {
      try {
        setLoadingAiSummary(true);
        const data = await aiService.getSyllabusSummary(currentCourseId);
        setAiSummary(data);
      } catch (error) {
        console.error("AI syllabus summary fetch error:", error);
        setAiSummary(null);
      } finally {
        setLoadingAiSummary(false);
      }
    };

    fetchAiSummary();
  }, [courseId, hasProcessingAiResource, readyResourceKey]);

  const sortedDeadlines = [...(course?.deadlines ?? [])].sort((a, b) => {
    const first = a.dueDate ? new Date(a.dueDate).getTime() : 0;
    const second = b.dueDate ? new Date(b.dueDate).getTime() : 0;
    return first - second;
  });

  const resolvedSyllabus = syllabus ?? course?.syllabus ?? null;
  const splitSummaryText = (value?: string | null) =>
    value
      ?.split(/\n|(?<=\.)\s+(?=[A-Z])/)
      .map((line) => line.trim())
      .filter(Boolean) ?? [];
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
      aiPolicySections?.communication,
    aiDigitalTools:
      manualOverrides.policySections?.aiDigitalTools ||
      aiPolicySections?.aiDigitalTools,
    deadlines:
      manualOverrides.policySections?.deadlines || aiPolicySections?.deadlines,
    attendance:
      manualOverrides.policySections?.attendance ||
      aiPolicySections?.attendance,
    disabledStudentSupport:
      manualOverrides.policySections?.disabledStudentSupport ||
      aiPolicySections?.disabledStudentSupport,
    communicationEthics:
      manualOverrides.policySections?.communicationEthics ||
      aiPolicySections?.communicationEthics,
    privacyCopyright:
      manualOverrides.policySections?.privacyCopyright ||
      aiPolicySections?.privacyCopyright,
    academicIntegrity:
      manualOverrides.policySections?.academicIntegrity ||
      aiPolicySections?.academicIntegrity,
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
  const aiWeeks: SyllabusWeek[] = (aiSummary?.weeklyTopics ?? []).map(
    (week, index) => ({
      id: `ai-week-${week.weekNo ?? index + 1}`,
      weekNo: week.weekNo ?? index + 1,
      place: week.place,
      topic: week.topic || "Not published yet",
      details: week.details,
      todo: week.todo,
    })
  );
  const savedWeeks = resolvedSyllabus?.weeks ?? [];
  const shouldShowFinalExamWeek =
    hasCompleteCourseWeeks(savedWeeks) || hasCompleteCourseWeeks(aiWeeks);
  const calendarWeekCount = shouldShowFinalExamWeek ? 16 : 15;
  const syllabusWeeks: SyllabusWeek[] = Array.from(
    { length: calendarWeekCount },
    (_, index) => {
      const weekNo = index + 1;
      const savedWeek = savedWeeks.find((week) => week.weekNo === weekNo);
      const aiWeek = aiWeeks.find((week) => week.weekNo === weekNo);

      if (weekNo === 16 && !savedWeek && !aiWeek) {
        return createFinalExamWeek();
      }

      return (
        (hasUsefulWeekContent(savedWeek) ? savedWeek : null) ||
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
  const featuredWeeks = syllabusWeeks.slice(0, 3);
  const syllabusDescription =
    aiSummary?.courseSummary || getSyllabusDescriptionText(resolvedSyllabus);
  const syllabusDocument = getSyllabusDocumentMetadata(resolvedSyllabus);
  const aiGradingRows =
    aiSummary?.gradingItems.map((item, index) => ({
      id: `${item.label || "grading"}-${index}`,
      label: item.label || `Component ${index + 1}`,
      value: item.description?.includes("|")
        ? item.description
        : [item.description, item.value].filter(Boolean).join(" | "),
    })) ?? [];
  const savedGradingText = resolvedSyllabus?.grading || "";
  const savedGradingLooksOverExtracted =
    /See policy|Grading note|attendance is not going to be graded|relative grading system/i.test(
      savedGradingText
    );
  const manualGradingRows = savedGradingLooksOverExtracted
    ? []
    : getLabeledItems(savedGradingText);
  const manualGradingTotal = getGradingWeightTotal(manualGradingRows);
  const aiGradingTotal = getGradingWeightTotal(aiGradingRows);
  const shouldUseAiGrading =
    aiGradingRows.length > 0 &&
    aiGradingTotal >= 95 &&
    aiGradingTotal <= 105 &&
    (manualGradingRows.length === 0 ||
      manualGradingTotal < 95 ||
      manualGradingTotal > 105);
  const rawGradingRows =
    shouldUseAiGrading || manualGradingRows.length === 0
      ? aiGradingRows
      : manualGradingRows;
  const gradingRows = repairFinalExamWeight(rawGradingRows);
  const gradingChartData = getGradingChartData(gradingRows);
  const aiPoliciesText =
    aiSummary?.policies?.length ? aiSummary.policies.join("\n") : "";
  const displayedPoliciesText = resolvedSyllabus?.policies || aiPoliciesText;
  const policySections = getLabeledItems(displayedPoliciesText);
  const policyTopics = [
    {
      id: "communication",
      label: "Communication Channels and Methods",
      group: "Policy Topics",
    },
    {
      id: "ai-tools",
      label: "Usage of AI & Digital Tools",
      group: "Policy Topics",
    },
    {
      id: "deadlines",
      label: "Deadlines",
      group: "Policy Topics",
    },
    {
      id: "attendance",
      label: "Attendance",
      group: "Policy Topics",
    },
    {
      id: "disability",
      label: "Disabled Student Support",
      group: "Policy Topics",
    },
    {
      id: "ethics",
      label: "Oral and Written Communication Ethics",
      group: "Policy Topics",
    },
    {
      id: "privacy",
      label: "Privacy and Copyright",
      group: "Policy Topics",
    },
    {
      id: "academic-integrity",
      label: "Academic Integrity, Cheating and Plagiarism",
      group: "Ethics",
    },
  ];

  const activePolicyTopic =
    policyTopics.find((topic) => topic.id === activePolicyTab) ?? policyTopics[0];

  const selectedPolicySection =
    policySections.find((section) => {
      const sectionLabel = section.label.toLowerCase();
      const topicLabel = activePolicyTopic.label.toLowerCase();

      return (
        topicLabel.includes(sectionLabel) ||
        sectionLabel.includes(topicLabel.split(",")[0]) ||
        topicLabel.includes(sectionLabel.split(" ")[0])
      );
    }) ?? null;

  const policyContentByTopic: Record<string, string | undefined> = {
      communication: displayedPolicySections.communication,
      "ai-tools": displayedPolicySections.aiDigitalTools,
      deadlines: displayedPolicySections.deadlines,
      attendance: displayedPolicySections.attendance,
      disability: displayedPolicySections.disabledStudentSupport,
      ethics: displayedPolicySections.communicationEthics,
      privacy: displayedPolicySections.privacyCopyright,
      "academic-integrity": displayedPolicySections.academicIntegrity,
    };
  const selectedPolicyContent =
    policyContentByTopic[activePolicyTopic.id] ||
      selectedPolicySection?.value ||
      displayedPoliciesText ||
      "";

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
  const resourceItems = getLabeledItems(displayedResourcesText);
  const resourceFiles = aiResources.length
    ? aiResources.map((resource) => ({
        id: resource.resourceId,
        name: resource.resourceName,
        type: resource.resourceName.split(".").pop() || "PDF",
        size: `${Math.max(1, Math.round(resource.sizeBytes / 1024))} KB`,
        uploadDate: formatStableDateTime(resource.createdAt),
        status: resource.status,
        errorMessage: resource.errorMessage,
      }))
    : syllabusDocument.hasDocument
      ? [
          {
            id: "syllabus-document",
            name: syllabusDocument.fileName || "Syllabus document",
            type: syllabusDocument.fileName?.split(".").pop() || "PDF",
            size: resolvedSyllabus?.documentSizeKb
              ? `${resolvedSyllabus.documentSizeKb} KB`
              : "-",
            uploadDate: resolvedSyllabus?.documentUploadedAt
              ? formatStableDateTime(resolvedSyllabus.documentUploadedAt)
              : "-",
            status: "READY",
            errorMessage: null,
          },
        ]
      : [];
  const failedResourceFiles = resourceFiles.filter(
    (file) => file.status === "FAILED"
  );
  const rawInstructorName = course?.instructor?.name?.trim();
  const hasMeaningfulInstructorName =
    Boolean(rawInstructorName) &&
    rawInstructorName?.toLowerCase() !== "instructor user";
  const instructorDisplayName = hasMeaningfulInstructorName
    ? rawInstructorName
    : "Course Instructor";

  const getCalendarPlace = (week: SyllabusWeek) => {
    if (week.place) return week.place;

    const weekNo = week.weekNo;
    return [3, 6, 9, 12].includes(weekNo) ? "Online" : "F2F";
  };

  const getCalendarPlaceClass = (place: string) => {
    return place === "Online" ? "text-purple-600" : "text-blue-600";
  };

  const isProjectUploadCalendarItem = (value: string) =>
    /\bproject\s+upload\b/i.test(value) || /\bupload\s*#?\s*\d*\b/i.test(value);

  const getCalendarAssessment = (week: SyllabusWeek) => {
    const topic = String(week.topic || "");
    const todo = String(week.todo || "");
    const details = String(week.details || "");
    const combined = `${topic} ${todo} ${details}`.toLowerCase();

    if (combined.includes("final")) return "Final Exam Week";
    if (combined.includes("midterm")) return "Midterm Exam Week";
    if (isProjectUploadCalendarItem(combined)) {
      return todo || details || "Project Upload";
    }
    if (
      combined.includes("quiz") ||
      combined.includes("assignment") ||
      combined.includes("project") ||
      combined.includes("deadline") ||
      combined.includes("due")
    ) {
      return todo || details || "Assessment";
    }

    return "—";
  };

  const getCalendarRowClass = (week: SyllabusWeek) => {
    const text = `${week.topic || ""} ${week.todo || ""} ${week.details || ""}`.toLowerCase();

    if (text.includes("final")) return "bg-red-50";
    if (text.includes("midterm")) return "bg-orange-50";
    if (isProjectUploadCalendarItem(text)) {
      return "bg-cyan-50";
    }

    return "";
  };

  const getCalendarTopicClass = (week: SyllabusWeek) => {
    const text = `${week.topic || ""} ${week.todo || ""} ${week.details || ""}`.toLowerCase();

    if (text.includes("final")) return "text-red-900 font-semibold";
    if (text.includes("midterm")) return "text-orange-900 font-semibold";
    if (isProjectUploadCalendarItem(text)) {
      return "text-cyan-900 font-semibold";
    }

    return "text-slate-700";
  };

  const getCalendarTodoClass = (week: SyllabusWeek) => {
    const text = `${week.topic || ""} ${week.todo || ""} ${week.details || ""}`.toLowerCase();

    if (text.includes("final")) return "text-red-700";
    if (text.includes("midterm")) return "text-orange-700";
    if (isProjectUploadCalendarItem(text)) {
      return "text-cyan-700";
    }

    return "text-slate-600";
  };

  const getCalendarAssessmentClass = (assessment: string) => {
    const text = assessment.toLowerCase();

    if (text.includes("final")) return "text-red-900 font-bold";
    if (text.includes("midterm")) return "text-orange-900 font-bold";
    if (text.includes("quiz")) return "text-[rgb(45,175,24)] font-medium";
    if (isProjectUploadCalendarItem(text)) {
      return "text-cyan-900 font-bold";
    }
    if (text.includes("assignment") || text.includes("project")) {
      return "text-slate-900 font-medium";
    }

    return "text-slate-600";
  };

  if (loadingCourse) {
    return (
      <Layout>
        <div className="min-h-screen bg-slate-50 px-4 py-6 md:px-8 md:py-8">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-slate-500 shadow-sm">
            Loading course...
          </div>
        </div>
      </Layout>
    );
  }

  if (!course) {
    return (
      <Layout>
        <div className="min-h-screen bg-slate-50 px-4 py-6 md:px-8 md:py-8">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-slate-500 shadow-sm">
            Course not found.
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen overflow-x-hidden bg-[#f6f8fc]">
        <div className="border-b border-slate-200 bg-white">
          <div className="px-8 py-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <h1 className="text-[24px] font-semibold tracking-tight text-slate-900">
                  {course.code} - {course.title}
                </h1>
                <p className="mt-1 text-sm font-normal text-slate-500">
                  {instructorDisplayName}
                  <span className="mx-2 text-slate-300">•</span>
                  {course.semester || "Current Term"}
                </p>
                {course.description ? (
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                    {course.description}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2.5 xl:justify-end">
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-blue-500">
                  <p className="text-sm font-medium">
                    Academic Week: {loadingSyllabus ? "..." : syllabusWeeks.length}
                  </p>
                </div>
                <NotificationBell />
                <SettingsButton href="/settings" />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200">
            <div className="px-8">
              <div className="flex overflow-x-auto">
                {tabConfig.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.key;

                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-[15px] font-medium transition ${
                        isActive
                          ? "border-blue-500 text-blue-600"
                          : "border-transparent text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="px-8 py-8">
          <Link
            href="/courses"
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Courses
          </Link>

          <div className="space-y-6">
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[2fr_1fr]">
                  <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-[15px] font-semibold text-slate-900">
                          Latest Announcements
                        </h3>
                        <p className="mt-2 text-sm text-slate-500">
                          Important course updates and class notices.
                        </p>
                      </div>

                      <Link
                        href="/announcements"
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        Open Feed
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </div>

                    {loadingAnnouncements ? (
                      <p className="text-slate-500">Loading announcements...</p>
                    ) : !announcementsAvailable ? (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                        Announcements are not available from the current API yet.
                      </div>
                    ) : announcements.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                        No announcements published for this course yet.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {announcements.slice(0, 3).map((announcement, index) => {
                          const styles = getAnnouncementStyles(announcement.type);
                          const announcementKey =
                            announcement.id ??
                            `${announcement.courseId ?? "announcement"}-${index}`;
                          const isExpanded = expandedAnnouncementId === announcementKey;

                          return (
                            <button
                              key={announcementKey}
                              type="button"
                              onClick={() =>
                                setExpandedAnnouncementId((current) =>
                                  current === announcementKey ? null : announcementKey
                                )
                              }
                              className={`w-full rounded-lg border border-blue-100 bg-[#edf4ff] p-4 text-left transition hover:shadow-sm ${styles.wrapper}`}
                            >
                              <div className="flex gap-4">
                                <div className="w-1 shrink-0 rounded-full bg-blue-500" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-3">
                                    <span
                                      className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${styles.badge}`}
                                    >
                                      {announcement.type || "INFO"}
                                    </span>
                                    <span className="text-sm font-medium text-slate-500">
                                      {announcement.course?.code || course.code}
                                    </span>
                                  </div>

                                  <h4 className="mt-3 text-[15px] font-bold text-slate-900">
                                    {announcement.title || "Untitled Announcement"}
                                  </h4>

                                  <p className="mt-2 text-sm leading-6 text-slate-600">
                                    {getAnnouncementPreview(
                                      announcement.content,
                                      isExpanded
                                    )}
                                  </p>

                                  <div className="mt-3 flex flex-wrap items-center gap-2 text-slate-500">
                                    <CalendarDays className="h-5 w-5" />
                                    <span className="text-[13px]">
                                      {formatFriendlyDateTime(announcement.createdAt)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  <div className="space-y-6">
                    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="mb-5 flex items-center gap-3">
                        <div className="rounded-lg bg-blue-50 p-2 text-blue-700">
                          <CalendarDays className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-slate-900">
                            Upcoming Deadlines
                          </h3>
                          <p className="text-sm text-slate-500">
                            What needs your attention next.
                          </p>
                        </div>
                      </div>

                      {sortedDeadlines.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                          No deadlines scheduled for this course yet.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {sortedDeadlines.slice(0, 4).map((deadline) => (
                            <div
                              key={deadline.id}
                              className="rounded-lg border border-slate-200 bg-white p-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <h4 className="text-[15px] font-semibold text-slate-900">
                                    {deadline.title}
                                  </h4>
                                  <p
                                    className={`mt-2 text-sm font-medium ${getDeadlineTone(
                                      deadline.dueDate
                                    )}`}
                                  >
                                    {formatFriendlyDateTime(deadline.dueDate)}
                                  </p>
                                </div>
                                <span
                                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${getDeadlineTypeStyles(
                                    deadline.type
                                  )}`}
                                >
                                  {formatDeadlineType(deadline.type)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="mb-5 flex items-center gap-3">
                        <div className="rounded-lg bg-violet-50 p-2 text-violet-700">
                          <NotebookText className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-slate-900">
                            Syllabus Snapshot
                          </h3>
                          <p className="text-sm text-slate-500">
                            A compact view of the course structure.
                          </p>
                        </div>
                      </div>

                      {loadingSyllabus ? (
                        <p className="text-slate-500">Loading syllabus...</p>
                      ) : !resolvedSyllabus ? (
                        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                          No syllabus has been published for this course yet.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="rounded-lg bg-slate-50 p-4">
                            <p className="text-sm font-medium text-slate-500">
                              Syllabus Title
                            </p>
                            <p className="mt-2 text-lg font-semibold text-slate-900">
                              {resolvedSyllabus.title}
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-lg bg-slate-50 p-4">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Weeks
                              </p>
                              <p className="mt-2 text-xl font-bold text-slate-900">
                                {syllabusWeeks.length}
                              </p>
                            </div>
                            <div className="rounded-lg bg-slate-50 p-4">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                File
                              </p>
                              <p className="mt-2 line-clamp-2 text-sm font-semibold text-slate-900">
                                {syllabusDocument.fileName || "No document"}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setActiveTab("courseCalendar")}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                          >
                            Open weekly plan
                            <ArrowUpRight className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </section>
                  </div>
                </div>

                <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-[15px] font-semibold text-slate-900">
                        Weekly Focus
                      </h3>
                      <p className="mt-2 text-sm text-slate-500">
                        A quick look at the syllabus plan and upcoming learning flow.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveTab("courseCalendar")}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Open Calendar
                      <ArrowUpRight className="h-4 w-4" />
                    </button>
                  </div>

                  {loadingSyllabus ? (
                    <p className="text-slate-500">Loading syllabus...</p>
                  ) : !resolvedSyllabus ? (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                      No syllabus has been published for this course yet.
                    </div>
                  ) : syllabusWeeks.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                      A syllabus exists, but no weekly plan has been added yet.
                    </div>
                  ) : (
                    <div className="grid gap-4 xl:grid-cols-3">
                      {featuredWeeks.map((week) => (
                        <button
                          key={week.id}
                          type="button"
                          onClick={() => setActiveTab("courseCalendar")}
                          className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-blue-200 hover:bg-blue-50"
                        >
                          <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                            Week {week.weekNo}
                          </span>
                          <h4 className="mt-4 text-lg font-semibold text-slate-900">
                            {week.topic}
                          </h4>
                          <p className="mt-2 text-sm leading-6 text-slate-500">
                            {week.details ||
                              week.todo ||
                              "Open the weekly calendar for the full plan."}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}

            {activeTab === "instructorInfo" && (
              isAiSyllabusLoading ? (
                renderSyllabusLoading()
              ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="p-8">
                  <div className="mb-6 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900">
                      Instructor Information
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="mb-1 text-xs text-slate-500">Name</p>
                      <p className="text-sm font-medium text-slate-900">
                        {instructorDisplayName}
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
                      {course.instructor?.email ? (
                        <a
                          href={`mailto:${course.instructor.email}`}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          {course.instructor.email}
                        </a>
                      ) : (
                        <p className="text-sm text-slate-900">
                          Not available
                        </p>
                      )}
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
                  </div>

                  <div className="grid grid-cols-2 gap-6">
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
                      <p className="mb-1 text-xs text-slate-500">Credits</p>
                      <p className="text-sm text-slate-900">
                        {displayedCourseInfo.credits || "Not published yet"}
                      </p>
                    </div>

                    <div>
                      <p className="mb-1 text-xs text-slate-500">Classroom</p>
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
                        {displayedCourseInfo.courseType || "Not published yet"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-b border-slate-200 p-8">
                  <div className="mb-6 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900">
                      Prerequisites
                    </h3>
                  </div>

                  <div className="space-y-3">
                    {(splitSummaryText(displayedCourseInfo.prerequisites).length
                      ? splitSummaryText(displayedCourseInfo.prerequisites)
                      : [
                          "Enrollment in the course workspace",
                          "Review of the official syllabus and weekly plan",
                          "Completion of required project milestones announced by the instructor",
                        ]
                    ).map((item) => (
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
                  </div>

                  <div className="space-y-3">
                    {(splitSummaryText(displayedCourseInfo.courseObjectives).length
                      ? splitSummaryText(displayedCourseInfo.courseObjectives)
                      : [
                          "Course objectives are defined by the instructor and official syllabus.",
                        ]
                    ).map((item, index) => (
                      <div key={`${item}-${index}`} className="flex items-start gap-3">
                        <div className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                        <p className="text-sm leading-6 text-slate-900">
                          {item}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-b border-slate-200 p-8">
                  <div className="mb-6 flex items-center justify-between">
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
                        Students are expected to follow attendance expectations
                        and course participation rules announced by the instructor.
                      </p>
                    </div>

                    <div className="rounded-lg border-l-4 border-amber-500 bg-amber-50 p-4">
                      <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900">
                        <span className="text-amber-600">⏰</span>
                        Deadline Rules
                      </h4>
                      <p className="text-xs leading-relaxed text-amber-800">
                        Assignments, projects, exams, and quizzes should be
                        completed by the published due dates.
                      </p>
                    </div>

                    <div className="rounded-lg border-l-4 border-green-500 bg-green-50 p-4">
                      <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-green-900">
                        <span className="text-green-600">💬</span>
                        Communication Channels
                      </h4>
                      <p className="text-xs leading-relaxed text-green-800">
                        Course announcements and instructor updates should be
                        checked regularly through the course workspace.
                      </p>
                    </div>

                    <div className="rounded-lg border-l-4 border-purple-500 bg-purple-50 p-4">
                      <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-purple-900">
                        <span className="text-purple-600">♿</span>
                        Disabled Student Support
                      </h4>
                      <p className="text-xs leading-relaxed text-purple-800">
                        Students requiring accommodations should contact the
                        relevant university support office and inform the
                        instructor as needed.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-8">
                  <div className="mb-6 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900">
                      Syllabus Document
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="mb-1 text-xs text-slate-500">
                        Uploaded Syllabus File
                      </p>
                      <p className="break-all text-sm text-slate-900">
                        {syllabusDocument.fileName || "Not available"}
                      </p>
                    </div>

                    <div>
                      <p className="mb-1 text-xs text-slate-500">
                        Syllabus Status
                      </p>
                      <p className="text-sm text-slate-900">
                        {resolvedSyllabus
                          ? syllabusDocument.hasDocument
                            ? "Uploaded"
                            : "Published"
                          : "Not published yet"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              )
            )}

            {activeTab === "courseCalendar" && (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 px-8 py-6">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      Course Calendar
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Weekly schedule and important dates for {course.semester || "Spring 2026"}
                    </p>
                  </div>
                </div>

                {loadingSyllabus || isAiSyllabusLoading ? (
                  <div className="p-8 text-sm text-slate-500">
                    Loading syllabus...
                  </div>
                ) : syllabusWeeks.length === 0 ? (
                  <div className="p-8">
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                      No weekly course calendar has been found in the uploaded PDFs yet.
                    </div>
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
                          </tr>
                        </thead>

                        <tbody>
                          {[...syllabusWeeks]
                            .sort((a, b) => a.weekNo - b.weekNo)
                            .map((week) => {
                              const place = getCalendarPlace(week);
                              const assessment = getCalendarAssessment(week);

                              return (
                                <tr
                                  key={week.id}
                                  className={`border-b border-slate-200 transition-colors hover:bg-slate-50 ${getCalendarRowClass(
                                    week
                                  )}`}
                                >
                                  <td className="px-6 py-5 text-sm">
                                    <div className="font-semibold text-slate-900">
                                      W{week.weekNo}
                                    </div>
                                    <div
                                      className={`mt-1 text-xs ${getCalendarPlaceClass(
                                        place
                                      )}`}
                                    >
                                      {place}
                                    </div>
                                  </td>

                                  <td
                                    className={`px-6 py-5 text-sm ${getCalendarTopicClass(
                                      week
                                    )}`}
                                  >
                                    {week.topic}
                                  </td>

                                  <td
                                    className={`px-6 py-5 text-sm ${getCalendarTodoClass(
                                      week
                                    )}`}
                                  >
                                    {week.todo ||
                                      week.details ||
                                      "Review course materials"}
                                  </td>

                                  <td
                                    className={`px-6 py-5 text-sm ${getCalendarAssessmentClass(
                                      assessment
                                    )}`}
                                  >
                                    {assessment}
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
                          <span className="h-3 w-3 rounded-full bg-cyan-600" />
                          <span className="text-slate-600">
                            Project Upload
                          </span>
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
              </div>
            )}

            {activeTab === "resources" && (
              <div className="space-y-6">
                <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-5">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search files..."
                        className="h-12 w-full rounded-lg border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-lg border-2 border-blue-500 bg-white px-4 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
                      >
                        <Download className="h-4 w-4" />
                        Download (0)
                      </button>

                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        Sort by Date
                        <ChevronDown className="h-4 w-4 text-slate-500" />
                      </button>
                    </div>
                  </div>

                  {failedResourceFiles.length > 0 ? (
                    <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                      {failedResourceFiles[0]?.errorMessage ||
                        "PDF indexing failed. Please ask the instructor to upload a text-based PDF again."}
                    </div>
                  ) : null}

                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="w-full border-collapse text-left">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="w-[64px] px-5 py-4">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              aria-label="Select all files"
                            />
                          </th>
                          <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-600">
                            File Name
                          </th>
                          <th className="w-[180px] px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-600">
                            Size
                          </th>
                          <th className="w-[220px] px-5 py-4 text-xs font-semibold uppercase tracking-wide text-slate-600">
                            Upload Date
                          </th>
                        </tr>
                      </thead>

                      <tbody className="bg-white">
                        {loadingAiResources ? (
                          <tr className="border-t border-slate-200">
                            <td colSpan={4} className="px-5 py-8 text-sm text-slate-500">
                              Loading course documents...
                            </td>
                          </tr>
                        ) : resourceFiles.length > 0 ? (
                          resourceFiles.map((file) => (
                            <tr key={file.id} className="border-t border-slate-200">
                              <td className="px-5 py-5">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  aria-label={`Select ${file.name}`}
                                />
                              </td>

                              <td className="px-5 py-5">
                                <div className="flex items-center gap-4">
                                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100 text-red-600">
                                    <FileText className="h-6 w-6" />
                                  </div>

                                  <div className="min-w-0">
                                    <p className="break-words text-sm font-semibold text-slate-900">
                                      {file.name}
                                    </p>
                                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs font-medium uppercase text-slate-500">
                                      <span>{file.type}</span>
                                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                                        {file.status}
                                      </span>
                                    </p>
                                  </div>
                                </div>
                              </td>

                              <td className="px-5 py-5 text-sm text-slate-600">
                                {file.size}
                              </td>

                              <td className="px-5 py-5 text-sm text-slate-600">
                                {file.uploadDate}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr className="border-t border-slate-200">
                            <td colSpan={4} className="px-5 py-8 text-sm text-slate-500">
                              {noIndexedResourcesMessage}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <p className="mt-4 text-sm text-slate-500">
                    Showing {resourceFiles.length} file
                    {resourceFiles.length === 1 ? "" : "s"}
                  </p>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Course Resources
                  </h3>

                  {isAiSyllabusLoading ? (
                    <p className="mt-5 text-sm text-slate-500">
                      Loading syllabus...
                    </p>
                  ) : displayedResourcesText ? (
                    <div className="mt-6 space-y-4 text-sm leading-7 text-slate-600">
                      {displayedResourcesText
                        .split("\n")
                        .map((line, index) => {
                          const trimmedLine = line.trim();

                          if (!trimmedLine) {
                            return <div key={`space-${index}`} className="h-2" />;
                          }

                          const cleanedLine = trimmedLine.replace(/^[-•]\s*/, "");
                          const hasBullet =
                            trimmedLine.startsWith("-") || trimmedLine.startsWith("•");
                          const [label, ...rest] = cleanedLine.split(":");
                          const hasLabel = rest.length > 0 && label.length < 40;

                          if (hasBullet) {
                            return (
                              <p key={`${trimmedLine}-${index}`} className="pl-1">
                                <span className="mr-2 text-slate-900">•</span>
                                {hasLabel ? (
                                  <>
                                    <span className="font-semibold text-slate-900">
                                      {label.trim()}:
                                    </span>{" "}
                                    {rest.join(":").trim()}
                                  </>
                                ) : (
                                  cleanedLine
                                )}
                              </p>
                            );
                          }

                          if (hasLabel) {
                            return (
                              <p key={`${trimmedLine}-${index}`}>
                                <span className="font-semibold text-slate-900">
                                  {label.trim()}:
                                </span>{" "}
                                {rest.join(":").trim()}
                              </p>
                            );
                          }

                          return <p key={`${trimmedLine}-${index}`}>{trimmedLine}</p>;
                        })}
                    </div>
                  ) : (
                    <div className="mt-5 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                      {noIndexedResourcesMessage}
                    </div>
                  )}
                </section>
              </div>
            )}

            {activeTab === "grading" && (
              isAiSyllabusLoading ? (
                renderSyllabusLoading()
              ) : (
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="border-b border-slate-200 px-8 py-6">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Grading Breakdown
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Course evaluation components and their respective weights
                  </p>
                </div>

                {gradingRows.length > 0 ? (
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
                              label={({ name, value }) => `${name}: ${value}%`}
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
                ) : (
                  <div className="p-8">
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                      {readyAiResources.length === 0
                        ? noIndexedResourcesMessage
                        : "No syllabus-backed grading information is available yet."}
                    </div>
                  </div>
                )}

                <div className="mt-8 px-8 pb-8 pt-6">
                  <h3 className="mb-4 text-lg font-semibold text-slate-900">
                    Make-up Exam Rules
                  </h3>

                  <div className="space-y-3">
                    <p className="text-sm leading-relaxed text-slate-600">
                      Students are eligible to take a make-up exam only under documented and instructor-approved circumstances.
                    </p>

                    <ul className="ml-1 space-y-2">
                      <li className="flex items-start text-sm text-slate-700">
                        <span className="mr-3 mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                        <span>
                          <strong>Medical Emergency:</strong> A valid medical report must be submitted within the required timeframe.
                        </span>
                      </li>
                      <li className="flex items-start text-sm text-slate-700">
                        <span className="mr-3 mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                        <span>
                          <strong>Family Emergency:</strong> Supporting documentation may be requested by the instructor.
                        </span>
                      </li>
                      <li className="flex items-start text-sm text-slate-700">
                        <span className="mr-3 mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                        <span>
                          <strong>University-Sanctioned Activities:</strong> Prior approval is required when possible.
                        </span>
                      </li>
                    </ul>

                    <div className="mt-4 border-l-4 border-amber-500 bg-amber-50 p-4">
                      <p className="text-sm text-amber-900">
                        <strong>Important:</strong> Make-up exam requests must be submitted within 3 business days of the original exam date. All requests require instructor approval and supporting documentation.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              )
            )}

            {activeTab === "policies" && (
              isAiSyllabusLoading ? (
                renderSyllabusLoading()
              ) : (
              <div
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                style={{ minHeight: "600px" }}
              >
                <div className="flex">
                  <div className="flex-1 p-8">
                    <div className="mb-6 flex items-center justify-between">
                      <h3 className="text-xl font-semibold text-slate-900">
                        {activePolicyTopic.label}
                      </h3>
                    </div>

                    {selectedPolicyContent ? (
                      <div className="space-y-4">
                        {selectedPolicyContent
                          .split("\n")
                          .map((line, index) => {
                            const trimmedLine = line.trim();

                            if (!trimmedLine) {
                              return (
                                <div
                                  key={`policy-space-${index}`}
                                  className="h-2"
                                />
                              );
                            }

                            const cleanedLine = trimmedLine.replace(/^[-•]\s*/, "");
                            const hasBullet =
                              trimmedLine.startsWith("-") ||
                              trimmedLine.startsWith("•");
                            const [label, ...rest] = cleanedLine.split(":");
                            const hasLabel = rest.length > 0 && label.length < 70;

                            if (hasBullet) {
                              return (
                                <p
                                  key={`${trimmedLine}-${index}`}
                                  className="text-sm leading-relaxed text-slate-700"
                                >
                                  <span className="mr-2 text-slate-900">•</span>
                                  {hasLabel ? (
                                    <>
                                      <strong>{label.trim()}:</strong>{" "}
                                      {rest.join(":").trim()}
                                    </>
                                  ) : (
                                    cleanedLine
                                  )}
                                </p>
                              );
                            }

                            if (hasLabel) {
                              return (
                                <p
                                  key={`${trimmedLine}-${index}`}
                                  className="text-sm leading-relaxed text-slate-700"
                                >
                                  <strong>{label.trim()}:</strong>{" "}
                                  {rest.join(":").trim()}
                                </p>
                              );
                            }

                            return (
                              <p
                                key={`${trimmedLine}-${index}`}
                                className="text-sm leading-relaxed text-slate-700"
                              >
                                {trimmedLine}
                              </p>
                            );
                          })}

                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                        {readyAiResources.length === 0
                          ? noIndexedResourcesMessage
                          : "No syllabus-backed policy information is available yet."}
                      </div>
                    )}
                  </div>

                  <aside className="w-80 border-l border-slate-200 bg-slate-50 p-6">
                    <h4 className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Policy Topics
                    </h4>

                    <div className="space-y-2">
                      {policyTopics
                        .filter((topic) => topic.group === "Policy Topics")
                        .map((topic) => (
                          <button
                            key={topic.id}
                            type="button"
                            onClick={() => setActivePolicyTab(topic.id)}
                            className={`w-full rounded-lg px-4 py-3 text-left text-sm transition-colors ${
                              activePolicyTab === topic.id
                                ? "bg-blue-500 font-semibold text-white shadow-sm"
                                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            {topic.label}
                          </button>
                        ))}
                    </div>

                    <h4 className="mb-4 mt-8 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Ethics
                    </h4>

                    <div className="space-y-2">
                      {policyTopics
                        .filter((topic) => topic.group === "Ethics")
                        .map((topic) => (
                          <button
                            key={topic.id}
                            type="button"
                            onClick={() => setActivePolicyTab(topic.id)}
                            className={`w-full rounded-lg px-4 py-3 text-left text-sm transition-colors ${
                              activePolicyTab === topic.id
                                ? "bg-blue-500 font-semibold text-white shadow-sm"
                                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            {topic.label}
                          </button>
                        ))}
                    </div>
                  </aside>
                </div>
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
                  </div>

                  <p className="leading-relaxed text-slate-700">
                    {(displayedMoreInfo.learningOutcomes.length
                      ? displayedMoreInfo.learningOutcomes
                      : syllabusDescription
                        ? splitSummaryText(syllabusDescription)
                        : [
                            "Describe the course expectations and learning goals.",
                            "Follow the weekly syllabus plan and course deliverables.",
                            "Use announcements, resources, grading details, and deadlines effectively.",
                            "Apply course knowledge to assignments, projects, and assessments.",
                          ]
                    ).join(" ")}
                  </p>
                </div>

                <div className="border-b border-slate-200 p-8">
                  <div className="mb-6 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900">
                      Contribution of the Course to the Program
                    </h3>
                  </div>

                  <p className="text-slate-700">
                    {displayedMoreInfo.contributionToProgram ||
                      "Not found in uploaded syllabus."}
                  </p>
                </div>

                <div className="p-8">
                  <div className="mb-6 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900">
                      Course Structure
                    </h3>
                  </div>

                  <p className="mb-6 text-slate-700">
                    {displayedMoreInfo.courseStructure ||
                      "This course uses a variety of teaching and learning methods to support understanding, participation, and practical application."}
                  </p>

                  <div className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-4">
                    {(displayedMoreInfo.teachingMethods.length
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
                        ]
                    ).map((method) => (
                      <div key={method} className="flex items-start gap-3">
                        <div className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                        <span className="text-sm text-slate-700">{method}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              )
            )}


          </div>
        </div>
      </div>
    </Layout>
  );
}
