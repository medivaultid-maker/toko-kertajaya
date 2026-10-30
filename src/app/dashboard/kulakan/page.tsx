
"use client";

import { useEffect, useState, type FormEvent, type CSSProperties } from "react";
import { createClient } from "@/lib/supabase";

type Category = { id: string; name: string };

type Product = {
  id: string;
  name: string;
  brand: string;
  category_id: string;
};

type IntakeItem = {
  date: string;
  category: string;
  name: string;
  brand: string;
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
  category: "",
  name: "",
  brand: "",
  quantity: "",
  purchasePrice: "",
});

const rupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

const normalize = (value: string) => value.trim().toLocaleLowerCase("id-ID");

export default function KulakanPage() {
  const [supabase] = useState(() => createClient());

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [item, setItem] = useState<IntakeItem>(emptyItem);
  const [items, setItems] = useState<IntakeItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [categoryResult, productResult] = await Promise.all([
        supabase.from("categories").select("id, name").order("name"),
        supabase
          .from("products")
          .select("id, name, brand, category_id")
          .order("name"),
      ]);

      if (categoryResult.error) throw categoryResult.error;
      if (productResult.error) throw productResult.error;

      setCategories(categoryResult.data || []);
      setProducts(productResult.data || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal mengambil data."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  function update(field: keyof IntakeItem, value: string) {
    setItem((old) => {
      const next = { ...old, [field]: value };

      if (field === "category") {
        const oldProduct = products.find(
          (p) =>
            normalize(p.name) === normalize(old.name) &&
            normalize(p.brand) === normalize(old.brand)
        );
        const newCategory = categories.find(
          (c) => normalize(c.name) === normalize(value)
        );

        if (
          oldProduct &&
          newCategory &&
          oldProduct.category_id !== newCategory.id
        ) {
          next.name = "";
          next.brand = "";
        }
      }

      if (field === "name") {
        const matching = products.find(
          (p) =>
            normalize(p.name) === normalize(value) &&
            (!next.category ||
              categories.find((c) => c.id === p.category_id)?.name ===
                next.category)
        );

        if (matching) next.brand = matching.brand;
      }

      return next;
    });

    setError("");
    setMessage("");
  }

  const categoryOptions = categories.map((c) => c.name);

  const productOptions = [
    ...new Set(
      products
        .filter(
          (p) =>
            !item.category ||
            categories.find((c) => c.id === p.category_id)?.name ===
              item.category
        )
        .map((p) => p.name)
    ),
  ];

  const brandOptions = [
    ...new Set(
      products
        .filter(
          (p) =>
            (!item.name || normalize(p.name) === normalize(item.name)) &&
            (!item.category ||
              categories.find((c) => c.id === p.category_id)?.name ===
                item.category)
        )
        .map((p) => p.brand)
        .filter(Boolean)
    ),
  ];

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
      !item.date ||
      !item.category.trim() ||
      !item.name.trim() ||
      !item.brand.trim() ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !Number.isInteger(quantity) ||
      !Number.isFinite(price) ||
      price <= 0
    ) {
      setError(
        "Lengkapi semua data. Jumlah harus bilangan bulat positif dan harga harus lebih dari nol."
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
      setMessage("Barang berhasil diperbarui dalam daftar.");
    } else {
      setItems((old) => [...old, { ...item }]);
      setMessage("Barang ditambahkan ke daftar kulakan.");
    }

    setItem((old) => ({ ...emptyItem(), date: old.date }));
  }

  function editItem(index: number) {
    setItem({ ...items[index] });
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
    } else if (editingIndex !== null && editingIndex > index) {
      setEditingIndex(editingIndex - 1);
    }

    setMessage("Barang dihapus dari daftar sementara.");
    setError("");
  }

  function cancelEdit() {
    setEditingIndex(null);
    setItem(emptyItem());
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

      // Cache lokal mencegah pembuatan kategori/produk berulang
      // untuk nama yang sama dalam satu proses penyimpanan.
      const categoryCache = [...categories];
      const productCache = [...products];

      for (const row of items) {
        let category = categoryCache.find(
          (c) => normalize(c.name) === normalize(row.category)
        );

        if (!category) {
          const { data, error } = await supabase
            .from("categories")
            .insert({ name: row.category.trim() })
            .select("id, name")
            .single();

          if (error) throw new Error(`Kategori: ${error.message}`);

          category = data;
          categoryCache.push(data);
        }

        let product = productCache.find(
          (p) =>
            normalize(p.name) === normalize(row.name) &&
            normalize(p.brand) === normalize(row.brand)
        );

        if (product && product.category_id !== category.id) {
          throw new Error(
            `Barang "${row.name}" dengan merek "${row.brand}" sudah terdaftar pada kategori lain. Periksa data barang sebelum menyimpan.`
          );
        }

        if (!product) {
          const { data, error } = await supabase
            .from("products")
            .insert({
              category_id: category.id,
              name: row.name.trim(),
              brand: row.brand.trim(),
              unit: "pcs",
              min_stock: 0,
              current_purchase_cost: null,
              current_profit_percent: null,
              current_selling_price: null,
              price_status: "pending_price",
              is_active: true,
              stock_quantity: 0,
            })
            .select("id, name, brand, category_id")
            .single();

          if (error) throw new Error(`Barang: ${error.message}`);

          product = data;
          productCache.push(data);
        }

        // Simpan kulakan sebagai menunggu persetujuan harga.
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
            message: `${row.name} - ${row.brand}, jumlah ${row.quantity}. Harga jual perlu ditetapkan.`,
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
      setEditingIndex(null);

      setMessage(
        `${savedCount} data kulakan berhasil disimpan. Barang menunggu persetujuan harga admin sebelum menambah stok yang dapat dijual.`
      );

      await loadData();
    } catch (err) {
      setError(
        `${err instanceof Error ? err.message : "Gagal menyimpan data kulakan."}${
          savedCount > 0
            ? ` ${savedCount} baris telah tersimpan sebelum proses terhenti. Periksa data kulakan di database sebelum mencoba lagi agar tidak terjadi duplikasi.`
            : ""
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: CSSProperties = {
    width: "100%",
    minWidth: 0,
    padding: "12px 14px",
    border: "1px solid #dce5de",
    borderRadius: 10,
    background: "#fff",
    color: "#20352a",
    fontSize: 14,
    outlineColor: "#28734f",
    boxSizing: "border-box",
  };

  const labelStyle: CSSProperties = {
    display: "block",
    fontSize: 13,
    fontWeight: 650,
    color: "#33483b",
    marginBottom: 7,
  };

  const cardStyle: CSSProperties = {
    background: "#fff",
    border: "1px solid #e5ebe6",
    borderRadius: 16,
    padding: 22,
    boxShadow: "0 4px 18px rgba(30, 65, 43, 0.035)",
  };

  const primaryButton: CSSProperties = {
    padding: "12px 18px",
    border: 0,
    borderRadius: 10,
    background: "#176b45",
    color: "#fff",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  };

  function field(
    label: string,
    key: keyof IntakeItem,
    type = "text",
    options?: string[],
    placeholder?: string
  ) {
    const listId = `options-${key}`;

    return (
      <div key={key} style={{ minWidth: 0 }}>
        <label htmlFor={key} style={labelStyle}>
          {label}
        </label>
        <input
          id={key}
          type={type}
          list={options ? listId : undefined}
          value={item[key]}
          onChange={(e) => update(key, e.target.value)}
          placeholder={placeholder || `Masukkan ${label.toLowerCase()}`}
          min={type === "number" ? "0.01" : undefined}
          step={
            key === "quantity"
              ? "1"
              : type === "number"
                ? "any"
                : undefined
          }
          required
          style={inputStyle}
        />
        {options && (
          <datalist id={listId}>
            {[...new Set(options)].map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          padding: 32,
          background: "#f5f8f5",
          color: "#405347",
        }}
      >
        Memuat data kulakan...
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f8f5",
        padding: "24px clamp(14px, 3vw, 36px) 48px",
        color: "#23382b",
        fontFamily: "inherit",
      }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <a
          href="/dashboard"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            color: "#176b45",
            fontSize: 14,
            fontWeight: 650,
            textDecoration: "none",
            marginBottom: 24,
          }}
        >
          ← Kembali ke Dashboard
        </a>

        <header style={{ marginBottom: 26 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                flexShrink: 0,
                display: "grid",
                placeItems: "center",
                borderRadius: 14,
                background: "#e1f1e6",
                fontSize: 24,
              }}
            >
              📦
            </div>
            <div>
              <p
                style={{
                  margin: "0 0 4px",
                  fontSize: 12,
                  fontWeight: 750,
                  letterSpacing: 1.2,
                  color: "#47815f",
                  textTransform: "uppercase",
                }}
              >
                TOKO ROSYIDAH · PASAR SEBAUNG
              </p>
              <h1
                style={{
                  margin: 0,
                  fontSize: "clamp(25px, 3vw, 32px)",
                  letterSpacing: -0.7,
                }}
              >
                Input Kulakan
              </h1>
            </div>
          </div>
          <p
            style={{
              margin: 0,
              color: "#718076",
              fontSize: 14,
              lineHeight: 1.7,
            }}
          >
            Catat barang yang baru dibeli dari pemasok. Harga jual ditetapkan
            oleh admin setelah data kulakan disimpan.
          </p>
        </header>

        {error && (
          <div
            role="alert"
            style={{
              marginBottom: 18,
              padding: 15,
              borderRadius: 12,
              background: "#fff0ee",
              border: "1px solid #ffd4cf",
              color: "#a52c21",
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            <strong>Perlu diperiksa</strong>
            <div>{error}</div>
          </div>
        )}

        {message && (
          <div
            role="status"
            style={{
              marginBottom: 18,
              padding: 15,
              borderRadius: 12,
              background: "#eaf6ed",
              border: "1px solid #cce8d2",
              color: "#21683e",
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            {message}
          </div>
        )}

        <section style={cardStyle}>
          <div style={{ marginBottom: 22 }}>
            <h2 style={{ margin: "0 0 6px", fontSize: 19 }}>
              Informasi barang
            </h2>
            <p style={{ margin: 0, color: "#77847a", fontSize: 13 }}>
              Isi detail kulakan, lalu tambahkan ke daftar sebelum menyimpan.
            </p>
          </div>

          <form onSubmit={addItem}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))",
                gap: 18,
              }}
            >
              {field("Tanggal kulakan", "date", "date")}
              {field("Kategori", "category", "text", categoryOptions)}
              {field("Nama barang", "name", "text", productOptions)}
              {field("Merek", "brand", "text", brandOptions)}
              {field("Jumlah barang", "quantity", "number", undefined, "Contoh: 12")}
              {field(
                "Harga kulakan satuan (Rp)",
                "purchasePrice",
                "number",
                undefined,
                "Contoh: 5.000"
              )}
            </div>

            <div
              style={{
                marginTop: 20,
                padding: 13,
                background: "#f3f8f4",
                borderRadius: 10,
                color: "#5e7063",
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              <strong style={{ color: "#315840" }}>Perlu diingat:</strong>{" "}
              masukkan harga beli per satuan, bukan total seluruh barang.
              Persentase keuntungan tidak diisi di halaman ini.
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                marginTop: 20,
              }}
            >
              <button type="submit" style={primaryButton}>
                {editingIndex !== null ? "✓ Perbarui Barang" : "+ Tambah ke Daftar"}
              </button>

              {editingIndex !== null && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  style={{
                    ...primaryButton,
                    background: "#eef2ee",
                    color: "#405347",
                  }}
                >
                  Batal Edit
                </button>
              )}
            </div>
          </form>
        </section>

        <section style={{ ...cardStyle, marginTop: 22 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 16,
              flexWrap: "wrap",
              marginBottom: 20,
            }}
          >
            <div>
              <h2 style={{ margin: "0 0 6px", fontSize: 19 }}>
                Daftar Kulakan
              </h2>
              <p style={{ margin: 0, color: "#77847a", fontSize: 13 }}>
                Periksa barang sebelum menyimpannya ke database.
              </p>
            </div>

            <span
              style={{
                borderRadius: 30,
                padding: "7px 12px",
                background: "#e5f3e9",
                color: "#176b45",
                fontSize: 13,
                fontWeight: 750,
              }}
            >
              {items.length} barang
            </span>
          </div>

          {items.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "38px 16px",
                border: "1px dashed #d6e1d8",
                borderRadius: 12,
                background: "#fafcf9",
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 10 }}>🧾</div>
              <p style={{ margin: "0 0 6px", fontWeight: 700 }}>
                Belum ada barang kulakan
              </p>
              <p style={{ margin: 0, color: "#7a877e", fontSize: 13 }}>
                Isi formulir di atas, kemudian klik Tambah ke Daftar.
              </p>
            </div>
          ) : (
            <>
              <div style={{ overflowX: "auto", width: "100%" }}>
                <table
                  style={{
                    width: "100%",
                    minWidth: 760,
                    borderCollapse: "collapse",
                    fontSize: 13,
                  }}
                >
                  <thead>
                    <tr style={{ background: "#f4f7f4" }}>
                      {[
                        "Tanggal",
                        "Kategori",
                        "Nama barang",
                        "Merek",
                        "Jumlah",
                        "Harga satuan",
                        "Total",
                        "Aksi",
                      ].map((title) => (
                        <th
                          key={title}
                          style={{
                            padding: "13px 12px",
                            textAlign: "left",
                            color: "#526458",
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                            borderBottom: "1px solid #e5ebe6",
                          }}
                        >
                          {title}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row, index) => (
                      <tr
                        key={`${row.name}-${row.brand}-${index}`}
                        style={{
                          background:
                            editingIndex === index ? "#f2f8f3" : "#fff",
                        }}
                      >
                        <td style={{ padding: 12, borderBottom: "1px solid #edf1ed" }}>
                          {row.date}
                        </td>
                        <td style={{ padding: 12, borderBottom: "1px solid #edf1ed" }}>
                          {row.category}
                        </td>
                        <td style={{ padding: 12, borderBottom: "1px solid #edf1ed", fontWeight: 650 }}>
                          {row.name}
                        </td>
                        <td style={{ padding: 12, borderBottom: "1px solid #edf1ed" }}>
                          {row.brand}
                        </td>
                        <td style={{ padding: 12, borderBottom: "1px solid #edf1ed" }}>
                          {Number(row.quantity).toLocaleString("id-ID")}
                        </td>
                        <td style={{ padding: 12, borderBottom: "1px solid #edf1ed", whiteSpace: "nowrap" }}>
                          {rupiah(Number(row.purchasePrice))}
                        </td>
                        <td style={{ padding: 12, borderBottom: "1px solid #edf1ed", whiteSpace: "nowrap", fontWeight: 650 }}>
                          {rupiah(
                            Number(row.quantity) * Number(row.purchasePrice)
                          )}
                        </td>
                        <td style={{ padding: 12, borderBottom: "1px solid #edf1ed" }}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => editItem(index)}
                              disabled={saving}
                              style={{
                                padding: "7px 9px",
                                borderRadius: 7,
                                border: "1px solid #dce5de",
                                background: "#fff",
                                color: "#176b45",
                                cursor: "pointer",
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              disabled={saving}
                              style={{
                                padding: "7px 9px",
                                borderRadius: 7,
                                border: "1px solid #f2d8d5",
                                background: "#fff7f6",
                                color: "#a43b31",
                                cursor: "pointer",
                              }}
                            >
                              Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
                  gap: 12,
                  marginTop: 18,
                }}
              >
                <div
                  style={{
                    padding: 17,
                    background: "#f5f8f5",
                    borderRadius: 12,
                  }}
                >
                  <p style={{ margin: "0 0 7px", color: "#718076", fontSize: 12 }}>
                    Total jumlah barang
                  </p>
                  <p style={{ margin: 0, fontSize: 23, fontWeight: 750 }}>
                    {totalQuantity.toLocaleString("id-ID")}{" "}
                    <span style={{ fontSize: 13, fontWeight: 500 }}>unit</span>
                  </p>
                </div>

                <div
                  style={{
                    padding: 17,
                    background: "#eaf5ed",
                    borderRadius: 12,
                  }}
                >
                  <p style={{ margin: "0 0 7px", color: "#477357", fontSize: 12 }}>
                    Total nilai kulakan
                  </p>
                  <p style={{ margin: 0, fontSize: 23, fontWeight: 750, color: "#176b45" }}>
                    {rupiah(totalValue)}
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 14,
                  flexWrap: "wrap",
                  marginTop: 22,
                  paddingTop: 20,
                  borderTop: "1px solid #e8eee9",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    maxWidth: 460,
                    color: "#758177",
                    fontSize: 12,
                    lineHeight: 1.7,
                  }}
                >
                  Pastikan jumlah dan harga benar. Setelah tersimpan, kulakan
                  menunggu persetujuan harga dari admin.
                </p>

                <button
                  type="button"
                  onClick={saveItems}
                  disabled={items.length === 0 || saving || editingIndex !== null}
                  style={{
                    ...primaryButton,
                    padding: "14px 22px",
                    opacity:
                      items.length === 0 || saving || editingIndex !== null
                        ? 0.55
                        : 1,
                    cursor:
                      items.length === 0 || saving || editingIndex !== null
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {saving
                    ? "Menyimpan kulakan..."
                    : editingIndex !== null
                      ? "Selesaikan edit dahulu"
                      : `Simpan ${items.length} Barang`}
                </button>
              </div>
            </>
          )}
        </section>

        <p
          style={{
            margin: "18px 4px 0",
            color: "#849087",
            textAlign: "center",
            fontSize: 12,
          }}
        >
          Toko Rosyidah · Sistem pengelolaan kulakan dan persetujuan harga
        </p>
      </div>
    </main>
  );
}
