export type AskSourceDto = {
  resourceId: string;
  resourceName: string;
  pageNumber: number | null;
  contentPreview: string;
  score: number;
};

export type AskResponseDto = {
  answer: string;
  courseId: string;
  mode: 'rag';
  sourceCount: number;
  sources: AskSourceDto[];
};
