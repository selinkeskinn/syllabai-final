ALTER TABLE "Syllabus"
ADD COLUMN "grading" TEXT,
ADD COLUMN "policies" TEXT,
ADD COLUMN "resources" TEXT,
ADD COLUMN "documentFileName" TEXT,
ADD COLUMN "documentStoredFileName" TEXT,
ADD COLUMN "documentMimeType" TEXT,
ADD COLUMN "documentSizeKb" INTEGER,
ADD COLUMN "documentUploadedAt" TIMESTAMP(3);
