"use client";

import type { FormEvent } from "react";
import { FormField } from "./ui";
import { industries, interestLevels, selectionStatuses, type Company, type CompanyList } from "@/types";

export function CompanyForm({ company, lists, defaultListId, error, onSubmit, onClose }: {
  company?: Company; lists: CompanyList[]; defaultListId: string; error: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void; onClose: () => void;
}) {
  const industryOptions = company?.industry && !industries.some((industry) => industry === company.industry) ? [company.industry, ...industries] : industries;
  const listId = lists.some((list) => list.id === company?.listId) ? company!.listId : defaultListId;
  return <form className="company-form" onSubmit={onSubmit}>
    {error && <p className="error-message" role="alert">{error}</p>}
    <FormField label="企業名 *" htmlFor="company-name"><input id="company-name" name="name" defaultValue={company?.name} autoFocus required /></FormField>
    <FormField label="所属リスト" htmlFor="company-list"><select id="company-list" name="listId" defaultValue={company ? (lists.some((list) => list.id === company.listId) ? company.listId : "") : listId}><option value="">未分類</option>{lists.map((list) => <option value={list.id} key={list.id}>{list.name}</option>)}</select></FormField>
    <details className="company-form-section"><summary>選考・日程を追加</summary><div className="company-form-fields">
      <FormField label="選考状況" htmlFor="status"><select id="status" name="selectionStatus" defaultValue={company?.selectionStatus ?? "検討中"}>{selectionStatuses.map((value) => <option key={value}>{value}</option>)}</select></FormField>
      <div className="company-form-columns"><FormField label="エントリー締切" htmlFor="deadline"><input id="deadline" name="entryDeadline" type="date" defaultValue={company?.entryDeadline} /></FormField><FormField label="次回選考日" htmlFor="next-date"><input id="next-date" name="nextSelectionDate" type="date" defaultValue={company?.nextSelectionDate} /></FormField></div>
    </div></details>
    <details className="company-form-section"><summary>その他の情報を追加</summary><div className="company-form-fields">
      <div className="company-form-columns"><FormField label="業界" htmlFor="industry"><select id="industry" name="industry" defaultValue={company?.industry ?? ""}><option value="">未設定</option>{industryOptions.map((industry) => <option key={industry}>{industry}</option>)}</select></FormField>
        <FormField label="希望職種" htmlFor="role"><input id="role" name="desiredRole" defaultValue={company?.desiredRole} /></FormField>
        <FormField label="志望度" htmlFor="interest"><select id="interest" name="interestLevel" defaultValue={company?.interestLevel ?? "未設定"}>{interestLevels.map((level) => <option key={level}>{level}</option>)}</select></FormField>
        <FormField label="所在地" htmlFor="location"><input id="location" name="location" defaultValue={company?.location} /></FormField></div>
      <FormField label="企業研究メモ" htmlFor="research"><textarea id="research" name="companyResearch" defaultValue={company?.companyResearch} /></FormField>
    </div></details>
    <div className="company-form-actions"><button type="button" className="secondary-button" onClick={onClose}>キャンセル</button><button className="primary-button">{company ? "変更を保存" : "登録する"}</button></div>
  </form>;
}
