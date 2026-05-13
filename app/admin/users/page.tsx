import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-normal">Users</h1>
        <p className="text-muted-foreground">Registered system users and roles.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>User accounts</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr><th className="py-3">Name</th><th>Email</th><th>Role</th><th>Created</th></tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b">
                  <td className="py-4 font-medium">{user.name}</td>
                  <td>{user.email}</td>
                  <td><Badge>{user.role}</Badge></td>
                  <td>{user.createdAt.toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
