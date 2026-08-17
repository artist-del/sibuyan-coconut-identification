"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Menu, BarChart3, ClipboardCheck, Leaf, LogOut, Settings, Users, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger, DialogClose, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/varieties", label: "Coconut Varieties", icon: Leaf },
  { href: "/admin/identifications", label: "Identifications", icon: ClipboardCheck },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/settings", label: "Settings", icon: Settings }
];

interface AdminSidebarProps {
  isMobile?: boolean;
  onClose?: () => void;
}

function SidebarContent({ onClose, isDialog = false }: { onClose?: () => void; isDialog?: boolean }) {
  const pathname = usePathname();

  return (
    <>
      <div className="flex h-16 items-center justify-between border-b px-6">
        <div className="flex items-center gap-2">
          <Leaf className="h-6 w-6 text-primary" />
          {isDialog ? (
            <DialogTitle className="font-semibold">Cajidiocan Admin</DialogTitle>
          ) : (
            <span className="font-semibold">Cajidiocan Admin</span>
          )}
        </div>
        {onClose && (
          <DialogClose asChild>
            <Button variant="ghost" size="icon">
              <X className="h-4 w-4" />
              <span className="sr-only">Close sidebar</span>
            </Button>
          </DialogClose>
        )}
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
              pathname === item.href && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="border-t p-4">
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => {
            signOut({ callbackUrl: "/" });
            onClose?.();
          }}
        >
          <LogOut className="h-4 w-4" /> Logout
        </Button>
      </div>
    </>
  );
}

export function AdminSidebar({ isMobile = false, onClose }: AdminSidebarProps) {
  if (isMobile) {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon" className="lg:hidden">
            <Menu className="h-4 w-4" />
            <span className="sr-only">Open sidebar</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="h-full w-72 p-0 left-0 top-0 translate-x-0 translate-y-0">
          <SidebarContent onClose={onClose} isDialog={true} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r bg-card lg:flex lg:flex-col">
      <SidebarContent isDialog={false} />
    </aside>
  );
}
