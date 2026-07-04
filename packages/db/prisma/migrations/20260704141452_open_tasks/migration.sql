-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE 'OPEN';

-- AlterTable
ALTER TABLE "Task" ALTER COLUMN "assignedToUserId" DROP NOT NULL;
