import type { Metadata } from "next";
import { CalendarPage } from "@/components/calendar-page";
export const metadata: Metadata = { title: "カレンダー" };
export default function Page(){ return <CalendarPage/>; }
