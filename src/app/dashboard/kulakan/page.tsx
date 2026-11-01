
"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase";
import {
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
  Boxes,
  Check,
  Scale,
  CreditCard,
  RefreshCw,
} from "lucide-react";

type PurchaseMode = "coded" | "loose";
type PaymentMethod = "cash" | "transfer" | "qris";

type Product = {
  id: string;
  product_code: string | null;
  name: string;
  brand: string;
  category_id: string;
  unit: string;
};

type IntakeItem = {
  mode: PurchaseMode;
  date: string;
  productId: string;
  productCode: string;
  name: string;
  brand: string;
  quantity: string;
  unit: string;
  purchasePrice: string;
  supplierName: string;
  paidAmount: string;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  note: string;
};

type PurchaseHistory = {
  id: string;
  mode: "coded" | "loose";
  purchase_date: string;
  product_name: string;
  product_code: string | null;
  brand: string;
  quantity: number;
  unit: string;
  purchase_price: number;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  payment_status: string;
  created_at: string;
};

const getTodayWIB = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  return `${year}-${month}-${day}`;
};

const emptyItem = (mode: PurchaseMode = "coded"): IntakeItem => ({
  mode,
  date: getTodayWIB(),
  productId: "",
  productCode: "",
  name: "",
  brand: "",
  quantity: "",
  unit: "",
  purchasePrice: "",
  supplierName: "",
  paidAmount: "0",
  paymentMethod: "cash",
  paymentDate: getTodayWIB(),
  note: "",
});

const rupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatDate = (value: string) =>
  new Date(`${value}T12:00:00+07:00`).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });

const lineTotal = (row: IntakeItem) =>
  Number(row.quantity || 0) * Number(row.purchasePrice || 0);

const paidValue = (row: IntakeItem) =>
  Number(row.paidAmount || 0);

const remainingValue = (row: IntakeItem) =>
  Math.max(0, lineTotal(row) - paidValue(row));

const paymentLabel = (row: IntakeItem) => {
  const paid = paidValue(row);
  const total = lineTotal(row);

  if (paid <= 0) return "Belum dibayar";
  if (paid >= total) return "Lunas";
  return "Dibayar sebagian";
};

function getHistoryStatusClass(status: string) {
  if (status === "Lunas") return "tag-paid";
  if (status === "Dibayar sebagian") return "tag-partial";
  return "tag-unpaid";
}

export default function KulakanPage() {
  const [supabase] = useState(() => createClient());

  const [products, setProducts] = useState<Product[]>([]);
  const [item, setItem] = useState<IntakeItem>(emptyItem());
  const [items, setItems] = useState<IntakeItem[]>([]);

  const [history, setHistory] = useState<PurchaseHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [checkedCode, setCheckedCode] = useState("");

  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // =========================================
  // LOAD MASTER PRODUK
  // =========================================

  const loadProducts = useCallback(async () => {
    setLoading(true);

    try {
      const { data, error: queryError } = await supabase
        .from("products")
        .select("id, product_code, name, brand, category_id, unit")
        .not("product_code", "is", null)
        .order("name");

      if (queryError) throw queryError;

      setProducts((data || []) as Product[]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal mengambil data barang."
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // =========================================
  // LOAD RIWAYAT KULAKAN TERSIMPAN
  // =========================================

  const loadHistory = useCallback(async () => {
  setHistoryLoading(true);

  try {
    const { data, error: rpcError } = await supabase.rpc(
      "get_purchase_intake_history"
    );

    if (rpcError) {
      console.error("RIWAYAT KULAKAN ERROR:", rpcError);
      throw rpcError;
    }

    setHistory((data || []) as PurchaseHistory[]);
    console.log("RIWAYAT KULAKAN BERHASIL:", data);
  } catch (err: unknown) {
    console.error("GAGAL MEMUAT RIWAYAT:", err);

    const detail =
      typeof err === "object" && err !== null && "message" in err
        ? String(err.message)
        : String(err);

    setError(`Gagal memuat riwayat kulakan: ${detail}`);
  } finally {
    setHistoryLoading(false);
  }
}, [supabase]);

  // =========================================
  // LOAD DATA SAAT HALAMAN DIBUKA
  // =========================================

  useEffect(() => {
    void loadProducts();
    void loadHistory();
  }, [loadProducts, loadHistory]);

  // =========================================
  // UPDATE FORM
  // =========================================

  function update(field: keyof IntakeItem, value: string) {
    setItem((old) => {
      if (field === "productCode") {
        return {
          ...old,
          productCode: value,
          productId: "",
          name: "",
          brand: "",
          unit: "",
        };
      }

      return {
        ...old,
        [field]: value,
      };
    });

    if (field === "productCode") {
      setSelectedProduct(null);
      setCheckedCode("");
    }

    setError("");
    setMessage("");
  }

  function changeMode(mode: PurchaseMode) {
    if (editingIndex !== null) {
      setError("Selesaikan atau batalkan proses edit terlebih dahulu.");
      return;
    }

    setItem(emptyItem(mode));
    setSelectedProduct(null);
    setCheckedCode("");
    setError("");
    setMessage("");
  }

  // =========================================
  // CEK BARCODE
  // =========================================

  async function checkProduct() {
    const code = item.productCode.trim();

    if (!code) {
      setError("Masukkan kode barang terlebih dahulu.");
      return;
    }

    setChecking(true);
    setError("");
    setMessage("");
    setSelectedProduct(null);
    setCheckedCode("");

    try {
      const { data, error: queryError } = await supabase
        .from("products")
        .select("id, product_code, name, brand, category_id, unit")
        .eq("product_code", code)
        .maybeSingle();

      if (queryError) throw queryError;

      if (!data) {
        throw new Error(
          `Kode barang "${code}" tidak ditemukan di master produk.`
        );
      }

      const product = data as Product;

      setSelectedProduct(product);
      setCheckedCode(product.product_code || "");

      setItem((old) => ({
        ...old,
        productId: product.id,
        productCode: product.product_code || "",
        name: product.name,
        brand: product.brand || "",
        unit: product.unit || "pcs",
      }));

      setMessage(
        "Barang ditemukan. Lengkapi jumlah, harga kulakan, dan pembayarannya."
      );
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

  // =========================================
  // TOTAL DAFTAR SEMENTARA
  // =========================================

  const totalValue = items.reduce(
    (sum, row) => sum + lineTotal(row),
    0
  );

  const totalPaid = items.reduce(
    (sum, row) => sum + paidValue(row),
    0
  );

  const totalRemaining = items.reduce(
    (sum, row) => sum + remainingValue(row),
    0
  );

  // =========================================
  // TAMBAH KE DAFTAR SEMENTARA
  // =========================================

  function addItem(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");
    setMessage("");

    const quantity = Number(item.quantity);
    const price = Number(item.purchasePrice);
    const paid = Number(item.paidAmount || 0);
    const total = quantity * price;

    if (!item.date) {
      setError("Tanggal kulakan wajib diisi.");
      return;
    }

    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      (item.mode === "coded" && !Number.isInteger(quantity))
    ) {
      setError(
        item.mode === "coded"
          ? "Jumlah barang berkode harus berupa bilangan bulat positif."
          : "Jumlah kulakan curah harus lebih dari nol."
      );
      return;
    }

    if (
      !Number.isFinite(price) ||
      price <= 0 ||
      !Number.isInteger(price)
    ) {
      setError("Harga kulakan harus berupa nominal rupiah positif.");
      return;
    }

    if (
      !Number.isFinite(paid) ||
      paid < 0 ||
      !Number.isInteger(paid) ||
      paid > total
    ) {
      setError(
        "Nominal yang dibayar harus berupa rupiah positif atau nol, dan tidak boleh melebihi total kulakan."
      );
      return;
    }

    if (item.mode === "coded") {
      if (
        !selectedProduct ||
        checkedCode !== item.productCode.trim() ||
        selectedProduct.id !== item.productId
      ) {
        setError("Periksa kode barang terlebih dahulu.");
        return;
      }
    } else {
      if (!item.name.trim()) {
        setError("Nama barang curah wajib diisi.");
        return;
      }

      if (!item.unit.trim()) {
        setError("Satuan barang wajib diisi, misalnya kg atau sak.");
        return;
      }
    }

    if (paid > 0 && !item.paymentDate) {
      setError("Tanggal pembayaran wajib diisi.");
      return;
    }

    const newRow = { ...item };

    if (editingIndex !== null) {
      setItems((old) =>
        old.map((row, index) =>
          index === editingIndex ? newRow : row
        )
      );

      setEditingIndex(null);
      setMessage("Data kulakan berhasil diperbarui dalam daftar.");
    } else {
      setItems((old) => [...old, newRow]);
      setMessage("Kulakan berhasil ditambahkan ke daftar.");
    }

    setItem(emptyItem(item.mode));
    setSelectedProduct(null);
    setCheckedCode("");
  }

  // =========================================
  // EDIT DAFTAR SEMENTARA
  // =========================================

  function editItem(index: number) {
    const row = items[index];

    setItem({ ...row });

    if (row.mode === "coded") {
      const product = products.find((p) => p.id === row.productId);
      setSelectedProduct(product || null);
      setCheckedCode(product?.product_code || "");
    } else {
      setSelectedProduct(null);
      setCheckedCode("");
    }

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

  // =========================================
  // SIMPAN KULAKAN
  // =========================================

  async function saveItems() {
    if (!items.length || saving || editingIndex !== null) return;

    setSaving(true);
    setError("");
    setMessage("");

    let savedCount = 0;

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        throw new Error("Sesi login berakhir. Silakan login kembali.");
      }

      for (const row of items) {
        const paid = paidValue(row);

        if (row.mode === "coded") {
          const product = products.find(
            (p) => p.id === row.productId
          );

          if (!product) {
            throw new Error(
              `Produk "${row.name}" tidak ditemukan lagi. Muat ulang halaman.`
            );
          }

          const { data, error: rpcError } = await supabase.rpc(
            "create_coded_purchase_intake",
            {
              p_product_id: row.productId,
              p_purchase_date: row.date,
              p_quantity: Number(row.quantity),
              p_purchase_price: Number(row.purchasePrice),
              p_paid_amount: paid,
              p_payment_method: paid > 0 ? row.paymentMethod : null,
              p_payment_date: paid > 0 ? row.paymentDate : null,
              p_supplier_name: row.supplierName.trim() || null,
              p_note: row.note.trim() || null,
            }
          );

          if (rpcError) {
            throw new Error(
              `Kulakan "${row.name}" gagal disimpan: ${rpcError.message}`
            );
          }

          if (!data?.success || !data?.intake_id) {
            throw new Error(
              `Respons penyimpanan kulakan "${row.name}" tidak valid.`
            );
          }

          savedCount += 1;

          // Notifikasi untuk persetujuan harga barang berkode
          const { error: notificationError } = await supabase
            .from("notifications")
            .insert({
              recipient_role: "admin",
              title: "Kulakan baru menunggu persetujuan",
              message:
                `${row.name} - ${row.brand || "Tanpa merek"}, ` +
                `kode ${row.productCode}, jumlah ${row.quantity} ${row.unit}. ` +
                `Harga jual perlu ditetapkan.`,
              related_intake_id: data.intake_id,
              is_read: false,
            });

          if (notificationError) {
            throw new Error(
              `Kulakan "${row.name}" sudah tersimpan, tetapi notifikasi admin gagal: ${notificationError.message}`
            );
          }
        } else {
          const { data, error: rpcError } = await supabase.rpc(
            "create_loose_purchase_intake",
            {
              p_purchase_date: row.date,
              p_product_name: row.name.trim(),
              p_quantity: Number(row.quantity),
              p_unit: row.unit.trim(),
              p_purchase_price: Number(row.purchasePrice),
              p_supplier_name: row.supplierName.trim() || null,
              p_paid_amount: paid,
              p_payment_method: paid > 0 ? row.paymentMethod : null,
              p_payment_date: paid > 0 ? row.paymentDate : null,
              p_note: row.note.trim() || null,
            }
          );

          if (rpcError) {
            throw new Error(
              `Kulakan curah "${row.name}" gagal disimpan: ${rpcError.message}`
            );
          }

          if (!data?.success || !data?.intake_id) {
            throw new Error(
              `Respons penyimpanan kulakan curah "${row.name}" tidak valid.`
            );
          }

          savedCount += 1;
        }
      }

      setItems([]);
      setItem(emptyItem());
      setSelectedProduct(null);
      setCheckedCode("");
      setEditingIndex(null);

      setMessage(
        `${savedCount} data kulakan berhasil disimpan. Pembayaran aktual telah dicatat sesuai metode dan tanggal yang dipilih.`
      );

      // Muat ulang riwayat permanen setelah penyimpanan
      await loadHistory();
    } catch (err) {
      setError(
        `${
          err instanceof Error
            ? err.message
            : "Gagal menyimpan data kulakan."
        }${
          savedCount > 0
            ? ` ${savedCount} baris sudah tersimpan sebelum proses terhenti. Periksa riwayat dan pembayaran sebelum mencoba lagi agar tidak terjadi duplikasi.`
            : ""
        }`
      );

      // Tetap muat riwayat untuk menampilkan baris yang mungkin sudah berhasil
      await loadHistory();
    } finally {
      setSaving(false);
    }
  }

  // =========================================
  // LOADING AWAL
  // =========================================

  if (loading) {
    return (
      <main className="intake-loading">
        <LoaderCircle size={26} className="spin" />
        <p>Menyiapkan data kulakan...</p>
      </main>
    );
  }

  const currentTotal =
    Number(item.quantity || 0) * Number(item.purchasePrice || 0);

  const currentPaid = Number(item.paidAmount || 0);

  const currentRemaining = Math.max(
    0,
    currentTotal - currentPaid
  );

  // =========================================
  // TAMPILAN
  // =========================================

  return (
    <main className="intake-page">
      <style jsx>{`
        .intake-page {
          --green: #174b36;
          --green-dark: #103a2a;
          --green-soft: #edf4ef;
          --gold: #b99a62;
          --ink: #26352c;
          --muted: #849087;
          --line: #e8ece6;
          width: 100%;
          min-height: 100vh;
          padding: 26px 28px 34px;
          box-sizing: border-box;
          background: #f8f8f4;
          color: var(--ink);
          font-family: var(--font-dm-sans), sans-serif;
        }

        .container {
          display: grid;
          gap: 20px;
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
        }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          min-height: 135px;
          padding: 27px 30px;
          border: 1px solid #e5e9e1;
          border-radius: 20px;
          background:
            radial-gradient(circle at 92% 10%, rgba(185,154,98,.13), transparent 28%),
            linear-gradient(115deg, #fff, #f5f8f3);
        }

        .heading {
          display: flex;
          align-items: center;
          gap: 16px;
          min-width: 0;
        }

        .heading-icon,
        .section-icon {
          display: grid;
          flex-shrink: 0;
          place-items: center;
          border: 1px solid #dce8de;
          border-radius: 14px;
          background: var(--green-soft);
          color: var(--green);
        }

        .heading-icon {
          width: 54px;
          height: 54px;
        }

        .eyebrow {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 7px;
          color: var(--gold);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 2px;
        }

        h1 {
          margin: 0;
          color: var(--green-dark);
          font-family: var(--font-manrope), sans-serif;
          font-size: 32px;
          font-weight: 800;
          letter-spacing: -1px;
        }

        .header p,
        .section-heading p {
          margin: 7px 0 0;
          color: var(--muted);
          font-size: 11px;
          line-height: 1.8;
        }

        .header-tag {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 11px 14px;
          border: 1px solid #dce8de;
          border-radius: 10px;
          background: white;
          color: var(--green);
          font-size: 10px;
          font-weight: 800;
          white-space: nowrap;
        }

        .alert {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px 16px;
          border-radius: 11px;
          font-size: 11px;
          line-height: 1.7;
        }

        .alert strong {
          display: block;
          margin-bottom: 3px;
        }

        .alert p {
          margin: 0;
          overflow-wrap: anywhere;
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

        .alert-close {
          display: grid;
          flex-shrink: 0;
          place-items: center;
          width: 28px;
          height: 28px;
          border: 0;
          border-radius: 7px;
          background: transparent;
          color: inherit;
          cursor: pointer;
        }

        .card {
          min-width: 0;
          padding: 26px 28px;
          border: 1px solid var(--line);
          border-radius: 17px;
          background: white;
          box-shadow: 0 5px 20px rgba(24,55,37,.035);
        }

        .section-heading {
          display: flex;
          align-items: flex-start;
          gap: 13px;
          margin-bottom: 23px;
        }

        .section-icon {
          width: 43px;
          height: 43px;
          border-radius: 12px;
        }

        .section-heading > div:nth-child(2) {
          flex: 1;
          min-width: 0;
        }

        h2 {
          margin: 1px 0 0;
          color: var(--green-dark);
          font-family: var(--font-manrope), sans-serif;
          font-size: 17px;
          font-weight: 800;
        }

        .step {
          padding: 7px 10px;
          border: 1px solid #e8dfca;
          border-radius: 8px;
          background: #fbf8f0;
          color: #927545;
          font-size: 9px;
          font-weight: 800;
          white-space: nowrap;
        }

        .mode-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 23px;
        }

        .mode-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          min-height: 48px;
          padding: 10px;
          border: 1px solid #e2e8e1;
          border-radius: 11px;
          background: #fff;
          color: #718075;
          font-family: inherit;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
        }

        .mode-button.active {
          border-color: #b9cdbd;
          background: #edf4ef;
          color: var(--green);
        }

        .field-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
          margin-top: 19px;
        }

        .field {
          min-width: 0;
        }

        .field.full {
          grid-column: 1 / -1;
        }

        label {
          display: block;
          margin-bottom: 8px;
          color: #526157;
          font-size: 10px;
          font-weight: 800;
        }

        .input-wrap {
          position: relative;
          display: flex;
          align-items: center;
          min-width: 0;
        }

        .input-icon {
          position: absolute;
          left: 13px;
          display: flex;
          color: #8a988d;
          pointer-events: none;
        }

        .input,
        .select,
        .textarea {
          display: block;
          width: 100%;
          min-width: 0;
          min-height: 45px;
          box-sizing: border-box;
          padding: 0 13px;
          border: 1px solid #e2e8e1;
          border-radius: 9px;
          outline: none;
          background: #fff;
          color: #304136;
          font-family: inherit;
          font-size: 11px;
        }

        .input.with-icon {
          padding-left: 41px;
        }

        .input:focus,
        .select:focus,
        .textarea:focus {
          border-color: #789b83;
          box-shadow: 0 0 0 3px rgba(45,105,68,.08);
        }

        .textarea {
          min-height: 76px;
          padding: 11px 13px;
          resize: vertical;
        }

        .hint {
          margin: 8px 0 0;
          color: #9aa39b;
          font-size: 10px;
          line-height: 1.7;
        }

        .code-row {
          display: flex;
          gap: 10px;
        }

        .code-row .input-wrap {
          flex: 1;
        }

        .button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 43px;
          padding: 0 16px;
          border: 0;
          border-radius: 9px;
          font-family: inherit;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
          transition: .18s ease;
          white-space: nowrap;
        }

        .button-primary {
          background: linear-gradient(135deg, #205a3e, #123d2b);
          color: #fff;
        }

        .button-primary:hover:not(:disabled) {
          background: #0e3525;
          transform: translateY(-1px);
        }

        .button-secondary {
          border: 1px solid #dce7dd;
          background: #f0f5f0;
          color: var(--green);
        }

        .button:disabled {
          opacity: .48;
          cursor: not-allowed;
          transform: none;
        }

        .product-preview {
          display: flex;
          align-items: center;
          gap: 13px;
          margin-top: 17px;
          padding: 17px;
          border: 1px solid #dcebdd;
          border-radius: 12px;
          background: #f7faf6;
        }

        .product-preview-icon {
          display: grid;
          flex-shrink: 0;
          place-items: center;
          width: 43px;
          height: 43px;
          border-radius: 11px;
          background: #edf6ed;
          color: #477b51;
        }

        .product-preview-info {
          flex: 1;
          min-width: 0;
        }

        .found {
          display: flex;
          align-items: center;
          gap: 5px;
          color: #3e754b;
          font-size: 9px;
          font-weight: 800;
        }

        .product-preview h3 {
          margin: 4px 0 0;
          color: var(--green-dark);
          font-size: 14px;
        }

        .product-preview p {
          margin: 3px 0 0;
          color: #89938a;
          font-size: 10px;
        }

        .product-code {
          padding: 7px 9px;
          border: 1px solid #e3e9df;
          border-radius: 7px;
          background: white;
          color: #718075;
          font-size: 10px;
          font-weight: 800;
        }

        .payment-box {
          margin-top: 22px;
          padding: 19px;
          border: 1px solid #e6ebe3;
          border-radius: 12px;
          background: #fafcf9;
        }

        .payment-heading {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-bottom: 15px;
          color: var(--green);
          font-size: 12px;
          font-weight: 800;
        }

        .payment-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 13px;
        }

        .calculation {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          gap: 10px;
          margin-top: 16px;
          padding-top: 13px;
          border-top: 1px solid #e7ece5;
          color: #6d7d70;
          font-size: 10px;
        }

        .calculation strong {
          color: var(--green);
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 22px;
          padding-top: 18px;
          border-top: 1px solid #edf0eb;
        }

        .empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 42px 20px;
          border: 1px dashed #dce5dc;
          border-radius: 12px;
          background: #fafbf9;
          text-align: center;
        }

        .empty-icon {
          display: grid;
          place-items: center;
          width: 55px;
          height: 55px;
          margin-bottom: 13px;
          border-radius: 15px;
          background: #edf4ef;
          color: #64836c;
        }

        .empty h3 {
          margin: 0 0 7px;
          color: #42594a;
          font-size: 13px;
        }

        .empty p {
          max-width: 350px;
          margin: 0;
          color: #8a958b;
          font-size: 10px;
          line-height: 1.8;
        }

        .table-wrap {
          width: 100%;
          overflow-x: auto;
          border: 1px solid #e8ece6;
          border-radius: 11px;
        }

        table {
          width: 100%;
          min-width: 1050px;
          border-collapse: collapse;
          background: white;
          text-align: left;
        }

        th {
          padding: 13px 11px;
          border-bottom: 1px solid #e5ebe3;
          background: #f2f6f1;
          color: #607365;
          font-size: 9px;
          font-weight: 800;
          white-space: nowrap;
        }

        td {
          padding: 13px 11px;
          border-bottom: 1px solid #edf0eb;
          color: #68776b;
          font-size: 10px;
          white-space: nowrap;
        }

        tbody tr:last-child td {
          border-bottom: 0;
        }

        .strong {
          color: #304136;
          font-weight: 800;
        }

        .money {
          color: var(--green);
          font-weight: 800;
        }

        .tag {
          display: inline-flex;
          padding: 5px 8px;
          border: 1px solid #e3e9df;
          border-radius: 6px;
          background: #f4f7f2;
          color: var(--green);
          font-size: 9px;
          font-weight: 800;
        }

        .tag-loose {
          border-color: #e8dfca;
          background: #fbf8f0;
          color: #927545;
        }

        .tag-paid {
          color: #347548;
          background: #edf7ee;
          border-color: #dcebdd;
        }

        .tag-partial {
          color: #98713a;
          background: #fbf7ed;
          border-color: #eee2c5;
        }

        .tag-unpaid {
          color: #a64d45;
          background: #fff5f3;
          border-color: #f0d9d5;
        }

        .row-actions {
          display: flex;
          gap: 6px;
        }

        .icon-button {
          display: grid;
          place-items: center;
          width: 30px;
          height: 30px;
          border-radius: 7px;
          cursor: pointer;
        }

        .edit {
          border: 1px solid #e8dfca;
          background: #fbf8f0;
          color: #9a8150;
        }

        .delete {
          border: 1px solid #f0deda;
          background: #fff5f3;
          color: #ae5148;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-top: 17px;
        }

        .summary {
          padding: 16px;
          border: 1px solid #e5ebe3;
          border-radius: 11px;
          background: #fafcf9;
        }

        .summary span {
          display: block;
          color: #849087;
          font-size: 10px;
        }

        .summary strong {
          display: block;
          margin-top: 8px;
          color: var(--green-dark);
          font-size: 17px;
          overflow-wrap: anywhere;
        }

        .summary.outstanding {
          border-color: #e8dfca;
          background: #fbf9f3;
        }

        .summary.outstanding strong {
          color: #927545;
        }

        .save-area {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-top: 20px;
          padding-top: 18px;
          border-top: 1px solid #edf0eb;
        }

        .save-info {
          max-width: 650px;
          color: #8a958b;
          font-size: 10px;
          line-height: 1.8;
        }

        .history-subtext {
          margin-top: 4px;
          color: #89938a;
          font-size: 9px;
        }

        .history-empty {
          padding: 35px 15px;
          border: 1px dashed #dce5dc;
          border-radius: 12px;
          color: #849087;
          background: #fafbf9;
          font-size: 11px;
          text-align: center;
        }

        .history-footer {
          margin-top: 14px;
          color: #89938a;
          font-size: 10px;
        }

        .history-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .history-title-left {
          display: flex;
          align-items: flex-start;
          gap: 13px;
          min-width: 0;
        }

        .history-title-left > div:last-child {
          min-width: 0;
        }

        .loading {
          display: flex;
          min-height: 65vh;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 13px;
          background: #f8f8f4;
          color: var(--green);
          font-size: 12px;
        }

        .loading p {
          margin: 0;
          color: #849087;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 900px) {
          .field-grid,
          .payment-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .summary-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 600px) {
          .intake-page {
            padding: 18px 14px 25px;
          }

          .header {
            align-items: flex-start;
            flex-direction: column;
            padding: 22px 19px;
          }

          .heading {
            align-items: flex-start;
            gap: 12px;
          }

          .heading-icon {
            width: 45px;
            height: 45px;
          }

          h1 {
            font-size: 26px;
          }

          .card {
            padding: 20px 17px;
          }

          .section-heading {
            gap: 10px;
          }

          .step {
            display: none;
          }

          .mode-button {
            font-size: 10px;
          }

          .field-grid,
          .payment-grid {
            grid-template-columns: 1fr;
          }

          .code-row {
            flex-direction: column;
          }

          .code-row .button {
            width: 100%;
          }

          .product-preview {
            flex-wrap: wrap;
          }

          .product-code {
            margin-left: 56px;
          }

          .form-actions {
            flex-direction: column-reverse;
          }

          .form-actions .button {
            width: 100%;
          }

          .summary-grid {
            grid-template-columns: 1fr;
          }

          .save-area {
            align-items: stretch;
            flex-direction: column;
          }

          .save-area .button {
            width: 100%;
          }

          .history-title {
            align-items: flex-start;
          }
        }
      `}</style>

      <div className="container">
        {/* HEADER */}
        <header className="header">
          <div className="heading">
            <div className="heading-icon">
              <Package size={26} />
            </div>

            <div>
              <div className="eyebrow">
                <Sparkles size={12} />
                TOKO ROSYIDAH · SEBAUNG
              </div>

              <h1>Input Kulakan</h1>

              <p>
                Catat barang berkode maupun barang curah dan pembayarannya.
              </p>
            </div>
          </div>

          <div className="header-tag">
            <ShoppingBag size={15} />
            Pengadaan Barang
          </div>
        </header>

        {/* ALERT */}
        {(error || message) && (
          <div className={`alert ${error ? "alert-error" : "alert-success"}`}>
            {error ? <AlertCircle size={19} /> : <CheckCircle2 size={19} />}

            <div style={{ flex: 1, minWidth: 0 }}>
              <strong>{error ? "Perlu diperiksa" : "Berhasil"}</strong>
              <p>{error || message}</p>
            </div>

            <button
              type="button"
              className="alert-close"
              onClick={() => {
                setError("");
                setMessage("");
              }}
              aria-label="Tutup notifikasi"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* FORM KULAKAN */}
        <section className="card">
          <div className="section-heading">
            <div className="section-icon">
              <ClipboardList size={20} />
            </div>

            <div>
              <h2>Informasi Kulakan</h2>
              <p>Pilih jenis barang yang ingin dicatat.</p>
            </div>

            <span className="step">01 / INPUT</span>
          </div>

          <div className="mode-tabs">
            <button
              type="button"
              className={`mode-button ${item.mode === "coded" ? "active" : ""}`}
              onClick={() => changeMode("coded")}
            >
              <Hash size={17} />
              Barang Berkode
            </button>

            <button
              type="button"
              className={`mode-button ${item.mode === "loose" ? "active" : ""}`}
              onClick={() => changeMode("loose")}
            >
              <Scale size={17} />
              Barang Curah / Tanpa Kode
            </button>
          </div>

          <form onSubmit={addItem}>
            {item.mode === "coded" ? (
              <>
                <div className="field">
                  <label>Kode Barang</label>

                  <div className="code-row">
                    <div className="input-wrap">
                      <span className="input-icon">
                        <Hash size={16} />
                      </span>

                      <input
                        className="input with-icon"
                        type="text"
                        value={item.productCode}
                        onChange={(e) => update("productCode", e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void checkProduct();
                          }
                        }}
                        placeholder="Masukkan atau scan barcode"
                        autoComplete="off"
                      />
                    </div>

                    <button
                      type="button"
                      className="button button-primary"
                      onClick={() => void checkProduct()}
                      disabled={checking || !item.productCode.trim()}
                    >
                      {checking ? (
                        <LoaderCircle size={16} className="spin" />
                      ) : (
                        <Search size={16} />
                      )}

                      {checking ? "Mengecek..." : "Cek Barang"}
                    </button>
                  </div>

                  <p className="hint">
                    Barang harus sudah terdaftar di menu Barang & Stok.
                  </p>
                </div>

                {selectedProduct &&
                  checkedCode === item.productCode.trim() && (
                    <div className="product-preview">
                      <div className="product-preview-icon">
                        <PackageCheck size={22} />
                      </div>

                      <div className="product-preview-info">
                        <div className="found">
                          <Check size={12} />
                          Barang ditemukan
                        </div>

                        <h3>{selectedProduct.name}</h3>
                        <p>{selectedProduct.brand || "Tanpa merek"}</p>
                      </div>

                      <span className="product-code">
                        {selectedProduct.product_code}
                      </span>
                    </div>
                  )}
              </>
            ) : (
              <div className="field-grid">
                <div className="field full">
                  <label>Nama Barang Curah</label>

                  <input
                    className="input"
                    value={item.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="Contoh: Beras, Telur, Gula"
                    required
                  />

                  <p className="hint">
                    Barang curah hanya dicatat di riwayat kulakan dan tidak
                    otomatis dibuat menjadi produk atau stok.
                  </p>
                </div>

                <div className="field">
                  <label>Satuan Pembelian</label>

                  <input
                    className="input"
                    value={item.unit}
                    onChange={(e) => update("unit", e.target.value)}
                    placeholder="Contoh: kg, sak, karung"
                    required
                  />
                </div>
              </div>
            )}

            <div className="field-grid">
              <div className="field">
                <label>Tanggal Kulakan</label>

                <div className="input-wrap">
                  <span className="input-icon">
                    <CalendarDays size={16} />
                  </span>

                  <input
                    className="input with-icon"
                    type="date"
                    value={item.date}
                    onChange={(e) => update("date", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="field">
                <label>Jumlah Pembelian</label>

                <div className="input-wrap">
                  <span className="input-icon">
                    <Boxes size={16} />
                  </span>

                  <input
                    className="input with-icon"
                    type="number"
                    min="0.001"
                    step={item.mode === "coded" ? "1" : "0.001"}
                    value={item.quantity}
                    onChange={(e) => update("quantity", e.target.value)}
                    placeholder={
                      item.mode === "coded" ? "Contoh: 12" : "Contoh: 30"
                    }
                    required
                  />
                </div>
              </div>

              <div className="field">
                <label>
                  Harga Kulakan per{" "}
                  {item.mode === "coded"
                    ? "unit"
                    : item.unit || "satuan"}
                </label>

                <div className="input-wrap">
                  <span className="input-icon">
                    <Wallet size={16} />
                  </span>

                  <input
                    className="input with-icon"
                    type="number"
                    min="1"
                    step="1"
                    value={item.purchasePrice}
                    onChange={(e) => update("purchasePrice", e.target.value)}
                    placeholder="Contoh: 12000"
                    required
                  />
                </div>
              </div>

              <div className="field">
                <label>Nama Pemasok (opsional)</label>

                <input
                  className="input"
                  value={item.supplierName}
                  onChange={(e) => update("supplierName", e.target.value)}
                  placeholder="Nama pemasok"
                />
              </div>

              <div className="field full">
                <label>Catatan (opsional)</label>

                <textarea
                  className="textarea"
                  value={item.note}
                  onChange={(e) => update("note", e.target.value)}
                  placeholder="Catatan tambahan..."
                />
              </div>
            </div>

            {/* PEMBAYARAN */}
            <div className="payment-box">
              <div className="payment-heading">
                <CreditCard size={18} />
                Pembayaran Kulakan
              </div>

              <div className="payment-grid">
                <div className="field">
                  <label>Jumlah yang Dibayar</label>

                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="1"
                    value={item.paidAmount}
                    onChange={(e) => update("paidAmount", e.target.value)}
                    placeholder="0"
                  />

                  <p className="hint">
                    Isi 0 jika belum dibayar. Isi total jika langsung lunas.
                  </p>
                </div>

                <div className="field">
                  <label>Metode Pembayaran</label>

                  <select
                    className="select"
                    value={item.paymentMethod}
                    onChange={(e) =>
                      update("paymentMethod", e.target.value)
                    }
                    disabled={currentPaid <= 0}
                  >
                    <option value="cash">Tunai dari laci kasir</option>
                    <option value="transfer">Transfer</option>
                    <option value="qris">QRIS</option>
                  </select>
                </div>

                <div className="field">
                  <label>Tanggal Pembayaran</label>

                  <input
                    className="input"
                    type="date"
                    value={item.paymentDate}
                    onChange={(e) => update("paymentDate", e.target.value)}
                    disabled={currentPaid <= 0}
                  />
                </div>
              </div>

              <div className="calculation">
                <span>
                  Total kulakan: <strong>{rupiah(currentTotal)}</strong>
                </span>

                <span>
                  Sisa pembayaran: <strong>{rupiah(currentRemaining)}</strong>
                </span>

                {currentTotal > 0 && (
                  <span>
                    Status:{" "}
                    <strong>
                      {currentPaid <= 0
                        ? "Belum dibayar"
                        : currentPaid >= currentTotal
                        ? "Lunas"
                        : "Dibayar sebagian"}
                    </strong>
                  </span>
                )}
              </div>
            </div>

            <div className="form-actions">
              {editingIndex !== null && (
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={cancelEdit}
                >
                  <X size={16} />
                  Batal Edit
                </button>
              )}

              <button
                type="submit"
                className="button button-primary"
                disabled={
                  item.mode === "coded" &&
                  (!selectedProduct ||
                    checkedCode !== item.productCode.trim())
                }
              >
                {editingIndex !== null ? (
                  <>
                    <Save size={16} />
                    Perbarui Barang
                  </>
                ) : (
                  <>
                    <Plus size={17} />
                    Tambah ke Daftar
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* DAFTAR SEMENTARA */}
        <section className="card">
          <div className="section-heading">
            <div className="section-icon">
              <ClipboardList size={20} />
            </div>

            <div>
              <h2>Daftar Kulakan Sementara</h2>
              <p>Periksa barang dan pembayarannya sebelum disimpan.</p>
            </div>

            <span className="step">{items.length} BARIS</span>
          </div>

          {items.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">
                <PackageCheck size={29} />
              </div>

              <h3>Belum ada barang kulakan sementara</h3>

              <p>
                Barang yang ditambahkan melalui formulir akan muncul di sini
                sebelum disimpan.
              </p>
            </div>
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Jenis</th>
                      <th>Barang</th>
                      <th>Jumlah</th>
                      <th>Harga Satuan</th>
                      <th>Total</th>
                      <th>Dibayar</th>
                      <th>Sisa</th>
                      <th>Status</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.map((row, index) => (
                      <tr key={`${row.mode}-${index}`}>
                        <td>{formatDate(row.date)}</td>

                        <td>
                          <span
                            className={`tag ${
                              row.mode === "loose" ? "tag-loose" : ""
                            }`}
                          >
                            {row.mode === "coded" ? "Berkode" : "Curah"}
                          </span>
                        </td>

                        <td>
                          <span className="strong">{row.name}</span>
                          {row.mode === "coded" && (
                            <div className="history-subtext">
                              {row.productCode}
                            </div>
                          )}
                        </td>

                        <td>
                          {Number(row.quantity).toLocaleString("id-ID")}{" "}
                          {row.unit}
                        </td>

                        <td>{rupiah(Number(row.purchasePrice))}</td>

                        <td className="money">
                          {rupiah(lineTotal(row))}
                        </td>

                        <td>{rupiah(paidValue(row))}</td>

                        <td>{rupiah(remainingValue(row))}</td>

                        <td>
                          <span
                            className={`tag ${
                              paidValue(row) <= 0
                                ? "tag-unpaid"
                                : paidValue(row) >= lineTotal(row)
                                ? "tag-paid"
                                : "tag-partial"
                            }`}
                          >
                            {paymentLabel(row)}
                          </span>
                        </td>

                        <td>
                          <div className="row-actions">
                            <button
                              type="button"
                              className="icon-button edit"
                              onClick={() => editItem(index)}
                              disabled={saving}
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>

                            <button
                              type="button"
                              className="icon-button delete"
                              onClick={() => removeItem(index)}
                              disabled={saving}
                              title="Hapus"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="summary-grid">
                <div className="summary">
                  <span>Total Nilai Kulakan</span>
                  <strong>{rupiah(totalValue)}</strong>
                </div>

                <div className="summary">
                  <span>Total Sudah Dibayar</span>
                  <strong>{rupiah(totalPaid)}</strong>
                </div>

                <div className="summary outstanding">
                  <span>Total Belum Dibayar</span>
                  <strong>{rupiah(totalRemaining)}</strong>
                </div>
              </div>

              <div className="save-area">
                <div className="save-info">
                  <strong>Perhatian:</strong> Barang berkode akan menunggu
                  persetujuan harga admin. Barang curah hanya tersimpan sebagai
                  catatan kulakan dan tidak menambah master produk atau stok.
                  Pembayaran yang dicatat akan masuk ke rekap pembayaran
                  kulakan sesuai metode dan tanggalnya.
                </div>

                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => void saveItems()}
                  disabled={
                    saving ||
                    items.length === 0 ||
                    editingIndex !== null
                  }
                >
                  {saving ? (
                    <>
                      <LoaderCircle size={17} className="spin" />
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <Save size={17} />
                      Simpan {items.length} Kulakan
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </section>

        {/* RIWAYAT KULAKAN TERSIMPAN */}
        <section className="card">
          <div className="section-heading">
            <div className="section-icon">
              <Receipt size={20} />
            </div>

            <div>
              <h2>Riwayat Kulakan Tersimpan</h2>
              <p>
                Semua barang berkode dan curah yang sudah masuk ke database.
              </p>
            </div>

            <button
              type="button"
              className="button button-secondary"
              onClick={() => void loadHistory()}
              disabled={historyLoading}
            >
              {historyLoading ? (
                <LoaderCircle size={15} className="spin" />
              ) : (
                <RefreshCw size={15} />
              )}
              Perbarui
            </button>
          </div>

          {historyLoading && history.length === 0 ? (
            <div className="history-empty">
              <LoaderCircle size={20} className="spin" />
              <p>Memuat riwayat kulakan...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">
                <Package size={29} />
              </div>

              <h3>Belum ada riwayat kulakan</h3>

              <p>
                Kulakan yang berhasil disimpan akan muncul di sini secara
                otomatis.
              </p>
            </div>
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Jenis</th>
                      <th>Nama Barang</th>
                      <th>Jumlah</th>
                      <th>Harga Satuan</th>
                      <th>Total</th>
                      <th>Dibayar</th>
                      <th>Sisa</th>
                      <th>Status Pembayaran</th>
                    </tr>
                  </thead>

                  <tbody>
                    {history.map((row) => (
                      <tr key={`${row.mode}-${row.id}`}>
                        <td>{formatDate(row.purchase_date)}</td>

                        <td>
                          <span
                            className={`tag ${
                              row.mode === "loose" ? "tag-loose" : ""
                            }`}
                          >
                            {row.mode === "loose" ? "Curah" : "Berkode"}
                          </span>
                        </td>

                        <td>
                          <span className="strong">
                            {row.product_name}
                          </span>

                          {row.mode === "coded" && row.product_code && (
                            <div className="history-subtext">
                              Kode: {row.product_code}
                            </div>
                          )}

                          {row.brand && (
                            <div className="history-subtext">
                              {row.brand}
                            </div>
                          )}
                        </td>

                        <td>
                          {Number(row.quantity).toLocaleString("id-ID")}{" "}
                          {row.unit}
                        </td>

                        <td>{rupiah(Number(row.purchase_price))}</td>

                        <td className="money">
                          {rupiah(Number(row.total_amount))}
                        </td>

                        <td>{rupiah(Number(row.paid_amount))}</td>

                        <td>
                          {rupiah(Number(row.remaining_amount))}
                        </td>

                        <td>
                          <span
                            className={`tag ${getHistoryStatusClass(
                              row.payment_status
                            )}`}
                          >
                            {row.payment_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="history-footer">
                Menampilkan {history.length} data kulakan tersimpan.
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
