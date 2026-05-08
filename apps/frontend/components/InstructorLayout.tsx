"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  BookOpen,
  CalendarDays,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  LucideIcon,
  MessageSquare,
} from "lucide-react";

type InstructorLayoutProps = {
  children: ReactNode;
};

type StoredUser = {
  name?: string;
  email?: string;
  role?: string;
};

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  {
    label: "Instructor Dashboard",
    href: "/instructor/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "My Courses",
    href: "/instructor/courses",
    icon: BookOpen,
  },
  {
    label: "Deadlines",
    href: "/instructor/deadlines",
    icon: CalendarDays,
  },
  {
    label: "Announcements",
    href: "/instructor/announcements",
    icon: Bell,
  },
  {
    label: "Feedback",
    href: "/instructor/feedback",
    icon: MessageSquare,
  },
];

function getInitials(name?: string) {
  if (!name) return "IU";

  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return initials || "IU";
}

export default function InstructorLayout({ children }: InstructorLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<StoredUser>({
    name: "Instructor User",
    email: "Instructor email not available",
  });

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");

      if (storedUser) {
        const parsedUser = JSON.parse(storedUser) as StoredUser;
        setUser({
          name: parsedUser.name || "Instructor User",
          email: parsedUser.email || "Instructor email not available",
          role: parsedUser.role,
        });
      }
    } catch {
      setUser({
        name: "Instructor User",
        email: "Instructor email not available",
      });
    }
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <aside className="hidden w-[300px] shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
          <div className="border-b border-slate-200 px-7 py-8">
            <div className="flex items-center gap-4">
              <div className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
                <GraduationCap className="h-9 w-9" />
              </div>

              <div>
                <h1 className="text-[26px] font-bold leading-tight text-slate-900">
                  BAUser
                </h1>
                <p className="mt-1 text-[17px] leading-7 text-slate-500">
                  AI Supported Syllabus System
                </p>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-5 py-7">
            <div className="space-y-3">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/instructor/dashboard" &&
                    pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-4 rounded-xl px-5 py-4 text-[17px] font-medium transition ${
                      isActive
                        ? "bg-blue-50 text-blue-600 ring-1 ring-blue-100"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <Icon className="h-6 w-6 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="border-t border-slate-200 p-5">
            <div className="mb-4 rounded-2xl bg-blue-50 p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-xl font-bold text-white">
                  {getInitials(user.name)}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-[19px] font-bold text-slate-900">
                    {user.name || "Instructor User"}
                  </p>
                  <p className="truncate text-sm text-slate-500">
                    {user.email || "Instructor email not available"}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
