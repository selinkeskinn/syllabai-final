import { api } from "@/lib/api";

export type CourseSummary = {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  semester?: string | null;
  deliveryMethod?: string | null;
  joinKey?: string | null;
  archivedAt?: string | null;
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
    deliveryMethod?: string;
    file?: File | null;
  }) {
    if (data.file) {
      const formData = new FormData();
      formData.append("code", data.code);
      formData.append("title", data.title);
      formData.append("description", data.description);
      formData.append("semester", data.semester);
      formData.append("deliveryMethod", data.deliveryMethod || "In-Person");
      formData.append("file", data.file);

      const response = await api.post("/courses", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      return response.data;
    }

    const response = await api.post("/courses", {
      code: data.code,
      title: data.title,
      description: data.description,
      semester: data.semester,
      deliveryMethod: data.deliveryMethod || "In-Person",
    });
    return response.data;
  },

  async updateCourse(
    id: string,
    data: Partial<{
      title: string;
      description: string;
      semester: string;
      deliveryMethod: string;
    }>
  ): Promise<CourseSummary> {
    const response = await api.patch(`/courses/${id}`, data);
    return response.data;
  },

  async archiveCourse(id: string): Promise<CourseSummary> {
    const response = await api.delete(`/courses/${id}`);
    return response.data;
  },

  async leaveCourse(
    id: string
  ): Promise<{ message: string; courseId: string }> {
    const response = await api.delete(`/courses/${id}/enrollment`);
    return response.data;
  },
};
