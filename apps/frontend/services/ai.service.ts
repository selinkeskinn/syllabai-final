import { api } from "@/lib/api";

export type CourseAiResource = {
  resourceId: string;
  courseId: string;
  resourceName: string;
  mimeType: string;
  sizeBytes: number;
  status: "PROCESSING" | "READY" | "FAILED";
  errorMessage: string | null;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CourseAiSource = {
  resourceId: string;
  resourceName: string;
  pageNumber: number | null;
  contentPreview: string;
  score: number;
};

export type CourseAiAskResponse = {
  answer: string;
  courseId: string;
  mode: "rag";
  sourceCount: number;
  sources: CourseAiSource[];
};

export type CourseAiSyllabusSummary = {
  courseSummary: string;
  instructorInfo: {
    office: string;
    officeHours: string;
    cvLink: string;
  };
  courseInfo: {
    credits: string;
    classSchedule: string;
    classroom: string;
    courseType: string;
    prerequisites: string;
    courseObjectives: string;
  };
  policySections: {
    communication: string;
    aiDigitalTools: string;
    deadlines: string;
    attendance: string;
    disabledStudentSupport: string;
    communicationEthics: string;
    privacyCopyright: string;
    academicIntegrity: string;
  };
  moreInfo: {
    learningOutcomes: string[];
    contributionToProgram: string;
    courseStructure: string;
    teachingMethods: string[];
  };
  gradingItems: Array<{
    label: string;
    value: string;
    description: string;
  }>;
  policies: string[];
  resources: string[];
  weeklyTopics: Array<{
    weekNo: number | null;
    place?: string;
    topic: string;
    details: string;
    todo: string;
  }>;
  importantDates: string[];
  officeHours: string;
  sourceCount: number;
};

export const aiService = {
  async getCourseResources(courseId: string): Promise<CourseAiResource[]> {
    const response = await api.get(`/courses/${courseId}/resources`);
    return Array.isArray(response.data) ? response.data : [];
  },

  async uploadCourseResource(
    courseId: string,
    file: File
  ): Promise<CourseAiResource> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await api.post(
      `/courses/${courseId}/resources/upload`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    return response.data;
  },

  async deleteCourseResource(
    courseId: string,
    resourceId: string
  ): Promise<{ message: string; resourceId: string }> {
    const response = await api.delete(
      `/courses/${courseId}/resources/${resourceId}`
    );
    return response.data;
  },

  async askCourseQuestion(
    courseId: string,
    question: string
  ): Promise<CourseAiAskResponse> {
    const response = await api.post(`/courses/${courseId}/ai/ask`, {
      question,
    });
    return response.data;
  },

  async getSyllabusSummary(courseId: string): Promise<CourseAiSyllabusSummary> {
    const response = await api.get(`/courses/${courseId}/ai/syllabus-summary`);
    return response.data;
  },
};
