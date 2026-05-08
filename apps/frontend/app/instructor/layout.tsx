"use client";

import { ReactNode, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

type InstructorRouteLayoutProps = {
  children: ReactNode;
};

type StoredUser = {
  role?: string;
};

type AccessState =
  | "checking"
  | "allowed"
  | "forbidden"
  | "unauthenticated"
  | "invalid";

const subscribe = () => () => undefined;

const getAccessState = (): AccessState => {
  if (typeof window === "undefined") {
    return "checking";
  }

  const token = localStorage.getItem("token");
  const userRaw = localStorage.getItem("user");

  if (!token || !userRaw) {
    return "unauthenticated";
  }

  try {
    const user = JSON.parse(userRaw) as StoredUser;
    return user.role === "INSTRUCTOR" ? "allowed" : "forbidden";
  } catch (error) {
    console.error("Instructor route auth parse error:", error);
    return "invalid";
  }
};

export default function InstructorRouteLayout({
  children,
}: InstructorRouteLayoutProps) {
  const router = useRouter();
  const accessState = useSyncExternalStore(
    subscribe,
    getAccessState,
    () => "checking",
  );

  useEffect(() => {
    if (accessState === "unauthenticated") {
      router.replace("/");
      return;
    }

    if (accessState === "invalid") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      router.replace("/");
      return;
    }

    if (accessState === "forbidden") {
      router.replace("/dashboard");
    }
  }, [accessState, router]);

  if (accessState !== "allowed") {
    return (
      <div className="min-h-screen bg-slate-100">
        <div className="mx-auto max-w-3xl px-4 py-10 md:px-6">
          <div className="rounded-2xl border bg-white p-6 text-slate-500 shadow-sm">
            Redirecting...
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
