
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
    useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

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

    if (new Set(codes).size !== codes.length) {
      return "Kode barang tidak boleh sama.";
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
      .select("id, product_code");

    if (checkError) {
      return {
        error: `Gagal memeriksa kode barang: ${checkError.message}`,
      };
    }

    for (const item of rows) {
      const duplicate = (data ?? []).find(
        (saved) =>
          saved.id !== excludeId &&
          normalize(saved.product_code ?? "") ===
            normalize(item.product_code)
      );

      if (duplicate) {
        return {
          error: `Kode barang "${item.product_code}" sudah terdaftar. Gunakan kode barang lain.`,
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
      ? "Kode barang sudah terdaftar. Silakan gunakan kode lain."
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
  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: rgba(15, 35, 25, .48);
    backdrop-filter: blur(5px);
    animation: fadeIn .18s ease;
  }

  .modal-card {
    width: 100%;
    max-width: 720px;
    max-height: min(90vh, 760px);
    overflow-y: auto;
    padding: 27px;
    border: 1px solid #e3e9df;
    border-radius: 20px;
    background: #fff;
    box-shadow: 0 24px 80px rgba(10, 35, 22, .22);
    animation: modalIn .22s ease;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 15px;
    margin-bottom: 22px;
    padding-bottom: 18px;
    border-bottom: 1px solid #edf0eb;
  }

  .modal-eyebrow {
    margin-bottom: 7px;
    color: var(--gold);
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 2px;
  }

  .modal-title {
    margin: 0;
    color: var(--emerald-dark);
    font-family: var(--font-manrope), sans-serif;
    font-size: 21px;
    font-weight: 800;
  }

  .modal-description {
    margin: 7px 0 0;
    color: #879188;
    font-size: 11px;
    line-height: 1.7;
  }

  .modal-close {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border: 1px solid #e7ece6;
    border-radius: 10px;
    background: #f8faf7;
    color: #68776b;
    font-size: 20px;
    cursor: pointer;
  }

  .modal-close:hover:not(:disabled) {
    background: #edf4ef;
    color: var(--emerald);
  }

  .modal-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 17px;
  }

  .modal-grid .field {
    min-height: 46px;
  }

  .modal-note {
    display: flex;
    gap: 10px;
    margin-top: 20px;
    padding: 13px 15px;
    border: 1px solid #eee7d8;
    border-radius: 11px;
    background: #fbf9f3;
    color: #81775f;
    font-size: 10px;
    line-height: 1.7;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 23px;
    padding-top: 18px;
    border-top: 1px solid #edf0eb;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes modalIn {
    from {
      opacity: 0;
      transform: translateY(12px) scale(.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @media (max-width: 600px) {
    .modal-overlay {
      align-items: flex-end;
      padding: 0;
    }

    .modal-card {
      max-height: 92vh;
      padding: 21px;
      border-radius: 20px 20px 0 0;
    }

    .modal-grid {
      grid-template-columns: 1fr;
      gap: 13px;
    }

    .modal-footer {
      flex-direction: column-reverse;
    }

    .modal-footer .button {
      width: 100%;
    }
  }
  .inventory-page {
    --emerald: #174b36;
    --emerald-dark: #103a2a;
    --emerald-soft: #edf4ef;
    --gold: #b99a62;
    --ivory: #f8f8f4;
    --ink: #26352c;
    --muted: #849087;
    --line: #e8ece6;

    display: flex;
    flex-direction: column;
    gap: 22px;
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
      radial-gradient(circle at 92% 10%, rgba(185,154,98,.13), transparent 28%),
      linear-gradient(115deg, #ffffff 0%, #f5f8f3 100%);
    box-shadow: 0 8px 28px rgba(24, 55, 37, .035);
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

  .count-chip {
    position: relative;
    z-index: 1;
    padding: 12px 17px;
    border: 1px solid #dce8de;
    border-radius: 12px;
    background: rgba(255,255,255,.85);
    color: var(--emerald);
    font-size: 12px;
    font-weight: 800;
    white-space: nowrap;
    box-shadow: 0 4px 12px rgba(20,60,39,.04);
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
  }

  .stat {
    position: relative;
    min-width: 0;
    overflow: hidden;
    padding: 21px;
    border: 1px solid var(--line);
    border-radius: 17px;
    background: #fff;
    box-shadow: 0 5px 18px rgba(24,55,37,.035);
    transition: transform .2s ease, box-shadow .2s ease;
  }

  .stat:hover {
    transform: translateY(-3px);
    box-shadow: 0 10px 25px rgba(24,55,37,.07);
  }

  .stat::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 3px;
    height: 42px;
    border-radius: 0 0 5px 0;
    background: var(--gold);
  }

  .stat-label {
    color: #7e8a80;
    font-size: 11px;
    font-weight: 700;
  }

  .stat-value {
    margin-top: 11px;
    color: var(--emerald-dark);
    font-family: var(--font-manrope), sans-serif;
    font-size: 29px;
    font-weight: 800;
    letter-spacing: -1px;
  }

  .stat-caption {
    margin-top: 6px;
    color: #9aa39b;
    font-size: 10px;
    line-height: 1.6;
  }

  .panel {
    min-width: 0;
    padding: 25px;
    border: 1px solid var(--line);
    border-radius: 19px;
    background: #fff;
    box-shadow: 0 6px 22px rgba(24,55,37,.035);
  }

  .panel-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 15px;
    margin-bottom: 21px;
    flex-wrap: wrap;
  }

  .panel-heading h2 {
    margin: 0 0 7px;
    color: var(--emerald-dark);
    font-family: var(--font-manrope), sans-serif;
    font-size: 17px;
    font-weight: 800;
    letter-spacing: -.4px;
  }

  .panel-heading p {
    margin: 0;
    color: #89938a;
    font-size: 11px;
    line-height: 1.75;
  }

  .step {
    padding: 9px 13px;
    border: 1px solid #e8dfca;
    border-radius: 9px;
    background: #fbf8f0;
    color: #927545;
    font-size: 11px;
    font-weight: 800;
  }

  .draft-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .draft-row {
    display: grid;
    grid-template-columns: 1fr 1.3fr 1fr .85fr 1fr 65px 75px;
    align-items: end;
    gap: 10px;
    padding: 16px;
    border: 1px solid #edf0eb;
    border-radius: 13px;
    background: #fafbf9;
    transition: border-color .2s ease;
  }

  .draft-row:focus-within {
    border-color: #c8d9cb;
    background: #fff;
  }

  .field-wrap {
    display: block;
    min-width: 0;
  }

  .field-label {
    display: block;
    margin-bottom: 8px;
    color: #526157;
    font-size: 10px;
    font-weight: 800;
  }

  .required {
    color: #bd615b;
  }

  .field {
    display: block;
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    min-height: 43px;
    padding: 0 12px;
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

  .field:read-only {
    background: #f0f4ef;
    color: #657568;
    font-weight: 800;
    text-align: center;
  }

  .button,
  .reload,
  .edit-button,
  .delete-button,
  .remove-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 37px;
    padding: 0 13px;
    border-radius: 9px;
    font-family: inherit;
    font-size: 11px;
    font-weight: 800;
    cursor: pointer;
    transition: all .18s ease;
    white-space: nowrap;
  }

  .button {
    min-height: 43px;
    padding: 0 18px;
    border: 0;
    font-size: 12px;
  }

  .primary {
    background: linear-gradient(135deg, #205a3e, #123d2b);
    color: white;
    box-shadow: 0 4px 11px rgba(23,75,54,.16);
  }

  .primary:hover:not(:disabled) {
    background: #0e3525;
    box-shadow: 0 6px 15px rgba(23,75,54,.22);
    transform: translateY(-1px);
  }

  .secondary {
    border: 1px solid #dce7dd;
    background: #f0f5f0;
    color: var(--emerald);
  }

  .secondary:hover:not(:disabled) {
    border-color: #bfd2c2;
    background: #e7f0e8;
  }

  .reload {
    min-height: 39px;
    border: 1px solid #e0e8df;
    background: #fff;
    color: #496a53;
  }

  .reload:hover:not(:disabled) {
    border-color: #bfd2c2;
    background: #f3f7f2;
  }

  .edit-button {
    border: 1px solid #dce7dd;
    background: #f0f5f0;
    color: #376547;
  }

  .edit-button:hover:not(:disabled) {
    background: #e3eee5;
    border-color: #c4d8c7;
  }

  .delete-button,
  .remove-button {
    border: 1px solid #f0deda;
    background: #fff5f3;
    color: #ae5148;
  }

  .delete-button:hover:not(:disabled),
  .remove-button:hover:not(:disabled) {
    border-color: #eac5bf;
    background: #ffebe7;
  }

  button:disabled {
    opacity: .5;
    cursor: not-allowed;
    transform: none !important;
  }

  .form-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    flex-wrap: wrap;
    margin-top: 20px;
    padding-top: 18px;
    border-top: 1px solid #edf0eb;
  }

  .form-footer p {
    max-width: 430px;
    margin: 0;
    color: #89938a;
    font-size: 10px;
    line-height: 1.8;
  }

  .actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 9px;
    flex-wrap: wrap;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 11px;
    margin-bottom: 15px;
  }

  .search-wrap {
    position: relative;
    flex: 1;
    min-width: 180px;
  }

  .search-icon {
    position: absolute;
    top: 50%;
    left: 13px;
    color: #8a988d;
    font-size: 19px;
    transform: translateY(-52%);
    pointer-events: none;
  }

  .search-input {
    padding-left: 39px;
  }

  .filter {
    width: auto;
    min-width: 175px;
    cursor: pointer;
  }

  .result-count {
    margin-bottom: 12px;
    color: #8b968c;
    font-size: 10px;
    font-weight: 600;
  }

  .table-wrap {
    width: 100%;
    overflow-x: auto;
    border: 1px solid #e7ece6;
    border-radius: 13px;
  }

  .table {
    width: 100%;
    min-width: 990px;
    border-collapse: separate;
    border-spacing: 0;
    font-size: 11px;
  }

  .table th {
    padding: 15px 14px;
    border-bottom: 1px solid #e6ebe5;
    background: #f5f7f3;
    color: #66766a;
    text-align: left;
    white-space: nowrap;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: .45px;
  }

  .table td {
    padding: 15px 14px;
    border-bottom: 1px solid #edf0eb;
    color: #758077;
    vertical-align: middle;
  }

  .table tbody tr {
    transition: background .15s ease;
  }

  .table tbody tr:hover {
    background: #f8faf7;
  }

  .table tbody tr:last-child td {
    border-bottom: 0;
  }

  .code {
    display: inline-block;
    padding: 6px 9px;
    border: 1px solid #e5ebe3;
    border-radius: 7px;
    background: #f3f6f1;
    color: #496650;
    font-size: 10px;
    font-weight: 800;
    white-space: nowrap;
  }

  .name {
    color: #2c4033;
    font-size: 11px;
    font-weight: 800;
  }

  .price,
  .stock {
    color: var(--emerald);
    font-weight: 800;
    white-space: nowrap;
  }

  .status {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 10px;
    border-radius: 8px;
    font-size: 9px;
    font-weight: 800;
    white-space: nowrap;
  }

  .approved {
    border: 1px solid #dcebdd;
    background: #edf6ed;
    color: #3e754b;
  }

  .pending {
    border: 1px solid #f0e4c9;
    background: #fcf6e9;
    color: #a17b35;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
  }

  .action-buttons {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 6px;
    flex-wrap: nowrap;
  }

  .empty {
    padding: 40px 18px;
    border: 1px dashed #dce5dc;
    border-radius: 13px;
    background: #fafbf9;
    color: #8a958b;
    text-align: center;
    font-size: 11px;
    line-height: 1.8;
  }

  .empty strong {
    display: block;
    margin-bottom: 6px;
    color: #42594a;
    font-family: var(--font-manrope), sans-serif;
    font-size: 13px;
    font-weight: 800;
  }

  .edit-panel {
    padding: 21px;
    border: 1px solid #e1e9df;
    border-radius: 14px;
    background: #f8faf7;
  }

  .edit-title {
    margin: 0 0 6px;
    color: var(--emerald-dark);
    font-family: var(--font-manrope), sans-serif;
    font-size: 15px;
    font-weight: 800;
  }

  .edit-description {
    margin: 0 0 19px;
    color: #859087;
    font-size: 10px;
    line-height: 1.8;
  }

  .edit-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 12px;
  }

  .edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 9px;
    margin-top: 20px;
  }

  .alert {
    display: flex;
    align-items: flex-start;
    gap: 11px;
    padding: 15px 17px;
    border-radius: 12px;
    font-size: 11px;
    line-height: 1.7;
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

  .info {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px 18px;
    border: 1px solid #e8e8dc;
    border-radius: 13px;
    background: #faf9f4;
    color: #7e887e;
    font-size: 10px;
    line-height: 1.8;
  }

  .info-icon {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 27px;
    height: 27px;
    border-radius: 9px;
    background: #f0eadb;
    color: #987b45;
    font-weight: 800;
  }

  .info strong {
    display: block;
    margin-bottom: 3px;
    color: #56634f;
  }

  .list-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 17px;
  }

  .list-tab {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: 39px;
    padding: 0 14px;
    border: 1px solid #e1e8df;
    border-radius: 9px;
    background: #fff;
    color: #617365;
    font-family: inherit;
    font-size: 10px;
    font-weight: 800;
    cursor: pointer;
    transition: all .18s ease;
  }

  .list-tab:hover {
    border-color: #c5d7c8;
    background: #f6f9f5;
  }

  .list-tab span {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 22px;
    height: 22px;
    padding: 0 5px;
    border-radius: 7px;
    background: #f0f4ef;
    color: #607564;
    font-size: 10px;
  }

  .list-tab-active {
    border-color: var(--emerald);
    background: var(--emerald);
    color: white;
    box-shadow: 0 4px 10px rgba(23,75,54,.13);
  }

  .list-tab-active:hover {
    border-color: var(--emerald-dark);
    background: var(--emerald-dark);
    color: white;
  }

  .list-tab-active span {
    background: rgba(255,255,255,.17);
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
      gap: 15px;
    }

    .hero {
      align-items: flex-start;
      flex-direction: column;
      padding: 23px 20px;
      border-radius: 17px;
    }

    .count-chip {
      padding: 9px 12px;
    }

    .stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 9px;
    }

    .stat {
      padding: 15px;
      border-radius: 13px;
    }

    .stat-value {
      font-size: 24px;
    }

    .stat-caption {
      font-size: 9px;
    }

    .panel {
      padding: 17px;
      border-radius: 15px;
    }

    .panel-heading h2 {
      font-size: 15px;
    }

    .draft-row,
    .edit-grid {
      grid-template-columns: 1fr;
    }

    .draft-row {
      padding: 15px;
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

    .search-wrap {
      width: 100%;
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

    .list-tabs {
      gap: 7px;
    }

    .list-tab {
      flex: 1;
      padding: 0 10px;
    }
  }

  @media (max-width: 380px) {
    .stats {
      grid-template-columns: 1fr;
    }

    .actions {
      flex-direction: column;
    }

    .actions .button {
      width: 100%;
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
          {activeProducts.length} barang aktif
        </div>
      </header>

      <div className="stats">
        <div className="stat">
          <div className="stat-label">Total barang aktif</div>
          <div className="stat-value">{activeProducts.length}</div>
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
  <div
    className="modal-overlay"
    onMouseDown={(e) => {
      if (e.target === e.currentTarget && !savingEdit) {
        cancelEdit();
      }
    }}
  >
    <section
      className="modal-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-modal-title"
    >
      <div className="modal-header">
        <div>
          <div className="modal-eyebrow">MANAJEMEN INVENTARIS</div>
          <h2 className="modal-title" id="edit-modal-title">
            Edit Barang
          </h2>
          <p className="modal-description">
            Perbarui informasi barang dan sesuaikan stok yang tersedia.
          </p>
        </div>

        <button
          type="button"
          className="modal-close"
          onClick={cancelEdit}
          disabled={savingEdit}
          aria-label="Tutup"
        >
          ×
        </button>
      </div>

      <form onSubmit={saveEdit}>
        <div className="modal-grid">
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

          <label className="field-wrap">
            <span className="field-label">Satuan</span>
            <input className="field" value="pcs" readOnly />
          </label>
        </div>

        <div className="modal-note">
          <span>ⓘ</span>
          <span>
            Perubahan harga berlaku untuk transaksi berikutnya.
            Pastikan jumlah stok sesuai dengan stok fisik toko.
          </span>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginTop: 15 }}>
            <strong>Gagal</strong>
            <span>{error}</span>
          </div>
        )}

        <div className="modal-footer">
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
  </div>
)}

    </div>
  );
}
