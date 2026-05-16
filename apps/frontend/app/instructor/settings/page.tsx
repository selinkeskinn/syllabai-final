"use client";

import AccountSettings from "@/components/AccountSettings";
import InstructorLayout from "@/components/InstructorLayout";

export default function InstructorSettingsPage() {
  return (
    <InstructorLayout>
      <AccountSettings
        title="Settings"
        description="Manage your instructor account preferences."
      />
    </InstructorLayout>
  );
}
