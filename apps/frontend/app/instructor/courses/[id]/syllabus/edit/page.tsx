"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import InstructorLayout from "@/components/InstructorLayout";
import { aiService, CourseAiResource } from "@/services/ai.service";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Trash2,
  UploadCloud,
  X,
  XCircle,
} from "lucide-react";

const formatAiErrorMessage = (message: string) => {
  if (
    message.includes("AI provider is not reachable") ||
    message.includes("AI_BASE_URL") ||
    message.includes("local model server")
  ) {
    return "AI indexing is not available right now. Please start the AI service and upload again.";
  }

  return message;
};

const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    (error as { response?: { data?: { message?: unknown } } }).response?.data
      ?.message
  ) {
    const message = (error as { response: { data: { message: unknown } } })
      .response.data.message;
    if (typeof message === "string") return formatAiErrorMessage(message);
  }

  return fallback;
};

const getStatusClass = (status: CourseAiResource["status"]) => {
  if (status === "READY") return "bg-emerald-100 text-emerald-700";
  if (status === "FAILED") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-700";
};

export default function ManageSyllabusDocumentsPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;

  const [resources, setResources] = useState<CourseAiResource[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loadingResources, setLoadingResources] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingResourceIds, setDeletingResourceIds] = useState<Set<string>>(
    new Set()
  );
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleClose = () => {
    router.push(`/instructor/courses/${courseId}`);
  };

  useEffect(() => {
    const fetchResources = async () => {
      try {
        const data = await aiService.getCourseResources(courseId);
        setResources(data);
      } catch {
        setResources([]);
      } finally {
        setLoadingResources(false);
      }
    };

    fetchResources();
  }, [courseId]);

  useEffect(() => {
    if (!resources.some((resource) => resource.status === "PROCESSING")) return;

    const intervalId = window.setInterval(async () => {
      try {
        const data = await aiService.getCourseResources(courseId);
        setResources(data);
      } catch {
        window.clearInterval(intervalId);
      }
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [courseId, resources]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setErrorMessage("");
    setMessage("");
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      event.target.value = "";
      setSelectedFile(null);
      setErrorMessage("Only PDF files can be indexed for course AI.");
      return;
    }

    setSelectedFile(file);
    setErrorMessage("");
    setMessage("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedFile) {
      setErrorMessage("Please choose a PDF file first.");
      return;
    }

    try {
      setUploading(true);
      setErrorMessage("");
      setMessage("");

      const uploadedResource = await aiService.uploadCourseResource(
        courseId,
        selectedFile
      );

      setResources((current) => [
        uploadedResource,
        ...current.filter(
          (resource) => resource.resourceId !== uploadedResource.resourceId
        ),
      ]);
      setSelectedFile(null);
      event.currentTarget.reset();
      setMessage("Document uploaded. AI indexing is running.");
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, "Document could not be uploaded.")
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteResource = async (resource: CourseAiResource) => {
    if (resource.status === "PROCESSING") return;

    const confirmed = window.confirm(
      `Delete "${resource.resourceName}" and remove it from AI search?`
    );

    if (!confirmed) return;

    setDeletingResourceIds((current) =>
      new Set(current).add(resource.resourceId)
    );
    setErrorMessage("");
    setMessage("");

    try {
      await aiService.deleteCourseResource(courseId, resource.resourceId);
      setResources((current) =>
        current.filter((item) => item.resourceId !== resource.resourceId)
      );
      setMessage("Document deleted.");
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, "Document could not be deleted.")
      );
    } finally {
      setDeletingResourceIds((current) => {
        const next = new Set(current);
        next.delete(resource.resourceId);
        return next;
      });
    }
  };

  return (
    <InstructorLayout>
      <div className="min-h-screen bg-slate-50">
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="mx-4 w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Manage AI Documents
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Syllabus details are answered from uploaded PDFs.
                </p>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="text-slate-400 transition-colors hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <UploadCloud className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center overflow-hidden rounded-lg border border-slate-300 bg-white text-sm text-slate-700">
                      <label className="shrink-0 cursor-pointer bg-slate-100 px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-200">
                        Choose File
                        <input
                          type="file"
                          accept="application/pdf,.pdf"
                          disabled={uploading}
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>
                      <span className="truncate px-3 text-slate-500">
                        {selectedFile?.name || "No file chosen"}
                      </span>
                    </div>
                    <p className="mt-2 truncate text-xs text-slate-500">
                      Upload a text-based syllabus PDF.
                    </p>
                  </div>
                </div>
              </div>

              {message ? (
                <div className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{message}</span>
                </div>
              ) : null}

              {errorMessage && selectedFile ? (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              ) : null}

              <div className="rounded-lg border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Uploaded PDFs
                </div>
                {loadingResources ? (
                  <div className="flex items-center gap-2 px-4 py-5 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading documents...
                  </div>
                ) : resources.length === 0 ? (
                  <div className="px-4 py-5 text-sm text-slate-500">
                    No AI documents uploaded yet.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {resources.map((resource) => (
                      <div
                        key={resource.resourceId}
                        className="flex items-start justify-between gap-3 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 shrink-0 text-red-500" />
                            <p className="truncate text-sm font-medium text-slate-900">
                              {resource.resourceName}
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {resource.chunkCount} chunks
                          </p>
                          {resource.errorMessage ? (
                            <p className="mt-1 line-clamp-2 text-xs text-red-600">
                              {resource.errorMessage}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClass(
                              resource.status
                            )}`}
                          >
                            {resource.status === "READY" ? (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            ) : resource.status === "FAILED" ? (
                              <XCircle className="h-3.5 w-3.5" />
                            ) : (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            )}
                            {resource.status}
                          </span>

                          <button
                            type="button"
                            disabled={
                              resource.status === "PROCESSING" ||
                              deletingResourceIds.has(resource.resourceId)
                            }
                            onClick={() => void handleDeleteResource(resource)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300 disabled:hover:bg-transparent"
                            title={
                              resource.status === "PROCESSING"
                                ? "Wait until indexing finishes before deleting"
                                : "Delete PDF"
                            }
                            aria-label={`Delete ${resource.resourceName}`}
                          >
                            {deletingResourceIds.has(resource.resourceId) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Close
                </button>

                <button
                  type="submit"
                  disabled={!selectedFile || uploading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {uploading ? "Uploading..." : "Upload PDF"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </InstructorLayout>
  );
}
