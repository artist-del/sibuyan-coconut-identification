import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Leaf } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { SiteHeader } from "@/components/landing/site-header";
import { UserProfileForm } from "@/components/forms/user-profile-form";
import { VarietyImageManager } from "@/components/users/variety-image-manager";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/auth/login?callbackUrl=/dashboard");
  }

  if (session.user.role === "ADMIN") {
    redirect("/admin");
  }

  const varieties = await prisma.coconutVariety.findMany({
    where: { imageUploadedById: session.user.id },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      characteristics: true,
      treeHeight: true,
      localName: true,
      scientificName: true,
      locationFound: true,
      fruitColor: true,
      averageYield: true,
      imageUrl: true,
      imageLabels: true,
      imageFeatures: true,
      imageUploadedBy: {
        select: { name: true }
      }
    }
  });

  return (
    <main>
      <SiteHeader />
      <div className="pt-24">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                <Leaf className="h-4 w-4" /> User dashboard
              </p>
              <h1 className="mt-4 text-3xl font-semibold tracking-normal">Manage your profile</h1>
              <p className="mt-2 max-w-2xl text-muted-foreground">
                Update your account details and manage the coconut variety records you uploaded.
              </p>
            </div>
          </div>
          <div className="space-y-8">
            <UserProfileForm user={{ name: session.user.name ?? "", email: session.user.email ?? "" }} />
            <VarietyImageManager initialVarieties={varieties} />
          </div>
        </div>
      </div>
    </main>
  );
}
