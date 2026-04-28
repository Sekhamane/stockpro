import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { PLATFORM_ADMIN_EMAIL, supabase } from "@/integrations/supabase/client";

export type ShopRole = "admin" | "cashier";
export type SubscriptionStatus = "trial" | "active" | "expired" | "pending_verification";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ShopContext {
  shop_id: string;
  shop_name: string;
  role: ShopRole;
  subscription_status: SubscriptionStatus;
  expiry_date: string | null;
}

function getExpiryTimestamp(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  const ts = new Date(expiryDate).getTime();
  return Number.isFinite(ts) ? ts : null;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  shop: ShopContext | null;
  loading: boolean;
  isPlatformAdmin: boolean;
  signOut: () => Promise<void>;
  refreshShop: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [shop, setShop] = useState<ShopContext | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadShop = async (uid: string) => {
    const { data, error } = await supabase
      .from("shop_members")
      .select(
        "role, shops:shop_id (id, name, subscription_status, expiry_date)",
      )
      .eq("user_id", uid)
      .maybeSingle();

    if (error || !data || !data.shops) {
      setShop(null);
      return;
    }
    const s = Array.isArray(data.shops) ? data.shops[0] : data.shops;
    if (!s) {
      setShop(null);
      return;
    }
    const rawStatus = s.subscription_status as SubscriptionStatus;
    const expiryTs = getExpiryTimestamp((s.expiry_date as string | null) ?? null);
    const shouldMarkExpired =
      (rawStatus === "trial" || rawStatus === "active") &&
      expiryTs !== null &&
      expiryTs <= Date.now();

    if (shouldMarkExpired) {
      void supabase
        .from("shops")
        .update({ subscription_status: "expired" })
        .eq("id", s.id as string);
    }

    setShop({
      shop_id: s.id as string,
      shop_name: s.name as string,
      role: data.role as ShopRole,
      subscription_status: shouldMarkExpired ? "expired" : rawStatus,
      expiry_date: (s.expiry_date as string | null) ?? null,
    });
  };

  const isOwnerEmail = (email: string | null | undefined) =>
    (email ?? "").trim().toLowerCase() === PLATFORM_ADMIN_EMAIL.toLowerCase();

  const loadSystemOwnerRole = async (uid: string, email?: string | null) => {
    const { data } = await supabase.rpc("is_platform_admin", { _uid: uid });
    setIsPlatformAdmin(Boolean(data) || isOwnerEmail(email));
  };

  useEffect(() => {
    // Set up listener FIRST, then check session — required pattern
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        // defer to avoid deadlock
        setTimeout(() => {
          loadShop(newSession.user.id);
          loadSystemOwnerRole(newSession.user.id, newSession.user.email);
        }, 0);
      } else {
        setShop(null);
        setIsPlatformAdmin(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      if (existing?.user) {
        Promise.all([
          loadShop(existing.user.id),
          loadSystemOwnerRole(existing.user.id, existing.user.email),
        ]).finally(() => setLoading(false));
      } else {
        setIsPlatformAdmin(false);
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setShop(null);
    setIsPlatformAdmin(false);
  };

  const refreshShop = async () => {
    if (session?.user) {
      await Promise.all([
        loadShop(session.user.id),
        loadSystemOwnerRole(session.user.id, session.user.email),
      ]);
    }
  };

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    shop,
    loading,
    isPlatformAdmin,
    signOut,
    refreshShop,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Returns true if shop has working access (trial or active and not expired). */
// eslint-disable-next-line react-refresh/only-export-components
export function getEffectiveSubscriptionStatus(
  shop: ShopContext | null,
  nowMs = Date.now(),
): SubscriptionStatus | null {
  if (!shop) return null;
  if (shop.subscription_status === "expired") return "expired";
  if (shop.subscription_status === "pending_verification") return "pending_verification";

  const expiryTs = getExpiryTimestamp(shop.expiry_date);
  if (expiryTs !== null && expiryTs <= nowMs) return "expired";

  return shop.subscription_status;
}

// eslint-disable-next-line react-refresh/only-export-components
export function getSubscriptionDaysLeft(shop: ShopContext | null, nowMs = Date.now()): number {
  if (!shop?.expiry_date) return 0;
  const expiryTs = getExpiryTimestamp(shop.expiry_date);
  if (expiryTs === null) return 0;
  return Math.max(0, Math.ceil((expiryTs - nowMs) / DAY_MS));
}

// eslint-disable-next-line react-refresh/only-export-components
export function hasActiveAccess(shop: ShopContext | null): boolean {
  const status = getEffectiveSubscriptionStatus(shop);
  return status === "trial" || status === "active";
}
