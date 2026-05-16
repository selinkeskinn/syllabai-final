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

export type AnnouncementPayload = {
  courseId: string;
  title: string;
  content: string;
  type?: string;
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

  async createAnnouncement(data: AnnouncementPayload): Promise<Announcement> {
    const response = await api.post("/announcements", data);
    return response.data;
  },

  async updateAnnouncement(
    id: string | number,
    data: Partial<Omit<AnnouncementPayload, "courseId">>
  ): Promise<Announcement> {
    const response = await api.put(`/announcements/${id}`, data);
    return response.data;
  },

  async deleteAnnouncement(id: string | number) {
    const response = await api.delete(`/announcements/${id}`);
    return response.data;
  },
};
