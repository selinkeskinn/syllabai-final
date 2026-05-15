"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import InstructorLayout from "@/components/InstructorLayout";
import { Bot, FileText, X } from "lucide-react";

export default function NewWeekPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;

  const handleClose = () => {
    router.push(`/instructor/courses/${courseId}`);
  };

  return (
    <InstructorLayout>
      <div className="min-h-screen bg-slate-50">
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900">
                Weekly Plan
              </h3>

              <button
                type="button"
                onClick={handleClose}
                className="text-slate-400 transition-colors hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-blue-600">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900">
                      AI reads weekly topics from the PDF.
                    </h4>
                    <p className="mt-1 text-sm text-slate-600">
                      Manual week entry is no longer required.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Close
                </button>

                <Link
                  href={`/instructor/courses/${courseId}/syllabus/edit`}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  <FileText className="h-4 w-4" />
                  Manage PDFs
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </InstructorLayout>
  );
}
