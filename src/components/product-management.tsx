
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@/lib/supabase";

type Product = {
  id: string;
  product_code: string | null;
  name: string;
  brand: string | null;
  unit: string;
  stock_quantity: number;
  current_selling_price: number | null;
  price_status: "pending_price" | "approved";
  is_active: boolean;
};

type DraftProduct = {
  product_code: string;
  name: string;
  brand: string;
  stock_quantity: string;
  current_selling_price: string;
};

type ProductFilter = "all" | "approved" | "pending_price";
type ProductListView = "active" | "inactive";

const emptyDraft = (): DraftProduct => ({
  product_code: "",
  name: "",
  brand: "",
  stock_quantity: "0",
  current_selling_price: "",
});

const normalize = (value: string) =>
  value.trim().toLocaleLowerCase("id-ID");

const formatRupiah = (value: number | null) =>
  value === null
    ? "Belum ditentukan"
    : new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
      }).format(value);

export default function ProductManagement() {
  const [supabase] = useState(() => createClient());

  const [products, setProducts] = useState<Product[]>([]);
  const [drafts, setDrafts] = useState<DraftProduct[]>([emptyDraft()]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] =
    useState<DraftProduct>(emptyDraft());

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ProductFilter>("all");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [listView, setListView] =
  useState<ProductListView>("active");

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data, error: loadError } = await supabase
        .from("products")
        .select(
          "id, product_code, name, brand, unit, stock_quantity, current_selling_price, price_status, is_active"
        )
        
        .order("name");

      if (loadError) {
        setError(`Gagal memuat barang: ${loadError.message}`);
        return;
      }

      setProducts((data ?? []) as Product[]);
    } catch (err) {
      setError(
        `Gagal memuat barang: ${
          err instanceof Error ? err.message : "Terjadi kesalahan."
        }`
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const activeProducts = useMemo(
  () => products.filter((p) => p.is_active),
  [products]
);

const inactiveProducts = useMemo(
  () => products.filter((p) => !p.is_active),
  [products]
);

const displayedProducts =
  listView === "active" ? activeProducts : inactiveProducts;

const approvedCount = activeProducts.filter(
  (p) => p.price_status === "approved"
).length;

const pendingCount = activeProducts.length - approvedCount;

const totalStock = activeProducts.reduce(
  (total, p) => total + Number(p.stock_quantity || 0),
  0
);

const filteredProducts = useMemo(() => {
  const keyword = normalize(search);

  return displayedProducts.filter((p) => {
    const matchesSearch =
      !keyword ||
      normalize(p.product_code ?? "").includes(keyword) ||
      normalize(p.name).includes(keyword) ||
      normalize(p.brand ?? "").includes(keyword);

    const matchesFilter =
      filter === "all" || p.price_status === filter;

    return matchesSearch && matchesFilter;
  });
}, [displayedProducts, search, filter]);

  function updateDraft(
    index: number,
    field: keyof DraftProduct,
    value: string
  ) {
    setDrafts((current) =>
      current.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    );
  }

  function addDraft() {
    if (drafts.length < 10) {
      setDrafts((current) => [...current, emptyDraft()]);
    }
  }

  function removeDraft(index: number) {
    setDrafts((current) => {
      const next = current.filter((_, i) => i !== index);
      return next.length ? next : [emptyDraft()];
    });
  }

  function validateDrafts(rows: DraftProduct[]) {
    if (rows.some((p) => !p.product_code.trim())) {
      return "Kode barang wajib diisi.";
    }

    if (rows.some((p) => !p.name.trim())) {
      return "Nama barang wajib diisi.";
    }

    const codes = rows.map((p) => normalize(p.product_code));
    const names = rows.map(
      (p) => `${normalize(p.name)}|||${normalize(p.brand)}`
    );

    if (new Set(codes).size !== codes.length) {
      return "Ada kode barang yang sama dalam formulir.";
    }

    if (new Set(names).size !== names.length) {
      return "Ada nama barang dan merek yang sama dalam formulir.";
    }

    for (const p of rows) {
      const stock = Number(p.stock_quantity);

      if (
        p.stock_quantity.trim() === "" ||
        !Number.isInteger(stock) ||
        stock < 0
      ) {
        return `Stok untuk "${p.name}" harus berupa bilangan bulat nol atau lebih.`;
      }

      if (p.current_selling_price.trim() !== "") {
        const price = Number(p.current_selling_price);

        if (!Number.isFinite(price) || price < 0) {
          return `Harga jual untuk "${p.name}" harus berupa angka nol atau lebih.`;
        }
      }
    }

    return "";
  }

  async function checkDuplicates(
    rows: DraftProduct[],
    excludeId?: string
  ) {
    const { data, error: checkError } = await supabase
      .from("products")
      .select("id, product_code, name, brand");

    if (checkError) {
      return {
        error: `Gagal memeriksa barang: ${checkError.message}`,
      };
    }

    for (const item of rows) {
      const duplicate = (data ?? []).find(
        (saved) =>
          saved.id !== excludeId &&
          (
            normalize(saved.product_code ?? "") ===
              normalize(item.product_code) ||
            (
              normalize(saved.name ?? "") === normalize(item.name) &&
              normalize(saved.brand ?? "") === normalize(item.brand)
            )
          )
      );

      if (duplicate) {
        return {
          error: `Kode atau kombinasi nama dan merek untuk "${item.name}" sudah terdaftar.`,
        };
      }
    }

    return { error: "" };
  }

  async function saveProducts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const filled = drafts
      .map((p) => ({
        product_code: p.product_code.trim(),
        name: p.name.trim(),
        brand: p.brand.trim(),
        stock_quantity: p.stock_quantity.trim(),
        current_selling_price: p.current_selling_price.trim(),
      }))
      .filter(
        (p) =>
          p.product_code ||
          p.name ||
          p.brand ||
          p.stock_quantity !== "0" ||
          p.current_selling_price
      );

    if (!filled.length) {
      setError("Isi minimal satu barang terlebih dahulu.");
      return;
    }

    const validation = validateDrafts(filled);

    if (validation) {
      setError(validation);
      return;
    }

    setSaving(true);

    try {
      const duplicateCheck = await checkDuplicates(filled);

      if (duplicateCheck.error) {
        setError(duplicateCheck.error);
        return;
      }

      const payload = filled.map((p) => {
        const hasPrice = p.current_selling_price !== "";

        return {
          product_code: p.product_code,
          name: p.name,
          brand: p.brand || null,
          unit: "pcs",
          stock_quantity: Number(p.stock_quantity),
          current_selling_price: hasPrice
            ? Number(p.current_selling_price)
            : null,
          price_status: hasPrice ? "approved" : "pending_price",
          is_active: true,
        };
      });

      const { error: insertError } = await supabase
        .from("products")
        .insert(payload);

      if (insertError) {
        setError(
          insertError.code === "23505"
            ? "Kode atau nama barang sudah terdaftar."
            : `Gagal menyimpan barang: ${insertError.message}`
        );
        return;
      }

      setMessage(`${filled.length} barang berhasil didaftarkan.`);
      setDrafts([emptyDraft()]);
      await loadProducts();
    } catch (err) {
      setError(
        `Gagal menyimpan barang: ${
          err instanceof Error ? err.message : "Terjadi kesalahan."
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  function startEdit(product: Product) {
    setError("");
    setMessage("");
    setEditingId(product.id);

    setEditDraft({
      product_code: product.product_code ?? "",
      name: product.name,
      brand: product.brand ?? "",
      stock_quantity: String(product.stock_quantity ?? 0),
      current_selling_price:
        product.current_selling_price === null
          ? ""
          : String(product.current_selling_price),
    });

    window.setTimeout(() => {
      document
        .getElementById("product-edit-panel")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(emptyDraft());
  }

  function updateEditDraft(
    field: keyof DraftProduct,
    value: string
  ) {
    setEditDraft((current) => ({ ...current, [field]: value }));
  }

  
async function saveEdit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setError("");
  setMessage("");

  if (!editingId) return;

  const cleaned: DraftProduct = {
    product_code: editDraft.product_code.trim(),
    name: editDraft.name.trim(),
    brand: editDraft.brand.trim(),
    stock_quantity: editDraft.stock_quantity.trim(),
    current_selling_price: editDraft.current_selling_price.trim(),
  };

  const validation = validateDrafts([cleaned]);

  if (validation) {
    setError(validation);
    return;
  }

  setSavingEdit(true);

  try {
    const duplicateCheck = await checkDuplicates(
      [cleaned],
      editingId
    );

    if (duplicateCheck.error) {
      setError(duplicateCheck.error);
      return;
    }

    const hasPrice = cleaned.current_selling_price !== "";
    const price = hasPrice
      ? Number(cleaned.current_selling_price)
      : null;

    const { data: updatedRows, error: updateError } = await supabase
      .from("products")
      .update({
        product_code: cleaned.product_code,
        name: cleaned.name,
        brand: cleaned.brand || null,
        unit: "pcs",
        stock_quantity: Number(cleaned.stock_quantity),
        current_selling_price: price,
        price_status: hasPrice ? "approved" : "pending_price",
      })
      .eq("id", editingId)
      .select("id");

    if (updateError) {
      setError(`Gagal memperbarui barang: ${updateError.message}`);
      return;
    }

    if (!updatedRows || updatedRows.length === 0) {
      setError(
        "Tidak ada baris yang diperbarui. Periksa kebijakan UPDATE dan SELECT pada tabel products di Supabase."
      );
      return;
    }

    const editedName = cleaned.name;

    cancelEdit();

    await loadProducts();

    setMessage(
      `Perubahan barang "${editedName}" berhasil dikirim. Daftar barang telah dimuat ulang.`
    );
  } catch (err) {
    setError(
      `Gagal memperbarui barang: ${
        err instanceof Error ? err.message : "Terjadi kesalahan."
      }`
    );
  } finally {
    setSavingEdit(false);
  }
}

  

  

async function deleteProduct(product: Product) {
  const confirmed = window.confirm(
    `Hapus "${product.name}" dari daftar barang aktif?\n\nBarang akan dinonaktifkan, bukan dihapus permanen.`
  );

  if (!confirmed) return;

  setError("");
  setMessage("");
  setDeletingId(product.id);

  try {
    const { data: updatedRows, error: deleteError } = await supabase
      .from("products")
      .update({ is_active: false })
      .eq("id", product.id)
      .eq("is_active", true)
      .select("id");

    if (deleteError) {
      setError(`Gagal menghapus barang: ${deleteError.message}`);
      return;
    }

    

    if (!updatedRows || updatedRows.length === 0) {
      setError(
        "Barang belum terkonfirmasi dinonaktifkan. Periksa kebijakan UPDATE dan SELECT pada tabel products di Supabase."
      );
      return;
    }

    if (editingId === product.id) {
      cancelEdit();
    }

    await loadProducts();

    setMessage(
      `Barang "${product.name}" berhasil dinonaktifkan dan daftar telah dimuat ulang.`
    );
  } catch (err) {
    setError(
      `Gagal menghapus barang: ${
        err instanceof Error ? err.message : "Terjadi kesalahan."
      }`
    );
  } finally {
    setDeletingId(null);
  }
}

async function activateProduct(product: Product) {
  const confirmed = window.confirm(
    `Aktifkan kembali "${product.name}"?\n\nBarang akan kembali tersedia pada daftar barang aktif.`
  );

  if (!confirmed) return;

  setError("");
  setMessage("");
  setDeletingId(product.id);

  try {
    const { data: updatedRows, error: updateError } = await supabase
      .from("products")
      .update({ is_active: true })
      .eq("id", product.id)
      .eq("is_active", false)
      .select("id");

    if (updateError) {
      setError(`Gagal mengaktifkan barang: ${updateError.message}`);
      return;
    }

    if (!updatedRows || updatedRows.length === 0) {
      setError(
        "Barang belum terkonfirmasi aktif. Periksa kebijakan UPDATE dan SELECT pada tabel products."
      );
      return;
    }

    await loadProducts();

    setMessage(
      `Barang "${product.name}" berhasil diaktifkan kembali.`
    );
  } catch (err) {
    setError(
      `Gagal mengaktifkan barang: ${
        err instanceof Error ? err.message : "Terjadi kesalahan."
      }`
    );
  } finally {
    setDeletingId(null);
  }
}

  return (
    <div className="inventory-page">
      <style jsx>{`
        .inventory-page {
          display: flex;
          flex-direction: column;
          gap: 22px;
          padding-bottom: 30px;
          color: #243126;
        }

        .hero, .panel-heading, .form-footer, .toolbar, .actions,
        .edit-actions, .action-buttons {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .eyebrow {
          margin-bottom: 8px;
          color: #64836a;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.7px;
        }

        .title {
          margin: 0;
          font-size: clamp(25px, 3vw, 33px);
          font-weight: 800;
          letter-spacing: -1px;
        }

        .subtitle {
          margin: 8px 0 0;
          color: #7a8579;
          font-size: 13px;
          line-height: 1.7;
        }

        .count-chip, .step {
          padding: 10px 13px;
          border: 1px solid #e4eae1;
          border-radius: 10px;
          background: #f4f8f1;
          color: #426b49;
          font-size: 12px;
          font-weight: 750;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .stat, .panel {
          min-width: 0;
          padding: 20px;
          border: 1px solid #e7ece4;
          border-radius: 16px;
          background: white;
          box-shadow: 0 4px 16px rgba(35, 55, 35, 0.025);
        }

        .stat-label {
          color: #7b8579;
          font-size: 12px;
          font-weight: 650;
        }

        .stat-value {
          margin-top: 9px;
          font-size: 26px;
          font-weight: 850;
        }

        .stat-caption {
          margin-top: 5px;
          color: #91998e;
          font-size: 11px;
          line-height: 1.5;
        }

        .alert {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 14px 16px;
          border-radius: 12px;
          font-size: 12px;
          line-height: 1.65;
          overflow-wrap: anywhere;
        }

        .alert-error {
          color: #a13737;
          background: #fff2f0;
          border: 1px solid #f3d9d5;
        }

        .alert-success {
          color: #356d42;
          background: #eef7ed;
          border: 1px solid #d9ead5;
        }

        .panel-heading {
          align-items: flex-start;
          margin-bottom: 18px;
        }

        .panel-heading h2 {
          margin: 0 0 6px;
          font-size: 16px;
          font-weight: 800;
        }

        .panel-heading p {
          margin: 0;
          color: #818a7e;
          font-size: 12px;
          line-height: 1.7;
        }

        .draft-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .draft-row {
          display: grid;
          grid-template-columns: 1fr 1.3fr 1fr 0.9fr 1fr 65px 60px;
          align-items: end;
          gap: 10px;
          padding: 14px;
          border: 1px solid #edf0eb;
          border-radius: 12px;
          background: #fcfdfb;
        }

        .field-wrap {
          display: block;
          min-width: 0;
        }

        .field-label {
          display: block;
          margin-bottom: 7px;
          color: #475147;
          font-size: 11px;
          font-weight: 750;
        }

        .required {
          color: #b33c36;
        }

        .field {
          display: block;
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
          min-height: 41px;
          padding: 0 11px;
          border: 1px solid #dfe5dc;
          border-radius: 9px;
          background: white;
          color: #283428;
          font: inherit;
          font-size: 12px;
          outline: none;
        }

        .field:focus {
          border-color: #78977b;
          box-shadow: 0 0 0 3px rgba(105, 145, 109, 0.12);
        }

        .field:read-only {
          background: #f2f5ef;
          color: #61715e;
          font-weight: 700;
          text-align: center;
        }

        .button, .reload, .edit-button, .delete-button,
        .remove-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 36px;
          padding: 0 12px;
          border-radius: 9px;
          font: inherit;
          font-size: 11px;
          font-weight: 750;
          cursor: pointer;
          transition: background 0.15s;
        }

        .button {
          min-height: 41px;
          padding: 0 15px;
          border: 0;
          font-size: 12px;
        }

        .primary {
          background: #426b49;
          color: white;
        }

        .primary:hover:not(:disabled) {
          background: #34583a;
        }

        .secondary {
          border: 1px solid #dfe8db;
          background: #edf4eb;
          color: #426b49;
        }

        .secondary:hover:not(:disabled) {
          background: #e2eddf;
        }

        .reload {
          border: 1px solid #e1e8de;
          background: white;
          color: #526b55;
        }

        .edit-button {
          border: 1px solid #dfe8db;
          background: #f4f8f1;
          color: #426b49;
        }

        .edit-button:hover:not(:disabled) {
          background: #e8f1e4;
        }

        .delete-button, .remove-button {
          border: 1px solid #f1d8d5;
          background: #fff2f0;
          color: #b13e38;
        }

        .delete-button:hover:not(:disabled),
        .remove-button:hover:not(:disabled) {
          background: #ffe5e1;
        }

        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .form-footer {
          margin-top: 18px;
          padding-top: 17px;
          border-top: 1px solid #edf0eb;
        }

        .form-footer p {
          max-width: 420px;
          margin: 0;
          color: #828b7e;
          font-size: 11px;
          line-height: 1.7;
        }

        .actions {
          justify-content: flex-end;
        }

        .toolbar {
          margin-bottom: 15px;
        }

        .search-wrap {
          position: relative;
          flex: 1;
          min-width: 180px;
        }

        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #879184;
        }

        .search-input {
          padding-left: 34px;
        }

        .filter {
          width: auto;
          min-width: 150px;
        }

        .result-count {
          margin-bottom: 12px;
          color: #858e81;
          font-size: 11px;
        }

        .table-wrap {
          width: 100%;
          overflow-x: auto;
          border: 1px solid #e7ece4;
          border-radius: 12px;
        }

        .table {
          width: 100%;
          min-width: 990px;
          border-collapse: collapse;
          font-size: 12px;
        }

        .table th {
          padding: 13px;
          text-align: left;
          white-space: nowrap;
          color: #6d786b;
          background: #f7f9f6;
          font-size: 10px;
          font-weight: 800;
          border-bottom: 1px solid #e7ece4;
        }

        .table td {
          padding: 13px;
          border-bottom: 1px solid #edf0eb;
          vertical-align: middle;
        }

        .table tbody tr:last-child td {
          border-bottom: 0;
        }

        .table tbody tr:hover {
          background: #fcfdfb;
        }

        .code {
          display: inline-block;
          padding: 5px 8px;
          border-radius: 6px;
          background: #f1f5ef;
          color: #596d59;
          font-size: 10px;
          font-weight: 800;
          white-space: nowrap;
        }

        .name {
          color: #2e3a2f;
          font-weight: 750;
        }

        .price, .stock {
          color: #2e5134;
          font-weight: 750;
          white-space: nowrap;
        }

        .status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 8px;
          border-radius: 7px;
          font-size: 10px;
          font-weight: 750;
          white-space: nowrap;
        }

        .approved {
          background: #edf7eb;
          color: #3e7545;
        }

        .pending {
          background: #fff5e5;
          color: #97691d;
        }

        .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
        }

        .action-buttons {
          justify-content: flex-start;
          flex-wrap: nowrap;
          gap: 6px;
        }

        .empty {
          padding: 32px 16px;
          text-align: center;
          border: 1px dashed #dce4d9;
          border-radius: 12px;
          background: #fafbf9;
          color: #858d82;
          font-size: 12px;
          line-height: 1.7;
        }

        .empty strong {
          display: block;
          margin-bottom: 5px;
          color: #465245;
          font-size: 13px;
        }

        .edit-panel {
          padding: 18px;
          border: 1px solid #dfe9db;
          border-radius: 13px;
          background: #f8fbf6;
        }

        .edit-title {
          margin: 0 0 5px;
          font-size: 14px;
          font-weight: 800;
        }

        .edit-description {
          margin: 0 0 16px;
          color: #7c8779;
          font-size: 11px;
          line-height: 1.6;
        }

        .edit-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
        }

        .edit-actions {
          justify-content: flex-end;
          margin-top: 16px;
        }

        .info {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          padding: 15px 17px;
          border: 1px solid #e7ebe3;
          border-radius: 13px;
          background: #fafbf9;
          color: #778073;
          font-size: 11px;
          line-height: 1.7;
        }

        .info-icon {
          display: grid;
          place-items: center;
          flex-shrink: 0;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #eaf0e6;
          color: #4e6f4c;
          font-weight: 800;
        }

        .info strong {
          display: block;
          margin-bottom: 3px;
          color: #475646;
        }

        .list-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 18px;
}

.list-tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 42px;
  padding: 0 16px;
  border: 1px solid #dfe8db;
  border-radius: 10px;
  background: white;
  color: #526b55;
  font: inherit;
  font-size: 12px;
  font-weight: 750;
  cursor: pointer;
}

.list-tab span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 5px;
  border-radius: 7px;
  background: #f1f5ef;
  font-size: 11px;
}

.list-tab-active {
  border-color: #426b49;
  background: #426b49;
  color: white;
}

.list-tab-active span {
  background: rgba(255, 255, 255, 0.18);
  color: white;
}

        @media (max-width: 1100px) {
          .draft-row {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .edit-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 700px) {
          .inventory-page {
            gap: 16px;
          }

          .stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 9px;
          }

          .stat {
            padding: 15px;
          }

          .stat-value {
            font-size: 23px;
          }

          .panel {
            padding: 15px;
          }

          .draft-row, .edit-grid {
            grid-template-columns: 1fr;
          }

          .form-footer {
            align-items: stretch;
            flex-direction: column;
          }

          .actions {
            width: 100%;
          }

          .actions .button {
            flex: 1;
          }

          .toolbar {
            align-items: stretch;
            flex-direction: column;
          }

          .filter {
            width: 100%;
          }

          .edit-actions {
            align-items: stretch;
            flex-direction: column-reverse;
          }

          .edit-actions .button {
            width: 100%;
          }

          .action-buttons {
            flex-wrap: wrap;
          }
        }
      `}</style>

      <header className="hero">
        <div>
          <div className="eyebrow">INVENTARIS TOKO</div>
          <h1 className="title">Barang &amp; Stok</h1>
          <p className="subtitle">
            Kelola barang, jumlah stok, harga jual, dan satuan
            Toko Rosyidah.
          </p>
        </div>

        <div className="count-chip">
          {products.length} barang aktif
        </div>
      </header>

      <div className="stats">
        <div className="stat">
          <div className="stat-label">Total barang aktif</div>
          <div className="stat-value">{products.length}</div>
          <div className="stat-caption">Jumlah jenis barang terdaftar</div>
        </div>

        <div className="stat">
          <div className="stat-label">Total stok</div>
          <div className="stat-value">{totalStock}</div>
          <div className="stat-caption">Akumulasi jumlah seluruh barang (pcs)</div>
        </div>

        <div className="stat">
          <div className="stat-label">Harga disetujui</div>
          <div className="stat-value">{approvedCount}</div>
          <div className="stat-caption">Barang dengan harga jual</div>
        </div>

        <div className="stat">
          <div className="stat-label">Menunggu harga</div>
          <div className="stat-value">{pendingCount}</div>
          <div className="stat-caption">Barang yang perlu ditetapkan harganya</div>
        </div>
      </div>

      {(error || message) && (
        <div
          role={error ? "alert" : "status"}
          className={`alert ${error ? "alert-error" : "alert-success"}`}
        >
          <strong>{error ? "Perlu diperiksa" : "Berhasil"}</strong>
          <span>{error || message}</span>
        </div>
      )}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Daftarkan Barang Baru</h2>
            <p>
              Masukkan kode, nama, jumlah stok awal, dan harga jual
              jika sudah ditentukan.
            </p>
          </div>
          <span className="step">{drafts.length} / 10 baris</span>
        </div>

        <form onSubmit={saveProducts}>
          <div className="draft-list">
            {drafts.map((item, index) => (
              <div className="draft-row" key={index}>
                <label className="field-wrap">
                  <span className="field-label">
                    Kode barang <span className="required">*</span>
                  </span>
                  <input
                    className="field"
                    value={item.product_code}
                    onChange={(e) =>
                      updateDraft(index, "product_code", e.target.value)
                    }
                    maxLength={50}
                    required
                    placeholder="BRG001"
                  />
                </label>

                <label className="field-wrap">
                  <span className="field-label">
                    Nama barang <span className="required">*</span>
                  </span>
                  <input
                    className="field"
                    value={item.name}
                    onChange={(e) =>
                      updateDraft(index, "name", e.target.value)
                    }
                    maxLength={150}
                    required
                    placeholder="Gula 1/4 kg"
                  />
                </label>

                <label className="field-wrap">
                  <span className="field-label">Merek</span>
                  <input
                    className="field"
                    value={item.brand}
                    onChange={(e) =>
                      updateDraft(index, "brand", e.target.value)
                    }
                    maxLength={100}
                    placeholder="Tanpa merek"
                  />
                </label>

                <label className="field-wrap">
                  <span className="field-label">
                    Jumlah stok <span className="required">*</span>
                  </span>
                  <input
                    className="field"
                    type="number"
                    min="0"
                    step="1"
                    value={item.stock_quantity}
                    onChange={(e) =>
                      updateDraft(index, "stock_quantity", e.target.value)
                    }
                    required
                  />
                </label>

                <label className="field-wrap">
                  <span className="field-label">Harga jual (Rp)</span>
                  <input
                    className="field"
                    type="number"
                    min="0"
                    step="1"
                    value={item.current_selling_price}
                    onChange={(e) =>
                      updateDraft(
                        index,
                        "current_selling_price",
                        e.target.value
                      )
                    }
                    placeholder="Belum ditentukan"
                  />
                </label>

                <label className="field-wrap">
                  <span className="field-label">Satuan</span>
                  <input className="field" value="pcs" readOnly />
                </label>

                <button
                  type="button"
                  className="remove-button"
                  onClick={() => removeDraft(index)}
                  disabled={drafts.length === 1 || saving}
                >
                  Hapus baris
                </button>
              </div>
            ))}
          </div>

          <div className="form-footer">
            <p>
              Stok awal wajib berupa bilangan bulat nol atau lebih.
              Harga boleh dikosongkan jika belum ditentukan.
              Satuan barang adalah pcs.
            </p>

            <div className="actions">
              <button
                type="button"
                className="button secondary"
                onClick={addDraft}
                disabled={drafts.length >= 10 || saving}
              >
                + Tambah Baris
              </button>

              <button
                type="submit"
                className="button primary"
                disabled={saving}
              >
                {saving ? "Menyimpan..." : "Simpan Barang"}
              </button>
            </div>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>
  {listView === "active"
    ? "Daftar Barang Aktif"
    : "Daftar Barang Nonaktif"}
</h2>
            <p>
              Cari barang, periksa jumlah stok dan harga, edit
              informasi, atau hapus barang dari daftar aktif.
            </p>

            <div className="list-tabs">
  <button
    type="button"
    className={`list-tab ${listView === "active" ? "list-tab-active" : ""}`}
    onClick={() => {
      setListView("active");
      setEditingId(null);
      setSearch("");
      setFilter("all");
      setError("");
      setMessage("");
    }}
  >
    Barang Aktif
    <span>{activeProducts.length}</span>
  </button>

  <button
    type="button"
    className={`list-tab ${listView === "inactive" ? "list-tab-active" : ""}`}
    onClick={() => {
      setListView("inactive");
      setEditingId(null);
      setSearch("");
      setFilter("all");
      setError("");
      setMessage("");
    }}
  >
    Barang Nonaktif
    <span>{inactiveProducts.length}</span>
  </button>
</div>

          </div>

          <button
            type="button"
            className="reload"
            onClick={() => void loadProducts()}
            disabled={loading}
          >
            {loading ? "Memuat..." : "↻ Muat Ulang"}
          </button>
        </div>

        <div className="toolbar">
          <label className="search-wrap">
            <span className="search-icon">⌕</span>
            <input
              className="field search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kode, nama, atau merek..."
            />
          </label>

          <select
            className="field filter"
            value={filter}
            onChange={(e) =>
              setFilter(e.target.value as ProductFilter)
            }
            aria-label="Filter status harga"
          >
            <option value="all">Semua status</option>
            <option value="approved">Harga disetujui</option>
            <option value="pending_price">Menunggu harga</option>
          </select>
        </div>

        <div className="result-count">
  Menampilkan {filteredProducts.length} dari {displayedProducts.length} barang
</div>

        {loading ? (
          <div className="empty">Memuat daftar barang...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="empty">
            <strong>Barang tidak ditemukan</strong>
            Coba ubah kata pencarian atau filter status harga.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Kode barang</th>
                  <th>Nama barang</th>
                  <th>Merek</th>
                  <th>Jumlah stok</th>
                  <th>Satuan</th>
                  <th>Harga jual</th>
                  <th>Status harga</th>
                  <th>Aksi</th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <span className="code">
                        {product.product_code || "Belum ada"}
                      </span>
                    </td>

                    <td>
                      <div className="name">{product.name}</div>
                    </td>

                    <td>{product.brand || "—"}</td>

                    <td className="stock">
                      {Number(product.stock_quantity || 0)}
                    </td>

                    <td>{product.unit || "pcs"}</td>

                    <td className="price">
                      {formatRupiah(product.current_selling_price)}
                    </td>

                    <td>
                      <span
                        className={`status ${
                          product.price_status === "approved"
                            ? "approved"
                            : "pending"
                        }`}
                      >
                        <span className="dot" />
                        {product.price_status === "approved"
                          ? "Disetujui"
                          : "Menunggu harga"}
                      </span>
                    </td>

                    <td>
                      <div className="action-buttons">
  {listView === "active" ? (
    <>
      <button
        type="button"
        className="edit-button"
        onClick={() => startEdit(product)}
        disabled={deletingId === product.id || savingEdit || saving}
      >
        ✎ Edit
      </button>

      <button
        type="button"
        className="delete-button"
        onClick={() => void deleteProduct(product)}
        disabled={deletingId === product.id || savingEdit || saving}
      >
        {deletingId === product.id ? "Memproses..." : "Nonaktifkan"}
      </button>
    </>
  ) : (
    <button
      type="button"
      className="edit-button"
      onClick={() => void activateProduct(product)}
      disabled={deletingId === product.id || savingEdit || saving}
    >
      {deletingId === product.id ? "Mengaktifkan..." : "Aktifkan Kembali"}
    </button>
  )}
</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editingId && (
        <section className="panel" id="product-edit-panel">
          <div className="panel-heading">
            <div>
              <h2>Edit Barang</h2>
              <p>
                Ubah informasi barang dan sesuaikan jumlah stok yang tersedia.
              </p>
            </div>
          </div>

          <form className="edit-panel" onSubmit={saveEdit}>
            <h3 className="edit-title">Perbarui informasi barang</h3>

            <p className="edit-description">
              Perubahan harga berlaku untuk transaksi berikutnya.
              Pastikan jumlah stok sesuai dengan stok fisik toko.
            </p>

            <div className="edit-grid">
              <label className="field-wrap">
                <span className="field-label">
                  Kode barang <span className="required">*</span>
                </span>
                <input
                  className="field"
                  value={editDraft.product_code}
                  onChange={(e) =>
                    updateEditDraft("product_code", e.target.value)
                  }
                  maxLength={50}
                  required
                />
              </label>

              <label className="field-wrap">
                <span className="field-label">
                  Nama barang <span className="required">*</span>
                </span>
                <input
                  className="field"
                  value={editDraft.name}
                  onChange={(e) =>
                    updateEditDraft("name", e.target.value)
                  }
                  maxLength={150}
                  required
                />
              </label>

              <label className="field-wrap">
                <span className="field-label">Merek</span>
                <input
                  className="field"
                  value={editDraft.brand}
                  onChange={(e) =>
                    updateEditDraft("brand", e.target.value)
                  }
                  maxLength={100}
                />
              </label>

              <label className="field-wrap">
                <span className="field-label">
                  Jumlah stok <span className="required">*</span>
                </span>
                <input
                  className="field"
                  type="number"
                  min="0"
                  step="1"
                  value={editDraft.stock_quantity}
                  onChange={(e) =>
                    updateEditDraft("stock_quantity", e.target.value)
                  }
                  required
                />
              </label>

              <label className="field-wrap">
                <span className="field-label">Harga jual (Rp)</span>
                <input
                  className="field"
                  type="number"
                  min="0"
                  step="1"
                  value={editDraft.current_selling_price}
                  onChange={(e) =>
                    updateEditDraft(
                      "current_selling_price",
                      e.target.value
                    )
                  }
                  placeholder="Belum ditentukan"
                />
              </label>
            </div>

            <div style={{ marginTop: 12, maxWidth: 180 }}>
              <label className="field-wrap">
                <span className="field-label">Satuan</span>
                <input className="field" value="pcs" readOnly />
              </label>
            </div>

            <div className="edit-actions">
              <button
                type="button"
                className="button secondary"
                onClick={cancelEdit}
                disabled={savingEdit}
              >
                Batal
              </button>

              <button
                type="submit"
                className="button primary"
                disabled={savingEdit}
              >
                {savingEdit ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </form>
        </section>
      )}

      <aside className="info">
        <span className="info-icon">i</span>
        <div>
          <strong>Informasi pengelolaan barang</strong>
          Jumlah stok awal diisi saat barang didaftarkan. Perubahan jumlah
          stok pada formulir edit akan langsung mengubah angka stok di master
          barang. Tombol Hapus menonaktifkan barang agar data barang tetap
          tersimpan. Pastikan proses transaksi nantinya mengurangi stok
          secara konsisten dan menyimpan riwayat transaksi.
        </div>
      </aside>
    </div>
  );
}
