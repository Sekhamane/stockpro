import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  useAuth,
  hasActiveAccess,
  getEffectiveSubscriptionStatus,
  getSubscriptionDaysLeft,
} from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdminPasswordGate } from "@/hooks/use-admin-password-gate";
import { formatM } from "@/lib/currency";
import { Upload, CheckCircle2, Clock, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/billing")({
  component: BillingPage,
});

interface Submission {
  id: string;
  amount: number;
  payment_method: string;
  reference_number: string | null;
  status: "pending_verification" | "approved" | "rejected";
  proof_url: string | null;
  rejection_reason: string | null;
  created_at: string;
  plan: "monthly" | "yearly";
}

function BillingPage() {
  const { shop, user, refreshShop } = useAuth();
  const isAdmin = shop?.role === "admin";
  const { verified, gate } = useAdminPasswordGate(Boolean(isAdmin), "Billing");
  const [history, setHistory] = useState<Submission[]>([]);
  const [plan, setPlan] = useState<"monthly" | "yearly">("monthly");
  const [method, setMethod] = useState<"mpesa" | "ecocash" | "cash" | "bank_transfer">("mpesa");
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [timeTick, setTimeTick] = useState(() => Date.now());

  const planAmount = plan === "monthly" ? 200 : 2160;

  const load = async () => {
    if (!shop) return;
    const { data } = await supabase
      .from("subscription_payments")
      .select("*")
      .eq("shop_id", shop.shop_id)
      .order("created_at", { ascending: false });
    setHistory((data ?? []) as Submission[]);
  };

  useEffect(() => {
    load();
  }, [shop]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const interval = setInterval(() => setTimeTick(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  if (!isAdmin) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">Only owners can manage billing.</p>
      </Card>
    );
  }

  if (!verified) {
    return gate;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!shop || !user || !file) {
      toast.error("Please upload your proof of payment.");
      return;
    }
    setSubmitting(true);
    try {
      // 1. Upload proof to storage
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${shop.shop_id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("payment-proofs")
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;

      // 2. Insert payment row (status pending_verification by default)
      const { error: insErr } = await supabase.from("subscription_payments").insert({
        shop_id: shop.shop_id,
        submitted_by: user.id,
        amount: planAmount,
        plan,
        payment_method: method,
        reference_number: reference || null,
        proof_url: path,
      });
      if (insErr) throw insErr;

      // 3. Mark shop as pending verification
      await supabase
        .from("shops")
        .update({ subscription_status: "pending_verification" })
        .eq("id", shop.shop_id);

      toast.success("Proof submitted. We'll review and activate your subscription shortly.");
      setFile(null);
      setReference("");
      await refreshShop();
      load();
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err.message ?? "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const active = hasActiveAccess(shop);
  const effectiveStatus = getEffectiveSubscriptionStatus(shop, timeTick);
  const expired = effectiveStatus === "expired";
  const daysLeft = getSubscriptionDaysLeft(shop, timeTick);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Billing & subscription</h1>
        <p className="text-sm text-muted-foreground">
          Pay by cash, M-Pesa, or EcoCash. Upload proof to activate.
        </p>
      </div>

      <Card
        className={`border-2 p-6 ${
          expired
            ? "border-destructive/40 bg-destructive/5"
            : active
              ? "border-success/30 bg-success/5"
              : "border-warning/40 bg-warning/5"
        }`}
      >
        <div className="flex items-start gap-3">
          {expired ? (
            <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
          ) : shop?.subscription_status === "active" ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
          ) : shop?.subscription_status === "trial" ? (
            <Clock className="mt-0.5 h-5 w-5 text-foreground" />
          ) : (
            <Clock className="mt-0.5 h-5 w-5 text-warning" />
          )}
          <div>
            <p className="font-semibold capitalize">
              {effectiveStatus?.replace("_", " ") ?? "No subscription"}
            </p>
            <p className="text-sm text-muted-foreground">
              {expired
                ? "Your subscription has expired. Please make payment and upload proof to continue using StockMaster Pro."
                : shop?.expiry_date
                  ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left · Valid until ${new Date(shop.expiry_date).toLocaleDateString()}`
                  : "No active subscription"}
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-display text-lg font-semibold">Submit payment proof</h2>
        <p className="text-sm text-muted-foreground">
          Pay using one of the methods below, then upload your proof.
        </p>

        <div className="mt-4 grid gap-3 rounded-md border bg-muted/40 p-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">M-Pesa</p>
            <p>Pay to: <span className="font-medium">+266 5XXX XXXX</span></p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">EcoCash</p>
            <p>Pay to: <span className="font-medium">+266 6XXX XXXX</span></p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Plan</Label>
            <Select value={plan} onValueChange={(v) => setPlan(v as "monthly" | "yearly")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly · M 200</SelectItem>
                <SelectItem value="yearly">Yearly · M 2,160 (save 10%)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Payment method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mpesa">M-Pesa</SelectItem>
                <SelectItem value="ecocash">EcoCash</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Amount paid (M)</Label>
            <Input value={planAmount} disabled />
          </div>
          <div className="space-y-1.5">
            <Label>Transaction / reference number</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. MP123XYZ"
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Proof of payment (image or PDF)</Label>
            <Input
              type="file"
              accept="image/*,application/pdf"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={submitting} size="lg">
              <Upload className="mr-2 h-4 w-4" />
              {submitting ? "Submitting..." : `Submit proof for ${formatM(planAmount)}`}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="font-display text-lg font-semibold">Payment history</h2>
        <div className="mt-4 space-y-2">
          {history.length === 0 && (
            <p className="text-sm text-muted-foreground">No payments submitted yet.</p>
          )}
          {history.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <div>
                <p className="text-sm font-medium">
                  {formatM(s.amount)} · {s.plan} · {s.payment_method}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(s.created_at).toLocaleString()}
                  {s.reference_number ? ` · Ref ${s.reference_number}` : ""}
                </p>
                {s.rejection_reason && (
                  <p className="mt-1 text-xs text-destructive">
                    Rejected: {s.rejection_reason}
                  </p>
                )}
              </div>
              <StatusBadge status={s.status} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: Submission["status"] }) {
  if (status === "approved")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-medium text-success">
        <CheckCircle2 className="h-3 w-3" /> Approved
      </span>
    );
  if (status === "rejected")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2.5 py-0.5 text-xs font-medium text-destructive">
        <XCircle className="h-3 w-3" /> Rejected
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-warning-foreground">
      <Clock className="h-3 w-3" /> Pending
    </span>
  );
}
