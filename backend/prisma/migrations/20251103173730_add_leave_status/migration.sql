/*
  Warnings:

  - The values [MANAGER-APPROVED,MANAGER-REJECTED,HR-APPROVED,HR-REJECTED] on the enum `LeaveRequest_status` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `leaverequest` MODIFY `status` ENUM('PENDING', 'MANAGER_APPROVED', 'MANAGER_REJECTED', 'HR_APPROVED', 'HR_REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `user` MODIFY `role` ENUM('USER', 'ADMIN', 'MANAGER') NOT NULL DEFAULT 'USER';
