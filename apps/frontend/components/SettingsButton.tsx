"use client";

import Link from "next/link";
import { Settings } from "lucide-react";

type SettingsButtonProps = {
  href: string;
};

export default function SettingsButton({ href }: SettingsButtonProps) {
  return (
    <Link
      href={href}
      className="rounded-lg p-2.5 transition hover:bg-slate-100"
      aria-label="Settings"
    >
      <Settings className="h-5 w-5 text-slate-600" />
    </Link>
  );
}
