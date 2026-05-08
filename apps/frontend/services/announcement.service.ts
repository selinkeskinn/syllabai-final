import { api } from "@/lib/api";

export type AnnouncementCourse = {
  id?: string;
  code?: string;
  title?: string;
};

export type Announcement = {
  id?: string | number;
  courseId?: string;
  title?: string;
  content?: string;
  type?: string;
  createdAt?: string;
  updatedAt?: string;
  course?: AnnouncementCourse | null;
};

export const announcementService = {
  async getAllAnnouncements(courseId?: string): Promise<Announcement[]> {
    const response = await api.get("/announcements", {
      params: courseId ? { courseId } : undefined,
    });

    const payload = response.data;

    if (Array.isArray(payload)) {
      return payload;
    }

    if (Array.isArray(payload?.data)) {
      return payload.data;
    }

    return [];
  },
};
