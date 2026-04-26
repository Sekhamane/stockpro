import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatM } from "@/lib/currency";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Printer,
  PauseCircle,
  RotateCcw,
  ScanLine,
  X,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/pos")({
  component: POSPage,
});

interface Product {
  id: string;
  name: string;
  barcode: string | null;
  selling_price: number;
  stock_quantity: number;
}

interface CartLine {
  product: Product;
  qty: number;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>'"]/g, (char) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    })[char] ?? char,
  );

function POSPage() {
  const { shop, user } = useAuth();
  const searchRef = useRef<HTMLInputElement>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [heldCarts, setHeldCarts] = useState<CartLine[][]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "mpesa" | "ecocash">("cash");
  const [amountReceived, setAmountReceived] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [checkout, setCheckout] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<{
    saleNumber: string;
    lines: CartLine[];
    total: number;
    method: string;
    reference: string | null;
    received: number;
    change: number;
    at: Date;
  } | null>(null);

  const loadProducts = async () => {
    if (!shop) return;
    const { data } = await supabase
      .from("products")
      .select("id, name, barcode, selling_price, stock_quantity")
      .eq("shop_id", shop.shop_id)
      .order("name");
    setProducts((data ?? []) as Product[]);
  };

  useEffect(() => {
    loadProducts();
  }, [shop]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products.slice(0, 24);
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) || (p.barcode ?? "").toLowerCase().includes(q),
      )
      .slice(0, 24);
  }, [products, search]);

  const addToCart = (p: Product) => {
    if (p.stock_quantity <= 0) {
      toast.error("Out of stock");
      return;
    }
    setCart((curr) => {
      const exists = curr.find((c) => c.product.id === p.id);
      if (exists) {
        if (exists.qty >= p.stock_quantity) {
          toast.error("No more stock");
          return curr;
        }
        return curr.map((c) =>
          c.product.id === p.id ? { ...c, qty: c.qty + 1 } : c,
        );
      }
      return [...curr, { product: p, qty: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart((curr) =>
      curr
        .map((c) => {
          if (c.product.id !== id) return c;
          const next = c.qty + delta;
          if (next <= 0) return null;
          if (next > c.product.stock_quantity) {
            toast.error("No more stock");
            return c;
          }
          return { ...c, qty: next };
        })
        .filter(Boolean) as CartLine[],
    );
  };

  const removeLine = (id: string) =>
    setCart((curr) => curr.filter((c) => c.product.id !== id));

  const clearCart = () => {
    setCart([]);
    setAmountReceived("");
    setPaymentReference("");
    searchRef.current?.focus();
  };

  const holdCart = () => {
    if (cart.length === 0) return;
    setHeldCarts((curr) => [cart, ...curr].slice(0, 5));
    clearCart();
    toast.success("Cart held");
  };

  const recallCart = (index: number) => {
    if (cart.length > 0 && !confirm("Replace the current cart with this held cart?")) return;
    const next = heldCarts[index];
    if (!next) return;
    setCart(next);
    setHeldCarts((curr) => curr.filter((_, i) => i !== index));
    toast.success("Cart recalled");
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = search.trim().toLowerCase();
    if (!q) return;
    const exactBarcode = products.find((p) => (p.barcode ?? "").toLowerCase() === q);
    const target = exactBarcode ?? (filtered.length === 1 ? filtered[0] : null);
    if (!target) return;
    addToCart(target);
    setSearch("");
  };

  const total = cart.reduce((s, c) => s + c.qty * Number(c.product.selling_price), 0);
  const received = Number(amountReceived || 0);
  const change = Math.max(0, received - total);

  const handleCheckout = async () => {
    if (!shop || cart.length === 0) return;
    if (paymentMethod === "cash" && received < total) {
      toast.error("Amount received is less than total");
      return;
    }
    setCheckout(true);
    try {
      const saleNumber = `S${Date.now().toString().slice(-8)}`;
      const { data: sale, error } = await supabase
        .from("sales")
        .insert({
          shop_id: shop.shop_id,
          cashier_id: user?.id ?? null,
          subtotal: total,
          total: total,
          payment_method: paymentMethod,
          payment_reference:
            paymentMethod === "cash" ? `Received ${received}` : paymentReference || null,
        })
        .select("id")
        .single();
      if (error || !sale) throw error;

      const items = cart.map((c) => ({
        sale_id: sale.id,
        shop_id: shop.shop_id,
        product_id: c.product.id,
        product_name: c.product.name,
        quantity: c.qty,
        unit_price: Number(c.product.selling_price),
        line_total: c.qty * Number(c.product.selling_price),
      }));
      const { error: itemErr } = await supabase.from("sale_items").insert(items);
      if (itemErr) throw itemErr;

      // Stock deduction is handled by DB trigger.
      setLastReceipt({
        saleNumber,
        lines: cart,
        total,
        method: paymentMethod,
        reference: paymentMethod === "cash" ? null : paymentReference || null,
        received: paymentMethod === "cash" ? received : total,
        change: paymentMethod === "cash" ? change : 0,
        at: new Date(),
      });
      setCart([]);
      setAmountReceived("");
      setPaymentReference("");
      await loadProducts();
      toast.success("Sale recorded");
    } catch (e) {
      const err = e as { message?: string };
      toast.error(err.message ?? "Failed to record sale");
    } finally {
      setCheckout(false);
    }
  };

  const printLastReceipt = () => {
    if (!lastReceipt) return;

    const receiptWindow = window.open("", "receipt-print", "width=420,height=720");
    if (!receiptWindow) {
      toast.error("Please allow pop-ups to print receipts");
      return;
    }

    const rows = lastReceipt.lines
      .map(
        (line) => `
          <tr>
            <td>
              <strong>${escapeHtml(line.product.name)}</strong>
              <span>${formatM(line.product.selling_price)} × ${line.qty}</span>
            </td>
            <td>${formatM(line.qty * Number(line.product.selling_price))}</td>
          </tr>
        `,
      )
      .join("");

    receiptWindow.document.write(`<!doctype html>
      <html>
        <head>
          <title>Receipt ${escapeHtml(lastReceipt.saleNumber)}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              background: #f4f4f5;
              color: #111827;
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
              font-size: 12px;
              line-height: 1.45;
            }
            .receipt {
              width: 80mm;
              min-height: 100vh;
              margin: 0 auto;
              background: #fff;
              padding: 16px 14px 20px;
            }
            .center { text-align: center; }
            .shop { font-size: 16px; font-weight: 800; letter-spacing: 0.04em; }
            .muted { color: #52525b; }
            .divider { border-top: 1px dashed #a1a1aa; margin: 12px 0; }
            table { width: 100%; border-collapse: collapse; }
            td { padding: 5px 0; vertical-align: top; }
            td:last-child { text-align: right; white-space: nowrap; padding-left: 10px; }
            td span { display: block; color: #52525b; margin-top: 2px; }
            .totals { margin-top: 8px; }
            .totals .line { display: flex; justify-content: space-between; gap: 12px; padding: 3px 0; }
            .total { font-size: 15px; font-weight: 800; border-top: 1px solid #111827; margin-top: 6px; padding-top: 7px; }
            .thanks { margin-top: 14px; font-weight: 700; }
            .actions { display: flex; justify-content: center; gap: 8px; margin: 14px auto; }
            button { border: 0; border-radius: 6px; padding: 9px 12px; cursor: pointer; font-weight: 700; }
            .print { background: #111827; color: white; }
            .close { background: #e4e4e7; color: #18181b; }
            @page { size: 80mm auto; margin: 0; }
            @media print {
              body { background: #fff; }
              .receipt { width: 80mm; margin: 0; padding: 10px; min-height: auto; }
              .actions { display: none; }
            }
          </style>
        </head>
        <body>
          <main class="receipt">
            <section class="center">
              <div class="shop">${escapeHtml(shop?.shop_name ?? "Shop")}</div>
              <div class="muted">${escapeHtml(lastReceipt.at.toLocaleString())}</div>
              <div>Receipt #${escapeHtml(lastReceipt.saleNumber)}</div>
            </section>
            <div class="divider"></div>
            <table><tbody>${rows}</tbody></table>
            <div class="divider"></div>
            <section class="totals">
              <div class="line total"><span>Total</span><span>${formatM(lastReceipt.total)}</span></div>
              <div class="line"><span>Payment</span><span>${escapeHtml(lastReceipt.method.replace("_", " "))}</span></div>
              ${
                lastReceipt.reference
                  ? `<div class="line"><span>Reference</span><span>${escapeHtml(lastReceipt.reference)}</span></div>`
                  : ""
              }
              ${
                lastReceipt.method === "cash"
                  ? `<div class="line"><span>Received</span><span>${formatM(lastReceipt.received)}</span></div>
                     <div class="line"><span>Change</span><span>${formatM(lastReceipt.change)}</span></div>`
                  : ""
              }
            </section>
            <p class="center thanks">Thank you!</p>
          </main>
          <div class="actions">
            <button class="print" onclick="window.print()">Print receipt</button>
            <button class="close" onclick="window.close()">Close</button>
          </div>
          <script>window.addEventListener('load', () => setTimeout(() => window.print(), 150));</script>
        </body>
      </html>`);
    receiptWindow.document.close();
    receiptWindow.focus();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      {/* Product picker */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search by name or scan barcode..."
            className="pl-10"
            autoFocus
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => searchRef.current?.focus()}>
            <ScanLine className="h-4 w-4" /> Scan next
          </Button>
          <Button variant="outline" size="sm" onClick={holdCart} disabled={cart.length === 0}>
            <PauseCircle className="h-4 w-4" /> Hold cart
          </Button>
          {heldCarts.map((held, index) => (
            <Button key={index} variant="secondary" size="sm" onClick={() => recallCart(index)}>
              <RotateCcw className="h-4 w-4" /> Recall {index + 1} · {held.length}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground">
              No products. Ask the owner to add products in Inventory.
            </p>
          )}
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => addToCart(p)}
              disabled={p.stock_quantity <= 0}
              className="flex h-24 flex-col justify-between rounded-md border bg-card p-3 text-left transition-shadow hover:shadow-md disabled:opacity-50"
            >
              <span className="line-clamp-2 text-sm font-medium text-foreground">{p.name}</span>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground">{p.stock_quantity} left</span>
                <span className="text-sm font-semibold text-primary">
                  {formatM(p.selling_price)}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Cart */}
      <Card className="flex h-fit flex-col p-4 lg:sticky lg:top-20">
        <div className="mb-3 flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">Cart</h2>
          <span className="ml-auto text-sm text-muted-foreground">{cart.length} items</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={clearCart}
            disabled={cart.length === 0}
            aria-label="Clear cart"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {cart.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Tap a product to add to cart
            </p>
          )}
          {cart.map((line) => (
            <div key={line.product.id} className="flex items-center gap-2 rounded-md border p-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{line.product.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatM(line.product.selling_price)} × {line.qty}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => updateQty(line.product.id, -1)}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-6 text-center text-sm font-medium">{line.qty}</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => updateQty(line.product.id, 1)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => removeLine(line.product.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-3 border-t pt-3">
          <div className="flex items-center justify-between text-lg">
            <span className="font-semibold">Total</span>
            <span className="font-display font-bold text-primary">{formatM(total)}</span>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Payment method</Label>
            <Select
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as "cash" | "mpesa" | "ecocash")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="mpesa">M-Pesa</SelectItem>
                <SelectItem value="ecocash">EcoCash</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {paymentMethod === "cash" && (
            <div className="space-y-2">
              <Label className="text-xs">Amount received</Label>
              <div className="grid grid-cols-3 gap-2">
                {[total, 50, 100].map((amount) => (
                  <Button
                    key={amount}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAmountReceived(String(amount.toFixed(2)))}
                    disabled={total === 0}
                  >
                    {amount === total ? "Exact" : formatM(amount)}
                  </Button>
                ))}
              </div>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
                placeholder="0.00"
              />
              {received > 0 && (
                <p className="text-xs text-muted-foreground">
                  Change: <span className="font-medium text-foreground">{formatM(change)}</span>
                </p>
              )}
            </div>
          )}

          {paymentMethod !== "cash" && (
            <div className="space-y-2">
              <Label className="text-xs">Payment reference</Label>
              <Input
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Transaction code"
              />
            </div>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={handleCheckout}
            disabled={cart.length === 0 || checkout}
          >
            {checkout ? "Processing..." : `Charge ${formatM(total)}`}
          </Button>
        </div>
      </Card>

      {/* Receipt dialog */}
      <Dialog open={!!lastReceipt} onOpenChange={(o) => !o && setLastReceipt(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Receipt</DialogTitle>
          </DialogHeader>
          {lastReceipt && (
            <div className="space-y-3 text-sm" id="receipt-print">
              <div className="text-center">
                <p className="font-display text-lg font-bold">{shop?.shop_name}</p>
                <p className="text-xs text-muted-foreground">
                  {lastReceipt.at.toLocaleString()}
                </p>
                <p className="mt-1 text-xs">Receipt #{lastReceipt.saleNumber}</p>
              </div>
              <div className="space-y-1 border-y py-2">
                {lastReceipt.lines.map((l) => (
                  <div key={l.product.id} className="flex justify-between">
                    <span>
                      {l.product.name} × {l.qty}
                    </span>
                    <span>{formatM(l.qty * Number(l.product.selling_price))}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatM(lastReceipt.total)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Payment</span>
                  <span className="capitalize">{lastReceipt.method.replace("_", " ")}</span>
                </div>
                {lastReceipt.reference && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Reference</span>
                    <span>{lastReceipt.reference}</span>
                  </div>
                )}
                {lastReceipt.method === "cash" && (
                  <>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Received</span>
                      <span>{formatM(lastReceipt.received)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Change</span>
                      <span>{formatM(lastReceipt.change)}</span>
                    </div>
                  </>
                )}
              </div>
              <p className="text-center text-xs text-muted-foreground">Thank you!</p>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setLastReceipt(null)}>
              Close
            </Button>
            <Button onClick={printLastReceipt}>
              <Printer className="mr-2 h-4 w-4" /> Print receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
