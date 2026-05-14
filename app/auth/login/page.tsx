import Link from "next/link";
import { Leaf } from "lucide-react";

import { LoginForm } from "@/components/forms/login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-secondary/30 px-4 py-12">
      <div className="mb-6 flex items-center gap-2 text-primary">
        <Leaf className="h-6 w-6" />
        <Link href="/" className="font-semibold">Sibuyan Coconut Identification System</Link>
      </div>
      <LoginForm />
    </main>
  );
}
