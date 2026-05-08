"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import InstructorLayout from "@/components/InstructorLayout";
import { syllabusService } from "@/services/syllabus.service";
import { Upload, X } from "lucide-react";

const ACCEPTED_FILE_TYPES = ".pdf,.doc,.docx";

export default function NewSyllabusPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleClose = () => {
    router.push(`/instructor/courses/${courseId}`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;

    setSelectedFile(file);
    setSuccessMessage("");
    setErrorMessage("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      setErrorMessage("Please choose a syllabus document before uploading.");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      await syllabusService.uploadSyllabusDocument(courseId, selectedFile);

      setSuccessMessage("Syllabus uploaded successfully. Redirecting...");

      window.setTimeout(() => {
        router.push(`/instructor/courses/${courseId}`);
      }, 800);
    } catch {
      setErrorMessage("Syllabus document could not be uploaded.");
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
                Upload Syllabus
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
                  htmlFor="syllabus-file"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Syllabus Document
                </label>

                <label
                  htmlFor="syllabus-file"
                  className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center transition-colors hover:border-blue-400 hover:bg-blue-50"
                >
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-white text-blue-600">
                    <Upload className="h-5 w-5" />
                  </div>

                  <span className="text-sm font-medium text-slate-900">
                    {selectedFile
                      ? selectedFile.name
                      : "Choose a PDF or Word document"}
                  </span>

                  <span className="mt-2 text-xs text-slate-500">
                    Accepted formats: PDF, DOC, DOCX
                  </span>

                  <input
                    id="syllabus-file"
                    type="file"
                    accept={ACCEPTED_FILE_TYPES}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              {selectedFile ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
                  Selected file:{" "}
                  <span className="font-medium text-slate-900">
                    {selectedFile.name}
                  </span>
                </div>
              ) : null}

              {successMessage ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
                  {successMessage}
                </div>
              ) : null}

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
                  {loading ? "Uploading..." : "Upload"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </InstructorLayout>
  );
}
