import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatM } from "@/lib/currency";
import { ShoppingCart, Package, AlertTriangle, TrendingUp, Receipt } from "lucide-react";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardOverview,
});

interface Stats {
  todaySales: number;
  todayCount: number;
  weekSales: number;
  monthExpenses: number;
  productCount: number;
  lowStock: number;
  expiringSoon: number;
}

interface SalesLedgerRow {
  id: string;
  created_at: string;
  total: number;
  payment_method: string;
}

interface ExpenseLedgerRow {
  id: string;
  expense_date: string;
  amount: number;
  category: string;
  description: string | null;
}

interface AccountingBookSummary {
  monthSales: number;
  monthCogs: number;
  monthExpenses: number;
  monthProfit: number;
  grossProfit: number;
  inventoryAsset: number;
  cashMovement: number;
  totalAssets: number;
  totalLiabilities: number;
  ownersEquity: number;
}

interface LedgerEntry {
  id: string;
  entryAt: string;
  entryType: "sale" | "expense";
  amount: number;
  detail: string;
}

interface PaymentBookRow {
  method: string;
  amount: number;
}

function DashboardOverview() {
  const { shop } = useAuth();
  const isAdmin = shop?.role === "admin";
  const [stats, setStats] = useState<Stats>({
    todaySales: 0,
    todayCount: 0,
    weekSales: 0,
    monthExpenses: 0,
    productCount: 0,
    lowStock: 0,
    expiringSoon: 0,
  });
  const [loading, setLoading] = useState(true);
  const [accounting, setAccounting] = useState<AccountingBookSummary>({
    monthSales: 0,
    monthCogs: 0,
    monthExpenses: 0,
    monthProfit: 0,
    grossProfit: 0,
    inventoryAsset: 0,
    cashMovement: 0,
    totalAssets: 0,
    totalLiabilities: 0,
    ownersEquity: 0,
  });
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [paymentBook, setPaymentBook] = useState<PaymentBookRow[]>([]);

  useEffect(() => {
    if (!shop) return;
    const load = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date(Date.now() - 7 * 86400000);
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const fiveDays = new Date(Date.now() + 5 * 86400000);

      const [
        todayRes,
        weekRes,
        expRes,
        prodRes,
        lowRes,
        expiringRes,
        monthSalesRes,
        monthItemsRes,
        monthExpensesRes,
        recentSalesRes,
        recentExpensesRes,
        inventoryRes,
        paymentMethodRes,
      ] = await Promise.all([
        supabase
          .from("sales")
          .select("total")
          .eq("shop_id", shop.shop_id)
          .gte("created_at", today.toISOString()),
        supabase
          .from("sales")
          .select("total")
          .eq("shop_id", shop.shop_id)
          .gte("created_at", weekAgo.toISOString()),
        supabase
          .from("expenses")
          .select("amount")
          .eq("shop_id", shop.shop_id)
          .gte("expense_date", monthStart.toISOString().slice(0, 10)),
        supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("shop_id", shop.shop_id),
        supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("shop_id", shop.shop_id)
          .lte("stock_quantity", 5),
        supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("shop_id", shop.shop_id)
          .not("expiry_date", "is", null)
          .lte("expiry_date", fiveDays.toISOString().slice(0, 10)),
        supabase
          .from("sales")
          .select("total")
          .eq("shop_id", shop.shop_id)
          .gte("created_at", monthStart.toISOString()),
        supabase
          .from("sale_items")
          .select("cost_price, quantity")
          .eq("shop_id", shop.shop_id)
          .gte("created_at", monthStart.toISOString()),
        supabase
          .from("expenses")
          .select("amount")
          .eq("shop_id", shop.shop_id)
          .gte("expense_date", monthStart.toISOString().slice(0, 10)),
        supabase
          .from("sales")
          .select("id, created_at, total, payment_method")
          .eq("shop_id", shop.shop_id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("expenses")
          .select("id, expense_date, amount, category, description")
          .eq("shop_id", shop.shop_id)
          .order("expense_date", { ascending: false })
          .limit(20),
        supabase
          .from("products")
          .select("cost_price, stock_quantity")
          .eq("shop_id", shop.shop_id),
        supabase
          .from("sales")
          .select("payment_method, total")
          .eq("shop_id", shop.shop_id)
          .gte("created_at", monthStart.toISOString()),
      ]);

      const sum = (rows: { total?: number; amount?: number }[] | null, key: "total" | "amount") =>
        (rows ?? []).reduce((s, r) => s + Number(r[key] ?? 0), 0);

      setStats({
        todaySales: sum(todayRes.data, "total"),
        todayCount: todayRes.data?.length ?? 0,
        weekSales: sum(weekRes.data, "total"),
        monthExpenses: sum(expRes.data, "amount"),
        productCount: prodRes.count ?? 0,
        lowStock: lowRes.count ?? 0,
        expiringSoon: expiringRes.count ?? 0,
      });

      const monthSales = sum(monthSalesRes.data, "total");
      const monthCogs = (monthItemsRes.data ?? []).reduce(
        (acc, row) => acc + Number(row.cost_price ?? 0) * Number(row.quantity ?? 0),
        0,
      );
      const monthExpenses = sum(monthExpensesRes.data, "amount");
      const grossProfit = monthSales - monthCogs;
      const cashMovement = monthSales - monthExpenses;
      const inventoryAsset = (inventoryRes.data ?? []).reduce(
        (acc, row) => acc + Number(row.cost_price ?? 0) * Number(row.stock_quantity ?? 0),
        0,
      );
      const totalAssets = Math.max(cashMovement, 0) + inventoryAsset;
      const totalLiabilities = 0;
      const ownersEquity = totalAssets - totalLiabilities;

      setAccounting({
        monthSales,
        monthCogs,
        monthExpenses,
        monthProfit: monthSales - monthCogs - monthExpenses,
        grossProfit,
        inventoryAsset,
        cashMovement,
        totalAssets,
        totalLiabilities,
        ownersEquity,
      });

      const paymentMethodMap = new Map<string, number>();
      for (const row of paymentMethodRes.data ?? []) {
        const key = String(row.payment_method ?? "unknown");
        paymentMethodMap.set(key, (paymentMethodMap.get(key) ?? 0) + Number(row.total ?? 0));
      }
      setPaymentBook(
        Array.from(paymentMethodMap.entries()).map(([method, amount]) => ({ method, amount })),
      );

      const salesEntries: LedgerEntry[] = ((recentSalesRes.data ?? []) as SalesLedgerRow[]).map(
        (sale) => ({
          id: `sale-${sale.id}`,
          entryAt: sale.created_at,
          entryType: "sale",
          amount: Number(sale.total ?? 0),
          detail: `Sale via ${sale.payment_method}`,
        }),
      );

      const expenseEntries: LedgerEntry[] = (
        (recentExpensesRes.data ?? []) as ExpenseLedgerRow[]
      ).map((expense) => ({
        id: `expense-${expense.id}`,
        entryAt: expense.expense_date,
        entryType: "expense",
        amount: Number(expense.amount ?? 0),
        detail: expense.description
          ? `${expense.category} · ${expense.description}`
          : `${expense.category}`,
      }));

      const merged = [...salesEntries, ...expenseEntries]
        .sort((a, b) => new Date(b.entryAt).getTime() - new Date(a.entryAt).getTime())
        .slice(0, 25);

      setLedger(merged);
      setLoading(false);
    };
    load();
  }, [shop]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">
          Welcome{shop?.shop_name ? `, ${shop.shop_name}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">
          Here's what's happening in your shop today.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Today's sales"
          value={formatM(stats.todaySales)}
          sub={`${stats.todayCount} transactions`}
          icon={ShoppingCart}
          tone="primary"
        />
        <StatCard
          label="This week"
          value={formatM(stats.weekSales)}
          sub="Sales total"
          icon={TrendingUp}
          tone="success"
        />
        {isAdmin && (
          <StatCard
            label="This month expenses"
            value={formatM(stats.monthExpenses)}
            sub="Total recorded"
            icon={Receipt}
            tone="warning"
          />
        )}
        <StatCard
          label="Products"
          value={String(stats.productCount)}
          sub={`${stats.lowStock} low stock`}
          icon={Package}
          tone="default"
        />
      </div>

      {(stats.lowStock > 0 || stats.expiringSoon > 0) && (
        <Card className="border-warning/40 bg-warning/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-warning" />
            <div className="flex-1">
              <p className="font-medium text-foreground">Attention needed</p>
              <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                {stats.lowStock > 0 && (
                  <li>
                    {stats.lowStock} product{stats.lowStock > 1 ? "s" : ""} running low on stock
                  </li>
                )}
                {stats.expiringSoon > 0 && (
                  <li>
                    {stats.expiringSoon} product{stats.expiringSoon > 1 ? "s" : ""} expiring in 5
                    days or less
                  </li>
                )}
              </ul>
              {isAdmin && (
                <Link to="/dashboard/inventory" className="mt-2 inline-block">
                  <Button size="sm" variant="outline">
                    Review inventory
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="font-display text-lg font-semibold">Quick actions</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/dashboard/pos">
              <Button>
                <ShoppingCart className="mr-2 h-4 w-4" /> Open POS
              </Button>
            </Link>
            {isAdmin && (
              <>
                <Link to="/dashboard/inventory">
                  <Button variant="outline">Add product</Button>
                </Link>
                <Link to="/dashboard/expenses">
                  <Button variant="outline">Record expense</Button>
                </Link>
              </>
            )}
          </div>
        </Card>
        <Card className="p-6">
          <h2 className="font-display text-lg font-semibold">Tips</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>• Set a low-stock threshold so you never run out of best-sellers.</li>
            <li>• Record expenses regularly to see real profit.</li>
            <li>• Add expiry dates to perishable items for early warnings.</li>
          </ul>
        </Card>
      </div>

      {isAdmin && (
        <Card className="p-6">
          <h2 className="font-display text-lg font-semibold">Automated accounting books</h2>
          <p className="text-sm text-muted-foreground">
            This page summarizes your shop books using recorded sales, stock costs, and expenses.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniMetric title="Sales" value={formatM(accounting.monthSales)} />
            <MiniMetric title="Cost of goods" value={formatM(accounting.monthCogs)} />
            <MiniMetric title="Expenses" value={formatM(accounting.monthExpenses)} />
            <MiniMetric title="Profit" value={formatM(accounting.monthProfit)} />
          </div>

          <div className="mt-6 rounded-md border bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">
              Detailed accounting books are now available in Reports.
            </p>
            <Link to="/dashboard/reports" className="mt-3 inline-block">
              <Button variant="outline" size="sm">
                Open accounting books in Reports
              </Button>
            </Link>
          </div>

          <div className="mt-6 overflow-x-auto">
            <h3 className="mb-2 font-medium">Ledger entries</h3>
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-3 pr-4 font-medium">Date</th>
                  <th className="py-3 pr-4 font-medium">Type</th>
                  <th className="py-3 pr-4 font-medium">Details</th>
                  <th className="py-3 pr-4 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ledger.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground">
                      No ledger entries yet.
                    </td>
                  </tr>
                )}
                {ledger.map((entry) => (
                  <tr key={entry.id}>
                    <td className="py-4 pr-4 text-muted-foreground">
                      {new Date(entry.entryAt).toLocaleString()}
                    </td>
                    <td className="py-4 pr-4 capitalize">{entry.entryType}</td>
                    <td className="py-4 pr-4 text-muted-foreground">{entry.detail}</td>
                    <td
                      className={
                        entry.entryType === "sale"
                          ? "py-4 pr-4 text-success"
                          : "py-4 pr-4 text-destructive"
                      }
                    >
                      {formatM(entry.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {loading && (
        <p className="text-xs text-muted-foreground">Loading latest numbers...</p>
      )}
    </div>
  );
}

function MiniMetric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 font-display text-xl font-semibold">{value}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "success" | "warning" | "default";
}) {
  const toneMap = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning-foreground",
    default: "bg-muted text-foreground",
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 font-display text-2xl font-bold text-foreground">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneMap[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
