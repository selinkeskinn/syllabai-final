"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import InstructorLayout from "@/components/InstructorLayout";
import { syllabusService } from "@/services/syllabus.service";
import { X } from "lucide-react";

type SyllabusFormState = {
  title: string;
  description: string;
  grading: string;
  policies: string;
  resources: string;
};

const emptyForm: SyllabusFormState = {
  title: "",
  description: "",
  grading: "",
  policies: "",
  resources: "",
};

export default function EditSyllabusPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;

  const [formData, setFormData] = useState<SyllabusFormState>(emptyForm);
  const [syllabusId, setSyllabusId] = useState<string | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const fetchSyllabus = async () => {
      try {
        const syllabus = await syllabusService.getSyllabusByCourseId(courseId);

        if (!syllabus) {
          setSyllabusId(null);
          setFormData(emptyForm);
          return;
        }

        setSyllabusId(syllabus.id);
        setFormData({
          title: syllabus.title || "",
          description: syllabus.description || "",
          grading: syllabus.grading || "",
          policies: syllabus.policies || "",
          resources: syllabus.resources || "",
        });
      } catch {
        setSyllabusId(null);
        setFormData(emptyForm);
      } finally {
        setLoadingInitial(false);
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
    setErrorMessage("");
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoadingSubmit(true);
      setErrorMessage("");

      if (syllabusId) {
        await syllabusService.updateSyllabus(syllabusId, formData);
      } else {
        await syllabusService.createSyllabus({
          courseId,
          ...formData,
        });
      }

      router.push(`/instructor/courses/${courseId}`);
    } catch {
      setErrorMessage("Syllabus details could not be saved.");
    } finally {
      setLoadingSubmit(false);
    }
  };

  return (
    <InstructorLayout>
      <div className="min-h-screen bg-slate-50">
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="mx-4 max-h-[calc(100vh-32px)] w-full max-w-md overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900">
                {syllabusId ? "Edit Syllabus Details" : "Create Syllabus"}
              </h3>

              <button
                type="button"
                onClick={handleClose}
                className="text-slate-400 transition-colors hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {loadingInitial ? (
              <div className="p-6 text-sm text-slate-500">
                Loading syllabus details...
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5 p-6">
                <div>
                  <label
                    htmlFor="syllabus-title"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Syllabus Title
                  </label>
                  <input
                    id="syllabus-title"
                    type="text"
                    name="title"
                    required
                    value={formData.title}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    placeholder="Official syllabus title"
                  />
                </div>

                <div>
                  <label
                    htmlFor="syllabus-description"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Description
                  </label>
                  <textarea
                    id="syllabus-description"
                    name="description"
                    rows={3}
                    value={formData.description}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    placeholder="Course overview and learning goals"
                  />
                </div>

                <div>
                  <label
                    htmlFor="syllabus-grading"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Grading
                  </label>
                  <textarea
                    id="syllabus-grading"
                    name="grading"
                    rows={3}
                    value={formData.grading}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    placeholder={"Midterm: 30%\nProject: 30%\nFinal: 40%"}
                  />
                </div>

                <div>
                  <label
                    htmlFor="syllabus-policies"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Policies
                  </label>
                  <textarea
                    id="syllabus-policies"
                    name="policies"
                    rows={3}
                    value={formData.policies}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    placeholder="Attendance, submission, and communication rules"
                  />
                </div>

                <div>
                  <label
                    htmlFor="syllabus-resources"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Resources
                  </label>
                  <textarea
                    id="syllabus-resources"
                    name="resources"
                    rows={3}
                    value={formData.resources}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    placeholder={"Textbook: Database System Concepts\nSlides: Weekly lecture slides"}
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
                    {loadingSubmit
                      ? "Saving..."
                      : syllabusId
                      ? "Save Changes"
                      : "Create"}
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
