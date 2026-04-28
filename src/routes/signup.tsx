import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Package } from "lucide-react";
import { PLATFORM_ADMIN_EMAIL, supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const { session, loading: authLoading, refreshShop } = useAuth();
  const [shopName, setShopName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && session) {
      navigate({ to: "/dashboard" });
    }
  }, [authLoading, session, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    const redirectUrl = `${window.location.origin}/dashboard`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: ownerName, shop_name: shopName },
      },
    });
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

    // If email confirmation is disabled, the trigger creates shop + membership.
    // If session is null, ask user to confirm email.
    if (!data.session) {
      setLoading(false);
      toast.success("Account created! Check your email to confirm and sign in.");
      navigate({ to: "/login" });
      return;
    }

    await refreshShop();

    const userId = data.user?.id;
    let admin = false;
    if (userId) {
      const { data: isAdmin } = await supabase.rpc("is_platform_admin", { _uid: userId });
      admin =
        Boolean(isAdmin) ||
        (data.user?.email ?? "").toLowerCase() === PLATFORM_ADMIN_EMAIL.toLowerCase();
    }

    setLoading(false);
    toast.success("Welcome! Your 7-day free trial has started.");
    navigate({ to: admin ? "/admin" : "/dashboard" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-gold/5 px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
            <Package className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-bold">
            StockMaster <span className="text-gold">Pro</span>
          </span>
        </Link>
        <Card className="p-6">
          <h1 className="font-display text-2xl font-bold">Start your free trial</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            7 days free. No credit card needed.
          </p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="shopName">Shop name</Label>
              <Input
                id="shopName"
                required
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="e.g. Lerato's Mini Market"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ownerName">Your name</Label>
              <Input
                id="ownerName"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Owner full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@shop.co.ls"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Create account & start trial"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
