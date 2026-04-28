import { createFileRoute, Outlet, useNavigate, Link, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  useAuth,
  hasActiveAccess,
  getEffectiveSubscriptionStatus,
  getSubscriptionDaysLeft,
} from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Receipt,
  TrendingUp,
  Truck,
  CreditCard,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading, shop, signOut, isPlatformAdmin } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [timeTick, setTimeTick] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setTimeTick(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: "/login" });
    }
  }, [loading, session, navigate]);

  // Subscription gate: non-admins (i.e. shop members) need active access
  // unless they're on the billing page.
  useEffect(() => {
    if (!shop) return;
    const onBilling = location.pathname.startsWith("/dashboard/billing");
    if (!hasActiveAccess(shop) && !onBilling) {
      navigate({ to: "/dashboard/billing" });
    }
  }, [shop, location.pathname, navigate, timeTick]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!shop && !isPlatformAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-lg rounded-xl border bg-card p-8 text-center shadow-sm">
          <h1 className="font-display text-2xl font-bold">Cashier account registered</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Your account is waiting to be attached to a shop. Ask the shop admin to add your email
            in Settings, then sign in again.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="outline" onClick={() => signOut().then(() => navigate({ to: "/" }))}>
              Sign out
            </Button>
            <Button onClick={() => navigate({ to: "/login" })}>Back to sign in</Button>
          </div>
        </div>
      </div>
    );
  }

  const isAdmin = shop?.role === "admin";

  const allNavItems = [
    { to: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
    { to: "/dashboard/pos", label: "POS", icon: ShoppingCart },
    { to: "/dashboard/inventory", label: "Inventory", icon: Package, adminOnly: true },
    { to: "/dashboard/expenses", label: "Expenses", icon: Receipt, adminOnly: true },
    { to: "/dashboard/suppliers", label: "Suppliers", icon: Truck, adminOnly: true },
    { to: "/dashboard/reports", label: "Reports", icon: TrendingUp, adminOnly: true },
    { to: "/dashboard/billing", label: "Billing", icon: CreditCard, adminOnly: true },
    { to: "/dashboard/settings", label: "Settings", icon: SettingsIcon, adminOnly: true },
  ];
  const navItems = allNavItems.filter((i) => !i.adminOnly || isAdmin);

  return (
    <div className="min-h-screen bg-secondary/40">
      {/* Mobile overlay + drawer */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 md:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden={!mobileOpen}
        onClick={() => setMobileOpen(false)}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground shadow-xl transition-transform duration-300 ease-out md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-hidden={!mobileOpen}
        aria-label="Mobile navigation drawer"
      >
        <div className="flex items-center justify-end border-b border-sidebar-border p-2">
          <Button
            variant="ghost"
            size="icon"
            className="text-sidebar-foreground"
            aria-label="Close navigation menu"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <SidebarContent
          navItems={navItems}
          shopName={shop?.shop_name}
          role={shop?.role}
          isPlatformAdmin={isPlatformAdmin}
          onSignOut={() => {
            signOut().then(() => navigate({ to: "/" }));
          }}
          currentPath={location.pathname}
          onNavigate={() => setMobileOpen(false)}
        />
      </aside>

      <div className="flex min-h-screen">
        {/* Sidebar - desktop */}
        <aside className="hidden w-64 flex-shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
          <SidebarContent
            navItems={navItems}
            shopName={shop?.shop_name}
            role={shop?.role}
            isPlatformAdmin={isPlatformAdmin}
            onSignOut={() => {
              signOut().then(() => navigate({ to: "/" }));
            }}
            currentPath={location.pathname}
            onNavigate={() => {}}
          />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Topbar */}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background px-4">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {shop?.shop_name ?? "StockMaster Pro"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isPlatformAdmin
                  ? "System Owner"
                  : shop?.role === "admin"
                    ? "Admin (Owner)"
                    : shop?.role === "cashier"
                      ? "Cashier"
                      : ""}
              </p>
            </div>
            {isPlatformAdmin && (
              <span className="rounded-full border border-gold/50 bg-gold/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gold">
                System Owner
              </span>
            )}
            <SubscriptionBadge />
          </header>

          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  adminOnly?: boolean;
}

function SidebarContent({
  navItems,
  shopName,
  role,
  isPlatformAdmin,
  onSignOut,
  currentPath,
  onNavigate,
}: {
  navItems: NavItem[];
  shopName?: string;
  role?: string;
  isPlatformAdmin: boolean;
  onSignOut: () => void;
  currentPath: string;
  onNavigate: () => void;
}) {
  return (
    <>
      <div className="border-b border-sidebar-border p-4">
        <Link to="/dashboard" onClick={onNavigate} className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold text-gold-foreground">
            <Package className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-sm font-bold leading-tight truncate">
              StockMaster Pro
            </p>
            <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60 truncate">
              {shopName}
            </p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const active = item.exact
            ? currentPath === item.to
            : currentPath.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {isPlatformAdmin && (
          <Link
            to="/admin"
            onClick={onNavigate}
            className={cn(
              "mt-4 flex items-center gap-3 rounded-md border border-gold/40 bg-gold/10 px-3 py-2 text-sm font-medium text-gold transition-colors hover:bg-gold/20",
            )}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Platform admin</span>
          </Link>
        )}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <p className="px-3 pb-2 text-[10px] uppercase tracking-wider text-sidebar-foreground/50">
          {role === "admin" ? "Owner" : "Cashier"}
        </p>
        <button
          onClick={onSignOut}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign out</span>
        </button>
      </div>
    </>
  );
}

function SubscriptionBadge() {
  const { shop } = useAuth();
  const [timeTick, setTimeTick] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setTimeTick(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  if (!shop) return null;

  const effectiveStatus = getEffectiveSubscriptionStatus(shop, timeTick);
  const daysLeft = getSubscriptionDaysLeft(shop, timeTick);

  const colorMap: Record<string, string> = {
    trial: "bg-gold/15 text-foreground border-gold/40",
    active: "bg-success/15 text-success border-success/40",
    expired: "bg-destructive/15 text-destructive border-destructive/40",
    pending_verification: "bg-warning/15 text-warning-foreground border-warning/40",
  };

  const labelMap: Record<string, string> = {
    trial: `Trial · ${daysLeft}d left`,
    active: `Active · ${daysLeft}d left`,
    expired: "Expired",
    pending_verification: "Pending verification",
  };

  if (!effectiveStatus) return null;

  return (
    <span
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium",
        colorMap[effectiveStatus],
      )}
    >
      {labelMap[effectiveStatus]}
    </span>
  );
}
