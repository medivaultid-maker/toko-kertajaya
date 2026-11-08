"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@/lib/supabase";

type Employee = {
  id: string;
  full_name: string;
  is_active: boolean;
};

type Product = {
  id: string;
  product_code: string;
  name: string;
  brand: string;
  unit: string;
  current_selling_price: number | null;
  price_status: string;
  is_active: boolean;
};

type DebtItem = {
  product: Product;
  quantity: string;
};

type DebtSummary = {
  id: string;
  full_name: string;
  debt_count: number;
  original_total: number;
  remaining_total: number;
};

type DebtRecord = {
  id: string;
  employee_id: string;
  description: string | null;
  debt_date: string;
  original_amount: number;
  remaining_amount: number;
  status: string;
  created_at: string;
};

type DebtDetailItem = {
  id: string;
  debt_id: string;
  product_name_snapshot: string;
  product_code_snapshot: string;
  brand_snapshot: string | null;
  quantity: number;
  selling_price_snapshot: number;
  line_total: number;
};

const rupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

// Menghasilkan tanggal lokal YYYY-MM-DD tanpa bergantung pada UTC.
const getLocalDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function EmployeeDebtManagement() {
  const [supabase] = useState(() => createClient());

  // DATA KARYAWAN DAN BARANG
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [items, setItems] = useState<DebtItem[]>([]);

  // FORM
  const [debtDate, setDebtDate] = useState(() => getLocalDateString());
  const [code, setCode] = useState("");
  const [notes, setNotes] = useState("");

  // DISKON
  const [discountType, setDiscountType] = useState<
    "amount" | "percent"
  >("amount");
  const [discount, setDiscount] = useState("0");

  // STATUS
  const [loading, setLoading] = useState(true);
  const [lookingUp, setLookingUp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingDebts, setLoadingDebts] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // NAVIGASI
  const [activeView, setActiveView] = useState<
    "form" | "list" | "detail"
  >("form");

  // DATA RIWAYAT PIUTANG
  const [debtSummaries, setDebtSummaries] = useState<DebtSummary[]>([]);
  const [selectedEmployee, setSelectedEmployee] =
    useState<DebtSummary | null>(null);
  const [employeeDebts, setEmployeeDebts] = useState<DebtRecord[]>([]);
  const [debtDetails, setDebtDetails] = useState<DebtDetailItem[]>([]);

  // ==========================================
  // LOAD KARYAWAN
  // ==========================================

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data, error: employeeError } = await supabase
        .from("employees")
        .select("id, full_name, is_active")
        .eq("is_active", true)
        .order("full_name");

      if (employeeError) throw employeeError;

      setEmployees((data ?? []) as Employee[]);
    } catch (err) {
      setError(
        `Gagal memuat karyawan: ${
          err instanceof Error ? err.message : "Terjadi kesalahan."
        }`
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  // ==========================================
  // PERHITUNGAN TOTAL DAN DISKON
  // ==========================================

  const total = items.reduce(
    (sum, item) =>
      sum +
      Number(item.quantity || 0) *
        Number(item.product.current_selling_price ?? 0),
    0
  );

  const discountValue = Number(discount || 0);

  const discountAmount =
    discountType === "percent"
      ? Math.round(total * (discountValue / 100))
      : Math.round(discountValue);

  const finalTotal = Math.max(0, total - discountAmount);

  const grandOriginalTotal = debtSummaries.reduce(
    (sum, employee) => sum + employee.original_total,
    0
  );

  const grandRemainingTotal = debtSummaries.reduce(
    (sum, employee) => sum + employee.remaining_total,
    0
  );

  // ==========================================
  // LOAD RINGKASAN PIUTANG
  // ==========================================

  const loadDebtSummaries = useCallback(async () => {
    setLoadingDebts(true);
    setError("");

    try {
      const [
        { data: employeeData, error: employeeError },
        { data: debtData, error: debtError },
      ] = await Promise.all([
        supabase.from("employees").select("id, full_name"),

        supabase
          .from("employee_debts")
          .select("id, employee_id, original_amount, remaining_amount"),
      ]);

      if (employeeError) throw employeeError;
      if (debtError) throw debtError;

      const summaries: DebtSummary[] = (employeeData ?? [])
        .map((employee) => {
          const debts = (debtData ?? []).filter(
            (debt) => debt.employee_id === employee.id
          );

          return {
            id: employee.id,
            full_name: employee.full_name,
            debt_count: debts.length,
            original_total: debts.reduce(
              (sum, debt) =>
                sum + Number(debt.original_amount || 0),
              0
            ),
            remaining_total: debts.reduce(
              (sum, debt) =>
                sum + Number(debt.remaining_amount || 0),
              0
            ),
          };
        })
        .filter((employee) => employee.debt_count > 0)
        .sort((a, b) => a.full_name.localeCompare(b.full_name));

      setDebtSummaries(summaries);
    } catch (err) {
      setError(
        `Gagal memuat daftar piutang: ${
          err instanceof Error ? err.message : "Terjadi kesalahan."
        }`
      );
    } finally {
      setLoadingDebts(false);
    }
  }, [supabase]);

  // ==========================================
  // DETAIL PIUTANG KARYAWAN
  // ==========================================

  async function openEmployeeDebt(employee: DebtSummary) {
    setSelectedEmployee(employee);
    setEmployeeDebts([]);
    setDebtDetails([]);
    setActiveView("detail");
    setLoadingDebts(true);
    setError("");
    setMessage("");

    try {
      const { data: debts, error: debtsError } = await supabase
        .from("employee_debts")
        .select(
          "id, employee_id, description, debt_date, original_amount, remaining_amount, status, created_at"
        )
        .eq("employee_id", employee.id)
        .order("debt_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (debtsError) throw debtsError;

      const debtRows = (debts ?? []) as DebtRecord[];
      setEmployeeDebts(debtRows);

      if (debtRows.length > 0) {
        const debtIds = debtRows.map((debt) => debt.id);

        const { data: detailRows, error: detailError } = await supabase
          .from("employee_debt_items")
          .select(
            "id, debt_id, product_name_snapshot, product_code_snapshot, brand_snapshot, quantity, selling_price_snapshot, line_total"
          )
          .in("debt_id", debtIds)
          .order("created_at", { ascending: true });

        if (detailError) throw detailError;

        setDebtDetails((detailRows ?? []) as DebtDetailItem[]);
      }
    } catch (err) {
      setError(
        `Gagal membuka detail piutang: ${
          err instanceof Error ? err.message : "Terjadi kesalahan."
        }`
      );
    } finally {
      setLoadingDebts(false);
    }
  }

  // ==========================================
  // CARI BARANG
  // ==========================================

  async function findProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const productCode = code.trim();

    if (!productCode) {
      setError("Masukkan kode barang terlebih dahulu.");
      return;
    }

    setLookingUp(true);

    try {
      const { data, error: productError } = await supabase
        .from("products")
        .select(
          "id, product_code, name, brand, unit, current_selling_price, price_status, is_active"
        )
        .eq("product_code", productCode)
        .eq("is_active", true)
        .maybeSingle();

      if (productError) throw productError;

      if (!data) {
        setError(`Kode barang "${productCode}" tidak ditemukan.`);
        return;
      }

      const product = data as Product;

      if (
        product.price_status !== "approved" ||
        product.current_selling_price === null
      ) {
        setError(
          `Harga ${product.name} belum disetujui. Tetapkan harga terlebih dahulu di Barang & Stok.`
        );
        return;
      }

      const existingIndex = items.findIndex(
        (item) => item.product.id === product.id
      );

      if (existingIndex >= 0) {
        setItems((current) =>
          current.map((item) =>
            item.product.id === product.id
              ? {
                  ...item,
                  quantity: String(Number(item.quantity || 0) + 1),
                }
              : item
          )
        );

        setMessage(`${product.name} sudah ada; jumlah ditambah 1.`);
      } else {
        setItems((current) => [
          ...current,
          { product, quantity: "1" },
        ]);

        setMessage(`${product.name} berhasil ditambahkan.`);
      }

      setCode("");

      requestAnimationFrame(() => {
        document
          .getElementById("employee-debt-product-code")
          ?.focus();
      });
    } catch (err) {
      setError(
        `Gagal mencari barang: ${
          err instanceof Error ? err.message : "Terjadi kesalahan."
        }`
      );
    } finally {
      setLookingUp(false);
    }
  }

  // ==========================================
  // UPDATE JUMLAH BARANG
  // ==========================================

  function updateQuantity(index: number, quantity: string) {
    if (quantity !== "" && Number(quantity) < 0) return;

    setItems((current) =>
      current.map((item, i) =>
        i === index ? { ...item, quantity } : item
      )
    );
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, i) => i !== index));
    setMessage("");
  }

  function addAnotherItem() {
    setError("");
    setMessage("");

    const input = document.getElementById(
      "employee-debt-product-code"
    ) as HTMLInputElement | null;

    if (input) {
      input.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      setTimeout(() => input.focus(), 300);
    }
  }

  // ==========================================
  // SIMPAN PIUTANG DENGAN DISKON
  // ==========================================

  async function saveDebt() {
    setError("");
    setMessage("");

    if (!debtDate) {
      setError("Pilih tanggal piutang terlebih dahulu.");
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(debtDate)) {
      setError("Tanggal piutang tidak valid.");
      return;
    }

    if (!employeeId) {
      setError("Pilih karyawan terlebih dahulu.");
      return;
    }

    if (items.length === 0) {
      setError("Tambahkan minimal satu barang.");
      return;
    }

    if (
      items.some(
        (item) =>
          !Number.isInteger(Number(item.quantity)) ||
          Number(item.quantity) <= 0
      )
    ) {
      setError("Jumlah barang harus berupa bilangan bulat lebih dari nol.");
      return;
    }

    if (total <= 0) {
      setError("Subtotal piutang harus lebih dari nol.");
      return;
    }

    if (!Number.isFinite(discountValue) || discountValue < 0) {
      setError("Nilai diskon tidak valid.");
      return;
    }

    if (discountType === "percent" && discountValue > 100) {
      setError("Diskon persentase maksimal 100%.");
      return;
    }

    if (discountType === "amount" && discountValue > total) {
      setError("Diskon Rupiah tidak boleh melebihi subtotal piutang.");
      return;
    }

    setSaving(true);

    try {
      // Ambil ulang harga terbaru dari database.
      const productIds = items.map((item) => item.product.id);

      const { data: currentProducts, error: priceError } = await supabase
        .from("products")
        .select(
          "id, product_code, name, brand, unit, current_selling_price, price_status, is_active"
        )
        .in("id", productIds);

      if (priceError || !currentProducts) {
        throw new Error(
          priceError?.message ?? "Data barang tidak ditemukan."
        );
      }

      const currentById = new Map(
        (currentProducts as Product[]).map((product) => [
          product.id,
          product,
        ])
      );

      const refreshedItems: DebtItem[] = [];

      for (const item of items) {
        const product = currentById.get(item.product.id);

        if (
          !product ||
          !product.is_active ||
          product.price_status !== "approved" ||
          product.current_selling_price === null ||
          !product.product_code
        ) {
          throw new Error(
            `Barang ${item.product.name} tidak aktif atau harganya belum valid.`
          );
        }

        refreshedItems.push({
          ...item,
          product,
        });
      }

      // Hitung ulang subtotal berdasarkan harga terbaru.
      const verifiedTotal = refreshedItems.reduce(
        (sum, item) =>
          sum +
          Number(item.quantity) *
            Number(item.product.current_selling_price),
        0
      );

      if (verifiedTotal <= 0) {
        throw new Error("Subtotal piutang tidak valid.");
      }

      // Validasi diskon berdasarkan subtotal terbaru.
      if (
        !Number.isFinite(discountValue) ||
        discountValue < 0
      ) {
        throw new Error("Nilai diskon tidak valid.");
      }

      if (
        discountType === "percent" &&
        discountValue > 100
      ) {
        throw new Error("Diskon persentase maksimal 100%.");
      }

      if (
        discountType === "amount" &&
        discountValue > verifiedTotal
      ) {
        throw new Error(
          "Diskon Rupiah tidak boleh melebihi subtotal piutang terbaru."
        );
      }

      const verifiedDiscountAmount =
        discountType === "percent"
          ? Math.round(verifiedTotal * (discountValue / 100))
          : Math.round(discountValue);

      if (verifiedDiscountAmount > verifiedTotal) {
        throw new Error(
          "Diskon tidak boleh melebihi subtotal piutang."
        );
      }

      const verifiedFinalTotal =
        verifiedTotal - verifiedDiscountAmount;

      if (verifiedFinalTotal <= 0) {
        throw new Error(
          "Total piutang setelah diskon harus lebih dari nol."
        );
      }

      // Simpan melalui RPC Supabase.
      const { data: debtId, error: debtError } = await supabase.rpc(
        "create_employee_debt_with_discount",
        {
          p_employee_id: employeeId,
          p_items: refreshedItems.map((item) => ({
            product_id: item.product.id,
            quantity: Number(item.quantity),
          })),
          p_notes: notes.trim() || null,
          p_discount_type: discountType,
          p_discount_value: discountValue,
        }
      );

      if (debtError) throw debtError;

      if (!debtId) {
        throw new Error("Piutang gagal disimpan.");
      }

      // Simpan tanggal yang dipilih ke kolom debt_date.
      const { error: dateUpdateError } = await supabase
        .from("employee_debts")
        .update({ debt_date: debtDate })
        .eq("id", debtId);

      if (dateUpdateError) {
        throw new Error(
          `Piutang sudah dibuat, tetapi tanggal gagal diperbarui: ${dateUpdateError.message}`
        );
      }

      setMessage(
        `Piutang berhasil disimpan sebesar ${rupiah(
          verifiedFinalTotal
        )}.`
      );

      // Reset form.
      setDiscountType("amount");
      setDiscount("0");
      setItems([]);
      setEmployeeId("");
      setDebtDate(getLocalDateString());
      setNotes("");
      setCode("");

      await loadDebtSummaries();
      setActiveView("list");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat menyimpan piutang."
      );
    } finally {
      setSaving(false);
    }
  }

  // ==========================================
  // TAMPILAN
  // ==========================================

  return (
    <div className="debt-page">
      <style jsx>{`
        .debt-page {
          --emerald: #174b36;
          --emerald-dark: #103a2a;
          --emerald-soft: #edf4ef;
          --gold: #b99a62;
          --ivory: #f8f8f4;
          --ink: #26352c;
          --muted: #849087;
          --line: #e8ece6;

          width: 100%;
          max-width: 1440px;
          min-height: 100vh;
          box-sizing: border-box;
          margin: 0 auto;
          padding: 28px;
          display: flex;
          flex-direction: column;
          gap: 22px;
          background: var(--ivory);
          color: var(--ink);
          font-family: var(--font-dm-sans), sans-serif;
        }

        .debt-hero {
          display: flex;
          align-items: center;
          min-height: 150px;
          padding: 30px 27px;
          border: 1px solid #e5e9e1;
          border-radius: 20px;
          background:
            radial-gradient(
              circle at 92% 15%,
              rgba(185, 154, 98, 0.13),
              transparent 25%
            ),
            linear-gradient(120deg, #fff 0%, #f1f6f0 100%);
          box-shadow: 0 4px 18px rgba(25, 55, 37, 0.035);
        }

        .eyebrow {
          margin-bottom: 9px;
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
          letter-spacing: -1.1px;
        }

        .subtitle {
          margin: 8px 0 0;
          color: var(--muted);
          font-size: 13px;
          line-height: 1.7;
        }

        .debt-tabs {
          display: flex;
          align-self: flex-start;
          width: fit-content;
          max-width: 100%;
          gap: 6px;
          padding: 5px;
          border: 1px solid var(--line);
          border-radius: 12px;
          background: #fff;
        }

        .debt-tab {
          min-height: 42px;
          padding: 0 20px;
          border: 0;
          border-radius: 9px;
          background: transparent;
          color: #778275;
          font: inherit;
          font-size: 12px;
          font-weight: 750;
          white-space: nowrap;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .debt-tab:hover:not(.active) {
          background: var(--emerald-soft);
          color: var(--emerald);
        }

        .debt-tab.active {
          background: var(--emerald);
          color: #fff;
          box-shadow: 0 3px 8px rgba(23, 75, 54, 0.12);
        }

        .card {
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
          padding: 27px;
          border: 1px solid var(--line);
          border-radius: 18px;
          background: #fff;
          box-shadow: 0 4px 18px rgba(25, 55, 37, 0.035);
        }

        .section-heading {
          display: flex;
          align-items: center;
          gap: 13px;
          width: 100%;
          margin-bottom: 23px;
          text-align: left;
        }

        .section-heading > div:last-child {
          flex: 1;
          min-width: 0;
        }

        .section-icon {
          display: grid;
          place-items: center;
          flex-shrink: 0;
          width: 45px;
          height: 45px;
          border: 1px solid #e2eae2;
          border-radius: 13px;
          background: var(--emerald-soft);
          color: var(--emerald);
          font-size: 21px;
          font-weight: 800;
        }

        .section-heading h2 {
          margin: 0 0 5px;
          color: var(--emerald-dark);
          font-family: var(--font-manrope), sans-serif;
          font-size: 17px;
          font-weight: 800;
        }

        .section-heading p {
          margin: 0;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.6;
        }

        .field-label {
          display: block;
          margin-bottom: 8px;
          color: #455248;
          font-size: 12px;
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
          min-height: 46px;
          padding: 0 14px;
          border: 1px solid #e0e6df;
          border-radius: 10px;
          background: #fff;
          color: var(--ink);
          font: inherit;
          font-size: 13px;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .field:hover:not(:disabled) {
          border-color: #bdcdbf;
        }

        .field:focus {
          border-color: var(--emerald);
          box-shadow: 0 0 0 3px rgba(23, 75, 54, 0.09);
        }

        .field:disabled {
          background: #f6f7f4;
          cursor: not-allowed;
        }

        .divider {
          height: 1px;
          margin: 26px 0;
          background: var(--line);
        }

        .search-row {
          display: flex;
          align-items: flex-end;
          gap: 12px;
        }

        .search-field {
          flex: 1;
          min-width: 0;
        }

        .button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 46px;
          padding: 0 18px;
          border: 0;
          border-radius: 10px;
          font: inherit;
          font-size: 12px;
          font-weight: 750;
          cursor: pointer;
          transition: background 0.2s, transform 0.2s;
        }

        .button-primary {
          background: var(--emerald);
          color: #fff;
        }

        .button-primary:hover:not(:disabled) {
          background: var(--emerald-dark);
          transform: translateY(-1px);
        }

        .button-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .button-secondary {
          border: 1px solid #dfe8df;
          background: var(--emerald-soft);
          color: var(--emerald);
        }

        .button-secondary:hover {
          background: #e3eee5;
        }

        .table-wrap {
          width: 100%;
          margin-top: 22px;
          overflow-x: auto;
          border: 1px solid var(--line);
          border-radius: 13px;
        }

        .table {
          width: 100%;
          min-width: 680px;
          border-collapse: collapse;
          font-size: 12px;
        }

        .table th {
          padding: 15px 14px;
          text-align: left;
          white-space: nowrap;
          color: #657469;
          background: #f5f7f3;
          font-size: 10px;
          font-weight: 800;
          border-bottom: 1px solid var(--line);
        }

        .table td {
          padding: 15px 14px;
          border-bottom: 1px solid #edf0eb;
          vertical-align: middle;
        }

        .table tbody tr:hover {
          background: #fafbf9;
        }

        .table tbody tr:last-child td {
          border-bottom: 0;
        }

        .product-name {
          color: var(--ink);
          font-weight: 750;
        }

        .product-meta {
          margin-top: 5px;
          color: #929a91;
          font-size: 10px;
        }

        .product-code {
          display: inline-block;
          padding: 5px 9px;
          border: 1px solid #e5ebe3;
          border-radius: 7px;
          background: #f3f6f1;
          color: var(--emerald);
          font-size: 10px;
          font-weight: 750;
        }

        .quantity {
          width: 85px;
          min-height: 36px;
          padding: 0 9px;
          border: 1px solid #dfe5dc;
          border-radius: 8px;
          background: #fff;
          color: var(--ink);
          font: inherit;
          font-size: 12px;
          outline: none;
        }

        .quantity:focus {
          border-color: var(--emerald);
          box-shadow: 0 0 0 3px rgba(23, 75, 54, 0.08);
        }

        .delete-button {
          min-height: 34px;
          padding: 0 11px;
          border: 1px solid #f1dfdc;
          border-radius: 8px;
          background: #fff5f3;
          color: #a7443d;
          font: inherit;
          font-size: 11px;
          font-weight: 750;
          cursor: pointer;
        }

        .delete-button:hover {
          background: #ffe9e5;
        }

        .empty {
          margin-top: 22px;
          padding: 35px 18px;
          text-align: center;
          border: 1px dashed #dce5da;
          border-radius: 13px;
          background: #fafbf9;
        }

        .empty-icon {
          display: grid;
          place-items: center;
          width: 46px;
          height: 46px;
          margin: 0 auto 12px;
          border: 1px solid #e3ebe1;
          border-radius: 13px;
          background: var(--emerald-soft);
          color: var(--emerald);
          font-size: 21px;
        }

        .empty strong {
          display: block;
          color: var(--ink);
          font-size: 12px;
        }

        .empty p {
          max-width: 360px;
          margin: 7px auto 0;
          color: var(--muted);
          font-size: 11px;
          line-height: 1.7;
        }

        .add-more {
          margin-top: 16px;
        }

        .summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          flex-wrap: wrap;
          margin-top: 25px;
          padding: 22px;
          border: 1px solid #e2e9df;
          border-radius: 15px;
          background: #f7f9f5;
        }

        .total-label {
          color: #778275;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1px;
        }

        .total-value {
          margin-top: 7px;
          color: var(--emerald);
          font-family: var(--font-manrope), sans-serif;
          font-size: clamp(25px, 3vw, 32px);
          font-weight: 850;
          letter-spacing: -0.9px;
          overflow-wrap: anywhere;
        }

        .total-caption {
          margin-top: 6px;
          color: #929b90;
          font-size: 11px;
        }

        .save-button {
          min-height: 48px;
          padding: 0 23px;
        }

        .alert {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          padding: 15px 17px;
          border-radius: 12px;
          font-size: 13px;
          line-height: 1.65;
          overflow-wrap: anywhere;
        }

        .alert-error {
          color: #a13737;
          background: #fff4f2;
          border: 1px solid #f0d9d5;
        }

        .alert-success {
          color: #285c3b;
          background: #eff6f0;
          border: 1px solid #dce9dd;
        }

        .alert-icon {
          font-weight: 900;
        }

        .debt-overview {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          margin-top: 20px;
        }

        .debt-overview-item {
          display: flex;
          flex-direction: column;
          gap: 9px;
          padding: 21px;
          border: 1px solid var(--line);
          border-radius: 15px;
          background: #fff;
        }

        .debt-overview-item span {
          color: var(--muted);
          font-size: 11px;
          font-weight: 600;
        }

        .debt-overview-item strong {
          color: var(--emerald-dark);
          font-family: var(--font-manrope), sans-serif;
          font-size: clamp(17px, 2.5vw, 23px);
          font-weight: 800;
          overflow-wrap: anywhere;
        }

        .debt-overview-item.highlight {
          border-color: #dce8dc;
          background: var(--emerald-soft);
        }

        .debt-overview-item.highlight strong {
          color: var(--emerald);
        }

        .employee-debt-list,
        .debt-history-list {
          display: flex;
          flex-direction: column;
          gap: 11px;
          margin-top: 20px;
        }

        .employee-debt-card {
          display: flex;
          align-items: center;
          gap: 14px;
          width: 100%;
          padding: 17px;
          border: 1px solid var(--line);
          border-radius: 13px;
          background: #fff;
          color: var(--ink);
          text-align: left;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .employee-debt-card:hover {
          border-color: #b8cbb9;
          background: #fafcf9;
          transform: translateY(-1px);
        }

        .employee-avatar {
          display: grid;
          place-items: center;
          flex-shrink: 0;
          width: 43px;
          height: 43px;
          border-radius: 12px;
          background: var(--emerald-soft);
          color: var(--emerald);
          font-size: 17px;
          font-weight: 850;
        }

        .employee-avatar.large {
          width: 52px;
          height: 52px;
          font-size: 21px;
        }

        .employee-debt-info {
          display: flex;
          flex: 1;
          min-width: 0;
          flex-direction: column;
          gap: 4px;
        }

        .employee-debt-info strong {
          color: var(--emerald-dark);
          font-size: 13px;
        }

        .employee-debt-info span,
        .employee-debt-info small {
          color: var(--muted);
          font-size: 11px;
        }

        .employee-debt-balance {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 5px;
        }

        .employee-debt-balance span {
          color: var(--muted);
          font-size: 10px;
        }

        .employee-debt-balance strong {
          color: var(--emerald);
          font-size: 13px;
        }

        .employee-chevron {
          color: var(--gold);
          font-size: 25px;
        }

        .employee-detail-heading {
          display: flex;
          align-items: center;
          gap: 14px;
          margin: 25px 0 20px;
        }

        .employee-detail-heading h2 {
          margin: 0;
          color: var(--emerald-dark);
          font-family: var(--font-manrope), sans-serif;
          font-size: 20px;
        }

        .employee-detail-heading p {
          margin: 5px 0 0;
          color: var(--muted);
          font-size: 12px;
        }

        .debt-detail-stats {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .debt-detail-stat {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 19px;
          border: 1px solid var(--line);
          border-radius: 13px;
          background: #fafbf8;
        }

        .debt-detail-stat span {
          color: var(--muted);
          font-size: 11px;
        }

        .debt-detail-stat strong {
          color: var(--emerald);
          font-size: 16px;
          overflow-wrap: anywhere;
        }

        .debt-history-title {
          margin: 0;
          color: var(--emerald-dark);
          font-size: 15px;
        }

        .debt-history-card {
          padding: 19px;
          border: 1px solid var(--line);
          border-radius: 14px;
          background: #fff;
        }

        .debt-history-top,
        .debt-history-total,
        .debt-item-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .debt-history-top > div,
        .debt-history-total > div,
        .debt-item-row > div {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .debt-history-top strong {
          color: var(--emerald-dark);
          font-size: 13px;
        }

        .debt-description {
          color: var(--muted);
          font-size: 11px;
        }

        .debt-status {
          padding: 6px 11px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 750;
          white-space: nowrap;
        }

        .debt-status.paid {
          background: #edf5ee;
          color: #347044;
        }

        .debt-status.unpaid {
          background: #fff4e8;
          color: #a66a25;
        }

        .debt-history-total {
          justify-content: flex-start;
          flex-wrap: wrap;
          margin-top: 17px;
          padding: 13px 0;
          border-top: 1px solid var(--line);
          border-bottom: 1px solid var(--line);
        }

        .debt-history-total > div {
          min-width: 130px;
        }

        .debt-history-total span {
          color: var(--muted);
          font-size: 10px;
        }

        .debt-history-total strong {
          color: var(--emerald);
          font-size: 12px;
        }

        .debt-items {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 14px;
        }

        .debt-item-row {
          align-items: flex-start;
          font-size: 11px;
        }

        .debt-item-row > div strong {
          color: var(--ink);
        }

        .debt-item-row span,
        .debt-item-row small {
          color: var(--muted);
        }

        .debt-item-row > strong {
          color: var(--emerald);
          white-space: nowrap;
        }

        @media (max-width: 700px) {
          .debt-page {
            padding: 20px;
            gap: 16px;
          }

          .debt-hero {
            min-height: 135px;
            padding: 23px 20px;
            border-radius: 17px;
          }

          .title {
            font-size: 27px;
          }

          .card {
            padding: 23px 20px;
            border-radius: 15px;
          }

          .section-heading {
            align-items: flex-start;
            gap: 11px;
          }

          .section-icon {
            width: 40px;
            height: 40px;
          }

          .search-row {
            align-items: stretch;
            flex-direction: column;
          }

          .search-row .button {
            width: 100%;
          }

          .summary {
            align-items: stretch;
            flex-direction: column;
            padding: 18px;
          }

          .save-button {
            width: 100%;
          }

          .debt-tabs {
            width: 100%;
            box-sizing: border-box;
          }

          .debt-tab {
            flex: 1;
            padding: 0 8px;
          }
        }

        @media (max-width: 480px) {
          .debt-overview,
          .debt-detail-stats {
            grid-template-columns: 1fr;
          }

          .employee-debt-card {
            flex-wrap: wrap;
            gap: 10px;
            padding: 14px;
          }

          .employee-debt-balance {
            width: 100%;
            align-items: flex-start;
            padding-left: 53px;
          }

          .employee-chevron {
            margin-left: auto;
          }
        }

        @media (max-width: 380px) {
          .debt-page {
            padding: 14px;
            gap: 15px;
          }

          .debt-hero {
            padding: 22px 18px;
          }

          .card {
            padding: 20px 18px;
          }

          .debt-tabs {
            gap: 4px;
            padding: 4px;
          }

          .debt-tab {
            font-size: 11px;
          }
        }
      `}</style>

      {/* HEADER */}
      <header className="debt-hero">
        <div>
          <div className="eyebrow">KEUANGAN KARYAWAN</div>
          <h1 className="title">Piutang Karyawan</h1>
          <p className="subtitle">
            Catat pengambilan barang karyawan dengan pembayaran tertunda.
          </p>
        </div>
      </header>

      {/* TAB NAVIGASI */}
      <div className="debt-tabs">
        <button
          type="button"
          className={`debt-tab ${
            activeView === "form" ? "active" : ""
          }`}
          onClick={() => {
            setActiveView("form");
            setError("");
            setMessage("");
          }}
        >
          + Input Piutang
        </button>

        <button
          type="button"
          className={`debt-tab ${
            activeView !== "form" ? "active" : ""
          }`}
          onClick={() => {
            setActiveView("list");
            setSelectedEmployee(null);
            setError("");
            setMessage("");
            void loadDebtSummaries();
          }}
        >
          Daftar Karyawan
        </button>
      </div>

      {/* ======================================
          FORM INPUT PIUTANG
      ====================================== */}

      {activeView === "form" && (
        <>
          {(error || message) && (
            <div
              role={error ? "alert" : "status"}
              className={`alert ${
                error ? "alert-error" : "alert-success"
              }`}
            >
              <span className="alert-icon">
                {error ? "!" : "✓"}
              </span>
              <div>
                <strong>
                  {error ? "Belum dapat diproses" : "Berhasil"}
                </strong>
                <div>{error || message}</div>
              </div>
            </div>
          )}

          <section className="card">
            {/* KARYAWAN */}
            <div className="section-heading">
              <div className="section-icon">＋</div>
              <div>
                <h2>Data Piutang Baru</h2>
                <p>
                  Pilih karyawan, lalu masukkan kode barang yang diambil.
                </p>
              </div>
            </div>

            <label className="field-label" htmlFor="debt-employee">
              Pilih karyawan <span className="required">*</span>
            </label>

            <select
              id="debt-employee"
              className="field"
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
              required
              disabled={loading}
            >
              <option value="">
                {loading ? "Memuat data karyawan..." : "Pilih karyawan"}
              </option>

              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.full_name}
                </option>
              ))}
            </select>

            {/* TANGGAL PIUTANG */}
            <div style={{ marginTop: 18 }}>
              <label className="field-label" htmlFor="debt-date">
                Tanggal Piutang <span className="required">*</span>
              </label>
              <input
                id="debt-date"
                className="field"
                type="date"
                value={debtDate}
                onChange={(event) => setDebtDate(event.target.value)}
                required
              />
              <p
                style={{
                  margin: "7px 0 0",
                  color: "#849087",
                  fontSize: 11,
                  lineHeight: 1.5,
                }}
              >
                Pilih tanggal saat barang diambil. Tanggal ini akan digunakan
                pada riwayat piutang karyawan.
              </p>
            </div>

            <div className="divider" />

            {/* PENCARIAN BARANG */}
            <div className="section-heading">
              <div className="section-icon">⌕</div>
              <div>
                <h2>Tambah Barang</h2>
                <p>
                  Masukkan kode barang sesuai master Barang &amp; Stok.
                </p>
              </div>
            </div>

            <form className="search-row" onSubmit={findProduct}>
              <div className="search-field">
                <label
                  className="field-label"
                  htmlFor="employee-debt-product-code"
                >
                  Kode barang
                </label>

                <input
                  id="employee-debt-product-code"
                  className="field"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="Contoh: BRG001"
                  autoComplete="off"
                />
              </div>

              <button
                type="submit"
                className="button button-primary"
                disabled={lookingUp || !code.trim()}
              >
                {lookingUp ? "Mencari..." : "⌕ Cari Barang"}
              </button>
            </form>

            {/* TABEL BARANG */}
            {items.length > 0 ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Kode</th>
                      <th>Nama barang</th>
                      <th>Harga satuan</th>
                      <th>Jumlah</th>
                      <th>Subtotal</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.map((item, index) => (
                      <tr key={item.product.id}>
                        <td>
                          <span className="product-code">
                            {item.product.product_code}
                          </span>
                        </td>

                        <td>
                          <div className="product-name">
                            {item.product.name}
                          </div>
                          <div className="product-meta">
                            {item.product.brand || "Tanpa merek"} ·{" "}
                            {item.product.unit}
                          </div>
                        </td>

                        <td>
                          {rupiah(
                            Number(item.product.current_selling_price)
                          )}
                        </td>

                        <td>
                          <input
                            aria-label={`Jumlah ${item.product.name}`}
                            className="quantity"
                            type="number"
                            min="1"
                            step="1"
                            value={item.quantity}
                            onChange={(event) =>
                              updateQuantity(index, event.target.value)
                            }
                            required
                          />
                        </td>

                        <td>
                          <strong>
                            {rupiah(
                              Number(item.quantity || 0) *
                                Number(
                                  item.product.current_selling_price
                                )
                            )}
                          </strong>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="delete-button"
                            onClick={() => removeItem(index)}
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty">
                <div className="empty-icon">▤</div>
                <strong>Belum ada barang ditambahkan</strong>
                <p>
                  Cari barang menggunakan kode di atas. Barang yang
                  ditemukan akan muncul di daftar ini.
                </p>
              </div>
            )}

            <div className="add-more">
              <button
                type="button"
                className="button button-secondary"
                onClick={addAnotherItem}
              >
                <span style={{ fontSize: "17px" }}>＋</span>
                Tambah Barang Lagi
              </button>
            </div>

            <div className="divider" />

            {/* DISKON */}
            <div className="section-heading">
              <div className="section-icon">%</div>
              <div>
                <h2>Diskon Piutang</h2>
                <p>
                  Berikan potongan harga untuk total pengambilan barang.
                </p>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 14,
              }}
            >
              <div>
                <label
                  className="field-label"
                  htmlFor="debt-discount-type"
                >
                  Jenis Diskon
                </label>

                <select
                  id="debt-discount-type"
                  className="field"
                  value={discountType}
                  onChange={(event) => {
                    setDiscountType(
                      event.target.value as "amount" | "percent"
                    );
                    setDiscount("0");
                  }}
                >
                  <option value="amount">Rupiah (Rp)</option>
                  <option value="percent">Persentase (%)</option>
                </select>
              </div>

              <div>
                <label
                  className="field-label"
                  htmlFor="debt-discount"
                >
                  {discountType === "amount"
                    ? "Nominal Diskon (Rp)"
                    : "Besar Diskon (%)"}
                </label>

                <input
                  id="debt-discount"
                  className="field"
                  type="number"
                  min="0"
                  max={
                    discountType === "percent" ? 100 : total
                  }
                  step={discountType === "percent" ? "0.01" : "1"}
                  value={discount}
                  onChange={(event) => setDiscount(event.target.value)}
                  placeholder="Masukkan diskon"
                />
              </div>
            </div>

            {/* RINGKASAN TOTAL */}
            <div className="summary">
              <div>
                <div className="total-label">SUBTOTAL PIUTANG</div>
                <div className="total-value">{rupiah(total)}</div>

                <div className="total-caption">
                  {items.length} jenis barang
                </div>

                <div className="total-caption">
                  Diskon: -{rupiah(discountAmount)}
                  {discountType === "percent" &&
                    ` (${discountValue || 0}%)`}
                </div>

                <div
                  className="total-label"
                  style={{ marginTop: 14 }}
                >
                  TOTAL PIUTANG SETELAH DISKON
                </div>

                <div className="total-value">
                  {rupiah(finalTotal)}
                </div>
              </div>

              <button
                type="button"
                className="button button-primary save-button"
                onClick={() => void saveDebt()}
                disabled={
                  saving ||
                  items.length === 0 ||
                  !employeeId ||
                  finalTotal <= 0
                }
              >
                {saving ? "Menyimpan..." : "Simpan Piutang"}
              </button>
            </div>
          </section>
        </>
      )}

      {/* ======================================
          DAFTAR PIUTANG KARYAWAN
      ====================================== */}

      {activeView === "list" && (
        <section className="card">
          {(error || message) && (
            <div
              role={error ? "alert" : "status"}
              className={`alert ${
                error ? "alert-error" : "alert-success"
              }`}
              style={{ marginBottom: 20 }}
            >
              <span className="alert-icon">
                {error ? "!" : "✓"}
              </span>
              <div>
                <strong>
                  {error ? "Gagal memuat data" : "Berhasil"}
                </strong>
                <div>{error || message}</div>
              </div>
            </div>
          )}

          <div className="section-heading">
            <div className="section-icon">♙</div>
            <div>
              <h2>Daftar Piutang Karyawan</h2>
              <p>
                Pilih nama karyawan untuk melihat rincian piutangnya.
              </p>
            </div>
          </div>

          <div className="debt-overview">
            <div className="debt-overview-item">
              <span>Total seluruh piutang awal</span>
              <strong>{rupiah(grandOriginalTotal)}</strong>
            </div>

            <div className="debt-overview-item highlight">
              <span>Total sisa piutang seluruh karyawan</span>
              <strong>{rupiah(grandRemainingTotal)}</strong>
            </div>
          </div>

          {loadingDebts ? (
            <div className="empty">
              <strong>Memuat data piutang...</strong>
            </div>
          ) : debtSummaries.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">▤</div>
              <strong>Belum ada piutang karyawan</strong>
              <p>
                Piutang yang berhasil dicatat akan muncul di sini.
              </p>
            </div>
          ) : (
            <div className="employee-debt-list">
              {debtSummaries.map((employee) => (
                <button
                  type="button"
                  key={employee.id}
                  className="employee-debt-card"
                  onClick={() => void openEmployeeDebt(employee)}
                >
                  <div className="employee-avatar">
                    {employee.full_name.charAt(0).toUpperCase()}
                  </div>

                  <div className="employee-debt-info">
                    <strong>{employee.full_name}</strong>
                    <span>
                      {employee.debt_count} transaksi piutang
                    </span>
                    <small>
                      Total awal: {rupiah(employee.original_total)}
                    </small>
                  </div>

                  <div className="employee-debt-balance">
                    <span>Sisa piutang</span>
                    <strong>
                      {rupiah(employee.remaining_total)}
                    </strong>
                  </div>

                  <span className="employee-chevron">›</span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ======================================
          DETAIL PIUTANG KARYAWAN
      ====================================== */}

      {activeView === "detail" && (
        <section className="card">
          <button
            type="button"
            className="button button-secondary"
            onClick={() => {
              setActiveView("list");
              setError("");
              setMessage("");
            }}
          >
            ← Kembali ke Daftar Karyawan
          </button>

          {selectedEmployee && (
            <>
              <div className="employee-detail-heading">
                <div className="employee-avatar large">
                  {selectedEmployee.full_name.charAt(0).toUpperCase()}
                </div>

                <div>
                  <h2>{selectedEmployee.full_name}</h2>
                  <p>
                    Riwayat pengambilan barang dan piutang karyawan
                  </p>
                </div>
              </div>

              <div className="debt-detail-stats">
                <div className="debt-detail-stat">
                  <span>Total piutang awal</span>
                  <strong>
                    {rupiah(selectedEmployee.original_total)}
                  </strong>
                </div>

                <div className="debt-detail-stat">
                  <span>Sisa piutang</span>
                  <strong>
                    {rupiah(selectedEmployee.remaining_total)}
                  </strong>
                </div>
              </div>

              <div className="divider" />

              <h3 className="debt-history-title">Riwayat Piutang</h3>

              {error && (
                <div
                  className="alert alert-error"
                  style={{ marginTop: 15 }}
                >
                  <span className="alert-icon">!</span>
                  <div>{error}</div>
                </div>
              )}

              {loadingDebts ? (
                <div className="empty">
                  <strong>Memuat detail piutang...</strong>
                </div>
              ) : employeeDebts.length === 0 ? (
                <div className="empty">
                  <strong>Belum ada riwayat piutang.</strong>
                </div>
              ) : (
                <div className="debt-history-list">
                  {employeeDebts.map((debt) => {
                    const details = debtDetails.filter(
                      (item) => item.debt_id === debt.id
                    );

                    const isPaid =
                      debt.remaining_amount <= 0 ||
                      debt.status === "paid";

                    return (
                      <article
                        className="debt-history-card"
                        key={debt.id}
                      >
                        <div className="debt-history-top">
                          <div>
                            <strong>
                              {new Date(
                                `${debt.debt_date}T00:00:00`
                              ).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })}
                            </strong>

                            <span className="debt-description">
                              {debt.description || "Pengambilan barang"}
                            </span>
                          </div>

                          <span
                            className={`debt-status ${
                              isPaid ? "paid" : "unpaid"
                            }`}
                          >
                            {isPaid ? "Lunas" : "Belum lunas"}
                          </span>
                        </div>

                        <div className="debt-history-total">
                          <div>
                            <span>Total awal</span>
                            <strong>
                              {rupiah(Number(debt.original_amount))}
                            </strong>
                          </div>

                          <div>
                            <span>Sisa tagihan</span>
                            <strong>
                              {rupiah(Number(debt.remaining_amount))}
                            </strong>
                          </div>
                        </div>

                        <div className="debt-items">
                          {details.map((item) => (
                            <div
                              className="debt-item-row"
                              key={item.id}
                            >
                              <div>
                                <strong>
                                  {item.product_name_snapshot}
                                </strong>

                                <span>
                                  {item.product_code_snapshot}
                                  {item.brand_snapshot
                                    ? ` · ${item.brand_snapshot}`
                                    : ""}
                                </span>

                                <small>
                                  {item.quantity} ×{" "}
                                  {rupiah(
                                    Number(item.selling_price_snapshot)
                                  )}
                                </small>
                              </div>

                              <strong>
                                {rupiah(Number(item.line_total))}
                              </strong>
                            </div>
                          ))}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}