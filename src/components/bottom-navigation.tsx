"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BriefcaseBusiness, CalendarDays, CheckSquare2, NotebookPen } from "lucide-react";
const items = [{ href: "/calendar", label: "カレンダー", icon: CalendarDays }, { href: "/todos", label: "ToDo", icon: CheckSquare2 }, { href: "/career", label: "就活情報", icon: BriefcaseBusiness }, { href: "/memos", label: "メモ", icon: NotebookPen }];
export function BottomNavigation() { const pathname = usePathname(); return <nav className="bottom-nav" aria-label="メインナビゲーション">{items.map(({ href, label, icon: Icon }) => { const active = pathname.startsWith(href); return <Link key={href} href={href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}><Icon size={22}/><span>{label}</span></Link>; })}</nav>; }
