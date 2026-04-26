import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export function useAdminPasswordGate(enabled: boolean, pageName: string) {
  const { user } = useAuth();
  const [verified, setVerified] = useState(!enabled);
  const [open, setOpen] = useState(enabled);
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    setVerified(!enabled);
    setOpen(enabled);
    setPassword("");
  }, [enabled, pageName]);

  const verifyPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!enabled) return;
    if (!user?.email) {
      toast.error("Cannot verify account email.");
      return;
    }
    if (!password) {
      toast.error("Enter your password.");
      return;
    }

    setVerifying(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    });
    setVerifying(false);

    if (error) {
      toast.error("Incorrect password.");
      return;
    }

    if (data.user?.id !== user.id) {
      toast.error("Password verification failed for this account.");
      return;
    }

    setVerified(true);
    setOpen(false);
    setPassword("");
    toast.success(`${pageName} unlocked`);
  };

  const gate = (
    <Card className="p-6">
      <h2 className="font-display text-lg font-semibold">Password required</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        For security, confirm your admin password to open {pageName}.
      </p>
      <Button className="mt-4" onClick={() => setOpen(true)}>
        Enter password
      </Button>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (verified) {
            setOpen(nextOpen);
            return;
          }
          setOpen(true);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Unlock {pageName}</DialogTitle>
          </DialogHeader>

          <form onSubmit={verifyPassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="admin-page-password">Admin password</Label>
              <Input
                id="admin-page-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={verifying}>
                {verifying ? "Verifying..." : "Unlock"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );

  return {
    verified,
    gate,
  };
}
