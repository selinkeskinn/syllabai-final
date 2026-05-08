import { api } from "@/lib/api";

export type DeadlineCourse = {
  id: string;
  code?: string;
  title?: string;
};

export type Deadline = {
  id: string;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  type?: string | null;
  courseId?: string;
  course?: DeadlineCourse | null;
};

export const deadlineService = {
  async getAllDeadlines(courseId?: string): Promise<Deadline[]> {
    const response = await api.get("/deadlines", {
      params: courseId ? { courseId } : undefined,
    });

    return response.data;
  },

  async deleteDeadline(id: string) {
    const response = await api.delete(`/deadlines/${id}`);
    return response.data;
  },
};
