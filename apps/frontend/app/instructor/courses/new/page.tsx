"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import InstructorLayout from "@/components/InstructorLayout";
import { courseService } from "@/services/course.service";
import { X } from "lucide-react";

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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      setErrorMessage("");

      await courseService.createCourse(formData);

      router.push("/instructor/courses");
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        "Course could not be created. Please try again.";

      setErrorMessage(Array.isArray(message) ? message.join(", ") : message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <InstructorLayout>
      <div className="min-h-screen bg-slate-50">
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white shadow-xl">
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
                  placeholder="e.g., Current Semester"
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
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
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
