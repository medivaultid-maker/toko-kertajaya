
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

type Product = {
  id: string;
  name: string;
  brand: string;
  current_selling_price: number;
  price_status: string;
  is_active: boolean;
};

type CartItem = {
  product: Product;
  quantity: number;
};

type Receipt = {
  receipt_number: string;
  subtotal: number;
  discount: number;
  total: number;
  amount_paid: number;
  change_amount: number;
  items: {
    name: string;
    brand: string;
    quantity: number;
    selling_price: number;
    line_total: number;
  }[];
};

export default function KasirPage() {
  const [supabase] = useState(() => createClient());
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [query, setQuery] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [discount, setDiscount] = useState("0");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const rupiah = (n: number) =>
    `Rp${Number(n).toLocaleString("id-ID")}`;

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        window.location.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role,is_active")
        .eq("id", user.id)
        .maybeSingle();

      if (
        !profile?.is_active ||
        !["admin", "cashier"].includes(profile.role)
      ) {
        setError("Akses kasir hanya untuk admin atau kasir aktif.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("products")
        .select("id,name,brand,current_selling_price,price_status,is_active")
        .eq("is_active", true)
        .eq("price_status", "approved")
        .order("name");

      if (error) setError(error.message);
      else setProducts(data || []);

      setLoading(false);
    }

    void load();
  }, [supabase]);

  const filtered = products.filter((p) =>
    `${p.name} ${p.brand}`.toLowerCase().includes(query.toLowerCase())
  );

  const subtotal = cart.reduce(
    (sum, item) =>
      sum + item.product.current_selling_price * item.quantity,
    0
  );

  const total = Math.max(0, subtotal - Math.max(0, Number(discount) || 0));

  function addProduct(product: Product) {
    setReceipt(null);
    setCart((old) => {
      const existing = old.find((i) => i.product.id === product.id);

      if (existing) {
        return old.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }

      return [...old, { product, quantity: 1 }];
    });
  }

  function changeQuantity(productId: string, quantity: number) {
    setCart((old) =>
      old
        .map((i) =>
          i.product.id === productId ? { ...i, quantity } : i
        )
        .filter((i) => i.quantity > 0)
    );
  }

  async function checkout() {
    if (!cart.length || busy) return;

    setError("");

    const paid = Number(amountPaid);
    const disc = Number(discount);

    if (!Number.isFinite(disc) || disc < 0 || disc > subtotal) {
      setError("Diskon tidak valid.");
      return;
    }

    if (!Number.isFinite(paid) || paid < 0) {
      setError("Jumlah pembayaran tidak valid.");
      return;
    }

    if (paymentMethod === "cash" && paid < total) {
      setError("Uang pembayaran kurang.");
      return;
    }

    if (paymentMethod !== "cash" && paid !== total) {
      setError("Pembayaran non-tunai harus sama dengan total.");
      return;
    }

    setBusy(true);

    const { data, error } = await supabase.rpc("checkout_sale", {
      p_items: cart.map((i) => ({
        product_id: i.product.id,
        quantity: i.quantity,
      })),
      p_payment_method: paymentMethod,
      p_amount_paid: paid,
      p_discount: disc,
    });

    if (error) {
      setError(error.message);
    } else {
      setReceipt(data as Receipt);
      setCart([]);
      setAmountPaid("");
      setDiscount("0");
      setQuery("");
    }

    setBusy(false);
  }

  if (loading) {
    return <main style={{ padding: 24 }}>Memuat kasir...</main>;
  }

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <a href="/dashboard">← Kembali ke dashboard</a>
      <h1>Kasir — TOKO ROSYIDAH</h1>
      <p>Alamat: Pasar Sebaung</p>

      {error && <p role="alert" style={{ color: "#b42318" }}>{error}</p>}

      {receipt && (
        <section
          id="receipt"
          style={{
            border: "1px dashed #777",
            padding: 20,
            maxWidth: 380,
            marginBottom: 24,
            background: "white",
            color: "#111",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <h2>TOKO ROSYIDAH</h2>
            <p>Alamat: Pasar Sebaung</p>
            <p>{receipt.receipt_number}</p>
          </div>

          <hr />

          {receipt.items.map((item, index) => (
            <div key={index} style={{ margin: "12px 0" }}>
              <div>{item.name} — {item.brand}</div>
              <div>
                {item.quantity} × {rupiah(item.selling_price)}
              </div>
              <div style={{ textAlign: "right" }}>
                {rupiah(item.line_total)}
              </div>
            </div>
          ))}

          <hr />
          <p>Subtotal: {rupiah(receipt.subtotal)}</p>
          <p>Diskon: {rupiah(receipt.discount)}</p>
          <h3>Total: {rupiah(receipt.total)}</h3>
          <p>Dibayar: {rupiah(receipt.amount_paid)}</p>
          <p>Kembalian: {rupiah(receipt.change_amount)}</p>
          <p style={{ textAlign: "center" }}>Terima kasih telah berbelanja!</p>

          <button type="button" onClick={() => window.print()}>
            Cetak Struk / Simpan PDF
          </button>
        </section>
      )}

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: 24,
      }}>
        <section>
          <h2>Pilih Barang</h2>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama barang atau merek..."
            style={{ width: "100%", padding: 12, boxSizing: "border-box" }}
          />

          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            {filtered.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => addProduct(product)}
                style={{
                  textAlign: "left",
                  padding: 14,
                  background: "white",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                <strong>{product.name}</strong>
                <div>{product.brand}</div>
                <div>{rupiah(product.current_selling_price)}</div>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2>Keranjang ({cart.length})</h2>

          {cart.map((item) => (
            <article
              key={item.product.id}
              style={{ borderBottom: "1px solid #ddd", padding: "12px 0" }}
            >
              <strong>{item.product.name}</strong>
              <p>{rupiah(item.product.current_selling_price)} / unit</p>
              <label>
                Jumlah:{" "}
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={item.quantity}
                  onChange={(e) =>
                    changeQuantity(
                      item.product.id,
                      Number(e.target.value)
                    )
                  }
                  style={{ width: 80, padding: 6 }}
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  changeQuantity(item.product.id, 0)
                }
                style={{ marginLeft: 10 }}
              >
                Hapus
              </button>
            </article>
          ))}

          <p>Subtotal: <strong>{rupiah(subtotal)}</strong></p>

          <label>
            Diskon (Rp)
            <input
              type="number"
              min="0"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              style={{ display: "block", width: "100%", padding: 10, boxSizing: "border-box" }}
            />
          </label>

          <h2>Total: {rupiah(total)}</h2>

          <label>
            Metode pembayaran
            <select
              value={paymentMethod}
              onChange={(e) => {
                setPaymentMethod(e.target.value);
                if (e.target.value !== "cash") setAmountPaid(String(total));
              }}
              style={{ display: "block", width: "100%", padding: 10 }}
            >
              <option value="cash">Tunai</option>
              <option value="qris">QRIS</option>
              <option value="transfer">Transfer</option>
              <option value="other">Lainnya</option>
            </select>
          </label>

          <label>
            Jumlah dibayar (Rp)
            <input
              type="number"
              min="0"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              style={{ display: "block", width: "100%", padding: 10, boxSizing: "border-box" }}
            />
          </label>

          {paymentMethod === "cash" && (
            <p>
              Kembalian:{" "}
              {rupiah(Math.max(0, Number(amountPaid || 0) - total))}
            </p>
          )}

          <button
            type="button"
            disabled={busy || cart.length === 0}
            onClick={checkout}
            style={{
              marginTop: 16,
              width: "100%",
              padding: 14,
              background: "#176b45",
              color: "white",
              border: 0,
              borderRadius: 8,
              fontWeight: 700,
              cursor: busy ? "wait" : "pointer",
            }}
          >
            {busy ? "Memproses..." : "Proses Pembayaran"}
          </button>
        </section>
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #receipt, #receipt * { visibility: visible; }
          #receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 72mm;
            max-width: 72mm;
            margin: 0;
            padding: 4mm;
            border: 0 !important;
          }
          #receipt button { display: none; }
        }
      `}</style>
    </main>
  );
}
