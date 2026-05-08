"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import InstructorLayout from "@/components/InstructorLayout";
import { api } from "@/lib/api";
import { X } from "lucide-react";

export default function NewAnnouncementPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    type: "INFO",
  });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleClose = () => {
    router.push(`/instructor/courses/${courseId}`);
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    setErrorMessage("");
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      setErrorMessage("");

      await api.post("/announcements", {
        courseId,
        title: formData.title,
        content: formData.content,
        type: formData.type,
      });

      router.push(`/instructor/courses/${courseId}`);
    } catch {
      setErrorMessage("Announcement could not be created. Please try again.");
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
                Add Announcement
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
                  htmlFor="announcement-title"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Title
                </label>
                <input
                  id="announcement-title"
                  type="text"
                  name="title"
                  required
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter announcement title"
                />
              </div>

              <div>
                <label
                  htmlFor="announcement-content"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Content
                </label>
                <textarea
                  id="announcement-content"
                  name="content"
                  required
                  rows={4}
                  value={formData.content}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter announcement content"
                />
              </div>

              <div>
                <label
                  htmlFor="announcement-type"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Category
                </label>
                <select
                  id="announcement-type"
                  name="type"
                  required
                  value={formData.type}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="INFO">General</option>
                  <option value="EVENT">Event</option>
                  <option value="URGENT">Urgent</option>
                </select>
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
                  {loading ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </InstructorLayout>
  );
}
