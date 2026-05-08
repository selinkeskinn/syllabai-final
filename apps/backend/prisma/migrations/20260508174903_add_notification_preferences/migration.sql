-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "assignmentRemindersEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "courseAnnouncementsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "deadlineAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "gradeUpdatesEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pushNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true;
