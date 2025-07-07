import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const handleLogout = async () => {
    await logout();
  };
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden md:flex w-56 flex-col border-r bg-card/50 backdrop-blur">
        <div className="h-14 flex items-center justify-center border-b font-bold">
          Ops Panel
        </div>
        <nav className="flex-1 p-4 space-y-2 text-sm">
          <Link href="/dashboard" className={cn("block px-3 py-2 rounded-md hover:bg-accent")}>Servers</Link>
          <Link href="/secrets" className={cn("block px-3 py-2 rounded-md hover:bg-accent")}>Secrets</Link>
        </nav>
        <div className="p-4 border-t">
          <Button variant="outline" className="w-full" onClick={handleLogout}>Logout</Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
