
"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import {
  Receipt,
  Search,
  Package,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Wallet,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  Tag,
  Printer,
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

type ReceiptData = {
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
  "Rp " +
  new Intl.NumberFormat("id-ID", {
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
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

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

  // Diskon dalam persen.
  const discountPercent = Math.min(
    100,
    Math.max(0, Number(discount) || 0)
  );

  // Nominal diskon untuk perhitungan transaksi.
  const discountAmount = Math.round(
    subtotal * (discountPercent / 100)
  );

  const total = Math.max(0, subtotal - discountAmount);

  const change = Math.max(
    0,
    Number(amountPaid || 0) - total
  );

  // Pembayaran non-tunai otomatis mengikuti total terbaru.
  useEffect(() => {
    if (paymentMethod !== "cash") {
      setAmountPaid(String(total));
    }
  }, [paymentMethod, total]);

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

        const { data: profile, error: profileError } =
          await supabase
            .from("profiles")
            .select("role,is_active")
            .eq("id", user.id)
            .maybeSingle();

        if (profileError) throw profileError;

        const allowed =
          profile?.is_active === true &&
          ["owner", "admin", "cashier"].includes(
            String(profile.role || "").toLowerCase()
          );

        if (!allowed) {
          setError(
            "Akses kasir hanya untuk Owner atau kasir aktif."
          );
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
        setError(
          `Barang dengan kode ${productCode} tidak ditemukan.`
        );
        return;
      }

      if (!data.is_active) {
        setError("Barang ini sedang tidak aktif.");
        return;
      }

      if (data.price_status !== "approved") {
        setError(
          "Harga barang ini belum disetujui oleh admin."
        );
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
    setMessage(
      `${product.name} berhasil ditambahkan ke keranjang.`
    );

    setCart((old) => {
      const existing = old.find(
        (item) => item.product.id === product.id
      );

      if (existing) {
        return old.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item
        );
      }

      return [...old, { product, quantity: 1 }];
    });

    setFoundProduct(null);
    setCode("");
  }

  function changeQuantity(
    productId: string,
    quantity: number
  ) {
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
      old.filter(
        (item) => item.product.id !== productId
      )
    );
  }

  async function checkout() {
    if (!cart.length || busy) return;

    setError("");
    setMessage("");

    const paid = Number(amountPaid);
    const disc = Number(discount);

    if (
      !Number.isFinite(disc) ||
      disc < 0 ||
      disc > 100
    ) {
      setError(
        "Diskon harus berada di antara 0 sampai 100%."
      );
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

    if (
      paymentMethod !== "cash" &&
      paid !== total
    ) {
      setError(
        "Pembayaran non-tunai harus sama dengan total transaksi."
      );
      return;
    }

    setBusy(true);

    try {
      const { data, error: checkoutError } =
        await supabase.rpc("checkout_sale", {
          p_items: cart.map((item) => ({
            product_id: item.product.id,
            quantity: item.quantity,
          })),
          p_payment_method: paymentMethod,
          p_amount_paid: paid,

          // Fungsi SQL menerima nominal Rupiah,
          // bukan persentase.
          p_discount: discountAmount,
        });

      if (checkoutError) throw checkoutError;

      if (!data) {
        throw new Error(
          "Transaksi tidak menghasilkan data struk."
        );
      }

      setReceipt(data as ReceiptData);
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
        <LoaderCircle className="spin" size={28} />
        <p>Menyiapkan halaman kasir...</p>

       <style jsx>{`
  .cashier-page {
    --emerald: #174b36;
    --emerald-dark: #103a2a;
    --emerald-soft: #edf4ef;
    --gold: #b99a62;
    --ink: #26352c;
    --muted: #849087;
    --line: #e8ece6;
    --ivory: #f8f8f4;

    display: flex;
    flex-direction: column;
    gap: 22px;
    width: 100%;
    padding: 4px 0 36px;
    color: var(--ink);
    font-family: var(--font-dm-sans), sans-serif;
  }

  /* HEADER */
  .hero {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    min-height: 155px;
    overflow: hidden;
    padding: 30px 32px;
    border: 1px solid #e5e9e1;
    border-radius: 20px;
    background:
      radial-gradient(
        circle at 92% 10%,
        rgba(185,154,98,.13),
        transparent 28%
      ),
      linear-gradient(115deg, #fff 0%, #f5f8f3 100%);
    box-shadow: 0 7px 24px rgba(24,55,37,.035);
  }

  .hero::before {
    content: "";
    position: absolute;
    right: 45px;
    top: -105px;
    width: 210px;
    height: 210px;
    border: 1px solid rgba(185,154,98,.15);
    border-radius: 50%;
    pointer-events: none;
  }

  .hero::after {
    content: "";
    position: absolute;
    right: 105px;
    bottom: -125px;
    width: 180px;
    height: 180px;
    border: 1px solid rgba(185,154,98,.22);
    border-radius: 50%;
    pointer-events: none;
  }

  .eyebrow {
    position: relative;
    z-index: 1;
    margin-bottom: 10px;
    color: var(--gold);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 2.4px;
  }

  .title {
    position: relative;
    z-index: 1;
    margin: 0;
    color: var(--emerald-dark);
    font-family: var(--font-manrope), sans-serif;
    font-size: clamp(28px, 3vw, 36px);
    font-weight: 800;
    letter-spacing: -1.4px;
  }

  .subtitle {
    position: relative;
    z-index: 1;
    margin: 9px 0 0;
    color: #7b877e;
    font-size: 13px;
    line-height: 1.7;
  }

  .hero-actions {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    flex-wrap: wrap;
  }

  .hero-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 41px;
    padding: 0 15px;
    border: 1px solid #dce7dd;
    border-radius: 10px;
    background: #fff;
    color: var(--emerald);
    font-size: 11px;
    font-weight: 800;
    text-decoration: none;
    transition: .18s ease;
  }

  .hero-link:hover {
    background: var(--emerald-soft);
    border-color: #bfd2c2;
  }

  .status-chip {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    padding: 11px 15px;
    border: 1px solid #dce8de;
    border-radius: 10px;
    background: rgba(255,255,255,.92);
    color: var(--emerald);
    font-size: 11px;
    font-weight: 800;
  }

  .status-dot {
    width: 7px;
    height: 7px;
    flex-shrink: 0;
    border-radius: 50%;
    background: #4d9b61;
    box-shadow: 0 0 0 4px #e8f3e9;
  }

  /* MAIN LAYOUT */
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1.55fr) minmax(320px, .85fr);
    align-items: start;
    gap: 20px;
    width: 100%;
  }

  .main-column {
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-width: 0;
  }

  .panel {
    min-width: 0;
    padding: 27px;
    border: 1px solid var(--line);
    border-radius: 18px;
    background: #fff;
    box-shadow: 0 5px 20px rgba(24,55,37,.035);
  }

  /* PANEL HEADING */
  .panel-heading {
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
    gap: 14px;
    width: 100%;
    margin-bottom: 23px;
    text-align: left;
  }

  .panel-icon {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    border: 1px solid #dce8de;
    border-radius: 12px;
    background: var(--emerald-soft);
    color: var(--emerald);
  }

  .panel-heading > div:last-of-type {
    flex: 1;
    min-width: 0;
    text-align: left;
  }

  .panel-heading h2 {
    margin: 1px 0 6px;
    color: var(--emerald-dark);
    font-family: var(--font-manrope), sans-serif;
    font-size: 17px;
    font-weight: 800;
    line-height: 1.4;
    text-align: left;
  }

  .panel-heading p {
    margin: 0;
    color: #89938a;
    font-size: 11px;
    line-height: 1.7;
    text-align: left;
  }

  /* INPUT KODE BARANG */
  .code-form label,
  .field-label {
    display: block;
    margin-bottom: 9px;
    color: #526157;
    font-size: 11px;
    font-weight: 800;
  }

  .code-row {
    display: flex;
    align-items: stretch;
    gap: 11px;
  }

  .input-wrap {
    position: relative;
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;
  }

  .input-icon {
    position: absolute;
    left: 14px;
    color: #8a988d;
    pointer-events: none;
  }

  .field {
    display: block;
    width: 100%;
    min-width: 0;
    min-height: 46px;
    box-sizing: border-box;
    padding: 0 14px;
    border: 1px solid #e2e8e1;
    border-radius: 10px;
    background: #fff;
    color: #304136;
    font-family: inherit;
    font-size: 12px;
    outline: none;
    transition: border-color .18s ease, box-shadow .18s ease;
  }

  .field::placeholder {
    color: #b1b9b1;
  }

  .field:focus {
    border-color: #789b83;
    box-shadow: 0 0 0 3px rgba(45,105,68,.09);
  }

  .code-input {
    padding-left: 43px;
  }

  .hint {
    display: block;
    margin-top: 10px;
    color: #9aa39b;
    font-size: 10px;
    line-height: 1.6;
  }

  /* BUTTONS */
  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 45px;
    padding: 0 17px;
    border: 0;
    border-radius: 10px;
    font-family: inherit;
    font-size: 11px;
    font-weight: 800;
    cursor: pointer;
    transition: all .18s ease;
    white-space: nowrap;
  }

  .primary {
    background: linear-gradient(135deg, #205a3e, #123d2b);
    color: #fff;
    box-shadow: 0 4px 11px rgba(23,75,54,.14);
  }

  .primary:hover:not(:disabled) {
    background: #0e3525;
    transform: translateY(-1px);
  }

  .secondary {
    border: 1px solid #dce7dd;
    background: #f0f5f0;
    color: var(--emerald);
  }

  button:disabled {
    opacity: .5;
    cursor: not-allowed;
  }

  /* FOUND PRODUCT */
  .found {
    margin-top: 21px;
    padding: 21px;
    border: 1px solid #dcebdd;
    border-radius: 14px;
    background: #f7faf6;
  }

  .found-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }

  .found-badge {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 11px;
    border: 1px solid #dcebdd;
    border-radius: 8px;
    background: #edf6ed;
    color: #3e754b;
    font-size: 10px;
    font-weight: 800;
  }

  .product-code {
    color: #8c9a8e;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 1px;
  }

  .found h3 {
    margin: 7px 0 5px;
    color: var(--emerald-dark);
    font-family: var(--font-manrope), sans-serif;
    font-size: 18px;
    font-weight: 800;
  }

  .found p {
    margin: 0;
    color: #89938a;
    font-size: 11px;
  }

  .found-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    margin-top: 19px;
    padding-top: 16px;
    border-top: 1px solid #e5ece3;
  }

  .found-bottom span {
    display: block;
    margin-bottom: 6px;
    color: #89938a;
    font-size: 10px;
  }

  .found-bottom strong {
    color: var(--emerald);
    font-size: 18px;
    font-weight: 800;
    white-space: nowrap;
  }

  /* CART */
  .cart-count {
    flex-shrink: 0;
    margin-left: auto;
    padding: 8px 12px;
    border: 1px solid #e8dfca;
    border-radius: 8px;
    background: #fbf8f0;
    color: #927545;
    font-size: 10px;
    font-weight: 800;
    white-space: nowrap;
  }

  .empty {
    padding: 40px 20px;
    border: 1px dashed #dce5dc;
    border-radius: 13px;
    background: #fafbf9;
    text-align: center;
  }

  .empty-icon {
    display: grid;
    place-items: center;
    width: 54px;
    height: 54px;
    margin: 0 auto 14px;
    border-radius: 15px;
    background: #edf4ef;
    color: #64836c;
  }

  .empty h3 {
    margin: 0 0 8px;
    color: #42594a;
    font-family: var(--font-manrope), sans-serif;
    font-size: 14px;
    font-weight: 800;
  }

  .empty p {
    max-width: 340px;
    margin: 0 auto;
    color: #8a958b;
    font-size: 11px;
    line-height: 1.8;
  }

  .cart-list {
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  .cart-item {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr) auto auto 34px;
    align-items: center;
    gap: 13px;
    padding: 17px 0;
    border-bottom: 1px solid #edf0eb;
  }

  .cart-item:first-child {
    padding-top: 2px;
  }

  .cart-item:last-child {
    padding-bottom: 0;
    border-bottom: 0;
  }

  .cart-product-icon {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border: 1px solid #e1e9df;
    border-radius: 11px;
    background: #f3f7f2;
    color: var(--emerald);
  }

  .cart-product {
    min-width: 0;
  }

  .cart-product strong {
    display: block;
    overflow: hidden;
    color: #304136;
    font-size: 12px;
    font-weight: 800;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cart-product span,
  .cart-product small {
    display: block;
    margin-top: 5px;
    color: #89938a;
    font-size: 10px;
  }

  .quantity {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 4px;
    border: 1px solid #e6ece4;
    border-radius: 9px;
    background: #fafbf9;
  }

  .quantity button {
    display: grid;
    place-items: center;
    width: 27px;
    height: 27px;
    border: 1px solid #e1e8df;
    border-radius: 7px;
    background: #fff;
    color: var(--emerald);
    cursor: pointer;
    transition: .15s ease;
  }

  .quantity button:hover {
    background: var(--emerald-soft);
  }

  .quantity span {
    min-width: 17px;
    color: #304136;
    font-size: 11px;
    font-weight: 800;
    text-align: center;
  }

  .line-total {
    color: var(--emerald);
    font-size: 11px;
    font-weight: 800;
    white-space: nowrap;
  }

  .remove {
    display: grid;
    place-items: center;
    width: 33px;
    height: 33px;
    border: 1px solid #f0deda;
    border-radius: 9px;
    background: #fff5f3;
    color: #ae5148;
    cursor: pointer;
    transition: .15s ease;
  }

  .remove:hover {
    background: #fce9e5;
  }

  /* PAYMENT */
  .payment-panel {
    position: sticky;
    top: 20px;
  }

  .total-box {
    padding: 23px;
    border: 1px solid #dce8de;
    border-radius: 15px;
    background:
      radial-gradient(
        circle at 100% 0%,
        rgba(185,154,98,.15),
        transparent 45%
      ),
      linear-gradient(135deg, #f4f8f3, #edf4ed);
  }

  .total-box span {
    display: block;
    color: #748477;
    font-size: 11px;
    font-weight: 700;
  }

  .total-box strong {
    display: block;
    margin-top: 9px;
    color: var(--emerald-dark);
    font-family: var(--font-manrope), sans-serif;
    font-size: clamp(22px, 2.5vw, 30px);
    font-weight: 800;
    letter-spacing: -.8px;
    white-space: nowrap;
  }

  .total-box small {
    display: block;
    margin-top: 8px;
    color: #9aa39b;
    font-size: 10px;
  }

  .summary-line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 19px;
    color: #849087;
    font-size: 11px;
  }

  .summary-line strong {
    color: #405346;
    font-weight: 800;
    white-space: nowrap;
  }

  .payment-divider {
    height: 1px;
    margin: 22px 0;
    background: #edf0eb;
  }

  .payment-field {
    margin-top: 19px;
  }

  .payment-field label {
    display: block;
    margin-bottom: 9px;
    color: #526157;
    font-size: 11px;
    font-weight: 800;
  }

  .simple-input {
    display: flex;
    align-items: center;
    overflow: hidden;
    min-height: 46px;
    border: 1px solid #e2e8e1;
    border-radius: 10px;
    background: #fff;
    transition: border-color .18s ease, box-shadow .18s ease;
  }

  .simple-input:focus-within {
    border-color: #789b83;
    box-shadow: 0 0 0 3px rgba(45,105,68,.09);
  }

  .simple-input > span {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    padding-left: 13px;
    color: #8a988d;
    font-size: 11px;
    font-weight: 700;
    white-space: nowrap;
  }

  .simple-input input,
  .simple-input select {
    width: 100%;
    min-width: 0;
    height: 44px;
    padding: 0 13px;
    border: 0;
    outline: none;
    background: transparent;
    color: #304136;
    font-family: inherit;
    font-size: 12px;
  }

  .simple-input input::placeholder {
    color: #b1b9b1;
  }

  .change-box {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 18px;
    padding: 15px;
    border: 1px solid #e8e8dc;
    border-radius: 11px;
    background: #faf9f4;
  }

  .change-box span {
    color: #7e887e;
    font-size: 11px;
    font-weight: 700;
  }

  .change-box strong {
    color: var(--emerald);
    font-size: 15px;
    font-weight: 800;
    white-space: nowrap;
  }

  .checkout {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    width: 100%;
    min-height: 49px;
    margin-top: 21px;
    border: 0;
    border-radius: 10px;
    background: linear-gradient(135deg, #205a3e, #123d2b);
    color: #fff;
    font-family: inherit;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
    box-shadow: 0 5px 14px rgba(23,75,54,.15);
    transition: .18s ease;
  }

  .checkout:hover:not(:disabled) {
    background: #0e3525;
    transform: translateY(-1px);
  }

  .checkout:disabled {
    opacity: .5;
    cursor: not-allowed;
  }

  .payment-note {
    margin: 13px 0 0;
    color: #9aa39b;
    font-size: 10px;
    line-height: 1.8;
    text-align: center;
  }

  /* NOTIFICATION */
  .alert {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 15px 17px;
    border-radius: 12px;
    font-size: 11px;
    line-height: 1.7;
  }

  .alert > :first-child {
    flex-shrink: 0;
    margin-top: 1px;
  }

  .alert p {
    flex: 1;
    min-width: 0;
    margin: 0;
    overflow-wrap: anywhere;
  }

  .alert button {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 27px;
    height: 27px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  .alert-error {
    border: 1px solid #f0d9d5;
    background: #fff5f3;
    color: #a64d45;
  }

  .alert-success {
    border: 1px solid #dcebdd;
    background: #f0f7ef;
    color: #3c7046;
  }

  /* RECEIPT */
  .receipt {
    width: 100%;
    max-width: 430px;
    box-sizing: border-box;
    margin: 0 auto;
    padding: 27px;
    border: 1px solid var(--line);
    border-radius: 17px;
    background: #fff;
    box-shadow: 0 6px 22px rgba(24,55,37,.035);
  }

  .receipt-header {
    text-align: center;
  }

  .receipt-logo {
    display: grid;
    place-items: center;
    width: 45px;
    height: 45px;
    margin: 0 auto 13px;
    border-radius: 13px;
    background: #edf4ef;
    color: var(--emerald);
  }

  .receipt-header h2 {
    margin: 0;
    color: var(--emerald-dark);
    font-family: var(--font-manrope), sans-serif;
    font-size: 18px;
    font-weight: 800;
  }

  .receipt-header p {
    margin: 5px 0 14px;
    color: #89938a;
    font-size: 10px;
  }

  .receipt-header span {
    display: block;
    color: #9a865d;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 1.5px;
  }

  .receipt-header strong {
    display: block;
    margin-top: 7px;
    color: #405346;
    font-size: 11px;
  }

  .receipt-divider {
    height: 1px;
    margin: 19px 0;
    border-top: 1px dashed #dce4da;
  }

  .receipt-item {
    margin-bottom: 14px;
  }

  .receipt-item > strong {
    display: block;
    color: #304136;
    font-size: 11px;
  }

  .receipt-item > span {
    display: block;
    margin-top: 4px;
    color: #89938a;
    font-size: 9px;
  }

  .receipt-item div,
  .receipt-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-top: 8px;
    color: #7c887e;
    font-size: 10px;
  }

  .receipt-item div strong,
  .receipt-row strong {
    color: #405346;
    white-space: nowrap;
  }

  .receipt-total {
    padding-top: 13px;
    border-top: 1px solid #edf0eb;
    color: var(--emerald-dark);
    font-weight: 800;
  }

  .receipt-total strong {
    color: var(--emerald) !important;
    font-size: 15px;
  }

  .receipt-thanks {
    margin: 21px 0;
    color: #89938a;
    font-size: 10px;
    text-align: center;
  }

  .print-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: 43px;
    border: 1px solid #dce7dd;
    border-radius: 9px;
    background: #f0f5f0;
    color: var(--emerald);
    font-family: inherit;
    font-size: 11px;
    font-weight: 800;
    cursor: pointer;
    transition: .18s ease;
  }

  .print-button:hover {
    background: #e5efe6;
  }

  /* FOOTER */
  .footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    padding: 13px;
    color: #a0aaa1;
    font-size: 10px;
  }

  .footer strong {
    color: #607564;
    letter-spacing: .7px;
  }

  /* LOADING ICON */
  .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* TABLET */
  @media (max-width: 1000px) {
    .layout {
      grid-template-columns: minmax(0, 1fr);
    }

    .payment-panel {
      position: static;
    }
  }

  /* MOBILE */
  @media (max-width: 700px) {
    .cashier-page {
      gap: 16px;
      padding-bottom: 25px;
    }

    .hero {
      align-items: flex-start;
      flex-direction: column;
      gap: 17px;
      min-height: auto;
      padding: 24px 21px;
      border-radius: 17px;
    }

    .hero-actions {
      width: 100%;
      justify-content: flex-start;
    }

    .layout {
      gap: 16px;
    }

    .main-column {
      gap: 16px;
    }

    .panel {
      padding: 21px 19px;
      border-radius: 16px;
    }

    .panel-heading {
      gap: 12px;
      margin-bottom: 20px;
    }

    .panel-icon {
      width: 40px;
      height: 40px;
    }

    .panel-heading h2 {
      font-size: 15px;
    }

    .code-row {
      flex-direction: column;
    }

    .code-row .button {
      width: 100%;
    }

    .found {
      padding: 17px;
    }

    .found-bottom {
      align-items: stretch;
      flex-direction: column;
    }

    .found-bottom .button {
      width: 100%;
    }

    .cart-item {
      grid-template-columns: 36px minmax(0, 1fr) auto 32px;
      gap: 9px;
    }

    .cart-product-icon {
      width: 35px;
      height: 35px;
    }

    .cart-product {
      grid-column: 2 / 4;
    }

    .quantity {
      grid-column: 2;
      grid-row: 2;
      justify-self: start;
    }

    .line-total {
      grid-column: 3;
      grid-row: 2;
      align-self: center;
      justify-self: end;
    }

    .remove {
      grid-column: 4;
      grid-row: 1 / 3;
    }

    .total-box {
      padding: 20px;
    }

    .total-box strong {
      font-size: clamp(21px, 6vw, 28px);
    }
  }

  /* SMALL MOBILE */
  @media (max-width: 380px) {
    .hero {
      padding: 21px 18px;
    }

    .hero-actions {
      align-items: stretch;
      flex-direction: column;
    }

    .hero-link,
    .status-chip {
      width: 100%;
      box-sizing: border-box;
    }

    .panel {
      padding: 18px 16px;
    }

    .panel-heading {
      gap: 10px;
    }

    .panel-icon {
      width: 37px;
      height: 37px;
    }

    .found-top {
      align-items: flex-start;
      flex-direction: column;
    }

    .cart-count {
      padding: 7px 9px;
      font-size: 9px;
    }

    .total-box {
      padding: 17px;
    }

    .receipt {
      padding: 20px;
    }
  }

  /* PRINT STRUK */
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
      border-radius: 0 !important;
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

  if (
    error ===
    "Akses kasir hanya untuk Owner atau kasir aktif."
  ) {
    return (
      <main className="cashier-denied">
        <div className="denied-icon">
          <AlertCircle size={28} />
        </div>
        <h1>Akses Ditolak</h1>
        <p>{error}</p>
        <a href="/dashboard">Kembali ke Dashboard</a>

        <style jsx>{`
          .cashier-denied {
            display: flex;
            min-height: 65vh;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 25px;
            color: #607564;
            text-align: center;
          }

          .denied-icon {
            display: grid;
            width: 58px;
            height: 58px;
            place-items: center;
            border-radius: 16px;
            background: #fff0ed;
            color: #ad5148;
          }

          h1 {
            color: #103a2a;
          }

          a {
            margin-top: 12px;
            color: #174b36;
            font-weight: 800;
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="cashier-page">
      <style jsx>{`
        .cashier-page {
          --emerald: #174b36;
          --emerald-dark: #103a2a;
          --gold: #b99a62;
          --ink: #26352c;
          --muted: #849087;
          --line: #e8ece6;

          display: flex;
          flex-direction: column;
          gap: 20px;
          padding-bottom: 36px;
          color: var(--ink);
          font-family: var(--font-dm-sans), sans-serif;
        }

        .hero {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          overflow: hidden;
          padding: 30px 32px;
          border: 1px solid #e5e9e1;
          border-radius: 22px;
          background:
            radial-gradient(
              circle at 92% 10%,
              rgba(185,154,98,.13),
              transparent 28%
            ),
            linear-gradient(115deg, #fff 0%, #f5f8f3 100%);
          box-shadow: 0 8px 28px rgba(24,55,37,.035);
        }

        .hero::after {
          content: "";
          position: absolute;
          width: 180px;
          height: 180px;
          right: 90px;
          bottom: -125px;
          border: 1px solid rgba(185,154,98,.24);
          border-radius: 50%;
          pointer-events: none;
        }

        .eyebrow {
          margin-bottom: 10px;
          color: var(--gold);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 2.4px;
        }

        .title {
          margin: 0;
          color: var(--emerald-dark);
          font-family: var(--font-manrope), sans-serif;
          font-size: clamp(27px, 3vw, 35px);
          font-weight: 800;
          letter-spacing: -1.4px;
        }

        .subtitle {
          margin: 9px 0 0;
          color: #7b877e;
          font-size: 13px;
          line-height: 1.7;
        }

        .hero-actions {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          gap: 9px;
          flex-wrap: wrap;
        }

        .hero-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 40px;
          padding: 0 14px;
          border: 1px solid #dce7dd;
          border-radius: 10px;
          background: #fff;
          color: var(--emerald);
          font-size: 11px;
          font-weight: 800;
          text-decoration: none;
          transition: .18s ease;
        }

        .hero-link:hover {
          background: #edf4ef;
          border-color: #bfd2c2;
        }

        .status-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 11px 15px;
          border: 1px solid #dce8de;
          border-radius: 11px;
          background: rgba(255,255,255,.9);
          color: var(--emerald);
          font-size: 11px;
          font-weight: 800;
        }

        .status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #4d9b61;
          box-shadow: 0 0 0 4px #e8f3e9;
        }

        .layout {
          display: grid;
          grid-template-columns: minmax(0, 1.55fr) minmax(300px, .85fr);
          align-items: start;
          gap: 18px;
        }

        .main-column {
          display: flex;
          flex-direction: column;
          gap: 18px;
          min-width: 0;
        }

        .panel {
          min-width: 0;
          padding: 25px;
          border: 1px solid var(--line);
          border-radius: 19px;
          background: #fff;
          box-shadow: 0 6px 22px rgba(24,55,37,.035);
        }

        /* Heading panel dibuat rata kiri */
        .panel-heading {
          display: flex;
          align-items: flex-start;
          justify-content: flex-start;
          gap: 13px;
          margin-bottom: 22px;
          text-align: left;
        }

        .panel-icon {
          display: grid;
          place-items: center;
          flex-shrink: 0;
          width: 42px;
          height: 42px;
          border: 1px solid #dce8de;
          border-radius: 12px;
          background: #edf4ef;
          color: var(--emerald);
        }

        .panel-heading h2 {
          margin: 0 0 6px;
          color: var(--emerald-dark);
          font-family: var(--font-manrope), sans-serif;
          font-size: 16px;
          font-weight: 800;
          text-align: left;
        }

        .panel-heading p {
          margin: 0;
          color: #89938a;
          font-size: 11px;
          line-height: 1.7;
          text-align: left;
        }

        .code-form label,
        .field-label {
          display: block;
          margin-bottom: 8px;
          color: #526157;
          font-size: 10px;
          font-weight: 800;
        }

        .code-row {
          display: flex;
          gap: 10px;
        }

        .input-wrap {
          position: relative;
          display: flex;
          align-items: center;
          flex: 1;
          min-width: 0;
        }

        .input-icon {
          position: absolute;
          left: 13px;
          color: #8a988d;
          pointer-events: none;
        }

        .field {
          display: block;
          width: 100%;
          min-width: 0;
          min-height: 44px;
          box-sizing: border-box;
          padding: 0 13px;
          border: 1px solid #e2e8e1;
          border-radius: 10px;
          background: #fff;
          color: #304136;
          font-family: inherit;
          font-size: 12px;
          outline: none;
          transition: border-color .18s ease, box-shadow .18s ease;
        }

        .field::placeholder {
          color: #b1b9b1;
        }

        .field:focus {
          border-color: #789b83;
          box-shadow: 0 0 0 3px rgba(45,105,68,.09);
        }

        .code-input {
          padding-left: 41px;
        }

        .hint {
          display: block;
          margin-top: 9px;
          color: #9aa39b;
          font-size: 10px;
        }

        .button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 42px;
          padding: 0 16px;
          border: 0;
          border-radius: 9px;
          font-family: inherit;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          transition: all .18s ease;
          white-space: nowrap;
        }

        .primary {
          background: linear-gradient(135deg, #205a3e, #123d2b);
          color: #fff;
          box-shadow: 0 4px 11px rgba(23,75,54,.16);
        }

        .primary:hover:not(:disabled) {
          background: #0e3525;
          transform: translateY(-1px);
        }

        .secondary {
          border: 1px solid #dce7dd;
          background: #f0f5f0;
          color: var(--emerald);
        }

        button:disabled {
          opacity: .5;
          cursor: not-allowed;
        }

        .found {
          margin-top: 20px;
          padding: 19px;
          border: 1px solid #dcebdd;
          border-radius: 13px;
          background: #f7faf6;
        }

        .found-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 15px;
        }

        .found-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 10px;
          border: 1px solid #dcebdd;
          border-radius: 8px;
          background: #edf6ed;
          color: #3e754b;
          font-size: 9px;
          font-weight: 800;
        }

        .product-code {
          color: #8c9a8e;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1px;
        }

        .found h3 {
          margin: 7px 0 4px;
          color: var(--emerald-dark);
          font-size: 17px;
          font-weight: 800;
        }

        .found p {
          margin: 0;
          color: #89938a;
          font-size: 11px;
        }

        .found-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 17px;
          padding-top: 15px;
          border-top: 1px solid #e5ece3;
        }

        .found-bottom span {
          display: block;
          margin-bottom: 5px;
          color: #89938a;
          font-size: 10px;
        }

        .found-bottom strong {
          color: var(--emerald);
          font-size: 17px;
          font-weight: 800;
          white-space: nowrap;
        }

        .cart-count {
          margin-left: auto;
          padding: 7px 11px;
          border: 1px solid #e8dfca;
          border-radius: 8px;
          background: #fbf8f0;
          color: #927545;
          font-size: 10px;
          font-weight: 800;
          white-space: nowrap;
        }

        .empty {
          padding: 36px 18px;
          border: 1px dashed #dce5dc;
          border-radius: 13px;
          background: #fafbf9;
          text-align: center;
        }

        .empty-icon {
          display: grid;
          place-items: center;
          width: 52px;
          height: 52px;
          margin: 0 auto 13px;
          border-radius: 15px;
          background: #edf4ef;
          color: #64836c;
        }

        .empty h3 {
          margin: 0 0 7px;
          color: #42594a;
          font-family: var(--font-manrope), sans-serif;
          font-size: 13px;
          font-weight: 800;
        }

        .empty p {
          max-width: 320px;
          margin: 0 auto;
          color: #8a958b;
          font-size: 10px;
          line-height: 1.8;
        }

        .cart-list {
          display: flex;
          flex-direction: column;
        }

        .cart-item {
          display: grid;
          grid-template-columns: 39px minmax(0, 1fr) auto auto 32px;
          align-items: center;
          gap: 12px;
          padding: 15px 0;
          border-bottom: 1px solid #edf0eb;
        }

        .cart-item:last-child {
          border-bottom: 0;
          padding-bottom: 0;
        }

        .cart-product-icon {
          display: grid;
          place-items: center;
          width: 38px;
          height: 38px;
          border: 1px solid #e1e9df;
          border-radius: 11px;
          background: #f3f7f2;
          color: var(--emerald);
        }

        .cart-product {
          min-width: 0;
        }

        .cart-product strong {
          display: block;
          overflow: hidden;
          color: #304136;
          font-size: 11px;
          font-weight: 800;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .cart-product span,
        .cart-product small {
          display: block;
          margin-top: 4px;
          color: #89938a;
          font-size: 9px;
        }

        .quantity {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 4px;
          border: 1px solid #e6ece4;
          border-radius: 9px;
          background: #fafbf9;
        }

        .quantity button {
          display: grid;
          place-items: center;
          width: 25px;
          height: 25px;
          border: 1px solid #e1e8df;
          border-radius: 7px;
          background: #fff;
          color: var(--emerald);
          cursor: pointer;
        }

        .quantity span {
          min-width: 15px;
          color: #304136;
          font-size: 11px;
          font-weight: 800;
          text-align: center;
        }

        .line-total {
          color: var(--emerald);
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }

        .remove {
          display: grid;
          place-items: center;
          width: 31px;
          height: 31px;
          border: 1px solid #f0deda;
          border-radius: 8px;
          background: #fff5f3;
          color: #ae5148;
          cursor: pointer;
        }

        .payment-panel {
          position: sticky;
          top: 20px;
        }

        .total-box {
          padding: 21px;
          border: 1px solid #dce8de;
          border-radius: 14px;
          background:
            radial-gradient(
              circle at 100% 0%,
              rgba(185,154,98,.13),
              transparent 45%
            ),
            #f4f8f3;
        }

        .total-box span {
          display: block;
          color: #748477;
          font-size: 10px;
          font-weight: 700;
        }

        .total-box strong {
          display: block;
          margin-top: 8px;
          color: var(--emerald-dark);
          font-family: var(--font-manrope), sans-serif;
          font-size: clamp(21px, 2.5vw, 29px);
          font-weight: 800;
          letter-spacing: -.7px;
          white-space: nowrap;
        }

        .total-box small {
          display: block;
          margin-top: 7px;
          color: #9aa39b;
          font-size: 10px;
        }

        .summary-line {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 19px;
          color: #849087;
          font-size: 11px;
        }

        .summary-line strong {
          color: #405346;
          font-weight: 800;
          white-space: nowrap;
        }

        .payment-divider {
          height: 1px;
          margin: 20px 0;
          background: #edf0eb;
        }

        .payment-field {
          margin-top: 17px;
        }

        .payment-field label {
          display: block;
          margin-bottom: 8px;
          color: #526157;
          font-size: 10px;
          font-weight: 800;
        }

        .simple-input {
          display: flex;
          align-items: center;
          overflow: hidden;
          min-height: 44px;
          border: 1px solid #e2e8e1;
          border-radius: 10px;
          background: #fff;
        }

        .simple-input > span {
          display: inline-flex;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          padding-left: 12px;
          color: #8a988d;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }

        .simple-input input,
        .simple-input select {
          width: 100%;
          min-width: 0;
          height: 42px;
          padding: 0 11px;
          border: 0;
          outline: none;
          background: transparent;
          color: #304136;
          font-family: inherit;
          font-size: 12px;
        }

        .simple-input:focus-within {
          border-color: #789b83;
          box-shadow: 0 0 0 3px rgba(45,105,68,.09);
        }

        .change-box {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 17px;
          padding: 13px;
          border: 1px solid #e8e8dc;
          border-radius: 11px;
          background: #faf9f4;
        }

        .change-box span {
          color: #7e887e;
          font-size: 10px;
          font-weight: 700;
        }

        .change-box strong {
          color: var(--emerald);
          font-size: 14px;
          font-weight: 800;
          white-space: nowrap;
        }

        .checkout {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          min-height: 47px;
          margin-top: 20px;
          border: 0;
          border-radius: 10px;
          background: linear-gradient(135deg, #205a3e, #123d2b);
          color: #fff;
          font-family: inherit;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 5px 14px rgba(23,75,54,.15);
          transition: .18s ease;
        }

        .checkout:hover:not(:disabled) {
          background: #0e3525;
          transform: translateY(-1px);
        }

        .checkout:disabled {
          opacity: .5;
          cursor: not-allowed;
        }

        .payment-note {
          margin: 12px 0 0;
          color: #9aa39b;
          font-size: 9px;
          line-height: 1.8;
          text-align: center;
        }

        .alert {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          padding: 14px 16px;
          border-radius: 12px;
          font-size: 11px;
          line-height: 1.7;
        }

        .alert p {
          flex: 1;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .alert button {
          display: grid;
          flex-shrink: 0;
          place-items: center;
          width: 25px;
          height: 25px;
          border: 0;
          border-radius: 7px;
          background: transparent;
          color: inherit;
          cursor: pointer;
        }

        .alert-error {
          border: 1px solid #f0d9d5;
          background: #fff5f3;
          color: #a64d45;
        }

        .alert-success {
          border: 1px solid #dcebdd;
          background: #f0f7ef;
          color: #3c7046;
        }

        .receipt {
          width: 100%;
          max-width: 430px;
          margin: 0 auto;
          padding: 25px;
          border: 1px solid var(--line);
          border-radius: 17px;
          background: #fff;
          box-shadow: 0 6px 22px rgba(24,55,37,.035);
        }

        .receipt-header {
          text-align: center;
        }

        .receipt-logo {
          display: grid;
          place-items: center;
          width: 43px;
          height: 43px;
          margin: 0 auto 12px;
          border-radius: 13px;
          background: #edf4ef;
          color: var(--emerald);
        }

        .receipt-header h2 {
          margin: 0;
          color: var(--emerald-dark);
          font-family: var(--font-manrope), sans-serif;
          font-size: 17px;
          font-weight: 800;
        }

        .receipt-header p {
          margin: 5px 0 13px;
          color: #89938a;
          font-size: 10px;
        }

        .receipt-header span {
          display: block;
          color: #9a865d;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1.5px;
        }

        .receipt-header strong {
          display: block;
          margin-top: 7px;
          color: #405346;
          font-size: 11px;
        }

        .receipt-divider {
          height: 1px;
          margin: 18px 0;
          border-top: 1px dashed #dce4da;
        }

        .receipt-item {
          margin-bottom: 13px;
        }

        .receipt-item > strong {
          display: block;
          color: #304136;
          font-size: 11px;
        }

        .receipt-item > span {
          display: block;
          margin-top: 4px;
          color: #89938a;
          font-size: 9px;
        }

        .receipt-item div,
        .receipt-row {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin-top: 7px;
          color: #7c887e;
          font-size: 10px;
        }

        .receipt-item div strong,
        .receipt-row strong {
          color: #405346;
          white-space: nowrap;
        }

        .receipt-total {
          padding-top: 12px;
          border-top: 1px solid #edf0eb;
          color: var(--emerald-dark);
          font-weight: 800;
        }

        .receipt-total strong {
          color: var(--emerald) !important;
          font-size: 15px;
        }

        .receipt-thanks {
          margin: 20px 0;
          color: #89938a;
          font-size: 10px;
          text-align: center;
        }

        .print-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          min-height: 41px;
          border: 1px solid #dce7dd;
          border-radius: 9px;
          background: #f0f5f0;
          color: var(--emerald);
          font-family: inherit;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
        }

        .footer {
          display: flex;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          color: #a0aaa1;
          font-size: 10px;
        }

        .footer strong {
          color: #607564;
          letter-spacing: .7px;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1000px) {
          .layout {
            grid-template-columns: 1fr;
          }

          .payment-panel {
            position: static;
          }
        }

        @media (max-width: 700px) {
          .cashier-page {
            gap: 15px;
          }

          .hero {
            align-items: flex-start;
            flex-direction: column;
            padding: 23px 20px;
            border-radius: 17px;
          }

          .hero-actions {
            width: 100%;
          }

          .panel {
            padding: 17px;
            border-radius: 15px;
          }

          .code-row {
            flex-direction: column;
          }

          .code-row .button {
            width: 100%;
          }

          .found-bottom {
            align-items: stretch;
            flex-direction: column;
          }

          .found-bottom .button {
            width: 100%;
          }

          .cart-item {
            grid-template-columns: 34px minmax(0, 1fr) auto 30px;
            gap: 8px;
          }

          .cart-product-icon {
            width: 34px;
            height: 34px;
          }

          .cart-product {
            grid-column: 2 / 4;
          }

          .quantity {
            grid-column: 2;
            grid-row: 2;
            justify-self: start;
          }

          .line-total {
            grid-column: 3;
            grid-row: 2;
            align-self: center;
          }

          .remove {
            grid-column: 4;
            grid-row: 1 / 3;
          }

          .total-box strong {
            font-size: clamp(20px, 6vw, 27px);
          }
        }

        @media (max-width: 380px) {
          .hero-actions {
            align-items: stretch;
            flex-direction: column;
          }

          .found-top {
            align-items: flex-start;
            flex-direction: column;
          }

          .total-box {
            padding: 16px;
          }
        }

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

      <header className="hero">
        <div>
          <div className="eyebrow">
            SISTEM PENJUALAN TOKO
          </div>

          <h1 className="title">Kasir</h1>

          <p className="subtitle">
            Catat transaksi penjualan dengan cepat, praktis,
            dan akurat.
          </p>
        </div>

        <div className="hero-actions">
        
         

         
        </div>
      </header>

      {(error || message) && (
        <div
          className={`alert ${
            error ? "alert-error" : "alert-success"
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

      <div className="layout">
        <div className="main-column">
          <section className="panel">
            <div className="panel-heading">
              <div className="panel-icon">
                <Package size={20} />
              </div>

              <div>
                <h2>Tambah Barang</h2>
                <p>
                  Masukkan kode barang untuk mencari produk.
                </p>
              </div>
            </div>

            <form
              className="code-form"
              onSubmit={(e) => {
                e.preventDefault();
                void checkProduct();
              }}
            >
              <label htmlFor="product-code">
                Kode Barang
              </label>

              <div className="code-row">
                <div className="input-wrap">
                  <Tag
                    className="input-icon"
                    size={18}
                  />

                  <input
                    id="product-code"
                    className="field code-input"
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
                  className="button primary"
                  disabled={checking || !code.trim()}
                >
                  {checking ? (
                    <LoaderCircle
                      size={17}
                      className="spin"
                    />
                  ) : (
                    <Search size={17} />
                  )}

                  {checking
                    ? "Memeriksa..."
                    : "Cek Barang"}
                </button>
              </div>

              <span className="hint">
                Gunakan kode barang yang terdaftar di barang &
                stock.
              </span>
            </form>

            {foundProduct && (
              <div className="found">
                <div className="found-top">
                  <span className="found-badge">
                    <CheckCircle2 size={14} />
                    Barang ditemukan
                  </span>

                  <span className="product-code">
                    KODE {foundProduct.product_code}
                  </span>
                </div>

                <h3>{foundProduct.name}</h3>
                <p>
                  {foundProduct.brand || "Tanpa merek"}
                </p>

                <div className="found-bottom">
                  <div>
                    <span>Harga jual</span>
                    <strong>
                      {rupiah(
                        foundProduct.current_selling_price
                      )}
                    </strong>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      addProduct(foundProduct)
                    }
                    className="button primary"
                  >
                    <Plus size={17} />
                    Tambah ke Keranjang
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div className="panel-icon">
                <ShoppingCart size={20} />
              </div>

              <div>
                <h2>Keranjang Belanja</h2>
                <p>
                  Periksa barang dan jumlah sebelum pembayaran.
                </p>
              </div>

              <span className="cart-count">
                {cart.length} jenis
              </span>
            </div>

            {cart.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">
                  <ShoppingCart size={25} />
                </div>

                <h3>Keranjang masih kosong</h3>

                <p>
                  Masukkan kode barang terlebih dahulu untuk
                  mulai menambahkan produk ke keranjang.
                </p>
              </div>
            ) : (
              <div className="cart-list">
                {cart.map((item) => (
                  <article
                    key={item.product.id}
                    className="cart-item"
                  >
                    <div className="cart-product-icon">
                      <Package size={19} />
                    </div>

                    <div className="cart-product">
                      <strong>
                        {item.product.name}
                      </strong>

                      <span>
                        {item.product.brand || "Tanpa merek"}
                      </span>

                      <small>
                        {rupiah(
                          item.product.current_selling_price
                        )}{" "}
                        / unit
                      </small>
                    </div>

                    <div className="quantity">
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
                        <Minus size={13} />
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
                        <Plus size={13} />
                      </button>
                    </div>

                    <strong className="line-total">
                      {rupiah(
                        item.product.current_selling_price *
                          item.quantity
                      )}
                    </strong>

                    <button
                      type="button"
                      className="remove"
                      onClick={() =>
                        removeProduct(item.product.id)
                      }
                      aria-label="Hapus barang"
                    >
                      <Trash2 size={15} />
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="panel payment-panel">
          <div className="panel-heading">
            <div className="panel-icon">
              <Wallet size={20} />
            </div>

            <div>
              <h2>Pembayaran</h2>
              <p>Ringkasan transaksi.</p>
            </div>
          </div>

          <div className="total-box">
            <span>Total Tagihan</span>
            <strong>{rupiah(total)}</strong>
            <small>{cart.length} jenis barang</small>
          </div>

          <div className="summary-line">
            <span>Subtotal</span>
            <strong>{rupiah(subtotal)}</strong>
          </div>

          <div className="payment-field">
            <label htmlFor="discount">
              Diskon (%)
            </label>

            <div className="simple-input">
              <input
                id="discount"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={discount}
                onChange={(e) => {
                  const value = e.target.value;

                  if (
                    value === "" ||
                    (Number(value) >= 0 &&
                      Number(value) <= 100)
                  ) {
                    setDiscount(value);
                  }
                }}
                placeholder="0"
              />

              <span>%</span>
            </div>

            <div className="summary-line">
              <span>Potongan diskon</span>
              <strong>{rupiah(discountAmount)}</strong>
            </div>
          </div>

          <div className="payment-divider" />

          <div className="payment-field">
            <label htmlFor="payment-method">
              Metode Pembayaran
            </label>

            <div className="simple-input">
              <span>
                <CreditCard size={16} />
              </span>

              <select
                id="payment-method"
                value={paymentMethod}
                onChange={(e) => {
                  setPaymentMethod(e.target.value);
                }}
              >
                <option value="cash">Tunai</option>
                <option value="qris">QRIS</option>
                <option value="transfer">Transfer</option>
                <option value="other">Lainnya</option>
              </select>
            </div>
          </div>

          <div className="payment-field">
            <label htmlFor="amount-paid">
              Jumlah Dibayar (Rp)
            </label>

            <div className="simple-input">
              <span>Rp</span>

              <input
                id="amount-paid"
                type="number"
                min="0"
                value={amountPaid}
                onChange={(e) =>
                  setAmountPaid(e.target.value)
                }
                placeholder="Masukkan pembayaran"
              />
            </div>
          </div>

          {paymentMethod === "cash" && (
            <div className="change-box">
              <span>Kembalian</span>
              <strong>{rupiah(change)}</strong>
            </div>
          )}

          <button
            type="button"
            className="checkout"
            onClick={() => void checkout()}
            disabled={busy || cart.length === 0}
          >
            {busy ? (
              <>
                <LoaderCircle
                  size={17}
                  className="spin"
                />
                Memproses Transaksi...
              </>
            ) : (
              <>
                <CheckCircle2 size={17} />
                Proses Pembayaran
              </>
            )}
          </button>

          <p className="payment-note">
            Pastikan jumlah barang dan pembayaran sudah benar
            sebelum menyelesaikan transaksi.
          </p>
        </aside>
      </div>

      {receipt && (
        <section id="receipt" className="receipt">
          <div className="receipt-header">
            <div className="receipt-logo">
              <ShoppingCart size={21} />
            </div>

            <h2>TOKO ROSYIDAH</h2>
            <p>Sebaung</p>
            <span>BUKTI PEMBAYARAN</span>
            <strong>{receipt.receipt_number}</strong>
          </div>

          <div className="receipt-divider" />

          {receipt.items.map((item, index) => (
            <div key={index} className="receipt-item">
              <strong>{item.name}</strong>
              <span>{item.brand}</span>

              <div>
                <span>
                  {item.quantity} ×{" "}
                  {rupiah(item.selling_price)}
                </span>

                <strong>
                  {rupiah(item.line_total)}
                </strong>
              </div>
            </div>
          ))}

          <div className="receipt-divider" />

          <div className="receipt-row">
            <span>Subtotal</span>
            <strong>{rupiah(receipt.subtotal)}</strong>
          </div>

          <div className="receipt-row">
            <span>
              Diskon (
              {receipt.subtotal > 0
                ? (
                    (receipt.discount /
                      receipt.subtotal) *
                    100
                  ).toLocaleString("id-ID", {
                    maximumFractionDigits: 2,
                  })
                : 0}
              %)
            </span>

            <strong>{rupiah(receipt.discount)}</strong>
          </div>

          <div className="receipt-row receipt-total">
            <span>Total</span>
            <strong>{rupiah(receipt.total)}</strong>
          </div>

          <div className="receipt-row">
            <span>Dibayar</span>
            <strong>{rupiah(receipt.amount_paid)}</strong>
          </div>

          <div className="receipt-row">
            <span>Kembalian</span>
            <strong>{rupiah(receipt.change_amount)}</strong>
          </div>

          <p className="receipt-thanks">
            Terima kasih telah berbelanja.
          </p>

          <button
            type="button"
            className="print-button"
            onClick={() => window.print()}
          >
            <Printer size={16} />
            Cetak Struk
          </button>
        </section>
      )}

      <footer className="footer">
        <strong>TOKO ROSYIDAH</strong>
        <span>·</span>
        Sistem Kasir & Penjualan
      </footer>
    </main>
  );
}
