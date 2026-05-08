import { api } from "@/lib/api";

export type CourseSummary = {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  semester?: string | null;
  joinKey?: string | null;
  instructor?: {
    id?: string;
    name?: string;
    email?: string;
  } | null;
  syllabus?: {
    weeks?: {
      id: string;
      weekNo: number;
      topic: string;
      details?: string | null;
      todo?: string | null;
    }[];
  } | null;
  deadlines?: {
    id: string;
    title: string;
    dueDate?: string | null;
    type?: string | null;
  }[];
};

const normalizeCourseList = (payload: unknown): CourseSummary[] => {
  const rawItems = Array.isArray(payload)
    ? payload
    : payload &&
      typeof payload === "object" &&
      "data" in payload &&
      Array.isArray((payload as { data?: unknown }).data)
    ? (payload as { data: unknown[] }).data
    : [];

  return rawItems
    .map((item) => {
      if (item && typeof item === "object" && "course" in item) {
        return (item as { course?: CourseSummary }).course;
      }

      return item as CourseSummary;
    })
    .filter(Boolean) as CourseSummary[];
};

export const courseService = {
  async getAllCourses(): Promise<CourseSummary[]> {
    const response = await api.get("/courses");
    return normalizeCourseList(response.data);
  },

  async getEnrolledCourses(): Promise<CourseSummary[]> {
    const response = await api.get("/courses/enrolled");
    return normalizeCourseList(response.data);
  },

  async enrollWithJoinKey(joinKey: string): Promise<CourseSummary> {
    const response = await api.post("/courses/enroll", { joinKey });
    return response.data.course;
  },

  async getMyCourses(): Promise<CourseSummary[]> {
    const response = await api.get("/courses/my");
    return normalizeCourseList(response.data);
  },

  async getCourseById(id: string) {
    const response = await api.get(`/courses/${id}`);
    return response.data;
  },

  async createCourse(data: {
    code: string;
    title: string;
    description: string;
    semester: string;
  }) {
    const response = await api.post("/courses", data);
    return response.data;
  },
};
