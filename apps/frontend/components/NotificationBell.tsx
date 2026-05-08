"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import {
  NotificationItem,
  notificationService,
} from "@/services/notification.service";

const formatDate = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchUnreadCount = async () => {
    try {
      const count = await notificationService.getUnreadCount();
      setUnreadCount(count);
    } catch {
      setUnreadCount(0);
    }
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const data = await notificationService.getNotifications();
      setNotifications(data);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
  }, []);

  const handleToggle = async () => {
    const nextOpen = !open;
    setOpen(nextOpen);

    if (nextOpen) {
      await fetchNotifications();
      await fetchUnreadCount();
    }
  };

  const handleMarkRead = async (item: NotificationItem) => {
    if (!item.isRead) {
      await notificationService.markRead(item.id);
      await fetchNotifications();
      await fetchUnreadCount();
    }
  };

  const handleMarkAllRead = async () => {
    await notificationService.markAllRead();
    await fetchNotifications();
    await fetchUnreadCount();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className="relative rounded-lg p-2.5 transition hover:bg-slate-100"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5 text-slate-600" />

        {unreadCount > 0 ? (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 w-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Notifications
              </h3>
              <p className="text-xs text-slate-500">
                {unreadCount} unread
              </p>
            </div>

            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          </div>

          <div className="max-h-[380px] overflow-y-auto">
            {loading ? (
              <div className="px-4 py-6 text-sm text-slate-500">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-6 text-sm text-slate-500">
                No notifications yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleMarkRead(item)}
                    className={`w-full px-4 py-3 text-left transition hover:bg-slate-50 ${
                      item.isRead ? "bg-white" : "bg-blue-50/50"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <span className="line-clamp-1 text-sm font-semibold text-slate-900">
                        {item.title}
                      </span>

                      {!item.isRead ? (
                        <span className="h-2 w-2 rounded-full bg-blue-600" />
                      ) : null}
                    </div>

                    <p className="line-clamp-2 text-xs leading-5 text-slate-600">
                      {item.message}
                    </p>

                    <div className="mt-2 flex items-center justify-between">
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                        {item.type.replaceAll("_", " ")}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {formatDate(item.createdAt)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
