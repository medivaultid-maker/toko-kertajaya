
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase";
import {
  ArrowLeft,
  Package,
  CalendarDays,
  Hash,
  Wallet,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  ClipboardList,
  PackageCheck,
  Receipt,
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  Sparkles,
  ShoppingBag,
  Search,
  Tag,
  Boxes,
  Check,
  RotateCcw,
} from "lucide-react";

type Product = {
  id: string;
  product_code: string;
  name: string;
  brand: string;
  category_id: string;
};

type IntakeItem = {
  date: string;
  productId: string;
  productCode: string;
  name: string;
  brand: string;
  category: string;
  quantity: string;
  purchasePrice: string;
};

const todayLocal = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const emptyItem = (): IntakeItem => ({
  date: todayLocal(),
  productId: "",
  productCode: "",
  name: "",
  brand: "",
  category: "",
  quantity: "",
  purchasePrice: "",
});

const rupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

const formatDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export default function KulakanPage() {
  const [supabase] = useState(() => createClient());

  const [products, setProducts] = useState<Product[]>([]);
  const [item, setItem] = useState<IntakeItem>(emptyItem);
  const [items, setItems] = useState<IntakeItem[]>([]);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkedCode, setCheckedCode] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, product_code, name, brand, category_id")
        .order("name");

      if (error) throw error;

      setProducts(data || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal mengambil data barang."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  function update(field: keyof IntakeItem, value: string) {
    setItem((old) => ({ ...old, [field]: value }));

    if (field === "productCode") {
      setSelectedProduct(null);
      setCheckedCode("");
    }

    setError("");
    setMessage("");
  }

  async function checkProduct() {
    const code = item.productCode.trim();

    if (!code) {
      setError("Masukkan kode barang terlebih dahulu.");
      setSelectedProduct(null);
      return;
    }

    setChecking(true);
    setError("");
    setMessage("");
    setSelectedProduct(null);
    setCheckedCode("");

    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, product_code, name, brand, category_id")
        .eq("product_code", code)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setError(`Kode barang "${code}" tidak ditemukan. Periksa kembali kode barang.`);
        return;
      }

      setSelectedProduct(data);
      setCheckedCode(data.product_code);

      setItem((old) => ({
        ...old,
        productId: data.id,
        productCode: data.product_code,
        name: data.name,
        brand: data.brand || "",
      }));

      setMessage("Barang berhasil ditemukan. Silakan lengkapi jumlah dan harga kulakan.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal memeriksa kode barang."
      );
    } finally {
      setChecking(false);
    }
  }

  const totalQuantity = items.reduce(
    (sum, row) => sum + Number(row.quantity),
    0
  );

  const totalValue = items.reduce(
    (sum, row) =>
      sum + Number(row.quantity) * Number(row.purchasePrice),
    0
  );

  function addItem(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");

    const quantity = Number(item.quantity);
    const price = Number(item.purchasePrice);

    if (
      !selectedProduct ||
      checkedCode !== item.productCode.trim() ||
      selectedProduct.id !== item.productId
    ) {
      setError("Periksa kode barang terlebih dahulu sebelum menambahkan kulakan.");
      return;
    }

    if (
      !item.date ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !Number.isInteger(quantity) ||
      !Number.isFinite(price) ||
      price <= 0
    ) {
      setError(
        "Lengkapi tanggal, jumlah, dan harga kulakan. Jumlah harus bilangan bulat positif dan harga harus lebih dari nol."
      );
      return;
    }

    if (editingIndex !== null) {
      setItems((old) =>
        old.map((row, index) =>
          index === editingIndex ? { ...item } : row
        )
      );

      setEditingIndex(null);
      setMessage("Data kulakan berhasil diperbarui dalam daftar.");
    } else {
      setItems((old) => [...old, { ...item }]);
      setMessage("Barang berhasil ditambahkan ke daftar kulakan.");
    }

    setItem((old) => ({
      ...emptyItem(),
      date: old.date,
    }));

    setSelectedProduct(null);
    setCheckedCode("");
  }

  function editItem(index: number) {
    const row = items[index];
    const product = products.find((p) => p.id === row.productId);

    setItem({ ...row });
    setSelectedProduct(product || null);
    setCheckedCode(product?.product_code || "");
    setEditingIndex(index);
    setError("");
    setMessage("");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function removeItem(index: number) {
    setItems((old) => old.filter((_, i) => i !== index));

    if (editingIndex === index) {
      setEditingIndex(null);
      setItem(emptyItem());
      setSelectedProduct(null);
      setCheckedCode("");
    } else if (editingIndex !== null && editingIndex > index) {
      setEditingIndex(editingIndex - 1);
    }

    setMessage("Barang dihapus dari daftar sementara.");
    setError("");
  }

  function cancelEdit() {
    setEditingIndex(null);
    setItem(emptyItem());
    setSelectedProduct(null);
    setCheckedCode("");
    setError("");
    setMessage("");
  }

  async function saveItems() {
    if (!items.length || saving) return;

    setSaving(true);
    setError("");
    setMessage("");

    let savedCount = 0;

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error("Sesi login berakhir. Silakan login kembali.");
      }

      for (const row of items) {
        const product = products.find((p) => p.id === row.productId);

        if (!product) {
          throw new Error(
            `Barang dengan kode "${row.productCode}" tidak ditemukan lagi. Muat ulang halaman dan periksa kembali.`
          );
        }

        const { data: intake, error: intakeError } = await supabase
          .from("purchase_intakes")
          .insert({
            product_id: product.id,
            purchase_date: row.date,
            quantity_received: Number(row.quantity),
            quantity_remaining: 0,
            purchase_price: Number(row.purchasePrice),
            status: "pending_price",
            entered_by: user.id,
          })
          .select("id")
          .single();

        if (intakeError) {
          throw new Error(
            `Kulakan "${row.name}" gagal disimpan: ${intakeError.message}`
          );
        }

        savedCount += 1;

        const { error: notificationError } = await supabase
          .from("notifications")
          .insert({
            recipient_role: "admin",
            title: "Kulakan baru menunggu persetujuan",
            message: `${row.name} - ${row.brand}, kode ${row.productCode}, jumlah ${row.quantity}. Harga jual perlu ditetapkan.`,
            related_intake_id: intake.id,
            is_read: false,
          });

        if (notificationError) {
          throw new Error(
            `Kulakan "${row.name}" sudah tersimpan, tetapi notifikasi gagal dibuat: ${notificationError.message}`
          );
        }
      }

      setItems([]);
      setItem(emptyItem());
      setSelectedProduct(null);
      setCheckedCode("");
      setEditingIndex(null);

      setMessage(
        `${savedCount} data kulakan berhasil disimpan. Barang menunggu persetujuan harga admin sebelum stok dapat dijual.`
      );

      await loadData();
    } catch (err) {
      setError(
        `${
          err instanceof Error
            ? err.message
            : "Gagal menyimpan data kulakan."
        }${
          savedCount > 0
            ? ` ${savedCount} baris telah tersimpan sebelum proses terhenti. Periksa data kulakan di database sebelum mencoba lagi agar tidak terjadi duplikasi.`
            : ""
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="intake-loading">
        <div className="intake-loading-icon">
          <LoaderCircle size={25} className="intake-spin" />
        </div>
        <p>Menyiapkan data kulakan...</p>
      </main>
    );
  }

  return (
  <main className="intake-page">
    <style jsx>{`

.intake-page {
  --emerald: #174b36;
  --emerald-dark: #103a2a;
  --emerald-soft: #edf4ef;
  --gold: #b99a62;
  --ink: #26352c;
  --muted: #849087;
  --line: #e8ece6;

  width: 100%;
  min-height: 100vh;
  padding: 26px 28px 34px;
  background: #f8f8f4;
  color: var(--ink);
  font-family: var(--font-dm-sans), sans-serif;
  box-sizing: border-box;
}

.intake-container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  gap: 20px;
  box-sizing: border-box;
}

/* BACK BUTTON */
.intake-back {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 8px;
  color: #718075;
  font-size: 11px;
  font-weight: 700;
  text-decoration: none;
  transition: .18s ease;
}

.intake-back:hover {
  color: var(--emerald);
  transform: translateX(-2px);
}

/* HEADER */
.intake-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  min-height: 145px;
  overflow: hidden;
  padding: 28px 30px;
  border: 1px solid #e5e9e1;
  border-radius: 20px;
  background:
    radial-gradient(circle at 92% 10%, rgba(185,154,98,.13), transparent 28%),
    linear-gradient(115deg, #fff 0%, #f5f8f3 100%);
  box-shadow: 0 7px 24px rgba(24,55,37,.035);
}

.intake-header::before {
  content: "";
  position: absolute;
  width: 210px;
  height: 210px;
  top: -110px;
  right: 40px;
  border: 1px solid rgba(185,154,98,.16);
  border-radius: 50%;
  pointer-events: none;
}

.intake-header::after {
  content: "";
  position: absolute;
  width: 170px;
  height: 170px;
  right: 100px;
  bottom: -125px;
  border: 1px solid rgba(185,154,98,.22);
  border-radius: 50%;
  pointer-events: none;
}

.intake-heading {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 17px;
  min-width: 0;
}

.intake-heading-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 55px;
  height: 55px;
  border: 1px solid #dce8de;
  border-radius: 15px;
  background: var(--emerald-soft);
  color: var(--emerald);
}

.intake-eyebrow {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 8px;
  color: var(--gold);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 2px;
}

.intake-heading h1 {
  margin: 0;
  color: var(--emerald-dark);
  font-family: var(--font-manrope), sans-serif;
  font-size: clamp(27px, 3vw, 34px);
  font-weight: 800;
  letter-spacing: -1.2px;
}

.intake-heading p {
  margin: 8px 0 0;
  color: #7b877e;
  font-size: 12px;
  line-height: 1.7;
}

.intake-header-tag {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-shrink: 0;
  min-height: 40px;
  padding: 0 14px;
  border: 1px solid #dce8de;
  border-radius: 10px;
  background: rgba(255,255,255,.9);
  color: var(--emerald);
  font-size: 10px;
  font-weight: 800;
}

/* ALERT */
.intake-alert {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 15px 17px;
  border-radius: 12px;
  font-size: 11px;
  line-height: 1.7;
}

.intake-alert > svg {
  flex-shrink: 0;
  margin-top: 2px;
}

.intake-alert > div {
  flex: 1;
  min-width: 0;
}

.intake-alert strong {
  display: block;
  margin-bottom: 3px;
  font-size: 11px;
  font-weight: 800;
}

.intake-alert p {
  margin: 0;
  overflow-wrap: anywhere;
}

.intake-alert-error {
  border: 1px solid #f0d9d5;
  background: #fff5f3;
  color: #a64d45;
}

.intake-alert-success {
  border: 1px solid #dcebdd;
  background: #f0f7ef;
  color: #3c7046;
}

.intake-alert-close {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 27px;
  height: 27px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

/* MAIN CARD */
.intake-card {
  min-width: 0;
  padding: 27px 29px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 5px 20px rgba(24,55,37,.035);
}

/* SECTION HEADING */
.intake-section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 14px;
  width: 100%;
  margin-bottom: 25px;
  text-align: left;
}

.intake-section-icon {
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

.intake-section-heading > div:nth-child(2) {
  flex: 1;
  min-width: 0;
  text-align: left;
}

.intake-section-heading h2 {
  margin: 1px 0 6px;
  color: var(--emerald-dark);
  font-family: var(--font-manrope), sans-serif;
  font-size: 17px;
  font-weight: 800;
  line-height: 1.4;
  text-align: left;
}

.intake-section-heading p {
  margin: 0;
  color: #89938a;
  font-size: 11px;
  line-height: 1.7;
  text-align: left;
}

.intake-step {
  flex-shrink: 0;
  padding: 8px 11px;
  border: 1px solid #e8dfca;
  border-radius: 8px;
  background: #fbf8f0;
  color: #927545;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .7px;
}

/* FORM */
.intake-field {
  min-width: 0;
}

.intake-label {
  display: block;
  margin-bottom: 9px;
  color: #526157;
  font-size: 11px;
  font-weight: 800;
}

.intake-code-row {
  display: flex;
  align-items: stretch;
  gap: 11px;
}

.intake-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
  width: 100%;
}

.intake-code-input-wrap {
  flex: 1;
}

.intake-input-icon {
  position: absolute;
  left: 14px;
  display: flex;
  align-items: center;
  color: #8a988d;
  pointer-events: none;
}

.intake-input {
  display: block;
  width: 100%;
  min-width: 0;
  height: 46px;
  box-sizing: border-box;
  padding: 0 14px 0 43px;
  border: 1px solid #e2e8e1;
  border-radius: 10px;
  outline: none;
  background: #fff;
  color: #304136;
  font-family: inherit;
  font-size: 12px;
  transition: border-color .18s ease, box-shadow .18s ease;
}

.intake-input::placeholder {
  color: #b1b9b1;
}

.intake-input:focus {
  border-color: #789b83;
  box-shadow: 0 0 0 3px rgba(45,105,68,.09);
}

.intake-input[type="date"] {
  color-scheme: light;
}

.intake-field-hint {
  margin: 9px 0 0;
  color: #9aa39b;
  font-size: 10px;
  line-height: 1.7;
}

/* BUTTON */
.intake-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
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

.intake-btn-primary {
  background: linear-gradient(135deg, #205a3e, #123d2b);
  color: #fff;
  box-shadow: 0 4px 11px rgba(23,75,54,.14);
}

.intake-btn-primary:hover:not(:disabled) {
  background: #0e3525;
  transform: translateY(-1px);
}

.intake-btn-secondary {
  border: 1px solid #dce7dd;
  background: #f0f5f0;
  color: var(--emerald);
}

.intake-btn-secondary:hover {
  background: #e5efe6;
}

.intake-btn:disabled {
  opacity: .48;
  cursor: not-allowed;
  transform: none;
}

.intake-check-btn {
  flex-shrink: 0;
  min-width: 125px;
}

/* PRODUCT PREVIEW */
.intake-product-preview {
  margin-top: 21px;
  padding: 20px;
  border: 1px solid #dcebdd;
  border-radius: 14px;
  background: #f7faf6;
}

.intake-product-preview-top {
  display: flex;
  align-items: center;
  gap: 13px;
}

.intake-product-preview-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 45px;
  height: 45px;
  border: 1px solid #dcebdd;
  border-radius: 12px;
  background: #edf6ed;
  color: #477b51;
}

.intake-product-preview-title {
  flex: 1;
  min-width: 0;
}

.intake-product-found {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 5px;
  color: #3e754b;
  font-size: 9px;
  font-weight: 800;
}

.intake-product-preview-title h3 {
  margin: 0;
  color: var(--emerald-dark);
  font-family: var(--font-manrope), sans-serif;
  font-size: 15px;
  font-weight: 800;
}

.intake-product-preview-title p {
  margin: 4px 0 0;
  color: #89938a;
  font-size: 10px;
}

.intake-product-code {
  flex-shrink: 0;
  padding: 7px 10px;
  border: 1px solid #e3e9df;
  border-radius: 8px;
  background: #fff;
  color: #718075;
  font-size: 10px;
  font-weight: 800;
}

.intake-product-preview-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 22px;
  margin-top: 17px;
  padding-top: 14px;
  border-top: 1px solid #e5ece3;
}

.intake-product-preview-meta div {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #728477;
  font-size: 10px;
}

.intake-product-preview-meta svg {
  color: #64836c;
}

/* INPUT GRID */
.intake-form-grid {
  display: grid;
  gap: 17px;
  margin-top: 24px;
}

.intake-form-grid-three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

/* NOTE */
.intake-note {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-top: 21px;
  padding: 15px 16px;
  border: 1px solid #e8e8dc;
  border-radius: 11px;
  background: #faf9f4;
}

.intake-note-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: #f2eddf;
  color: #9a8150;
}

.intake-note strong {
  display: block;
  margin-bottom: 4px;
  color: #6e654f;
  font-size: 10px;
  font-weight: 800;
}

.intake-note p {
  margin: 0;
  color: #8a8779;
  font-size: 10px;
  line-height: 1.7;
}

/* FORM ACTIONS */
.intake-form-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  margin-top: 23px;
  padding-top: 19px;
  border-top: 1px solid #edf0eb;
}

/* LIST */
.intake-list-card {
  padding-bottom: 25px;
}

.intake-list-heading {
  align-items: center;
}

.intake-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  gap: 7px;
  margin-left: auto;
  padding: 8px 12px;
  border: 1px solid #e8dfca;
  border-radius: 8px;
  background: #fbf8f0;
  color: #927545;
  font-size: 10px;
  font-weight: 800;
}

/* EMPTY STATE */
.intake-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 44px 20px;
  border: 1px dashed #dce5dc;
  border-radius: 13px;
  background: #fafbf9;
  text-align: center;
}

.intake-empty-icon {
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  margin-bottom: 15px;
  border-radius: 16px;
  background: #edf4ef;
  color: #64836c;
}

.intake-empty h3 {
  margin: 0 0 8px;
  color: #42594a;
  font-family: var(--font-manrope), sans-serif;
  font-size: 14px;
  font-weight: 800;
}

.intake-empty p {
  max-width: 350px;
  margin: 0;
  color: #8a958b;
  font-size: 11px;
  line-height: 1.8;
}

/* TABLE */
.intake-table-wrap {
  width: 100%;
  overflow-x: auto;
  border: 1px solid #e8ece6;
  border-radius: 12px;
  scrollbar-width: thin;
  scrollbar-color: #cbd8cb #f5f7f3;
}

.intake-table {
  width: 100%;
  min-width: 850px;
  border-collapse: separate;
  border-spacing: 0;
  background: #fff;
  text-align: left;
}

.intake-table thead {
  background: #f2f6f1;
}

.intake-table th {
  padding: 14px 13px;
  border-bottom: 1px solid #e5ebe3;
  color: #607365;
  font-size: 10px;
  font-weight: 800;
  white-space: nowrap;
}

.intake-table td {
  padding: 15px 13px;
  border-bottom: 1px solid #edf0eb;
  color: #68776b;
  font-size: 10px;
  vertical-align: middle;
  white-space: nowrap;
}

.intake-table tbody tr:last-child td {
  border-bottom: 0;
}

.intake-table tbody tr {
  transition: background .15s ease;
}

.intake-table tbody tr:hover {
  background: #fafcf9;
}

.intake-table tbody tr.intake-row-editing {
  background: #fbf8f0;
}

.intake-date-cell {
  color: #78877b !important;
}

.intake-category {
  display: inline-flex;
  align-items: center;
  padding: 6px 9px;
  border: 1px solid #e3e9df;
  border-radius: 7px;
  background: #f4f7f2;
  color: var(--emerald);
  font-size: 9px;
  font-weight: 800;
}

.intake-product-name {
  color: #304136 !important;
  font-weight: 800;
}

.intake-quantity {
  color: #526b59 !important;
  font-weight: 700;
}

.intake-money {
  color: #718075 !important;
  font-weight: 600;
}

.intake-total {
  color: var(--emerald) !important;
  font-weight: 800;
}

/* TABLE ACTIONS */
.intake-row-actions {
  display: flex;
  align-items: center;
  gap: 7px;
}

.intake-icon-btn {
  display: grid;
  place-items: center;
  width: 31px;
  height: 31px;
  border-radius: 8px;
  cursor: pointer;
  transition: .15s ease;
}

.intake-edit-btn {
  border: 1px solid #e8dfca;
  background: #fbf8f0;
  color: #9a8150;
}

.intake-edit-btn:hover {
  background: #f3eddf;
}

.intake-delete-btn {
  border: 1px solid #f0deda;
  background: #fff5f3;
  color: #ae5148;
}

.intake-delete-btn:hover {
  background: #fce9e5;
}

.intake-icon-btn:disabled {
  opacity: .45;
  cursor: not-allowed;
}

/* SUMMARY */
.intake-summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 20px;
}

.intake-summary {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  padding: 19px;
  border: 1px solid #e5ebe3;
  border-radius: 13px;
  background: #fafcf9;
}

.intake-summary-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 43px;
  height: 43px;
  border: 1px solid #dce8de;
  border-radius: 12px;
  background: #edf4ef;
  color: var(--emerald);
}

.intake-summary p {
  margin: 0 0 6px;
  color: #849087;
  font-size: 10px;
  font-weight: 700;
}

.intake-summary strong {
  display: block;
  color: var(--emerald-dark);
  font-family: var(--font-manrope), sans-serif;
  font-size: 19px;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.intake-summary strong small {
  color: #849087;
  font-family: var(--font-dm-sans), sans-serif;
  font-size: 10px;
  font-weight: 600;
}

.intake-summary-value {
  border-color: #e8dfca;
  background: #fbf9f3;
}

.intake-summary-value .intake-summary-icon {
  border-color: #e8dfca;
  background: #f5f0e4;
  color: #9a8150;
}

/* SAVE AREA */
.intake-save-area {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-top: 21px;
  padding-top: 20px;
  border-top: 1px solid #edf0eb;
}

.intake-save-info {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
  max-width: 650px;
}

.intake-save-info-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 31px;
  height: 31px;
  border-radius: 9px;
  background: #f5f0e4;
  color: #9a8150;
}

.intake-save-info p {
  margin: 2px 0 0;
  color: #8a958b;
  font-size: 10px;
  line-height: 1.8;
}

.intake-save-btn {
  flex-shrink: 0;
  min-width: 175px;
  min-height: 47px;
}

/* FOOTER */
.intake-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 13px;
  color: #a0aaa1;
  font-size: 10px;
  text-align: center;
}

.intake-footer span:first-child {
  color: #607564;
  font-weight: 800;
  letter-spacing: .7px;
}

.intake-footer-dot {
  color: var(--gold);
}

/* LOADING */
.intake-loading {
  display: flex;
  min-height: 65vh;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 13px;
  color: var(--emerald);
  background: #f8f8f4;
  font-size: 12px;
}

.intake-loading p {
  margin: 0;
  color: #849087;
}

.intake-loading-icon {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border: 1px solid #dce8de;
  border-radius: 15px;
  background: #edf4ef;
  color: var(--emerald);
}

.intake-spin {
  animation: intake-spin 1s linear infinite;
}

@keyframes intake-spin {
  to {
    transform: rotate(360deg);
  }
}

/* TABLET */
@media (max-width: 900px) {
  .intake-page {
    padding: 22px 20px 30px;
  }

  .intake-form-grid-three {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .intake-save-area {
    align-items: stretch;
    flex-direction: column;
  }

  .intake-save-btn {
    width: 100%;
  }
}

/* MOBILE */
@media (max-width: 600px) {
  .intake-page {
    padding: 18px 14px 25px;
  }

  .intake-container {
    gap: 16px;
  }

  .intake-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 17px;
    min-height: auto;
    padding: 23px 20px;
    border-radius: 17px;
  }

  .intake-heading {
    align-items: flex-start;
    gap: 12px;
  }

  .intake-heading-icon {
    width: 45px;
    height: 45px;
  }

  .intake-heading h1 {
    font-size: 27px;
  }

  .intake-heading p {
    font-size: 11px;
  }

  .intake-header-tag {
    min-height: 36px;
  }

  .intake-card {
    padding: 21px 18px;
    border-radius: 16px;
  }

  .intake-section-heading {
    gap: 11px;
    margin-bottom: 21px;
  }

  .intake-section-icon {
    width: 39px;
    height: 39px;
  }

  .intake-section-heading h2 {
    font-size: 15px;
  }

  .intake-section-heading p {
    font-size: 10px;
  }

  .intake-step {
    padding: 7px 8px;
    font-size: 8px;
  }

  .intake-code-row {
    flex-direction: column;
  }

  .intake-check-btn {
    width: 100%;
  }

  .intake-form-grid-three {
    grid-template-columns: 1fr;
    gap: 16px;
    margin-top: 21px;
  }

  .intake-product-preview {
    padding: 16px;
  }

  .intake-product-preview-top {
    flex-wrap: wrap;
  }

  .intake-product-code {
    margin-left: 58px;
  }

  .intake-product-preview-meta {
    flex-direction: column;
    gap: 10px;
  }

  .intake-form-actions {
    flex-direction: column-reverse;
    align-items: stretch;
  }

  .intake-form-actions .intake-btn {
    width: 100%;
  }

  .intake-list-heading {
    flex-wrap: wrap;
  }

  .intake-count {
    margin-left: 50px;
  }

  .intake-summary-grid {
    grid-template-columns: 1fr;
  }

  .intake-summary {
    padding: 16px;
  }

  .intake-save-area {
    gap: 15px;
  }

  .intake-save-btn {
    width: 100%;
  }

  .intake-footer {
    flex-wrap: wrap;
    font-size: 9px;
  }
}

/* SMALL MOBILE */
@media (max-width: 380px) {
  .intake-page {
    padding-right: 11px;
    padding-left: 11px;
  }

  .intake-header {
    padding: 20px 17px;
  }

  .intake-heading-icon {
    width: 41px;
    height: 41px;
  }

  .intake-heading h1 {
    font-size: 24px;
  }

  .intake-card {
    padding: 18px 15px;
  }

  .intake-section-heading {
    gap: 9px;
  }

  .intake-step {
    display: none;
  }

  .intake-count {
    margin-left: 48px;
  }

  .intake-summary strong {
    font-size: 17px;
  }
}
    `}</style>

    <div className="intake-container">
        

        <header className="intake-header">
          <div className="intake-heading">
            <div className="intake-heading-icon">
              <Package size={27} strokeWidth={1.7} />
            </div>

            <div>
              <div className="intake-eyebrow">
                <Sparkles size={12} />
                TOKO ROSYIDAH · SEBAUNG
              </div>

              <h1>Input Kulakan</h1>
              <p>
                Catat barang masuk dengan cepat menggunakan kode barang.
              </p>
            </div>
          </div>

          <div className="intake-header-tag">
            <ShoppingBag size={15} />
            Pengadaan Barang
          </div>
        </header>

        {(error || message) && (
          <div
            role={error ? "alert" : "status"}
            className={`intake-alert ${
              error ? "intake-alert-error" : "intake-alert-success"
            }`}
          >
            {error ? (
              <AlertCircle size={19} />
            ) : (
              <CheckCircle2 size={19} />
            )}

            <div>
              <strong>{error ? "Perlu diperiksa" : "Berhasil"}</strong>
              <p>{error || message}</p>
            </div>

            <button
              type="button"
              className="intake-alert-close"
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

        <section className="intake-card">
          <div className="intake-section-heading">
            <div className="intake-section-icon">
              <ClipboardList size={20} />
            </div>

            <div>
              <h2>Informasi Kulakan</h2>
              <p>
                Masukkan kode barang untuk mengambil data produk secara otomatis.
              </p>
            </div>

            <span className="intake-step">01 / INPUT</span>
          </div>

          <form onSubmit={addItem}>
            <div className="intake-field">
              <label htmlFor="productCode" className="intake-label">
                Kode Barang
              </label>

              <div className="intake-code-row">
                <div className="intake-input-wrap intake-code-input-wrap">
                  <span className="intake-input-icon">
                    <Hash size={17} />
                  </span>

                  <input
                    id="productCode"
                    type="text"
                    value={item.productCode}
                    onChange={(e) => update("productCode", e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void checkProduct();
                      }
                    }}
                    placeholder="Masukkan atau scan kode barang"
                    className="intake-input"
                    autoComplete="off"
                  />
                </div>

                <button
                  type="button"
                  onClick={checkProduct}
                  disabled={checking || !item.productCode.trim()}
                  className="intake-btn intake-btn-primary intake-check-btn"
                >
                  {checking ? (
                    <LoaderCircle size={17} className="intake-spin" />
                  ) : (
                    <Search size={17} />
                  )}
                  {checking ? "Mengecek..." : "Cek Barang"}
                </button>
              </div>

              <p className="intake-field-hint">
                Masukkan kode barang yang terdaftar di master produk, lalu tekan Cek Barang.
              </p>
            </div>

            {selectedProduct && checkedCode === item.productCode.trim() && (
              <div className="intake-product-preview">
                <div className="intake-product-preview-top">
                  <div className="intake-product-preview-icon">
                    <PackageCheck size={23} />
                  </div>

                  <div className="intake-product-preview-title">
                    <span className="intake-product-found">
                      <Check size={13} />
                      Barang ditemukan
                    </span>
                    <h3>{selectedProduct.name}</h3>
                    <p>{selectedProduct.brand || "Tanpa merek"}</p>
                  </div>

                  <span className="intake-product-code">
                    {selectedProduct.product_code}
                  </span>
                </div>

                <div className="intake-product-preview-meta">
                  <div>
                    <Tag size={15} />
                    <span>Data produk terdaftar</span>
                  </div>
                  <div>
                    <Boxes size={15} />
                    <span>Barang siap dicatat sebagai kulakan</span>
                  </div>
                </div>
              </div>
            )}

            <div className="intake-form-grid intake-form-grid-three">
              <div className="intake-field">
                <label htmlFor="date" className="intake-label">
                  Tanggal Kulakan
                </label>

                <div className="intake-input-wrap">
                  <span className="intake-input-icon">
                    <CalendarDays size={17} />
                  </span>

                  <input
                    id="date"
                    type="date"
                    value={item.date}
                    onChange={(e) => update("date", e.target.value)}
                    required
                    className="intake-input"
                  />
                </div>
              </div>

              <div className="intake-field">
                <label htmlFor="quantity" className="intake-label">
                  Jumlah Barang
                </label>

                <div className="intake-input-wrap">
                  <span className="intake-input-icon">
                    <Boxes size={17} />
                  </span>

                  <input
                    id="quantity"
                    type="number"
                    min="1"
                    step="1"
                    value={item.quantity}
                    onChange={(e) => update("quantity", e.target.value)}
                    placeholder="Contoh: 12"
                    required
                    className="intake-input"
                  />
                </div>
              </div>

              <div className="intake-field">
                <label htmlFor="purchasePrice" className="intake-label">
                  Harga Kulakan Satuan
                </label>

                <div className="intake-input-wrap">
                  <span className="intake-input-icon">
                    <Wallet size={17} />
                  </span>

                  <input
                    id="purchasePrice"
                    type="number"
                    min="1"
                    step="1"
                    value={item.purchasePrice}
                    onChange={(e) => update("purchasePrice", e.target.value)}
                    placeholder="Contoh: 5000"
                    required
                    className="intake-input"
                  />
                </div>
              </div>
            </div>

            <div className="intake-note">
              <div className="intake-note-icon">
                <Wallet size={17} />
              </div>

              <div>
                <strong>Perhatikan harga satuan</strong>
                <p>
                  Masukkan harga beli untuk satu unit barang, bukan total seluruh barang yang dibeli.
                </p>
              </div>
            </div>

            <div className="intake-form-actions">
              {editingIndex !== null && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="intake-btn intake-btn-secondary"
                >
                  <X size={17} />
                  Batal Edit
                </button>
              )}

              <button
                type="submit"
                disabled={!selectedProduct || checkedCode !== item.productCode.trim()}
                className="intake-btn intake-btn-primary"
              >
                {editingIndex !== null ? (
                  <>
                    <Save size={17} />
                    Perbarui Barang
                  </>
                ) : (
                  <>
                    <Plus size={18} />
                    Tambah ke Daftar
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        <section className="intake-card intake-list-card">
          <div className="intake-section-heading intake-list-heading">
            <div className="intake-section-icon">
              <Receipt size={20} />
            </div>

            <div>
              <h2>Daftar Kulakan</h2>
              <p>Periksa kembali barang sebelum disimpan.</p>
            </div>

            <span className="intake-count">
              <Package size={14} />
              {items.length} barang
            </span>
          </div>

          {items.length === 0 ? (
            <div className="intake-empty">
              <div className="intake-empty-icon">
                <PackageCheck size={31} strokeWidth={1.5} />
              </div>

              <h3>Belum ada barang kulakan</h3>
              <p>
                Barang yang berhasil dicek dan ditambahkan akan muncul di sini.
              </p>
            </div>
          ) : (
            <>
              <div className="intake-table-wrap">
                <table className="intake-table">
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Kode Barang</th>
                      <th>Nama Barang</th>
                      <th>Merek</th>
                      <th>Jumlah</th>
                      <th>Harga Satuan</th>
                      <th>Total</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.map((row, index) => (
                      <tr
                        key={`${row.productId}-${index}`}
                        className={
                          editingIndex === index ? "intake-row-editing" : ""
                        }
                      >
                        <td className="intake-date-cell">
                          {formatDate(row.date)}
                        </td>

                        <td>
                          <span className="intake-category">
                            {row.productCode}
                          </span>
                        </td>

                        <td className="intake-product-name">{row.name}</td>
                        <td>{row.brand || "—"}</td>

                        <td className="intake-quantity">
                          {Number(row.quantity).toLocaleString("id-ID")} pcs
                        </td>

                        <td className="intake-money">
                          {rupiah(Number(row.purchasePrice))}
                        </td>

                        <td className="intake-total">
                          {rupiah(
                            Number(row.quantity) * Number(row.purchasePrice)
                          )}
                        </td>

                        <td>
                          <div className="intake-row-actions">
                            <button
                              type="button"
                              className="intake-icon-btn intake-edit-btn"
                              onClick={() => editItem(index)}
                              disabled={saving}
                              title="Edit barang"
                            >
                              <Pencil size={15} />
                            </button>

                            <button
                              type="button"
                              className="intake-icon-btn intake-delete-btn"
                              onClick={() => removeItem(index)}
                              disabled={saving}
                              title="Hapus barang"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="intake-summary-grid">
                <div className="intake-summary">
                  <div className="intake-summary-icon">
                    <Boxes size={20} />
                  </div>

                  <div>
                    <p>Total Jumlah Barang</p>
                    <strong>
                      {totalQuantity.toLocaleString("id-ID")}
                      <small> unit</small>
                    </strong>
                  </div>
                </div>

                <div className="intake-summary intake-summary-value">
                  <div className="intake-summary-icon">
                    <Wallet size={20} />
                  </div>

                  <div>
                    <p>Total Nilai Kulakan</p>
                    <strong>{rupiah(totalValue)}</strong>
                  </div>
                </div>
              </div>

              <div className="intake-save-area">
                <div className="intake-save-info">
                  <div className="intake-save-info-icon">
                    <AlertCircle size={17} />
                  </div>

                  <p>
                    Setelah disimpan, data kulakan menunggu persetujuan harga admin sebelum stok dapat digunakan untuk transaksi.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={saveItems}
                  disabled={
                    items.length === 0 ||
                    saving ||
                    editingIndex !== null
                  }
                  className="intake-btn intake-btn-primary intake-save-btn"
                >
                  {saving ? (
                    <>
                      <LoaderCircle size={18} className="intake-spin" />
                      Menyimpan...
                    </>
                  ) : editingIndex !== null ? (
                    "Selesaikan Edit Dahulu"
                  ) : (
                    <>
                      <Save size={18} />
                      Simpan {items.length} Barang
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </section>

        <footer className="intake-footer">
          <span>TOKO ROSYIDAH</span>
          <span className="intake-footer-dot">·</span>
          Sistem Pengelolaan Kulakan & Persetujuan Harga
        </footer>
      </div>
    </main>
  );
}
