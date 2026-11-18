import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { slugify, isValidSlug } from "@/lib/slug";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OnboardingForm({ onCreated, onSignOut }: { onCreated: () => void; onSignOut: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [city, setCity] = useState("");
  const [locality, setLocality] = useState("");
  const [category, setCategory] = useState("Hardware & Electricals");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finalSlug = slugTouched ? slug : slugify(name);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidSlug(finalSlug)) {
      setError("Web address must be 3–50 lowercase letters, numbers or dashes.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc("create_business", {
      _public_name: name, _slug: finalSlug, _city: city, _locality: locality, _category: category,
    });
    setBusy(false);
    if (error) {
      setError(error.message.includes("duplicate") ? "That web address is taken — try another." : error.message);
      return;
    }
    onCreated();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4 py-8">
      <form onSubmit={submit} className="w-full max-w-md space-y-3 rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-bold text-foreground">Set up your business</h1>
        <p className="text-sm text-muted-foreground">You can change these details later.</p>
        <div className="space-y-1">
          <Label htmlFor="bname">Shop name</Label>
          <Input id="bname" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="bslug">Shop web address</Label>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <span>/shop/</span>
            <Input id="bslug" value={finalSlug} onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase()); }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="bcity">City</Label>
            <Input id="bcity" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Bijnor" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bloc">Locality</Label>
            <Input id="bloc" value={locality} onChange={(e) => setLocality(e.target.value)} placeholder="Main Bazar" />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="bcat">Category</Label>
          <Input id="bcat" value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Creating…" : "Create business"}</Button>
        <Button type="button" variant="ghost" className="w-full" onClick={onSignOut}>Sign out</Button>
      </form>
    </div>
  );
}
