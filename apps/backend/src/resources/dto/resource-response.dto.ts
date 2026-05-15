export type ResourceResponseDto = {
  resourceId: string;
  courseId: string;
  resourceName: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  errorMessage: string | null;
  chunkCount: number;
  createdAt: Date;
  updatedAt: Date;
};
