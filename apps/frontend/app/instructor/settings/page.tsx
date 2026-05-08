"use client";

import InstructorLayout from "@/components/InstructorLayout";

export default function InstructorSettingsPage() {
  return (
    <InstructorLayout>
      <div className="min-h-screen bg-slate-50">
        <header className="border-b border-slate-200 bg-white px-8 py-6">
          <h1 className="text-[28px] font-semibold text-slate-900">
            Settings
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your instructor account preferences.
          </p>
        </header>

        <main className="px-8 py-8">
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900">
              Profile Settings
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Profile and notification preferences will be managed here.
            </p>
          </section>
        </main>
      </div>
    </InstructorLayout>
  );
}
