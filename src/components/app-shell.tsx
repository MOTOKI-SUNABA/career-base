import type { ReactNode } from "react";
import { BottomNavigation } from "./bottom-navigation";
export function AppShell({ children }: { children: ReactNode }) { return <div className="app-shell"><main>{children}</main><BottomNavigation /></div>; }
