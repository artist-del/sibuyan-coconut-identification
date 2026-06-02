"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Leaf, Search } from "lucide-react";

import { AccountActions } from "@/components/auth/account-actions";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function SiteHeader() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const showDashboard = session?.user?.role === "USER";

  return (
    <header className="fixed left-0 right-0 top-0 z-40 border-b border-white/10 bg-black/35 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary">
            <Leaf className="h-5 w-5" />
          </span>
          <span className="text-sm font-semibold sm:text-base">Cajidiocan Coconut Identification System</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-white/85 md:flex">
          <Link href="/records" className="hover:text-white">Records</Link>
          <Link href="/identify" className="hover:text-white">Identify</Link>
          {showDashboard ? <Link href="/dashboard" className="hover:text-white">Dashboard</Link> : null}
          {isAdmin ? <Link href="/admin" className="hover:text-white">Admin</Link> : null}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild className="hidden sm:inline-flex">
            <Link href="/identify"><Search className="h-4 w-4" /> Identify</Link>
          </Button>
          <AccountActions compact />
        </div>
      </div>
    </header>
  );
}
