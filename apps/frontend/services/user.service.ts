import { api } from "@/lib/api";

export type UserProfile = {
  id: string;
  email: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  studentId?: string | null;
  role?: "STUDENT" | "INSTRUCTOR" | string;
  avatarUrl?: string | null;
  createdAt?: string | null;
  isActive?: boolean | null;
  deactivatedAt?: string | null;
};

export type UpdateProfilePayload = {
  name?: string;
  firstName?: string;
  lastName?: string;
};

export type UpdatePasswordPayload = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export type NotificationPreferences = {
  emailNotificationsEnabled?: boolean;
  pushNotificationsEnabled?: boolean;
  assignmentRemindersEnabled?: boolean;
  gradeUpdatesEnabled?: boolean;
  courseAnnouncementsEnabled?: boolean;
  deadlineAlertsEnabled?: boolean;
};

export const userService = {
  async getMe(): Promise<UserProfile> {
    const response = await api.get("/users/me");
    return response.data;
  },

  async updateMe(data: UpdateProfilePayload): Promise<UserProfile> {
    const response = await api.patch("/users/me", data);
    return response.data;
  },

  async updatePassword(data: UpdatePasswordPayload) {
    const response = await api.patch("/users/me/password", data);
    return response.data;
  },

  async getNotificationPreferences(): Promise<NotificationPreferences> {
    const response = await api.get("/users/me/notification-preferences");
    return response.data;
  },

  async updateNotificationPreferences(data: NotificationPreferences) {
    const response = await api.patch("/users/me/notification-preferences", data);
    return response.data;
  },

  async uploadAvatar(file: File): Promise<UserProfile> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await api.post("/users/me/avatar", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return response.data;
  },

  async removeAvatar(): Promise<UserProfile> {
    const response = await api.delete("/users/me/avatar");
    return response.data;
  },
};
