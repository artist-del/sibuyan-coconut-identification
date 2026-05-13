"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { LogIn, LogOut, Shield, User } from "lucide-react";

import { Button } from "@/components/ui/button";

export function AccountActions({ compact = false }: { compact?: boolean }) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <Button variant="outline" size={compact ? "icon" : "default"} disabled>
        <User className="h-4 w-4" />
        {!compact ? "Account" : null}
      </Button>
    );
  }

  if (!session?.user) {
    return (
      <Button asChild variant="secondary" size={compact ? "icon" : "default"}>
        <Link href="/auth/login" aria-label="Sign in">
          <LogIn className="h-4 w-4" />
          {!compact ? "Login" : null}
        </Link>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {session.user.role === "ADMIN" ? (
        <Button asChild variant="secondary" size={compact ? "icon" : "default"}>
          <Link href="/admin" aria-label="Admin dashboard">
            <Shield className="h-4 w-4" />
            {!compact ? "Admin" : null}
          </Link>
        </Button>
      ) : null}
      <Button variant="outline" size={compact ? "icon" : "default"} onClick={() => signOut({ callbackUrl: "/" })} aria-label="Logout">
        <LogOut className="h-4 w-4" />
        {!compact ? "Logout" : null}
      </Button>
    </div>
  );
}
