import type { ReactNode } from "react";
import { BottomNavigation } from "./bottom-navigation";
import { BrandHeader } from "./brand-header";
export function AppShell({ children }: { children: ReactNode }) { return <div className="app-shell"><BrandHeader /><main>{children}</main><BottomNavigation /></div>; }
