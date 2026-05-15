"use client";

import { type ChangeEvent, type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import InstructorLayout from "@/components/InstructorLayout";
import { courseService } from "@/services/course.service";
import { FileText, Loader2, UploadCloud, X } from "lucide-react";

const getApiErrorMessage = (error: unknown) => {
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    (error as { response?: { data?: { message?: unknown; error?: unknown } } })
      .response?.data
  ) {
    const data = (
      error as { response: { data: { message?: unknown; error?: unknown } } }
    ).response.data;
    const message = data.message ?? data.error;

    if (Array.isArray(message)) return message.join(", ");
    if (typeof message === "string") return message;
  }

  return "Course could not be created. Please try again.";
};

export default function NewCoursePage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    code: "",
    title: "",
    description: "",
    semester: "",
  });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setErrorMessage("");
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleClose = () => {
    router.push("/instructor/courses");
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setErrorMessage("");
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      setSelectedFile(null);
      setErrorMessage("Only PDF files can be attached to a course.");
      event.target.value = "";
      return;
    }

    setSelectedFile(file);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      setErrorMessage("");

      const course = await courseService.createCourse({
        ...formData,
        file: selectedFile,
      });

      router.push(`/instructor/courses/${course.id}`);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <InstructorLayout>
      <div className="min-h-screen bg-slate-50">
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="mx-4 w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900">
                Create Course
              </h3>

              <button
                type="button"
                onClick={handleClose}
                className="text-slate-400 transition-colors hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <div>
                <label
                  htmlFor="course-code"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Course Code
                </label>
                <input
                  id="course-code"
                  type="text"
                  name="code"
                  required
                  value={formData.code}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., DB 401"
                />
              </div>

              <div>
                <label
                  htmlFor="course-title"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Course Title
                </label>
                <input
                  id="course-title"
                  type="text"
                  name="title"
                  required
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Database Systems"
                />
              </div>

              <div>
                <label
                  htmlFor="course-semester"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Semester
                </label>
                <input
                  id="course-semester"
                  type="text"
                  name="semester"
                  required
                  value={formData.semester}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Spring 2026"
                />
              </div>

              <div>
                <label
                  htmlFor="course-description"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Description
                </label>
                <textarea
                  id="course-description"
                  name="description"
                  required
                  rows={4}
                  value={formData.description}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter course description"
                />
              </div>

              <div>
                <label
                  htmlFor="course-document"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Syllabus PDF
                </label>
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                      {selectedFile ? (
                        <FileText className="h-5 w-5" />
                      ) : (
                        <UploadCloud className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <input
                        id="course-document"
                        type="file"
                        accept="application/pdf,.pdf"
                        disabled={loading}
                        onChange={handleFileChange}
                        className="w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      {selectedFile ? (
                        <p className="mt-2 truncate text-xs text-slate-500">
                          {selectedFile.name}
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-slate-500">
                          Optional. The AI index starts after creation.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {errorMessage ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                  {errorMessage}
                </div>
              ) : null}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {loading ? "Creating..." : "Create Course"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </InstructorLayout>
  );
}
