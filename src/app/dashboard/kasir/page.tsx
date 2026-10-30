
"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import {
  ArrowLeft,
  Receipt,
  Search,
  Package,
  PackageCheck,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Wallet,
  CreditCard,
  Banknote,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  RefreshCw,
  Tag,
  CalendarDays,
  Printer,
  Sparkles,
  X,
} from "lucide-react";

type Product = {
  id: string;
  product_code: string;
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

const rupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

export default function KasirPage() {
  const [supabase] = useState(() => createClient());

  const [cart, setCart] = useState<CartItem[]>([]);
  const [code, setCode] = useState("");
  const [foundProduct, setFoundProduct] = useState<Product | null>(null);

  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [discount, setDiscount] = useState("0");

  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const subtotal = useMemo(
    () =>
      cart.reduce(
        (sum, item) =>
          sum +
          Number(item.product.current_selling_price) * item.quantity,
        0
      ),
    [cart]
  );

  const total = Math.max(
    0,
    subtotal - Math.max(0, Number(discount) || 0)
  );

  const change = Math.max(0, Number(amountPaid || 0) - total);

  useEffect(() => {
    async function checkAccess() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw authError;

        if (!user) {
          window.location.replace("/login");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role,is_active")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        if (
          !profile?.is_active ||
          !["admin", "cashier"].includes(profile.role)
        ) {
          setError("Akses kasir hanya untuk admin atau kasir aktif.");
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Gagal memeriksa akses pengguna."
        );
      } finally {
        setLoading(false);
      }
    }

    void checkAccess();
  }, [supabase]);

  async function checkProduct() {
    const productCode = code.trim();

    setError("");
    setMessage("");
    setFoundProduct(null);
    setReceipt(null);

    if (!productCode) {
      setError("Masukkan kode barang terlebih dahulu.");
      return;
    }

    setChecking(true);

    try {
      const { data, error: queryError } = await supabase
        .from("products")
        .select(
          "id,product_code,name,brand,current_selling_price,price_status,is_active"
        )
        .eq("product_code", productCode)
        .maybeSingle();

      if (queryError) throw queryError;

      if (!data) {
        setError(`Barang dengan kode ${productCode} tidak ditemukan.`);
        return;
      }

      if (!data.is_active) {
        setError("Barang ini sedang tidak aktif.");
        return;
      }

      if (data.price_status !== "approved") {
        setError("Harga barang ini belum disetujui oleh admin.");
        return;
      }

      if (
        data.current_selling_price === null ||
        Number(data.current_selling_price) <= 0
      ) {
        setError("Harga jual barang belum tersedia.");
        return;
      }

      setFoundProduct(data as Product);
      setMessage("Barang berhasil ditemukan.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal memeriksa kode barang."
      );
    } finally {
      setChecking(false);
    }
  }

  function addProduct(product: Product) {
    setReceipt(null);
    setError("");
    setMessage(`${product.name} berhasil ditambahkan ke keranjang.`);

    setCart((old) => {
      const existing = old.find(
        (item) => item.product.id === product.id
      );

      if (existing) {
        return old.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...old, { product, quantity: 1 }];
    });

    setFoundProduct(null);
    setCode("");
  }

  function changeQuantity(productId: string, quantity: number) {
    setCart((old) =>
      old
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeProduct(productId: string) {
    setCart((old) =>
      old.filter((item) => item.product.id !== productId)
    );
  }

  async function checkout() {
    if (!cart.length || busy) return;

    setError("");
    setMessage("");

    const paid = Number(amountPaid);
    const disc = Number(discount);

    if (!Number.isFinite(disc) || disc < 0 || disc > subtotal) {
      setError("Diskon tidak valid. Periksa kembali nominal diskon.");
      return;
    }

    if (!Number.isFinite(paid) || paid < 0) {
      setError("Jumlah pembayaran tidak valid.");
      return;
    }

    if (paymentMethod === "cash" && paid < total) {
      setError("Uang pembayaran masih kurang.");
      return;
    }

    if (paymentMethod !== "cash" && paid !== total) {
      setError("Pembayaran non-tunai harus sama dengan total transaksi.");
      return;
    }

    setBusy(true);

    try {
      const { data, error: checkoutError } = await supabase.rpc(
        "checkout_sale",
        {
          p_items: cart.map((item) => ({
            product_id: item.product.id,
            quantity: item.quantity,
          })),
          p_payment_method: paymentMethod,
          p_amount_paid: paid,
          p_discount: disc,
        }
      );

      if (checkoutError) throw checkoutError;

      if (!data) {
        throw new Error("Transaksi tidak menghasilkan data struk.");
      }

      setReceipt(data as Receipt);
      setCart([]);
      setAmountPaid("");
      setDiscount("0");
      setCode("");
      setFoundProduct(null);
      setMessage("Transaksi berhasil diselesaikan.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Transaksi gagal diproses."
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="cashier-loading">
        <LoaderCircle className="cashier-spin" size={28} />
        <p>Menyiapkan halaman kasir...</p>
      </main>
    );
  }

  if (error === "Akses kasir hanya untuk admin atau kasir aktif.") {
    return (
      <main className="cashier-denied">
        <div className="cashier-denied-icon">
          <AlertCircle size={28} />
        </div>
        <h1>Akses Ditolak</h1>
        <p>{error}</p>
        <a href="/dashboard">Kembali ke Dashboard</a>
      </main>
    );
  }

  return (
    <main className="cashier-page">
      <div className="cashier-container">
        <nav className="cashier-navigation">
          <a href="/dashboard" className="cashier-nav-link">
            <ArrowLeft size={16} />
            Dashboard
          </a>

          <a
            href="/dashboard/riwayat-penjualan"
            className="cashier-nav-link cashier-history-link"
          >
            <Receipt size={16} />
            Riwayat Penjualan
          </a>
        </nav>

        <header className="cashier-header">
          <div className="cashier-heading">
            <div className="cashier-heading-icon">
              <ShoppingCart size={27} />
            </div>

            <div>
              <div className="cashier-eyebrow">
                <Sparkles size={12} />
                TOKO ROSYIDAH · PASAR SEBAUNG
              </div>
              <h1>Kasir</h1>
              <p>Catat transaksi penjualan dengan cepat dan praktis.</p>
            </div>
          </div>

          <div className="cashier-status">
            <span className="cashier-status-dot" />
            Kasir Aktif
          </div>
        </header>

        {(error || message) && (
          <div
            className={`cashier-alert ${
              error ? "cashier-alert-error" : "cashier-alert-success"
            }`}
            role={error ? "alert" : "status"}
          >
            {error ? (
              <AlertCircle size={19} />
            ) : (
              <CheckCircle2 size={19} />
            )}
            <p>{error || message}</p>
            <button
              type="button"
              onClick={() => {
                setError("");
                setMessage("");
              }}
              aria-label="Tutup notifikasi"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className="cashier-layout">
          <section className="cashier-main-column">
            <div className="cashier-card cashier-product-card">
              <div className="cashier-section-heading">
                <div className="cashier-section-icon">
                  <Package size={20} />
                </div>
                <div>
                  <h2>Tambah Barang</h2>
                  <p>Masukkan kode barang untuk memeriksa produk.</p>
                </div>
              </div>

              <form
                className="cashier-code-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void checkProduct();
                }}
              >
                <label htmlFor="product-code">Kode Barang</label>

                <div className="cashier-code-row">
                  <div className="cashier-code-input-wrap">
                    <Tag size={19} />
                    <input
                      id="product-code"
                      type="text"
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value);
                        setFoundProduct(null);
                        setError("");
                        setMessage("");
                      }}
                      placeholder="Masukkan kode barang"
                      autoComplete="off"
                      autoFocus
                    />
                  </div>

                  <button
                    type="submit"
                    className="cashier-check-button"
                    disabled={checking || !code.trim()}
                  >
                    {checking ? (
                      <LoaderCircle size={18} className="cashier-spin" />
                    ) : (
                      <Search size={18} />
                    )}
                    {checking ? "Memeriksa..." : "Cek Barang"}
                  </button>
                </div>

                <span className="cashier-field-hint">
                  Masukkan kode sesuai master produk yang terdaftar.
                </span>
              </form>

              {foundProduct && (
                <div className="cashier-found-product">
                  <div className="cashier-found-top">
                    <div className="cashier-found-icon">
                      <PackageCheck size={25} />
                    </div>
                    <span className="cashier-found-badge">
                      <CheckCircle2 size={14} />
                      Barang ditemukan
                    </span>
                  </div>

                  <div className="cashier-found-details">
                    <span className="cashier-product-code">
                      KODE {foundProduct.product_code}
                    </span>
                    <h3>{foundProduct.name}</h3>
                    <p>{foundProduct.brand || "Tanpa merek"}</p>
                  </div>

                  <div className="cashier-found-bottom">
                    <div>
                      <span>Harga jual</span>
                      <strong>
                        {rupiah(foundProduct.current_selling_price)}
                      </strong>
                    </div>

                    <button
                      type="button"
                      onClick={() => addProduct(foundProduct)}
                      className="cashier-add-button"
                    >
                      <Plus size={18} />
                      Tambah ke Keranjang
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="cashier-card cashier-cart-card">
              <div className="cashier-section-heading cashier-cart-heading">
                <div className="cashier-section-icon">
                  <ShoppingCart size={20} />
                </div>
                <div>
                  <h2>Keranjang Belanja</h2>
                  <p>Daftar barang yang akan ditransaksikan.</p>
                </div>
                <span className="cashier-cart-count">
                  {cart.length} jenis
                </span>
              </div>

              {cart.length === 0 ? (
                <div className="cashier-empty">
                  <div className="cashier-empty-icon">
                    <ShoppingCart size={29} />
                  </div>
                  <h3>Keranjang masih kosong</h3>
                  <p>
                    Periksa kode barang terlebih dahulu untuk mulai
                    menambahkan produk.
                  </p>
                </div>
              ) : (
                <div className="cashier-cart-list">
                  {cart.map((item) => (
                    <article
                      key={item.product.id}
                      className="cashier-cart-item"
                    >
                      <div className="cashier-cart-product-icon">
                        <Package size={20} />
                      </div>

                      <div className="cashier-cart-product">
                        <strong>{item.product.name}</strong>
                        <span>{item.product.brand}</span>
                        <small>
                          {rupiah(item.product.current_selling_price)} / unit
                        </small>
                      </div>

                      <div className="cashier-quantity-control">
                        <button
                          type="button"
                          onClick={() =>
                            changeQuantity(
                              item.product.id,
                              item.quantity - 1
                            )
                          }
                          aria-label="Kurangi jumlah"
                        >
                          <Minus size={14} />
                        </button>

                        <span>{item.quantity}</span>

                        <button
                          type="button"
                          onClick={() =>
                            changeQuantity(
                              item.product.id,
                              item.quantity + 1
                            )
                          }
                          aria-label="Tambah jumlah"
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      <strong className="cashier-line-total">
                        {rupiah(
                          item.product.current_selling_price *
                            item.quantity
                        )}
                      </strong>

                      <button
                        type="button"
                        className="cashier-remove-button"
                        onClick={() => removeProduct(item.product.id)}
                        aria-label="Hapus barang"
                      >
                        <Trash2 size={16} />
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>

          <aside className="cashier-card cashier-payment-card">
            <div className="cashier-section-heading">
              <div className="cashier-section-icon">
                <Wallet size={20} />
              </div>
              <div>
                <h2>Pembayaran</h2>
                <p>Ringkasan transaksi.</p>
              </div>
            </div>

            <div className="cashier-total-box">
              <span>Total Tagihan</span>
              <strong>{rupiah(total)}</strong>
              <small>{cart.length} jenis barang</small>
            </div>

            <div className="cashier-summary-line">
              <span>Subtotal</span>
              <strong>{rupiah(subtotal)}</strong>
            </div>

            <div className="cashier-discount-field">
              <label htmlFor="discount">Diskon (Rp)</label>
              <div className="cashier-simple-input">
                <span>Rp</span>
                <input
                  id="discount"
                  type="number"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="cashier-payment-divider" />

            <div className="cashier-payment-method">
              <label htmlFor="payment-method">Metode Pembayaran</label>
              <div className="cashier-select-wrap">
                <CreditCard size={17} />
                <select
                  id="payment-method"
                  value={paymentMethod}
                  onChange={(e) => {
                    const method = e.target.value;
                    setPaymentMethod(method);
                    if (method !== "cash") {
                      setAmountPaid(String(total));
                    }
                  }}
                >
                  <option value="cash">Tunai</option>
                  <option value="qris">QRIS</option>
                  <option value="transfer">Transfer</option>
                  <option value="other">Lainnya</option>
                </select>
              </div>
            </div>

            <div className="cashier-paid-field">
              <label htmlFor="amount-paid">ayar (Rp)</label>
              <div className="cashier-simple-input">
                <span>Rp</span>
                <input
                  id="amount-paid"
                  type="number"
                  min="0"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder="Masukkan pembayaran"
                />
              </div>
            </div>

            {paymentMethod === "cash" && (
              <div className="cashier-change-box">
                <div>
                  <Banknote size={18} />
                  <span>Kembalian</span>
                </div>
                <strong>{rupiah(change)}</strong>
              </div>
            )}

            <button
              type="button"
              className="cashier-checkout-button"
              onClick={() => void checkout()}
              disabled={busy || cart.length === 0}
            >
              {busy ? (
                <>
                  <LoaderCircle size={19} className="cashier-spin" />
                  Memproses Transaksi...
                </>
              ) : (
                <>
                  <CheckCircle2 size={19} />
                  Proses Pembayaran
                </>
              )}
            </button>

            <p className="cashier-payment-note">
              Pastikan jumlah barang dan pembayaran sudah benar sebelum
              menyelesaikan transaksi.
            </p>
          </aside>
        </div>

        {receipt && (
          <section id="receipt" className="cashier-receipt">
            <div className="cashier-receipt-header">
              <div className="cashier-receipt-logo">
                <ShoppingCart size={22} />
              </div>
              <h2>TOKO ROSYIDAH</h2>
              <p>Pasar Sebaung</p>
              <span>BUKTI PEMBAYARAN</span>
              <strong>{receipt.receipt_number}</strong>
            </div>

            <div className="cashier-receipt-divider" />

            {receipt.items.map((item, index) => (
              <div key={index} className="cashier-receipt-item">
                <strong>{item.name}</strong>
                <span>{item.brand}</span>
                <div>
                  <span>
                    {item.quantity} × {rupiah(item.selling_price)}
                  </span>
                  <strong>{rupiah(item.line_total)}</strong>
                </div>
              </div>
            ))}

            <div className="cashier-receipt-divider" />

            <div className="cashier-receipt-row">
              <span>Subtotal</span>
              <strong>{rupiah(receipt.subtotal)}</strong>
            </div>
            <div className="cashier-receipt-row">
              <span>Diskon</span>
              <strong>{rupiah(receipt.discount)}</strong>
            </div>
            <div className="cashier-receipt-row cashier-receipt-total">
              <span>Total</span>
              <strong>{rupiah(receipt.total)}</strong>
            </div>
            <div className="cashier-receipt-row">
              <span>Dibayar</span>
              <strong>{rupiah(receipt.amount_paid)}</strong>
            </div>
            <div className="cashier-receipt-row">
              <span>Kembalian</span>
              <strong>{rupiah(receipt.change_amount)}</strong>
            </div>

            <p className="cashier-receipt-thanks">
              Terima kasih telah berbelanja.
            </p>

            <button
              type="button"
              className="cashier-print-button"
              onClick={() => window.print()}
            >
              <Printer size={17} />
              Cetak Struk
            </button>
          </section>
        )}

        <footer className="cashier-footer">
          <strong>TOKO ROSYIDAH</strong>
          <span>·</span>
          Sistem Kasir & Penjualan
        </footer>
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }

          #receipt,
          #receipt * {
            visibility: visible !important;
          }

          #receipt {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 72mm !important;
            max-width: 72mm !important;
            margin: 0 !important;
            padding: 4mm !important;
            border: 0 !important;
            box-shadow: none !important;
            color: #111 !important;
            background: #fff !important;
          }

          #receipt button {
            display: none !important;
          }
        }
      `}</style>
    </main>
  );
}
