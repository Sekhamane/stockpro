import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdminPasswordGate } from "@/hooks/use-admin-password-gate";
import { formatM } from "@/lib/currency";
import { Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/reports")({
  component: ReportsPage,
});

type Range = "today" | "week" | "month";
type AccountingBook = "income" | "cash-flow" | "balance-sheet" | "trial-balance";

interface SaleRow {
  id: string;
  total: number;
  created_at: string;
  payment_method: string;
}

interface ProductSalesRow {
  productKey: string;
  productName: string;
  unitsSold: number;
  salesTotal: number;
  cogsTotal: number;
  grossProfit: number;
  saleLines: number;
}

type ProductSort = "units_desc" | "revenue_desc" | "profit_desc" | "name_asc";

function rangeStart(range: Range): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (range === "week") d.setDate(d.getDate() - 7);
  if (range === "month") d.setDate(1);
  return d;
}

function ReportsPage() {
  const { shop } = useAuth();
  const isAdmin = shop?.role === "admin";
  const { verified, gate } = useAdminPasswordGate(Boolean(isAdmin), "Reports");
  const [range, setRange] = useState<Range>("today");
  const [activeBook, setActiveBook] = useState<AccountingBook>("income");
  const [startDate, setStartDate] = useState(() => rangeStart("today").toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [costSum, setCostSum] = useState(0);
  const [expSum, setExpSum] = useState(0);
  const [inventoryAsset, setInventoryAsset] = useState(0);
  const [paymentBook, setPaymentBook] = useState<{ method: string; amount: number }[]>([]);
  const [productSales, setProductSales] = useState<ProductSalesRow[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productSort, setProductSort] = useState<ProductSort>("units_desc");
  const [minUnitsSold, setMinUnitsSold] = useState(0);
  const [loading, setLoading] = useState(false);

  const setPresetRange = (nextRange: Range) => {
    const start = rangeStart(nextRange).toISOString().slice(0, 10);
    const end = new Date().toISOString().slice(0, 10);
    setRange(nextRange);
    setStartDate(start);
    setEndDate(end);
  };

  useEffect(() => {
    if (!shop || !isAdmin) return;
    const load = async () => {
      if (!startDate || !endDate || startDate > endDate) {
        toast.error("Invalid date range");
        return;
      }

      setLoading(true);
      const start = new Date(`${startDate}T00:00:00`).toISOString();
      const end = new Date(`${endDate}T23:59:59.999`).toISOString();

      const [salesRes, itemsRes, expRes, inventoryRes] = await Promise.all([
        supabase
          .from("sales")
          .select("id, total, created_at, payment_method")
          .eq("shop_id", shop.shop_id)
          .gte("created_at", start)
          .lte("created_at", end)
          .order("created_at", { ascending: false }),
        supabase
          .from("sale_items")
          .select(
            "product_id, product_name, quantity, line_total, cost_price, products:product_id (cost_price), sales:sale_id!inner(created_at)",
          )
          .eq("shop_id", shop.shop_id)
          .gte("sales.created_at", start)
          .lte("sales.created_at", end),
        supabase
          .from("expenses")
          .select("amount")
          .eq("shop_id", shop.shop_id)
          .gte("expense_date", startDate)
          .lte("expense_date", endDate),
        supabase
          .from("products")
          .select("cost_price, stock_quantity")
          .eq("shop_id", shop.shop_id)
      ]);

      if (salesRes.error || itemsRes.error || expRes.error || inventoryRes.error) {
        toast.error(
          salesRes.error?.message ||
            itemsRes.error?.message ||
            expRes.error?.message ||
            inventoryRes.error?.message ||
            "Could not load report data",
        );
        setLoading(false);
        return;
      }

      const salesRows = (salesRes.data ?? []) as SaleRow[];
      setSales(salesRows);

      const paymentMethodMap = new Map<string, number>();
      for (const row of salesRows) {
        const key = String(row.payment_method ?? "unknown");
        paymentMethodMap.set(key, (paymentMethodMap.get(key) ?? 0) + Number(row.total ?? 0));
      }
      setPaymentBook(
        Array.from(paymentMethodMap.entries()).map(([method, amount]) => ({ method, amount })),
      );

      const inventoryValue = (inventoryRes.data ?? []).reduce(
        (acc, row) => acc + Number(row.cost_price ?? 0) * Number(row.stock_quantity ?? 0),
        0,
      );
      setInventoryAsset(inventoryValue);

      let cost = 0;
      type ItemRow = {
        product_id: string | null;
        product_name: string;
        quantity: number;
        line_total: number;
        cost_price: number;
        products: { cost_price: number } | { cost_price: number }[] | null;
      };
      const productTotals = new Map<string, ProductSalesRow>();
      for (const row of (itemsRes.data ?? []) as ItemRow[]) {
        const prod = Array.isArray(row.products) ? row.products[0] : row.products;
        const units = Number(row.quantity ?? 0);
        const lineRevenue = Number(row.line_total ?? 0);
        const unitCost = Number(row.cost_price ?? prod?.cost_price ?? 0);
        const lineCogs = units * unitCost;

        cost += lineCogs;

        const name = row.product_name || "Unknown product";
        const productKey = row.product_id ?? `name:${name.toLowerCase()}`;
        const current = productTotals.get(productKey) ?? {
          productKey,
          productName: name,
          unitsSold: 0,
          salesTotal: 0,
          cogsTotal: 0,
          grossProfit: 0,
          saleLines: 0,
        };
        current.unitsSold += units;
        current.salesTotal += lineRevenue;
        current.cogsTotal += lineCogs;
        current.grossProfit = current.salesTotal - current.cogsTotal;
        current.saleLines += 1;
        productTotals.set(productKey, current);
      }
      setCostSum(cost);
      setProductSales(Array.from(productTotals.values()));
      setExpSum((expRes.data ?? []).reduce((s, e) => s + Number(e.amount ?? 0), 0));
      setLoading(false);
    };
    load();
  }, [shop, isAdmin, startDate, endDate]);

  if (!isAdmin) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">Only owners can view reports.</p>
      </Card>
    );
  }

  if (!verified) {
    return gate;
  }

  const revenue = sales.reduce((s, r) => s + Number(r.total ?? 0), 0);
  const grossProfit = revenue - costSum;
  const netProfit = grossProfit - expSum;
  const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

  const salesByMethodTotal = paymentBook.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const operatingCashIn = salesByMethodTotal;
  const operatingCashOut = expSum;
  const netCashFromOperations = operatingCashIn - operatingCashOut;
  const closingCash = netCashFromOperations;

  const cashAsset = Math.max(closingCash, 0);
  const cashLiability = Math.max(-closingCash, 0);
  const totalAssets = cashAsset + inventoryAsset;
  const totalLiabilities = cashLiability;
  const ownersEquity = totalAssets - totalLiabilities;

  const trialDebitBase = cashAsset + inventoryAsset + costSum + expSum;
  const trialCreditBase = cashLiability + revenue;
  const trialDifference = trialDebitBase - trialCreditBase;
  const trialEquityDebit = trialDifference < 0 ? Math.abs(trialDifference) : 0;
  const trialEquityCredit = trialDifference > 0 ? trialDifference : 0;
  const trialDebitTotal = trialDebitBase + trialEquityDebit;
  const trialCreditTotal = trialCreditBase + trialEquityCredit;

  const normalizedProductSearch = productSearch.trim().toLowerCase();
  const normalizedMinUnits = Number.isFinite(minUnitsSold) ? Math.max(0, minUnitsSold) : 0;

  const filteredProductSales = productSales
    .filter((row) => row.unitsSold >= normalizedMinUnits)
    .filter((row) => row.productName.toLowerCase().includes(normalizedProductSearch))
    .sort((a, b) => {
      if (productSort === "name_asc") return a.productName.localeCompare(b.productName);
      if (productSort === "revenue_desc") {
        const diff = b.salesTotal - a.salesTotal;
        return diff !== 0 ? diff : a.productName.localeCompare(b.productName);
      }
      if (productSort === "profit_desc") {
        const diff = b.grossProfit - a.grossProfit;
        return diff !== 0 ? diff : a.productName.localeCompare(b.productName);
      }
      const diff = b.unitsSold - a.unitsSold;
      return diff !== 0 ? diff : a.productName.localeCompare(b.productName);
    });

  const resetProductFilters = () => {
    setProductSearch("");
    setMinUnitsSold(0);
    setProductSort("units_desc");
  };

  const exportCSV = () => {
    const rows = [
      ["Sale ID", "Date", "Payment", "Total"],
      ...sales.map((s) => [
        s.id,
        new Date(s.created_at).toLocaleString(),
        s.payment_method,
        Number(s.total).toFixed(2),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground">Sales, accounting books and profitability</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={range} onValueChange={(v) => setPresetRange(v as Range)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 days</SelectItem>
              <SelectItem value="month">This month</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-[160px]"
          />
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-[160px]"
          />
          <Button variant="outline" onClick={exportCSV} disabled={sales.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      <Card className="p-5">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Accounting books
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={activeBook === "income" ? "default" : "outline"}
            onClick={() => setActiveBook("income")}
          >
            Income Statement
          </Button>
          <Button
            variant={activeBook === "cash-flow" ? "default" : "outline"}
            onClick={() => setActiveBook("cash-flow")}
          >
            Cash Flow
          </Button>
          <Button
            variant={activeBook === "balance-sheet" ? "default" : "outline"}
            onClick={() => setActiveBook("balance-sheet")}
          >
            Balance Sheet
          </Button>
          <Button
            variant={activeBook === "trial-balance" ? "default" : "outline"}
            onClick={() => setActiveBook("trial-balance")}
          >
            Trial Balance
          </Button>
        </div>
      </Card>

      <Card className="overflow-x-auto p-5">
        {activeBook === "income" && (
          <>
            <h2 className="mb-3 font-display text-lg font-semibold">Income Statement</h2>
            <table className="w-full min-w-[560px] text-left text-sm">
              <tbody className="divide-y">
                <tr>
                  <td className="py-3 pr-4 font-medium">Sales revenue</td>
                  <td className="py-3 text-right">{formatM(revenue)}</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium">Cost of goods sold</td>
                  <td className="py-3 text-right">{formatM(costSum)}</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium">Gross profit</td>
                  <td className="py-3 text-right">{formatM(grossProfit)}</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium">Gross margin</td>
                  <td className="py-3 text-right">{grossMargin.toFixed(1)}%</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium">Operating expenses</td>
                  <td className="py-3 text-right">{formatM(expSum)}</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-semibold">Net profit</td>
                  <td className="py-3 text-right font-semibold">{formatM(netProfit)}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        {activeBook === "cash-flow" && (
          <>
            <h2 className="mb-3 font-display text-lg font-semibold">Cash Flow Statement</h2>
            <table className="w-full min-w-[560px] text-left text-sm">
              <tbody className="divide-y">
                <tr>
                  <td className="py-3 pr-4 font-medium">Cash receipts from customers</td>
                  <td className="py-3 text-right">{formatM(operatingCashIn)}</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium">Cash paid for operating expenses</td>
                  <td className="py-3 text-right">{formatM(operatingCashOut)}</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium">Net cash from operations</td>
                  <td className="py-3 text-right">{formatM(netCashFromOperations)}</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-semibold">Closing cash movement</td>
                  <td className="py-3 text-right font-semibold">{formatM(closingCash)}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        {activeBook === "balance-sheet" && (
          <>
            <h2 className="mb-3 font-display text-lg font-semibold">Balance Sheet</h2>
            <table className="w-full min-w-[560px] text-left text-sm">
              <tbody className="divide-y">
                <tr>
                  <td className="py-3 pr-4 font-medium">Cash and cash equivalents</td>
                  <td className="py-3 text-right">{formatM(cashAsset)}</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium">Inventory</td>
                  <td className="py-3 text-right">{formatM(inventoryAsset)}</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium">Total assets</td>
                  <td className="py-3 text-right">{formatM(totalAssets)}</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium">Bank overdraft / liabilities</td>
                  <td className="py-3 text-right">{formatM(totalLiabilities)}</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-semibold">Owner's equity</td>
                  <td className="py-3 text-right font-semibold">{formatM(ownersEquity)}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        {activeBook === "trial-balance" && (
          <>
            <h2 className="mb-3 font-display text-lg font-semibold">Trial Balance</h2>
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-3 pr-4 font-medium">Account</th>
                  <th className="py-3 pr-4 text-right font-medium">Debit</th>
                  <th className="py-3 pr-4 text-right font-medium">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="py-3 pr-4">Cash and cash equivalents</td>
                  <td className="py-3 pr-4 text-right">{formatM(cashAsset)}</td>
                  <td className="py-3 pr-4 text-right">{formatM(0)}</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4">Inventory</td>
                  <td className="py-3 pr-4 text-right">{formatM(inventoryAsset)}</td>
                  <td className="py-3 pr-4 text-right">{formatM(0)}</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4">Cost of goods sold</td>
                  <td className="py-3 pr-4 text-right">{formatM(costSum)}</td>
                  <td className="py-3 pr-4 text-right">{formatM(0)}</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4">Operating expenses</td>
                  <td className="py-3 pr-4 text-right">{formatM(expSum)}</td>
                  <td className="py-3 pr-4 text-right">{formatM(0)}</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4">Sales revenue</td>
                  <td className="py-3 pr-4 text-right">{formatM(0)}</td>
                  <td className="py-3 pr-4 text-right">{formatM(revenue)}</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4">Bank overdraft / liabilities</td>
                  <td className="py-3 pr-4 text-right">{formatM(0)}</td>
                  <td className="py-3 pr-4 text-right">{formatM(cashLiability)}</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4">Owner's equity</td>
                  <td className="py-3 pr-4 text-right">{formatM(trialEquityDebit)}</td>
                  <td className="py-3 pr-4 text-right">{formatM(trialEquityCredit)}</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-semibold">Totals</td>
                  <td className="py-3 pr-4 text-right font-semibold">{formatM(trialDebitTotal)}</td>
                  <td className="py-3 pr-4 text-right font-semibold">{formatM(trialCreditTotal)}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Revenue" value={formatM(revenue)} />
        <Stat label="Cost of goods" value={formatM(costSum)} />
        <Stat label="Expenses" value={formatM(expSum)} />
        <Stat
          label="Net profit"
          value={formatM(netProfit)}
          tone={netProfit >= 0 ? "success" : "destructive"}
        />
      </div>

      <Card className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sale #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            )}
            {!loading && sales.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                  No sales in this period.
                </TableCell>
              </TableRow>
            )}
            {sales.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">#{s.id.slice(0, 8)}</TableCell>
                <TableCell>{new Date(s.created_at).toLocaleString()}</TableCell>
                <TableCell className="capitalize">
                  {s.payment_method.replace("_", " ")}
                </TableCell>
                <TableCell className="text-right">{formatM(s.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Products sold</h2>
            <p className="text-sm text-muted-foreground">
              Filter products to find high-volume and high-profit items in this date range.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Search product"
              className="w-[180px]"
            />
            <Input
              type="number"
              min={0}
              value={String(minUnitsSold)}
              onChange={(e) => {
                const parsed = Number.parseInt(e.target.value, 10);
                setMinUnitsSold(Number.isNaN(parsed) ? 0 : Math.max(0, parsed));
              }}
              placeholder="Min units"
              className="w-[120px]"
            />
            <Select value={productSort} onValueChange={(v) => setProductSort(v as ProductSort)}>
              <SelectTrigger className="w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="units_desc">Most sold (units)</SelectItem>
                <SelectItem value="revenue_desc">Highest sales value</SelectItem>
                <SelectItem value="profit_desc">Highest gross profit</SelectItem>
                <SelectItem value="name_asc">Product name A-Z</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={resetProductFilters}>
              Reset
            </Button>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Showing {filteredProductSales.length} of {productSales.length} sold products.
        </p>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Units sold</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="text-right">COGS</TableHead>
                <TableHead className="text-right">Gross profit</TableHead>
                <TableHead className="text-right">Sale lines</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    Loading product sales...
                  </TableCell>
                </TableRow>
              )}
              {!loading && filteredProductSales.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    No products match these filters.
                  </TableCell>
                </TableRow>
              )}
              {filteredProductSales.map((row) => (
                <TableRow key={row.productKey}>
                  <TableCell className="font-medium">{row.productName}</TableCell>
                  <TableCell className="text-right">{row.unitsSold}</TableCell>
                  <TableCell className="text-right">{formatM(row.salesTotal)}</TableCell>
                  <TableCell className="text-right">{formatM(row.cogsTotal)}</TableCell>
                  <TableCell
                    className={row.grossProfit >= 0 ? "text-right text-success" : "text-right text-destructive"}
                  >
                    {formatM(row.grossProfit)}
                  </TableCell>
                  <TableCell className="text-right">{row.saleLines}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "destructive";
}) {
  const toneMap = {
    default: "text-foreground",
    success: "text-success",
    destructive: "text-destructive",
  };
  return (
    <Card className="p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`mt-2 font-display text-2xl font-bold ${toneMap[tone]}`}>{value}</p>
    </Card>
  );
}
