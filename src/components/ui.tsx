"use client";
import Link from "next/link";
import { Settings, X } from "lucide-react";
import type { ReactNode } from "react";
export function PageHeader({ title, description, onAdd, showSettings = true }: { title: string; description: string; onAdd?: () => void; showSettings?: boolean }) { return <header className="page-header"><div><p className="eyebrow">CAREER BASE</p><h1>{title}</h1><p>{description}</p></div><div className="header-actions">{showSettings && <Link href="/settings" className="icon-button" aria-label="設定を開く"><Settings size={20} /></Link>}{onAdd && <button className="primary-button" onClick={onAdd}>＋ 追加</button>}</div></header>; }
export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) { return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header><h2 id="modal-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label="閉じる"><X size={20}/></button></header>{children}</section></div>; }
export function FormField({ label, htmlFor, children, hint }: { label: string; htmlFor: string; children: ReactNode; hint?: string }) { return <div className="form-field"><label htmlFor={htmlFor}>{label}</label>{children}{hint && <small>{hint}</small>}</div>; }
export function EmptyState({ title, description }: { title: string; description: string }) { return <div className="empty-state"><strong>{title}</strong><p>{description}</p></div>; }
export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "blue" | "amber" | "red" | "green" }) { return <span className={`badge badge-${tone}`}>{children}</span>; }
export function confirmDelete(label: string) { return window.confirm(`${label}を削除しますか？この操作は取り消せません。`); }
