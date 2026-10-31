
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
      <div className="intake-container">
        <a href="/dashboard" className="intake-back">
          <ArrowLeft size={16} />
          <span>Kembali ke Dashboard</span>
        </a>

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
