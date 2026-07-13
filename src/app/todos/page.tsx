import type { Metadata } from "next";
import { TodosPage } from "@/components/todos-page";
export const metadata: Metadata={title:"ToDo"};
export default function Page(){return <TodosPage/>}
