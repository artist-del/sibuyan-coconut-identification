import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-normal">Settings</h1>
        <p className="text-muted-foreground">System preferences and integration readiness.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Switch between light and dark mode.</p>
          <ThemeToggle />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Image upload</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Cloudinary variables are included in `.env.example` for production uploads.</p>
          <p>The current form supports local image preview and URL persistence.</p>
        </CardContent>
      </Card>
    </div>
  );
}
