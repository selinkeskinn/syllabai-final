"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import InstructorLayout from "@/components/InstructorLayout";
import { courseService } from "@/services/course.service";
import {
  getSyllabusDescriptionText,
  getSyllabusDocumentMetadata,
  Syllabus,
  syllabusService,
} from "@/services/syllabus.service";
import { api } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";
import SettingsButton from "@/components/SettingsButton";
import {
  ArrowLeft,
  Bell,
  Calendar,
  ChevronDown,
  Copy,
  Download,
  Edit2,
  FileText,
  KeyRound,
  MessageSquare,
  Plus,
  Search,
  Settings,
} from "lucide-react";
import {
  Cell,
  Legend,
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
};

const tabs: { id: TabType; label: string; icon: any }[] = [
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

  const resolvedSyllabus = syllabus ?? course?.syllabus ?? null;
  const syllabusDescription = getSyllabusDescriptionText(resolvedSyllabus);
  const syllabusDocument = getSyllabusDocumentMetadata(resolvedSyllabus);
  const sortedDeadlines = [...(course?.deadlines || [])].sort((a, b) => {
    const first = a.dueDate ? new Date(a.dueDate).getTime() : 0;
    const second = b.dueDate ? new Date(b.dueDate).getTime() : 0;
    return first - second;
  });

  const visibleAnnouncements = announcements.slice(0, 2);
  const visibleDeadlines = sortedDeadlines.slice(0, 3);
  const gradingRows = getLabeledRows(resolvedSyllabus?.grading);
  const gradingChartData = getGradingChartData(gradingRows);

  const resourceFiles: ResourceFile[] = syllabusDocument.fileName
    ? [
        {
          id: "syllabus-document",
          name: syllabusDocument.fileName,
          type: getFileType(syllabusDocument.fileName),
          size: "Uploaded file",
          uploadDate: formatShortDate(
            resolvedSyllabus?.documentUploadedAt || resolvedSyllabus?.updatedAt
          ),
        },
      ]
    : [];

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
      paragraphs: resolvedSyllabus?.policies
        ? resolvedSyllabus.policies.split("\n").map((line) => line.trim()).filter(Boolean)
        : [
            "Please use the university mail address for official course communication.",
            "All official course announcements will be posted through the course portal.",
            "Email responses can be expected within 24-48 hours during weekdays.",
          ],
      noteTone: "blue",
      note: "For urgent matters during office hours, in-person visits are preferred over email communication.",
    },
    aiTools: {
      title: "Usage of AI & Digital Tools",
      paragraphs: [
        "The use of AI tools is permitted for learning purposes but must be properly disclosed in submissions.",
        "Students must understand and be able to explain any code or content generated with AI assistance.",
      ],
      noteTone: "amber",
      note: "During exams and quizzes, all AI tools and digital assistance are prohibited unless explicitly stated otherwise.",
    },
    deadlines: {
      title: "Deadlines",
      paragraphs: [
        "All assignments must be submitted by the stated due date unless otherwise specified.",
        "Late submissions may be penalized according to the instructor's syllabus policy.",
        "Extension requests should be submitted before the deadline with valid justification.",
      ],
      noteTone: "blue",
      note: "Plan ahead and start assignments early to avoid technical issues close to the deadline.",
    },
    attendance: {
      title: "Attendance",
      paragraphs: [
        "Regular attendance is expected and will be tracked throughout the semester.",
        "Students should notify the instructor in advance when they are unable to attend.",
      ],
      noteTone: "red",
      note: "Repeated unexcused absences may affect participation and course performance.",
    },
    disability: {
      title: "Disabled Student Support",
      paragraphs: [
        "Students with disabilities are entitled to appropriate accommodations to ensure equal access to course materials and assessments.",
        "Please contact the university's Disability Support Services office to arrange accommodations.",
      ],
      noteTone: "blue",
      note: "Accommodation requests will be handled confidentially and according to university policies.",
    },
    ethics: {
      title: "Oral and Written Communication Ethics",
      paragraphs: [
        "All written and oral communications must be respectful, professional, and free from plagiarism.",
        "Proper citation is required for all external sources used in assignments.",
      ],
      noteTone: "amber",
      note: "Collaborative work is encouraged, but all submissions must represent your own understanding and effort.",
    },
    privacy: {
      title: "Privacy and Copyright",
      paragraphs: [
        "Course materials are protected by copyright and are for personal educational use only.",
        "Recording lectures or sharing course materials outside the class without permission is prohibited.",
      ],
      noteTone: "blue",
      note: "Respecting intellectual property rights is essential for maintaining academic integrity.",
    },
    academicIntegrity: {
      title: "Academic Integrity, Cheating and Plagiarism",
      paragraphs: [
        "Academic integrity is fundamental to the educational process.",
        "Cheating includes unauthorized use of materials during exams and submitting work that is not your own.",
        "Plagiarism is the use of another person's ideas, words, or work without proper attribution.",
      ],
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

  const moreInfoLearningOutcomes = syllabusDescription
    ? syllabusDescription
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    : [
        "Describe the role of this course in the broader academic program.",
        "Understand the core concepts, expectations, and weekly learning structure.",
        "Apply course knowledge through assignments, deadlines, and class activities.",
        "Use course resources, announcements, and feedback channels effectively.",
        course?.description ||
          "Demonstrate understanding of the course objectives and assessment structure.",
      ];

  const courseStructureItems = [
    "Collaborative Learning",
    "Discussion",
    "Guest Speaker",
    "Lecture",
    "Observation",
    "Problem Solving",
    "Reading",
    "Technology-Enhanced Learning",
  ];

  const prerequisiteItems = [
    "Enrollment in the course workspace",
    "Review of the official syllabus",
    "Completion of required weekly tasks",
  ];

  const courseObjectiveItems = syllabusDescription
    ? syllabusDescription
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 5)
    : [
        course.description ||
          "Understand the course expectations, weekly plan, and assessment structure.",
        "Follow course announcements, deadlines, resources, and grading requirements.",
        "Apply course concepts through assignments, exams, projects, and weekly activities.",
        "Use feedback and instructor communication channels effectively.",
      ];

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
                    {course.semester || "Current Semester"}
                  </p>
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
                  href={`/instructor/courses/${course.id}/syllabus/new`}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 transition-colors hover:border-blue-300 hover:bg-blue-50"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Upload Syllabus
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Add or replace official file
                    </p>
                  </div>
                  <FileText className="h-5 w-5 text-blue-600" />
                </Link>

                <Link
                  href={`/instructor/courses/${course.id}/syllabus/edit`}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 transition-colors hover:border-blue-300 hover:bg-blue-50"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Edit Syllabus
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Grading, policies, resources
                    </p>
                  </div>
                  <Edit2 className="h-5 w-5 text-blue-600" />
                </Link>

                <Link
                  href={`/instructor/courses/${course.id}/week/new`}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 transition-colors hover:border-blue-300 hover:bg-blue-50"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Add Week
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Add weekly course plan
                    </p>
                  </div>
                  <Calendar className="h-5 w-5 text-blue-600" />
                </Link>
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
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="p-8">
                    <div className="mb-6 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900">
                        Instructor Information
                      </h3>

                      <Link
                        href={`/instructor/courses/${course.id}/syllabus/edit`}
                        className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <Edit2 className="h-4 w-4" />
                        <span className="text-sm">Edit</span>
                      </Link>
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
                          Not published yet
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
                          Not published yet
                        </p>
                      </div>

                      <div className="col-span-2">
                        <p className="mb-1 text-xs text-slate-500">CV</p>
                        <a
                          href="#"
                          className="text-sm text-blue-600 hover:underline"
                        >
                          View Curriculum Vitae
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "courseInfo" && (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 p-8">
                    <div className="mb-6 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900">
                        Course Details
                      </h3>

                      <Link
                        href={`/instructor/courses/${course.id}/syllabus/edit`}
                        className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <Edit2 className="h-4 w-4" />
                        <span className="text-sm">Edit</span>
                      </Link>
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
                          Not published yet
                        </p>
                      </div>

                      <div>
                        <p className="mb-1 text-xs text-slate-500">
                          Class Schedule
                        </p>
                        <p className="text-sm text-slate-900">
                          Not published yet
                        </p>
                      </div>

                      <div>
                        <p className="mb-1 text-xs text-slate-500">
                          Classroom
                        </p>
                        <p className="text-sm text-slate-900">
                          Not published yet
                        </p>
                      </div>

                      <div>
                        <p className="mb-1 text-xs text-slate-500">
                          Delivery Method
                        </p>
                        <p className="text-sm text-slate-900">In-Person</p>
                      </div>

                      <div>
                        <p className="mb-1 text-xs text-slate-500">
                          Course Type
                        </p>
                        <p className="text-sm text-slate-900">
                          {course.semester || "Current Semester"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="border-b border-slate-200 p-8">
                    <div className="mb-6 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900">
                        Prerequisites
                      </h3>

                      <Link
                        href={`/instructor/courses/${course.id}/syllabus/edit`}
                        className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <Edit2 className="h-4 w-4" />
                        <span className="text-sm">Edit</span>
                      </Link>
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

                      <Link
                        href={`/instructor/courses/${course.id}/syllabus/edit`}
                        className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <Edit2 className="h-4 w-4" />
                        <span className="text-sm">Edit</span>
                      </Link>
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
                    <div className="mb-6 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900">
                        Important Information
                      </h3>

                      <Link
                        href={`/instructor/courses/${course.id}/syllabus/edit`}
                        className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <Edit2 className="h-4 w-4" />
                        <span className="text-sm">Edit</span>
                      </Link>
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
                        {course.semester || "Current Semester"}
                      </p>
                    </div>

                    <Link
                      href={`/instructor/courses/${course.id}/week/new`}
                      className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
                    >
                      <Edit2 className="h-4 w-4" />
                      <span className="text-sm font-medium">Edit</span>
                    </Link>
                  </div>

                  {loadingSyllabus ? (
                    <div className="p-8 text-sm text-slate-500">
                      Loading calendar...
                    </div>
                  ) : !resolvedSyllabus?.weeks?.length ? (
                    <div className="p-8 text-sm text-slate-500">
                      No weekly plan has been added yet.
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
                            {[...resolvedSyllabus.weeks]
                              .sort((a, b) => a.weekNo - b.weekNo)
                              .map((week) => {
                                const tone = getCalendarTone(
                                  week.topic,
                                  week.details
                                );
                                const place = getWeekPlace(week.weekNo);

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
                      href={`/instructor/courses/${course.id}/syllabus/new`}
                      className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-600"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add Document</span>
                    </Link>

                    <button
                      type="button"
                      disabled={selectedFiles.size === 0}
                      className="flex items-center gap-2 rounded-lg border-2 border-blue-500 px-4 py-2 font-medium text-blue-600 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download ({selectedFiles.size})</span>
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
                      <div className="col-span-5 text-xs font-semibold uppercase tracking-wide text-slate-700">
                        File Name
                      </div>
                      <div className="col-span-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
                        Size
                      </div>
                      <div className="col-span-3 text-xs font-semibold uppercase tracking-wide text-slate-700">
                        Upload Date
                      </div>
                    </div>

                    {filteredResourceFiles.length === 0 ? (
                      <div className="px-4 py-6 text-sm text-slate-500">
                        No uploaded documents found.
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

                            <div className="col-span-5">
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

                            <div className="col-span-3">
                              <span className="text-sm text-slate-600">
                                {file.uploadDate}
                              </span>
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
                      <Link
                        href={`/instructor/courses/${course.id}/syllabus/edit`}
                        className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <Edit2 className="h-4 w-4" />
                        <span className="text-sm font-medium">Edit</span>
                      </Link>
                    </div>

                    {renderMultilineText(resolvedSyllabus?.resources)}
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

                    <Link
                      href={`/instructor/courses/${course.id}/syllabus/edit`}
                      className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      <Edit2 className="h-4 w-4" />
                      <span className="text-sm font-medium">Edit</span>
                    </Link>
                  </div>

                  {gradingRows.length === 0 ? (
                    <div className="p-8 text-sm text-slate-500">
                      No grading information has been added yet.
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
                                label={(props: any) =>
                                  `${props.name}: ${props.value}%`
                                }
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
                                formatter={(value, entry: any) =>
                                  `${value} (${entry.payload.value}%)`
                                }
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
                              const percent = extractPercentValue(row.value);
                              const description =
                                row.value
                                  .replace(/\(?\d+(?:\.\d+)?\s*%\)?/g, "")
                                  .trim() ||
                                "Assessment component from the syllabus";

                              return (
                                <tr
                                  key={row.id}
                                  className="border-b border-slate-200 transition-colors hover:bg-slate-50"
                                >
                                  <td className="px-8 py-5 text-sm font-medium text-slate-900">
                                    {row.label}
                                  </td>
                                  <td className="px-8 py-5 text-sm text-slate-600">
                                    {description}
                                  </td>
                                  <td className="px-8 py-5 text-sm text-slate-600">
                                    0-100 points
                                  </td>
                                  <td className="px-8 py-5 text-right text-sm font-semibold text-slate-900">
                                    {percent > 0 ? `${percent}%` : row.value}
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
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900">
                        Make-up Exam Rules
                      </h3>
                      <Link
                        href={`/instructor/courses/${course.id}/syllabus/edit`}
                        className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <Edit2 className="h-4 w-4" />
                        <span className="text-sm font-medium">Edit</span>
                      </Link>
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
                <div className="flex min-h-[600px] overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="flex-1 p-8">
                    <div className="mb-6 flex items-center justify-between">
                      <h3 className="text-xl font-semibold text-slate-900">
                        {activePolicy.title}
                      </h3>

                      <Link
                        href={`/instructor/courses/${course.id}/syllabus/edit`}
                        className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <Edit2 className="h-4 w-4" />
                        <span className="text-sm font-medium">Edit</span>
                      </Link>
                    </div>

                    <div className="space-y-4">
                      {activePolicy.paragraphs.map((paragraph) => (
                        <p
                          key={paragraph}
                          className="text-sm leading-relaxed text-slate-700"
                        >
                          {paragraph}
                        </p>
                      ))}

                      <div
                        className={`mt-6 rounded-r-lg border-l-4 p-4 ${noteStyles}`}
                      >
                        <p className="text-sm">
                          <strong>Note:</strong> {activePolicy.note}
                        </p>
                      </div>
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
              )}

              {activeTab === "moreInfo" && (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 p-8">
                    <div className="mb-6 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900">
                        Course Learning Outcomes
                      </h3>

                      <Link
                        href={`/instructor/courses/${course.id}/syllabus/edit`}
                        className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <Edit2 className="h-4 w-4" />
                        <span className="text-sm">Edit</span>
                      </Link>
                    </div>

                    <p className="mb-4 text-slate-700">
                      At the end of the course, you will be able to:
                    </p>

                    <ol className="list-inside list-decimal space-y-2.5 text-slate-700">
                      {moreInfoLearningOutcomes.map((item, index) => (
                        <li key={`${item}-${index}`}>{item}</li>
                      ))}
                    </ol>
                  </div>

                  <div className="border-b border-slate-200 p-8">
                    <div className="mb-6 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900">
                        Contribution of the Course to the Program
                      </h3>

                      <Link
                        href={`/instructor/courses/${course.id}/syllabus/edit`}
                        className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <Edit2 className="h-4 w-4" />
                        <span className="text-sm">Edit</span>
                      </Link>
                    </div>

                    <p className="leading-relaxed text-slate-700">
                      {course.description ||
                        "This course contributes to the program by helping students build practical knowledge, follow structured academic resources, complete course deliverables, and connect weekly learning outcomes with program-level expectations."}
                    </p>
                  </div>

                  <div className="p-8">
                    <div className="mb-6 flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-slate-900">
                        Course Structure
                      </h3>

                      <Link
                        href={`/instructor/courses/${course.id}/syllabus/edit`}
                        className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <Edit2 className="h-4 w-4" />
                        <span className="text-sm">Edit</span>
                      </Link>
                    </div>

                    <p className="mb-6 text-slate-700">
                      This course employs a variety of teaching and learning
                      methods to ensure comprehensive understanding and practical
                      application of course concepts.
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
              )}
            </main>
          </>
        )}
      </div>
    </InstructorLayout>
  );
}
