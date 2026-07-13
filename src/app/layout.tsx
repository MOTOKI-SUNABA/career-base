import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { CloudSyncProvider } from "@/components/cloud-sync-provider";
export const metadata: Metadata = { title: { default: "Career Base", template: "%s | Career Base" }, description: "大学生活・研究・就職活動・私生活をひとつにまとめる個人用管理アプリ" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ja"><body><CloudSyncProvider><AppShell>{children}</AppShell></CloudSyncProvider></body></html>; }
