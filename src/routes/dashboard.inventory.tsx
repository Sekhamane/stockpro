import { createFileRoute } from "@tanstack/react-router";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatM } from "@/lib/currency";
import { useAdminPasswordGate } from "@/hooks/use-admin-password-gate";
import { Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/inventory")({
  component: InventoryPage,
});

interface Product {
  id: string;
  name: string;
  barcode: string | null;
  cost_price: number;
  selling_price: number;
  stock_quantity: number;
  low_stock_threshold: number;
  expiry_date: string | null;
}

const empty: Omit<Product, "id"> = {
  name: "",
  barcode: "",
  cost_price: 0,
  selling_price: 0,
  stock_quantity: 0,
  low_stock_threshold: 5,
  expiry_date: null,
};

function InventoryPage() {
  const { shop, user } = useAuth();
  const isAdmin = shop?.role === "admin";
  const { verified, gate } = useAdminPasswordGate(Boolean(isAdmin), "Inventory");
  const [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!shop) return;
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("shop_id", shop.shop_id)
      .order("name");
    setProducts((data ?? []) as Product[]);
  };

  useEffect(() => {
    load();
  }, [shop]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isAdmin) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">
          Only owners can manage inventory.
        </p>
      </Card>
    );
  }

  if (!verified) {
    return gate;
  }

  const openCreate = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };
  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      barcode: p.barcode ?? "",
      cost_price: Number(p.cost_price),
      selling_price: Number(p.selling_price),
      stock_quantity: p.stock_quantity,
      low_stock_threshold: p.low_stock_threshold,
      expiry_date: p.expiry_date,
    });
    setOpen(true);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!shop) return;
    setSaving(true);
    const payload = {
      ...form,
      barcode: form.barcode || null,
      expiry_date: form.expiry_date || null,
      shop_id: shop.shop_id,
      created_by: user?.id,
    };
    const res = editing
      ? await supabase.from("products").update(payload).eq("id", editing.id)
      : await supabase.from("products").insert(payload);
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(editing ? "Product updated" : "Product added");
    setOpen(false);
    load();
  };

  const onDelete = async (p: Product) => {
    if (!confirm(`Delete "${p.name}"?`)) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const fiveDays = Date.now() + 5 * 86400000;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            {products.length} products in stock
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Add product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit product" : "Add product"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Barcode (optional)</Label>
                <Input
                  value={form.barcode ?? ""}
                  onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Cost price (M)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    required
                    value={form.cost_price}
                    onChange={(e) =>
                      setForm({ ...form, cost_price: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Selling price (M)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    required
                    value={form.selling_price}
                    onChange={(e) =>
                      setForm({ ...form, selling_price: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Stock quantity</Label>
                  <Input
                    type="number"
                    required
                    value={form.stock_quantity}
                    onChange={(e) =>
                      setForm({ ...form, stock_quantity: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Low stock alert at</Label>
                  <Input
                    type="number"
                    value={form.low_stock_threshold}
                    onChange={(e) =>
                      setForm({ ...form, low_stock_threshold: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Expiry date (optional)</Label>
                <Input
                  type="date"
                  value={form.expiry_date ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, expiry_date: e.target.value || null })
                  }
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : editing ? "Update" : "Add product"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No products yet. Add your first to start selling.
                </TableCell>
              </TableRow>
            )}
            {products.map((p) => {
              const lowStock = p.stock_quantity <= p.low_stock_threshold;
              const expiringSoon =
                p.expiry_date && new Date(p.expiry_date).getTime() <= fiveDays;
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <p className="font-medium">{p.name}</p>
                    {p.barcode && (
                      <p className="text-xs text-muted-foreground">{p.barcode}</p>
                    )}
                  </TableCell>
                  <TableCell>{formatM(p.cost_price)}</TableCell>
                  <TableCell className="font-medium">{formatM(p.selling_price)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{p.stock_quantity}</span>
                      {lowStock && (
                        <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-medium text-warning-foreground">
                          Low
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {p.expiry_date ? (
                      <div className="flex items-center gap-1">
                        <span className="text-sm">{p.expiry_date}</span>
                        {expiringSoon && (
                          <AlertTriangle className="h-3 w-3 text-destructive" />
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(p)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => onDelete(p)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
