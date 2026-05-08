import { api } from "@/lib/api";

export type FeedbackItem = {
  id: string;
  courseId: string;
  userId?: string | null;
  rating: number;
  tags: string[];
  comment?: string | null;
  createdAt?: string;
  updatedAt?: string;
  course?: {
    id: string;
    code: string;
    title: string;
  } | null;
};

export const submitFeedback = async (data: {
  courseId: string;
  rating: number;
  tags: string[];
  comment?: string;
  isAnonymous?: boolean;
}) => {
  const response = await api.post("/feedback", data);
  return response.data;
};

export const getFeedback = async (): Promise<FeedbackItem[]> => {
  const response = await api.get("/feedback");
  return Array.isArray(response.data) ? response.data : [];
};
