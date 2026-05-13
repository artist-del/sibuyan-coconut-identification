import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { authOptions, isAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/login?callbackUrl=/admin");
  }

  if (!isAdmin(session.user.role)) {
    redirect("/records");
  }

  return (
    <div className="min-h-screen bg-secondary/20">
      <AdminSidebar />
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/90 px-4 backdrop-blur sm:px-6">
          <div>
            <p className="text-sm text-muted-foreground">Municipal agriculture dashboard</p>
            <p className="font-semibold">{session.user.name}</p>
          </div>
          <ThemeToggle />
        </header>
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
