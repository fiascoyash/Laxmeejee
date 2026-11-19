import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { LogOut, Settings, ShieldAlert, KeyRound, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMerchantStore } from "./store-context";
import { deleteMyAccount } from "@/lib/account.functions";

function providerOf(u: User | null) {
  const p = u?.app_metadata?.["provider"] ?? u?.identities?.[0]?.provider;
  return p === "google" ? "Google" : "Email";
}

/** Sidebar identity card + Account & Security dialog for the signed-in merchant. */
export function AccountCard({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const store = useMerchantStore();
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [busy, setBusy] = useState(false);
  const [delErr, setDelErr] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  if (!store) return null;
  const shopName = store.business.public_name;
  const email = user?.email ?? "";
  const provider = providerOf(user);
  const avatar = (user?.user_metadata?.["avatar_url"] as string | undefined) ?? undefined;
  const initial = (shopName || email || "?").trim().charAt(0).toUpperCase();
  const canDelete = confirmName.trim().toLowerCase() === shopName.trim().toLowerCase();

  const Avatar = ({ size }: { size: string }) => avatar
    ? <img src={avatar} alt="" referrerPolicy="no-referrer" className={`${size} shrink-0 rounded-full object-cover`} />
    : <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground`}>{initial}</span>;

  const savePassword = async () => {
    setPwMsg(null);
    if (pw.length < 8) { setPwMsg("Password must be at least 8 characters."); return; }
    const { error } = await supabase.auth.updateUser({ password: pw });
    setPwMsg(error ? error.message : "Password saved. You can now also sign in with email and password.");
    if (!error) setPw("");
  };

  const doDelete = async () => {
    setBusy(true); setDelErr(null);
    try {
      await deleteMyAccount({ data: { businessId: store.business.id } });
      await store.signOut();
    } catch (e) {
      setDelErr(e instanceof Error ? e.message : "Could not delete the account.");
    } finally { setBusy(false); }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { onNavigate?.(); setOpen(true); }}
        aria-label="Account settings"
        title={collapsed ? `${shopName} — ${email}` : undefined}
        className={`mb-2 flex w-full items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-left transition-colors hover:bg-slate-800 ${collapsed ? "lg:justify-center lg:border-0 lg:bg-transparent lg:px-0" : ""}`}
      >
        <Avatar size="h-9 w-9 text-sm" />
        <span className={`min-w-0 flex-1 ${collapsed ? "lg:hidden" : ""}`}>
          <span className="block truncate text-sm font-semibold text-white">{shopName}</span>
          <span className="block truncate text-xs text-slate-400">{email || "Loading…"}</span>
          <span className="mt-0.5 inline-block rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-medium text-slate-200">{provider}</span>
        </span>
        <Settings className={`h-4 w-4 shrink-0 text-slate-400 ${collapsed ? "lg:hidden" : ""}`} aria-hidden="true" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Account &amp; Security</DialogTitle>
            <DialogDescription>Manage how you sign in to {shopName}.</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="account">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="account">Account</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="danger">Delete</TabsTrigger>
            </TabsList>

            <TabsContent value="account" className="space-y-4 pt-2">
              <div className="flex items-center gap-3">
                <Avatar size="h-12 w-12 text-lg" />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{shopName}</p>
                  <p className="truncate text-sm text-muted-foreground">{email}</p>
                </div>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Signed in with</dt><dd className="font-medium">{provider}</dd>
                <dt className="text-muted-foreground">Shop page</dt><dd className="truncate font-medium">/shop/{store.business.slug}</dd>
                <dt className="text-muted-foreground">Member since</dt>
                <dd className="font-medium">{user?.created_at ? new Date(user.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—"}</dd>
              </dl>
              <Button variant="outline" className="w-full" onClick={() => { setOpen(false); void store.signOut(); }}>
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </Button>
            </TabsContent>

            <TabsContent value="security" className="space-y-4 pt-2">
              {provider === "Google" && (
                <p className="flex items-start gap-2 rounded-md bg-muted p-3 text-sm"><Mail className="mt-0.5 h-4 w-4 shrink-0" />Your login is protected by your Google account ({email}).</p>
              )}
              <div className="space-y-2">
                <label htmlFor="new-pw" className="flex items-center gap-2 text-sm font-medium"><KeyRound className="h-4 w-4" />{provider === "Google" ? "Add a backup password" : "Change password"}</label>
                <Input id="new-pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 8 characters" />
                <Button onClick={savePassword} disabled={!pw} className="w-full">Save password</Button>
                {pwMsg && <p className="text-sm text-muted-foreground">{pwMsg}</p>}
              </div>
            </TabsContent>

            <TabsContent value="danger" className="space-y-3 pt-2">
              <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                This permanently deletes your login and hides your shop page from customers. This cannot be undone. Bills saved on this device are not deleted.
              </p>
              <label htmlFor="confirm-shop" className="text-sm">Type <strong>{shopName}</strong> to confirm</label>
              <Input id="confirm-shop" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} autoComplete="off" />
              <Button variant="destructive" className="w-full" disabled={!canDelete || busy} onClick={doDelete}>
                {busy ? "Deleting…" : "Delete my account"}
              </Button>
              {delErr && <p className="text-sm text-destructive">{delErr}</p>}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
