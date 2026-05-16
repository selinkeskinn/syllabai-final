import { api } from "@/lib/api";

export type SyllabusWeek = {
  id: string;
  weekNo: number;
  topic: string;
  details?: string | null;
  todo?: string | null;
};

export type Syllabus = {
  id: string;
  courseId: string;
  title: string;
  description?: string | null;
  grading?: string | null;
  policies?: string | null;
  resources?: string | null;
  weeks: SyllabusWeek[];

  documentFileName?: string | null;
  documentStoredFileName?: string | null;
  documentMimeType?: string | null;
  documentSizeKb?: number | null;
  documentUploadedAt?: string | null;

  createdAt?: string | null;
  updatedAt?: string | null;
};

export type CreateSyllabusPayload = {
  courseId: string;
  title?: string;
  description?: string;
  grading?: string;
  policies?: string;
  resources?: string;
};

export type UpdateSyllabusPayload = {
  title?: string;
  description?: string;
  grading?: string;
  policies?: string;
  resources?: string;
};

export type SyllabusWeekPayload = {
  weekNo: number;
  topic: string;
  details?: string;
  todo?: string;
};

export type SyllabusDocumentMetadata = {
  fileName: string | null;
  storedFileName: string | null;
  mimeType: string | null;
  sizeKb: number | null;
  uploadedAt: string | null;
  hasDocument: boolean;
};

export const getSyllabusDocumentMetadata = (
  syllabus?: Syllabus | null
): SyllabusDocumentMetadata => {
  return {
    fileName: syllabus?.documentFileName ?? null,
    storedFileName: syllabus?.documentStoredFileName ?? null,
    mimeType: syllabus?.documentMimeType ?? null,
    sizeKb: syllabus?.documentSizeKb ?? null,
    uploadedAt: syllabus?.documentUploadedAt ?? null,
    hasDocument: Boolean(syllabus?.documentFileName),
  };
};

export const getSyllabusDescriptionText = (
  syllabus?: Syllabus | null
): string => {
  if (!syllabus) return "No syllabus description available yet.";

  const description = syllabus.description?.trim();
  if (description) return description;

  const meta = getSyllabusDocumentMetadata(syllabus);

  if (meta.hasDocument) {
    const parts: string[] = ["Official syllabus document uploaded"];

    if (meta.uploadedAt) {
      const uploadedDate = new Date(meta.uploadedAt);
      if (!Number.isNaN(uploadedDate.getTime())) {
        parts.push(`on ${uploadedDate.toLocaleString()}`);
      }
    }

    if (meta.mimeType) {
      const simplifiedType = meta.mimeType
        .replace(
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "DOCX"
        )
        .replace("application/msword", "DOC")
        .replace("application/pdf", "PDF");
      parts.push(`File type: ${simplifiedType}`);
    }

    if (typeof meta.sizeKb === "number") {
      parts.push(`Size: ${meta.sizeKb} KB`);
    }

    if (meta.storedFileName) {
      parts.push(`Stored file: ${meta.storedFileName}`);
    }

    return `${parts.join(". ")}.`;
  }

  return "No syllabus description available yet.";
};

const isAxiosNotFound = (error: unknown) => {
  return (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    (error as { response?: { status?: number } }).response?.status === 404
  );
};

export const syllabusService = {
  async getSyllabusByCourseId(courseId: string): Promise<Syllabus | null> {
    try {
      const response = await api.get(`/syllabi/course/${courseId}`);
      return response.data;
    } catch (error) {
      if (isAxiosNotFound(error)) {
        return null;
      }

      throw error;
    }
  },

  async createSyllabus(payload: CreateSyllabusPayload): Promise<Syllabus> {
    const response = await api.post("/syllabi", payload);
    return response.data;
  },

  async updateSyllabus(
    syllabusId: string,
    payload: UpdateSyllabusPayload
  ): Promise<Syllabus> {
    const response = await api.put(`/syllabi/${syllabusId}`, payload);
    return response.data;
  },

  async uploadSyllabusDocument(courseId: string, file: File): Promise<Syllabus> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await api.post(`/syllabi/course/${courseId}/upload`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return response.data;
  },

  async createWeek(
    syllabusId: string,
    payload: SyllabusWeekPayload
  ): Promise<SyllabusWeek> {
    const response = await api.post(`/syllabi/${syllabusId}/weeks`, payload);
    return response.data;
  },

  async updateWeek(
    syllabusId: string,
    weekId: string,
    payload: Partial<SyllabusWeekPayload>
  ): Promise<SyllabusWeek> {
    const response = await api.put(
      `/syllabi/${syllabusId}/weeks/${weekId}`,
      payload
    );
    return response.data;
  },

  async deleteWeek(syllabusId: string, weekId: string) {
    const response = await api.delete(`/syllabi/${syllabusId}/weeks/${weekId}`);
    return response.data;
  },
};