"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import InstructorLayout from "@/components/InstructorLayout";
import { api } from "@/lib/api";
import { syllabusService } from "@/services/syllabus.service";
import { X } from "lucide-react";

export default function NewWeekPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;

  const [syllabusId, setSyllabusId] = useState<string | null>(null);
  const [loadingSyllabus, setLoadingSyllabus] = useState(true);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [formData, setFormData] = useState({
    weekNo: 1,
    topic: "",
    details: "",
    todo: "",
  });

  useEffect(() => {
    const fetchSyllabus = async () => {
      try {
        const syllabus = await syllabusService.getSyllabusByCourseId(courseId);
        setSyllabusId(syllabus?.id ?? null);
      } catch {
        setSyllabusId(null);
      } finally {
        setLoadingSyllabus(false);
      }
    };

    fetchSyllabus();
  }, [courseId]);

  const handleClose = () => {
    router.push(`/instructor/courses/${courseId}`);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    setErrorMessage("");
    setFormData((prev) => ({
      ...prev,
      [name]: name === "weekNo" ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!syllabusId) {
      setErrorMessage("Please create syllabus details before adding weekly content.");
      return;
    }

    try {
      setLoadingSubmit(true);
      setErrorMessage("");

      await api.post(`/syllabi/${syllabusId}/weeks`, {
        weekNo: formData.weekNo,
        topic: formData.topic,
        details: formData.details,
        todo: formData.todo,
      });

      router.push(`/instructor/courses/${courseId}`);
    } catch {
      setErrorMessage("Week could not be created. Please try again.");
    } finally {
      setLoadingSubmit(false);
    }
  };

  return (
    <InstructorLayout>
      <div className="min-h-screen bg-slate-50">
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900">
                Add Week
              </h3>

              <button
                type="button"
                onClick={handleClose}
                className="text-slate-400 transition-colors hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {loadingSyllabus ? (
              <div className="p-6 text-sm text-slate-500">
                Loading syllabus...
              </div>
            ) : !syllabusId ? (
              <div className="space-y-5 p-6">
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  This course does not have syllabus details yet. Create a
                  syllabus before adding weekly content.
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Cancel
                  </button>

                  <Link
                    href={`/instructor/courses/${courseId}/syllabus/edit`}
                    className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-blue-700"
                  >
                    Create Syllabus
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5 p-6">
                <div>
                  <label
                    htmlFor="week-number"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Week Number
                  </label>
                  <input
                    id="week-number"
                    type="number"
                    name="weekNo"
                    min={1}
                    required
                    value={formData.weekNo}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="week-topic"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Topic
                  </label>
                  <input
                    id="week-topic"
                    type="text"
                    name="topic"
                    required
                    value={formData.topic}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    placeholder="Introduction to Database Systems"
                  />
                </div>

                <div>
                  <label
                    htmlFor="week-details"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Details
                  </label>
                  <textarea
                    id="week-details"
                    name="details"
                    required
                    rows={3}
                    value={formData.details}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    placeholder="Overview of weekly learning content"
                  />
                </div>

                <div>
                  <label
                    htmlFor="week-todo"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    To Do
                  </label>
                  <textarea
                    id="week-todo"
                    name="todo"
                    required
                    rows={3}
                    value={formData.todo}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    placeholder="Review syllabus and complete required tasks"
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
                    disabled={loadingSubmit}
                    className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loadingSubmit ? "Creating..." : "Create"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </InstructorLayout>
  );
}
