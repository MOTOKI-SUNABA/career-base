import type { Metadata } from "next";
import { SettingsPage } from "@/components/settings-page";

export const metadata: Metadata = { title: "設定" };
export default function Page() { return <SettingsPage />; }
