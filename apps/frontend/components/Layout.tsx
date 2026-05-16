"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import CourseAssistantWidget from "@/components/CourseAssistantWidget";
import {
  Bell,
  BookOpen,
  CalendarDays,
  GraduationCap,
  LayoutGrid,
  LogOut,
  MessageSquare,
} from "lucide-react";

type LayoutProps = {
  children: ReactNode;
};

type StoredUser = {
  name?: string;
  email?: string;
  role?: string;
  avatarUrl?: string | null;
};

type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutGrid;
};

const getInitials = (value?: string) => {
  if (!value) {
    return "ST";
  }

  return value
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

const getAvatarUrl = (value?: string | null) => {
  if (!value) return "";

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";
  const serverBase = apiBase.replace(/\/api\/?$/, "");
  return `${serverBase}${value.startsWith("/") ? value : `/${value}`}`;
};

const navItems = [
  { label: "Student Dashboard", href: "/dashboard", icon: LayoutGrid },
  { label: "My Courses", href: "/courses", icon: BookOpen },
  { label: "Deadlines", href: "/deadlines", icon: CalendarDays },
  { label: "Announcements", href: "/announcements", icon: Bell },
  { label: "Feedback", href: "/feedback", icon: MessageSquare },
] satisfies NavItem[];

export default function Layout({ children }: LayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [storedUser, setStoredUser] = useState<StoredUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const rawUser = localStorage.getItem("user");

    if (!token || !rawUser) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      router.replace("/");
      return;
    }

    try {
      const parsedUser = JSON.parse(rawUser) as StoredUser;

      if (parsedUser.role === "INSTRUCTOR") {
        router.replace("/instructor/dashboard");
        return;
      }

      if (parsedUser.role && parsedUser.role !== "STUDENT") {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        router.replace("/");
        return;
      }

      setStoredUser(parsedUser);
      setAuthChecked(true);

      const refreshStoredUser = () => {
        const updatedRawUser = localStorage.getItem("user");
        if (!updatedRawUser) return;

        try {
          setStoredUser(JSON.parse(updatedRawUser) as StoredUser);
        } catch {
          // Ignore malformed local storage updates.
        }
      };

      window.addEventListener("user-updated", refreshStoredUser);
      return () => window.removeEventListener("user-updated", refreshStoredUser);
    } catch (error) {
      console.error("Student layout auth check error:", error);
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      router.replace("/");
    }
  }, [router]);

  const handleSignOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/");
  };

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f8fc]">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="w-full border-b border-slate-200 bg-white lg:flex lg:w-[320px] lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">
          <div className="border-b border-slate-200 p-5 md:p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-200/80">
                <GraduationCap className="h-8 w-8" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-slate-900">BAUser</h1>
                <p className="mt-1 text-base leading-7 text-slate-500">
                  AI Supported Syllabus System
                </p>
              </div>
            </div>
          </div>

          <nav className="px-3 py-4 md:px-4 lg:flex-1 lg:px-4 lg:py-6">
            <div className="flex gap-2 overflow-x-auto pb-2 lg:block lg:space-y-3 lg:overflow-visible">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href === "/courses" && pathname.startsWith("/courses"));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center gap-3 whitespace-nowrap rounded-2xl px-4 py-3 text-sm font-medium transition md:text-base lg:flex lg:w-full ${
                      isActive
                        ? "bg-blue-50 text-blue-700 ring-1 ring-blue-100"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="h-6 w-6 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="hidden border-t border-slate-200 p-4 lg:block">
            <Link
              href="/settings"
              className="block rounded-[28px] bg-[#f2f6ff] p-4 transition hover:bg-blue-50"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-xl font-semibold text-white">
                  {getAvatarUrl(storedUser?.avatarUrl) ? (
                    <img
                      src={getAvatarUrl(storedUser?.avatarUrl)}
                      alt={storedUser?.name || "Profile photo"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    getInitials(storedUser?.name)
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xl font-semibold text-slate-900">
                    {storedUser?.name || "Student User"}
                  </p>
                  <p className="truncate text-sm text-slate-500">
                    {storedUser?.email || "No email"}
                  </p>
                </div>
              </div>
            </Link>

            <button
              onClick={handleSignOut}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#edf2fb] px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-[#e4ebf8]"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
        <CourseAssistantWidget role="student" />
      </div>
    </div>
  );
}
