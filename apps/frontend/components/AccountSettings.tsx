"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  NotificationPreferences,
  userService,
  UserProfile,
} from "@/services/user.service";

type AccountSettingsProps = {
  title: string;
  description: string;
};

type ProfileForm = {
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  studentId: string;
};

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const defaultPreferences: Required<NotificationPreferences> = {
  emailNotificationsEnabled: true,
  pushNotificationsEnabled: true,
  assignmentRemindersEnabled: true,
  gradeUpdatesEnabled: true,
  courseAnnouncementsEnabled: true,
  deadlineAlertsEnabled: true,
};

const getApiErrorMessage = (error: any, fallback: string) => {
  const message = error?.response?.data?.message;

  if (Array.isArray(message)) {
    return message.join("\n");
  }

  if (typeof message === "string") {
    return message;
  }

  return fallback;
};

const preferenceLabels: {
  key: keyof NotificationPreferences;
  title: string;
  description: string;
}[] = [
  {
    key: "emailNotificationsEnabled",
    title: "Email Notifications",
    description: "Receive important updates through email.",
  },
  {
    key: "pushNotificationsEnabled",
    title: "Push Notifications",
    description: "Show in-app notification alerts.",
  },
  {
    key: "assignmentRemindersEnabled",
    title: "Assignment Reminders",
    description: "Get reminders for assignment-related updates.",
  },
  {
    key: "gradeUpdatesEnabled",
    title: "Grade Updates",
    description: "Receive notifications for grade-related updates.",
  },
  {
    key: "courseAnnouncementsEnabled",
    title: "Course Announcements",
    description: "Receive announcements from enrolled or managed courses.",
  },
  {
    key: "deadlineAlertsEnabled",
    title: "Deadline Alerts",
    description: "Get alerts for upcoming deadlines.",
  },
];

export default function AccountSettings({
  title,
  description,
}: AccountSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    name: "",
    firstName: "",
    lastName: "",
    email: "",
    studentId: "",
  });
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [preferences, setPreferences] =
    useState<Required<NotificationPreferences>>(defaultPreferences);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);

  const isStudent = user?.role === "STUDENT";

  const initials = useMemo(() => {
    const value = profileForm.name || profileForm.email || "User";
    return value
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [profileForm.email, profileForm.name]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        setErrorMessage("");

        const [profile, notificationPreferences] = await Promise.all([
          userService.getMe(),
          userService.getNotificationPreferences(),
        ]);

        setUser(profile);
        setProfileForm({
          name: profile.name || "",
          firstName: profile.firstName || "",
          lastName: profile.lastName || "",
          email: profile.email || "",
          studentId: profile.studentId || "",
        });
        setPreferences({
          ...defaultPreferences,
          ...notificationPreferences,
        });
      } catch {
        setErrorMessage("Settings could not be loaded.");
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!profileForm.name.trim()) {
      setErrorMessage("Name cannot be empty.");
      return;
    }

    if (!profileForm.email.trim()) {
      setErrorMessage("Email cannot be empty.");
      return;
    }

    try {
      setSavingProfile(true);
      setMessage("");
      setErrorMessage("");

      const updatedUser = await userService.updateMe({
        name: profileForm.name.trim(),
        firstName: profileForm.firstName.trim(),
        lastName: profileForm.lastName.trim(),
        email: profileForm.email.trim().toLowerCase(),
        studentId: isStudent ? profileForm.studentId.trim() : undefined,
      });

      setUser(updatedUser);
      setProfileForm({
        name: updatedUser.name || "",
        firstName: updatedUser.firstName || "",
        lastName: updatedUser.lastName || "",
        email: updatedUser.email || "",
        studentId: updatedUser.studentId || "",
      });
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setMessage("Profile updated successfully.");
    } catch (error: any) {
      setErrorMessage(
        getApiErrorMessage(error, "Profile could not be updated.")
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (
      !passwordForm.currentPassword ||
      !passwordForm.newPassword ||
      !passwordForm.confirmPassword
    ) {
      setErrorMessage("Please fill in all password fields.");
      return;
    }

    if (passwordForm.newPassword === passwordForm.currentPassword) {
      setErrorMessage("New password must be different from current password.");
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setErrorMessage("New password must be at least 6 characters.");
      return;
    }

    if (passwordForm.confirmPassword.length < 6) {
      setErrorMessage("Confirm password must be at least 6 characters.");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setErrorMessage("New password and confirmation do not match.");
      return;
    }

    try {
      setSavingPassword(true);
      setMessage("");
      setErrorMessage("");

      await userService.updatePassword(passwordForm);

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setMessage("Password updated successfully.");
    } catch (error: any) {
      setErrorMessage(
        getApiErrorMessage(error, "Password could not be updated.")
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const handlePreferencesSubmit = async () => {
    try {
      setSavingPreferences(true);
      setMessage("");
      setErrorMessage("");

      const updatedPreferences =
        await userService.updateNotificationPreferences(preferences);

      setPreferences({
        ...defaultPreferences,
        ...updatedPreferences,
      });
      setMessage("Notification preferences updated successfully.");
    } catch (error: any) {
      setErrorMessage(
        getApiErrorMessage(
          error,
          "Notification preferences could not be updated."
        )
      );
    } finally {
      setSavingPreferences(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-8 py-6">
        <h1 className="text-[28px] font-semibold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </header>

      <main className="px-8 py-8">
        {loading ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Loading settings...
          </section>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-6">
              {(message || errorMessage) && (
                <div
                  className={`whitespace-pre-line rounded-xl border px-5 py-4 text-sm font-medium ${
                    errorMessage
                      ? "border-red-100 bg-red-50 text-red-700"
                      : "border-blue-100 bg-blue-50 text-blue-700"
                  }`}
                >
                  {errorMessage || message}
                </div>
              )}

              <section className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="text-lg font-semibold text-slate-900">
                  Profile Settings
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Update your personal information and account email.
                </p>

                <form onSubmit={handleProfileSubmit} className="mt-6 space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Display Name
                    </label>
                    <input
                      value={profileForm.name}
                      onChange={(event) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          name: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        First Name
                      </label>
                      <input
                        value={profileForm.firstName}
                        onChange={(event) =>
                          setProfileForm((prev) => ({
                            ...prev,
                            firstName: event.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Last Name
                      </label>
                      <input
                        value={profileForm.lastName}
                        onChange={(event) =>
                          setProfileForm((prev) => ({
                            ...prev,
                            lastName: event.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Email
                    </label>
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={(event) =>
                        setProfileForm((prev) => ({
                          ...prev,
                          email: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      {isStudent
                        ? "Student emails must end with @bahcesehir.edu.tr."
                        : "Instructor emails must end with @bau.edu.tr."}
                    </p>
                  </div>

                  {isStudent ? (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Student ID
                      </label>
                      <input
                        value={profileForm.studentId}
                        onChange={(event) =>
                          setProfileForm((prev) => ({
                            ...prev,
                            studentId: event.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  ) : null}

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingProfile ? "Saving..." : "Save Profile"}
                    </button>
                  </div>
                </form>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="text-lg font-semibold text-slate-900">
                  Password
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Change your password using your current password.
                </p>

                <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-4">
                  <input
                    type="password"
                    placeholder="Current password"
                    value={passwordForm.currentPassword}
                    onChange={(event) =>
                      setPasswordForm((prev) => ({
                        ...prev,
                        currentPassword: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  />

                  <input
                    type="password"
                    placeholder="New password"
                    value={passwordForm.newPassword}
                    onChange={(event) =>
                      setPasswordForm((prev) => ({
                        ...prev,
                        newPassword: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  />

                  <input
                    type="password"
                    placeholder="Confirm new password"
                    value={passwordForm.confirmPassword}
                    onChange={(event) =>
                      setPasswordForm((prev) => ({
                        ...prev,
                        confirmPassword: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  />

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={savingPassword}
                      className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingPassword ? "Updating..." : "Update Password"}
                    </button>
                  </div>
                </form>
              </section>
            </div>

            <aside className="space-y-6">
              <section className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-xl font-bold text-white">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold text-slate-900">
                      {profileForm.name || "User"}
                    </p>
                    <p className="truncate text-sm text-slate-500">
                      {profileForm.email}
                    </p>
                    <p className="mt-1 text-xs font-medium uppercase text-blue-600">
                      {user?.role || "USER"}
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="text-lg font-semibold text-slate-900">
                  Notification Preferences
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Choose which updates you want to receive.
                </p>

                <div className="mt-5 space-y-4">
                  {preferenceLabels.map((item) => (
                    <label
                      key={item.key}
                      className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-100 p-4 transition hover:bg-slate-50"
                    >
                      <span>
                        <span className="block text-sm font-semibold text-slate-900">
                          {item.title}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-slate-500">
                          {item.description}
                        </span>
                      </span>

                      <input
                        type="checkbox"
                        checked={Boolean(preferences[item.key])}
                        onChange={(event) =>
                          setPreferences((prev) => ({
                            ...prev,
                            [item.key]: event.target.checked,
                          }))
                        }
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600"
                      />
                    </label>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handlePreferencesSubmit}
                  disabled={savingPreferences}
                  className="mt-5 w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingPreferences ? "Saving..." : "Save Preferences"}
                </button>
              </section>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
