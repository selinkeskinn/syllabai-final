"use client";

import AccountSettings from "@/components/AccountSettings";
import Layout from "@/components/Layout";

export default function StudentSettingsPage() {
  return (
    <Layout>
      <AccountSettings
        title="Settings"
        description="Manage your student account preferences."
      />
    </Layout>
  );
}
