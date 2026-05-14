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
          <p>Cloudinary upload is enabled for varieties and identify workflow using the configured environment variables.</p>
          <p>Choose an image in the admin form to upload directly to Cloudinary and persist the returned URL.</p>
        </CardContent>
      </Card>
    </div>
  );
}
