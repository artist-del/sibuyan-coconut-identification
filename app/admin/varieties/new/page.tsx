import { VarietyForm } from "@/components/forms/variety-form";

export default function NewVarietyPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-normal">Add Variety</h1>
        <p className="text-muted-foreground">Create a coconut variety profile for Sibuyan Island.</p>
      </div>
      <VarietyForm />
    </div>
  );
}
