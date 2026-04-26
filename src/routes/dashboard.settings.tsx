import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdminPasswordGate } from "@/hooks/use-admin-password-gate";
import { Trash2, Info } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/settings")({
  component: SettingsPage,
});

interface Member {
  id: string;
  user_id: string;
  role: "admin" | "cashier";
  display_name: string | null;
  email: string | null;
  created_at: string;
}

function SettingsPage() {
  const { shop, user } = useAuth();
  const isAdmin = shop?.role === "admin";
  const { verified, gate } = useAdminPasswordGate(Boolean(isAdmin), "Settings");
  const [members, setMembers] = useState<Member[]>([]);
  const [shopName, setShopName] = useState(shop?.shop_name ?? "");
  const [cashierEmail, setCashierEmail] = useState("");
  const [cashierName, setCashierName] = useState("");
  const [addingCashier, setAddingCashier] = useState(false);

  const load = async () => {
    if (!shop) return;
    const { data } = await supabase
      .from("shop_members")
      .select("id, user_id, role, display_name, email, created_at")
      .eq("shop_id", shop.shop_id)
      .order("created_at");
    setMembers((data ?? []) as Member[]);
  };

  useEffect(() => {
    load();
    setShopName(shop?.shop_name ?? "");
  }, [shop]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isAdmin) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">Only owners can manage settings.</p>
      </Card>
    );
  }

  if (!verified) {
    return gate;
  }

  const onSaveShop = async (e: FormEvent) => {
    e.preventDefault();
    if (!shop) return;
    const { error } = await supabase
      .from("shops")
      .update({ name: shopName })
      .eq("id", shop.shop_id);
    if (error) return toast.error(error.message);
    toast.success("Shop name updated");
  };

  const onRemove = async (m: Member) => {
    if (m.user_id === user?.id) {
      toast.error("You can't remove yourself.");
      return;
    }
    if (!confirm(`Remove ${m.email ?? m.display_name}?`)) return;
    const { error } = await supabase.from("shop_members").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success("Removed");
    load();
  };

  const onAddCashier = async (e: FormEvent) => {
    e.preventDefault();
    if (!cashierEmail.trim()) {
      toast.error("Cashier email is required.");
      return;
    }

    setAddingCashier(true);
    const { error } = await supabase.rpc("add_cashier_member", {
      _email: cashierEmail.trim().toLowerCase(),
      _display_name: cashierName.trim() || null,
    });
    setAddingCashier(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Cashier added to your shop.");
    setCashierEmail("");
    setCashierName("");
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your shop and team.</p>
      </div>

      <Card className="p-6">
        <h2 className="font-display text-lg font-semibold">Shop details</h2>
        <form onSubmit={onSaveShop} className="mt-4 max-w-md space-y-3">
          <div className="space-y-1.5">
            <Label>Shop name</Label>
            <Input value={shopName} onChange={(e) => setShopName(e.target.value)} required />
          </div>
          <Button type="submit">Save</Button>
        </form>
      </Card>

      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold">Team</h2>
            <p className="text-sm text-muted-foreground">
              Cashiers can use the POS but can't see profit, expenses, or settings.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-md border bg-secondary/40 p-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
          <div>
            <p className="font-medium">How to add a cashier</p>
            <p className="text-muted-foreground">
              Cashiers must register first using the cashier registration page. Then add them here
              using the same email so they become a cashier in this shop. Only the admin of this
              shop can do this action.
            </p>
          </div>
        </div>

        <form onSubmit={onAddCashier} className="mt-4 grid gap-3 rounded-md border p-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="cashierName">Cashier name (optional)</Label>
            <Input
              id="cashierName"
              placeholder="e.g. Mpho"
              value={cashierName}
              onChange={(e) => setCashierName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="cashierEmail">Cashier email</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="cashierEmail"
                type="email"
                required
                placeholder="cashier@email.com"
                value={cashierEmail}
                onChange={(e) => setCashierEmail(e.target.value)}
              />
              <Button type="submit" disabled={addingCashier}>
                {addingCashier ? "Adding..." : "Add cashier"}
              </Button>
            </div>
          </div>
        </form>

        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.display_name ?? "—"}</TableCell>
                  <TableCell>{m.email ?? "—"}</TableCell>
                  <TableCell className="capitalize">{m.role}</TableCell>
                  <TableCell className="text-right">
                    {m.role !== "admin" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => onRemove(m)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
