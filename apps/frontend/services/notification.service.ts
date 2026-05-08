import { api } from "@/lib/api";

export type NotificationItem = {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "SYLLABUS_UPDATED" | "ANNOUNCEMENT" | "DEADLINE_REMINDER" | "ENROLLMENT";
  isRead: boolean;
  createdAt: string;
};

export const notificationService = {
  async getNotifications(): Promise<NotificationItem[]> {
    const response = await api.get("/notifications");
    return Array.isArray(response.data) ? response.data : [];
  },

  async getUnreadCount(): Promise<number> {
    const response = await api.get("/notifications/unread-count");
    return Number(response.data?.count || 0);
  },

  async markRead(id: string) {
    const response = await api.patch(`/notifications/${id}/read`);
    return response.data;
  },

  async markAllRead() {
    const response = await api.patch("/notifications/read-all");
    return response.data;
  },
};
