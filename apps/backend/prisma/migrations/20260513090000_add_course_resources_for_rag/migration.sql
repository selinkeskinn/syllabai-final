-- CreateEnum
CREATE TYPE "public"."ResourceStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "public"."CourseResource" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "status" "public"."ResourceStatus" NOT NULL DEFAULT 'PROCESSING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ResourceChunk" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "pageNumber" INTEGER,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[] NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseResource_courseId_idx" ON "public"."CourseResource"("courseId");

-- CreateIndex
CREATE INDEX "CourseResource_status_idx" ON "public"."CourseResource"("status");

-- CreateIndex
CREATE INDEX "ResourceChunk_courseId_idx" ON "public"."ResourceChunk"("courseId");

-- CreateIndex
CREATE INDEX "ResourceChunk_resourceId_idx" ON "public"."ResourceChunk"("resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceChunk_resourceId_chunkIndex_key" ON "public"."ResourceChunk"("resourceId", "chunkIndex");

-- AddForeignKey
ALTER TABLE "public"."CourseResource" ADD CONSTRAINT "CourseResource_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CourseResource" ADD CONSTRAINT "CourseResource_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResourceChunk" ADD CONSTRAINT "ResourceChunk_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "public"."CourseResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
