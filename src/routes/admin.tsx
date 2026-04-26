import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatM } from "@/lib/currency";
import { CalendarDays, CheckCircle2, ExternalLink, ShieldCheck, Store, Users, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

interface PendingPayment {
  id: string;
  shop_id: string;
  amount: number;
  plan: "monthly" | "yearly";
  payment_method: string;
  reference_number: string | null;
  proof_url: string;
  created_at: string;
  shops: { name: string } | { name: string }[];
}

interface ShopMemberSummary {
  email: string | null;
  display_name: string | null;
  role: "admin" | "cashier";
  user_id: string;
}

interface RegisteredShop {
  id: string;
  name: string;
  owner_id: string;
  subscription_status: "trial" | "active" | "expired" | "pending_verification";
  expiry_date: string;
  created_at: string;
  shop_members: ShopMemberSummary[];
}

interface PersonWithShop {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: "admin" | "cashier";
  shop_id: string;
  shops: { name: string } | { name: string }[];
}

function AdminPage() {
  const navigate = useNavigate();
  const { isPlatformAdmin, loading } = useAuth();
  const [pending, setPending] = useState<PendingPayment[]>([]);
  const [shops, setShops] = useState<RegisteredShop[]>([]);
  const [people, setPeople] = useState<PersonWithShop[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !isPlatformAdmin) navigate({ to: "/dashboard" });
  }, [loading, isPlatformAdmin, navigate]);

  const load = async () => {
    const [{ data: paymentData }, { data: shopData }, { data: peopleData }] = await Promise.all([
      supabase
      .from("subscription_payments")
      .select("id, shop_id, amount, plan, payment_method, reference_number, proof_url, created_at, shops:shop_id(name)")
      .eq("status", "pending_verification")
      .order("created_at", { ascending: false }),
      supabase
        .from("shops")
        .select("id, name, owner_id, subscription_status, expiry_date, created_at, shop_members(email, display_name, role, user_id)")
        .order("created_at", { ascending: false }),
      supabase
        .from("shop_members")
        .select("id, user_id, email, display_name, role, shop_id, shops:shop_id(name)")
        .order("created_at", { ascending: false }),
    ]);
    setPending((paymentData ?? []) as PendingPayment[]);
    setShops((shopData ?? []) as RegisteredShop[]);
    setPeople((peopleData ?? []) as PersonWithShop[]);
  };

  useEffect(() => {
    if (isPlatformAdmin) load();
  }, [isPlatformAdmin]);

  const getProofUrl = async (path: string) => {
    const { data } = await supabase.storage
      .from("payment-proofs")
      .createSignedUrl(path, 60 * 5);
    return data?.signedUrl;
  };

  const openProof = async (path: string) => {
    const url = await getProofUrl(path);
    if (url) window.open(url, "_blank");
    else toast.error("Could not load proof");
  };

  const approve = async (p: PendingPayment) => {
    setBusyId(p.id);
    const months = p.plan === "monthly" ? 1 : 12;
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + months);

    const { error: e1 } = await supabase
      .from("subscription_payments")
      .update({ status: "approved", verified_at: new Date().toISOString() })
      .eq("id", p.id);
    if (e1) {
      setBusyId(null);
      return toast.error(e1.message);
    }
    const { error: e2 } = await supabase
      .from("shops")
      .update({
        subscription_status: "active",
        expiry_date: expiry.toISOString(),
      })
      .eq("id", p.shop_id);
    setBusyId(null);
    if (e2) return toast.error(e2.message);
    toast.success("Subscription activated");
    load();
  };

  const reject = async (p: PendingPayment) => {
    const reason = prompt("Reason for rejection:");
    if (!reason) return;
    setBusyId(p.id);
    const { error: e1 } = await supabase
      .from("subscription_payments")
      .update({ status: "rejected", rejection_reason: reason })
      .eq("id", p.id);
    if (e1) {
      setBusyId(null);
      return toast.error(e1.message);
    }
    // Roll shop back to expired so they can re-submit
    await supabase
      .from("shops")
      .update({ subscription_status: "expired" })
      .eq("id", p.shop_id);
    setBusyId(null);
    toast.success("Marked as rejected");
    load();
  };

  if (loading || !isPlatformAdmin) return null;

  return (
    <div className="min-h-screen bg-secondary/40 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gold text-gold-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">System Owner dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Seithati Sekhamane · sekhamane@digniholdings.com
            </p>
          </div>
          <div className="ml-auto">
            <Button variant="outline" onClick={() => navigate({ to: "/dashboard" })}>
              Back to dashboard
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Store className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Registered shops</p>
                <p className="font-display text-2xl font-bold">{shops.length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-success/10 text-success">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active subscriptions</p>
                <p className="font-display text-2xl font-bold">
                  {shops.filter((shop) => shop.subscription_status === "active").length}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending payments</p>
                <p className="font-display text-2xl font-bold">{pending.length}</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-6">
          <h2 className="font-display text-lg font-semibold">Pending verifications</h2>
          <p className="text-sm text-muted-foreground">
            {pending.length} payment{pending.length === 1 ? "" : "s"} awaiting review
          </p>
          <div className="mt-4 space-y-3">
            {pending.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                All caught up. No pending payments.
              </p>
            )}
            {pending.map((p) => {
              const shopName = Array.isArray(p.shops) ? p.shops[0]?.name : p.shops?.name;
              return (
                <div
                  key={p.id}
                  className="flex flex-wrap items-start gap-4 rounded-md border p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{shopName ?? p.shop_id}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatM(p.amount)} · {p.plan} · via {p.payment_method}
                      {p.reference_number ? ` · Ref ${p.reference_number}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Submitted {new Date(p.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openProof(p.proof_url)}
                    >
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> View proof
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => approve(p)}
                      disabled={busyId === p.id}
                      className="bg-success text-success-foreground hover:bg-success/90"
                    >
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => reject(p)}
                      disabled={busyId === p.id}
                    >
                      <XCircle className="mr-1.5 h-3.5 w-3.5" /> Reject
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-lg font-semibold">People and shops</h2>
          <p className="text-sm text-muted-foreground">
            All signed-up people and the shops they belong to.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-3 pr-4 font-medium">Person</th>
                  <th className="py-3 pr-4 font-medium">Email</th>
                  <th className="py-3 pr-4 font-medium">Shop</th>
                  <th className="py-3 pr-4 font-medium">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {people.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground">
                      No people found yet.
                    </td>
                  </tr>
                )}
                {people.map((person) => {
                  const shopName = Array.isArray(person.shops)
                    ? person.shops[0]?.name
                    : person.shops?.name;
                  return (
                    <tr key={person.id}>
                      <td className="py-4 pr-4 font-medium">
                        {person.display_name ?? "No name"}
                      </td>
                      <td className="py-4 pr-4 text-muted-foreground">
                        {person.email ?? "No email"}
                      </td>
                      <td className="py-4 pr-4">{shopName ?? person.shop_id}</td>
                      <td className="py-4 pr-4 capitalize">{person.role}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-lg font-semibold">Registered shops</h2>
          <p className="text-sm text-muted-foreground">
            Shop owners, trial expiry dates, and current subscription status.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-3 pr-4 font-medium">Shop</th>
                  <th className="py-3 pr-4 font-medium">Owner</th>
                  <th className="py-3 pr-4 font-medium">Registered</th>
                  <th className="py-3 pr-4 font-medium">Trial / expiry</th>
                  <th className="py-3 pr-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {shops.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      No shops registered yet.
                    </td>
                  </tr>
                )}
                {shops.map((shop) => {
                  const owner = shop.shop_members.find(
                    (member) => member.user_id === shop.owner_id || member.role === "admin",
                  );
                  const statusLabel = shop.subscription_status.replace("_", " ");
                  return (
                    <tr key={shop.id}>
                      <td className="py-4 pr-4 font-medium">{shop.name}</td>
                      <td className="py-4 pr-4">
                        <div className="flex items-start gap-2">
                          <Users className="mt-0.5 h-4 w-4 text-muted-foreground" />
                          <div>
                            <p>{owner?.display_name ?? owner?.email ?? "Unknown owner"}</p>
                            <p className="text-xs text-muted-foreground">{owner?.email ?? shop.owner_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 pr-4 text-muted-foreground">
                        {new Date(shop.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-4 pr-4">
                        {new Date(shop.expiry_date).toLocaleDateString()}
                      </td>
                      <td className="py-4 pr-4">
                        <span className="inline-flex rounded-full bg-secondary px-2.5 py-1 text-xs font-medium capitalize text-secondary-foreground">
                          {statusLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
