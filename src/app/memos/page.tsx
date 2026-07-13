import type { Metadata } from "next";
import { MemosPage } from "@/components/memos-page";
export const metadata:Metadata={title:"メモ"};
export default function Page(){return <MemosPage/>}
