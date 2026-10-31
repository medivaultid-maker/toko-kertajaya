
"use client";

import { useCallback, useEffect, useState } from "react";
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

export default function EmployeeDebtManagement() {
  const [supabase] = useState(() => createClient());

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [items, setItems] = useState<DebtItem[]>([]);
  const [code, setCode] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [lookingUp, setLookingUp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [activeView, setActiveView] = useState<
  "form" | "list" | "detail"
>("form");

const [debtSummaries, setDebtSummaries] = useState<DebtSummary[]>([]);
const [selectedEmployee, setSelectedEmployee] =
  useState<DebtSummary | null>(null);

const [employeeDebts, setEmployeeDebts] = useState<DebtRecord[]>([]);
const [debtDetails, setDebtDetails] = useState<DebtDetailItem[]>([]);

const [loadingDebts, setLoadingDebts] = useState(false);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("employees")
      .select("id, full_name, is_active")
      .eq("is_active", true)
      .order("full_name");

    if (error) {
      setError(`Gagal memuat karyawan: ${error.message}`);
    } else {
      setEmployees((data ?? []) as Employee[]);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  const total = items.reduce(
    (sum, item) =>
      sum +
      Number(item.quantity || 0) *
        Number(item.product.current_selling_price ?? 0),
    0
  );
  const grandOriginalTotal = debtSummaries.reduce(
  (sum, employee) => sum + employee.original_total,
  0
);

const grandRemainingTotal = debtSummaries.reduce(
  (sum, employee) => sum + employee.remaining_total,
  0
);

  const loadDebtSummaries = useCallback(async () => {
  setLoadingDebts(true);
  setError("");

  try {
    const [
      { data: employeeData, error: employeeError },
      { data: debtData, error: debtError },
    ] = await Promise.all([
      supabase
        .from("employees")
        .select("id, full_name"),

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
            (sum, debt) => sum + Number(debt.original_amount || 0),
            0
          ),
          remaining_total: debts.reduce(
            (sum, debt) => sum + Number(debt.remaining_amount || 0),
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

async function openEmployeeDebt(employee: DebtSummary) {
  setSelectedEmployee(employee);
  setEmployeeDebts([]);
  setDebtDetails([]);
  setActiveView("detail");
  setLoadingDebts(true);
  setError("");

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

  async function findProduct(event: React.FormEvent<HTMLFormElement>) {
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
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, product_code, name, brand, unit, current_selling_price, price_status, is_active"
        )
        .eq("product_code", productCode)
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        setError(`Gagal mencari barang: ${error.message}`);
        return;
      }

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
        setItems((current) => [...current, { product, quantity: "1" }]);
        setMessage(`${product.name} berhasil ditambahkan.`);
      }

      setCode("");
      requestAnimationFrame(() => {
        document.getElementById("employee-debt-product-code")?.focus();
      });
    } finally {
      setLookingUp(false);
    }
  }

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
    document.getElementById("employee-debt-product-code")?.focus();
  }

  async function saveDebt() {
  setError("");
  setMessage("");

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
    setError("Total piutang harus lebih dari nol.");
    return;
  }

  setSaving(true);

  try {
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

      refreshedItems.push({ ...item, product });
    }

    const verifiedTotal = refreshedItems.reduce(
      (sum, item) =>
        sum +
        Number(item.quantity) *
          Number(item.product.current_selling_price),
      0
    );

    const { data: debtId, error: debtError } = await supabase.rpc(
      "create_employee_debt",
      {
        p_employee_id: employeeId,
        p_items: refreshedItems.map((item) => ({
          product_id: item.product.id,
          quantity: Number(item.quantity),
        })),
        p_notes: notes.trim() || null,
      }
    );

    if (debtError) throw debtError;
    if (!debtId) throw new Error("Piutang gagal disimpan.");

    setMessage(
      `Piutang berhasil disimpan sebesar ${rupiah(verifiedTotal)}.`
    );

    setItems([]);
    setEmployeeId("");
    setNotes("");
    setCode("");

    await loadDebtSummaries();
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

  return (
    <div className="debt-page">
      <style jsx>{`
      .debt-overview {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 20px;
}

.debt-overview-item {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 19px;
  border: 1px solid var(--line);
  border-radius: 13px;
  background: #fafbf8;
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

@media (max-width: 640px) {
  .debt-overview {
    grid-template-columns: 1fr;
  }
}
      .debt-tabs {
  display: flex;
  gap: 8px;
  padding: 5px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #f5f7f3;
}

.debt-tab {
  min-height: 42px;
  padding: 0 18px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: #778275;
  font: inherit;
  font-size: 12px;
  font-weight: 750;
  cursor: pointer;
}

.debt-tab.active {
  background: var(--emerald);
  color: white;
  box-shadow: 0 3px 8px rgba(23, 75, 54, 0.12);
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
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 13px;
  background: white;
  color: var(--ink);
  text-align: left;
  cursor: pointer;
  transition: 0.2s;
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
  gap: 12px;
}

.debt-detail-stat {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 12px;
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
  padding: 17px;
  border: 1px solid var(--line);
  border-radius: 13px;
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

.debt-history-top > div {
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
  padding: 6px 10px;
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
  display: flex;
  flex-direction: column;
  gap: 5px;
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

.debt-item-row > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
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
  
  .debt-page {
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
    padding-bottom: 30px;
    color: var(--ink);
    font-family: var(--font-dm-sans), sans-serif;
  }

  .debt-hero {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .eyebrow {
    margin-bottom: 9px;
    color: var(--gold);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 1.8px;
  }

  .title {
    margin: 0;
    color: var(--emerald-dark);
    font-family: var(--font-manrope), sans-serif;
    font-size: clamp(25px, 3vw, 33px);
    font-weight: 800;
    letter-spacing: -1.1px;
  }

  .subtitle {
    margin: 8px 0 0;
    color: var(--muted);
    font-size: 13px;
    line-height: 1.7;
  }

  .count-chip {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 14px 8px 8px;
    border: 1px solid var(--line);
    border-radius: 13px;
    background: #fff;
    color: var(--emerald);
    font-size: 12px;
    font-weight: 700;
  }

  .count-number {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: 10px;
    background: var(--emerald-soft);
    color: var(--emerald);
    font-size: 14px;
    font-weight: 800;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 15px;
  }

  .stat {
    position: relative;
    overflow: hidden;
    padding: 20px 22px;
    border: 1px solid var(--line);
    border-radius: 17px;
    background: #fff;
    box-shadow: 0 4px 16px rgba(25, 55, 37, 0.025);
  }

  .stat::after {
    position: absolute;
    top: 0;
    left: 0;
    width: 3px;
    height: 100%;
    background: var(--gold);
    content: "";
  }

  .stat-label {
    color: var(--muted);
    font-size: 12px;
    font-weight: 600;
  }

  .stat-value {
    margin-top: 10px;
    color: var(--emerald-dark);
    font-family: var(--font-manrope), sans-serif;
    font-size: clamp(21px, 2.7vw, 28px);
    font-weight: 800;
    letter-spacing: -0.8px;
    overflow-wrap: anywhere;
  }

  .stat-caption {
    margin-top: 5px;
    color: #9aa198;
    font-size: 11px;
  }

  .alert {
    display: flex;
    align-items: flex-start;
    gap: 11px;
    padding: 14px 16px;
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

  .card {
    min-width: 0;
    padding: 25px;
    border: 1px solid var(--line);
    border-radius: 18px;
    background: #fff;
    box-shadow: 0 4px 18px rgba(25, 55, 37, 0.035);
  }

  .section-heading {
    display: flex;
    align-items: center;
    gap: 13px;
    margin-bottom: 21px;
  }

  .section-icon {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 42px;
    height: 42px;
    border: 1px solid #e2eae2;
    border-radius: 12px;
    background: var(--emerald-soft);
    color: var(--emerald);
    font-size: 21px;
    font-weight: 800;
  }

  .section-heading h2 {
    margin: 0 0 5px;
    color: var(--emerald-dark);
    font-family: var(--font-manrope), sans-serif;
    font-size: 16px;
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
    gap: 11px;
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
    transition: background 0.2s, transform 0.2s, box-shadow 0.2s;
  }

  .button-primary {
    background: var(--emerald);
    color: #fff;
    box-shadow: 0 3px 8px rgba(23, 75, 54, 0.12);
  }

  .button-primary:hover:not(:disabled) {
    background: var(--emerald-dark);
    box-shadow: 0 5px 12px rgba(23, 75, 54, 0.16);
    transform: translateY(-1px);
  }

  .button-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
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
    padding: 14px;
    text-align: left;
    white-space: nowrap;
    color: #657469;
    background: #f7f9f6;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.35px;
    border-bottom: 1px solid var(--line);
  }

  .table td {
    padding: 15px 14px;
    border-bottom: 1px solid #edf0eb;
    vertical-align: middle;
  }

  .table tbody tr {
    transition: background 0.15s;
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
    transition: background 0.15s;
  }

  .delete-button:hover {
    background: #ffe9e5;
  }

  .empty {
    margin-top: 22px;
    padding: 32px 16px;
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

  .notes {
    min-height: 90px;
    padding: 12px 14px;
    resize: vertical;
    line-height: 1.6;
  }

  .optional {
    color: #9aa198;
    font-weight: 400;
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
    margin-top: 5px;
    color: #929b90;
    font-size: 10px;
  }

  .save-button {
    min-height: 48px;
    padding: 0 23px;
  }

  .info-box {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px 18px;
    border: 1px solid #e7eae2;
    border-radius: 13px;
    background: #fafbf8;
    color: #788276;
    font-size: 11px;
    line-height: 1.75;
  }

  .info-icon {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 25px;
    height: 25px;
    border-radius: 50%;
    background: #edf3e9;
    color: var(--emerald);
    font-weight: 800;
  }

  .info-box strong {
    display: block;
    margin-bottom: 3px;
    color: var(--emerald);
    font-size: 11px;
  }

  @media (max-width: 640px) {
    .debt-page {
      gap: 16px;
    }

    .stats {
      gap: 9px;
    }

    .stat {
      padding: 15px;
      border-radius: 13px;
    }

    .stat-caption {
      line-height: 1.5;
    }

    .card {
      padding: 17px;
      border-radius: 15px;
    }

    .section-heading {
      align-items: flex-start;
      gap: 10px;
    }

    .section-icon {
      width: 37px;
      height: 37px;
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

    .info-box {
      padding: 14px;
    }

    .debt-tabs {
  width: 100%;
}

.debt-tab {
  flex: 1;
  padding: 0 8px;
}

.employee-debt-card {
  flex-wrap: wrap;
  gap: 10px;
  padding: 13px;
}

.employee-debt-balance {
  width: 100%;
  align-items: flex-start;
  padding-left: 53px;
}

.employee-chevron {
  margin-left: auto;
}

.debt-detail-stats {
  grid-template-columns: 1fr;
}
  }

  @media (max-width: 380px) {
    .stats {
      grid-template-columns: 1fr;
    }
  }
`}</style>

      <header className="debt-hero">
        <div>
          <div className="eyebrow">KEUANGAN KARYAWAN</div>
          <h1 className="title">Piutang Karyawan</h1>
          <p className="subtitle">
            Catat pengambilan barang karyawan dengan pembayaran tertunda.
          </p>
        </div>

        <div className="count-chip">
          <span className="count-number">{items.length}</span>
          <span>Jenis barang</span>
        </div>
      </header>

<div className="debt-tabs">
  <button
    type="button"
    className={`debt-tab ${activeView === "form" ? "active" : ""}`}
    onClick={() => {
      setActiveView("form");
      setError("");
    }}
  >
    + Input Piutang
  </button>

  <button
    type="button"
    className={`debt-tab ${activeView !== "form" ? "active" : ""}`}
    onClick={() => {
      setActiveView("list");
      setSelectedEmployee(null);
      setError("");
      void loadDebtSummaries();
    }}
  >
    Daftar Karyawan
  </button>
</div>

{activeView === "form" && (
  <>


      {(error || message) && (
        <div
          role={error ? "alert" : "status"}
          className={`alert ${
            error ? "alert-error" : "alert-success"
          }`}
        >
          <span className="alert-icon">{error ? "!" : "✓"}</span>
          <div>
            <strong>
              {error ? "Belum dapat diproses" : "Berhasil"}
            </strong>
            <div>{error || message}</div>
          </div>
        </div>
      )}

      <section className="card">
        <div className="section-heading">
          <div className="section-icon">＋</div>
          <div>
            <h2>Data Piutang Baru</h2>
            <p>Pilih karyawan, lalu masukkan kode barang yang diambil.</p>
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

        <div className="divider" />

        <div className="section-heading">
          <div className="section-icon">⌕</div>
          <div>
            <h2>Tambah Barang</h2>
            <p>Masukkan kode barang sesuai master Barang &amp; Stok.</p>
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
                            Number(item.product.current_selling_price)
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
              Cari barang menggunakan kode di atas. Barang yang ditemukan
              akan muncul di daftar ini.
            </p>
          </div>
        )}

        <div className="add-more">
          <button
            type="button"
            className="button button-secondary"
            onClick={addAnotherItem}
          >
            + Tambah Barang Lagi
          </button>
        </div>

        <div className="divider" />

        <label className="field-label" htmlFor="debt-notes">
          Catatan tambahan <span className="optional">(opsional)</span>
        </label>
        <textarea
          id="debt-notes"
          className="field notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Contoh: pembayaran dipotong dari gaji minggu ini..."
          rows={3}
        />

        <div className="summary">
          <div>
            <div className="total-label">TOTAL PIUTANG</div>
            <div className="total-value">{rupiah(total)}</div>
            <div className="total-caption">
              {items.length} jenis barang · Belum termasuk pembayaran
            </div>
          </div>

          <button
            type="button"
            className="button button-primary save-button"
            onClick={() => void saveDebt()}
            disabled={saving || loading || items.length === 0}
          >
            {saving ? "Menyimpan piutang..." : "✓ Simpan Piutang"}
          </button>
        </div>
      </section>

      <aside className="info-box">
        <span className="info-icon">i</span>
        <div>
         <strong>Informasi pencatatan stok</strong>
Setiap piutang yang berhasil disimpan akan otomatis mengurangi
stok barang sesuai jumlah yang diambil. 
        </div>
        
    </aside>
  </>
)}
  
{activeView === "list" && (
  <section className="card">
    <div className="section-heading">
      <div className="section-icon">♙</div>
      <div>
        <h2>Daftar Piutang Karyawan</h2>
        <p>Pilih nama karyawan untuk melihat rincian piutangnya.</p>
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
        <p>Piutang yang berhasil dicatat akan muncul di sini.</p>
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
              <span>{employee.debt_count} transaksi piutang</span>
              <small>
                Total awal: {rupiah(employee.original_total)}
              </small>
            </div>

            <div className="employee-debt-balance">
              <span>Sisa piutang</span>
              <strong>{rupiah(employee.remaining_total)}</strong>
            </div>

            <span className="employee-chevron">›</span>
          </button>
        ))}
      </div>
    )}
  </section>
)}

{activeView === "detail" && (
  <section className="card">
    <button
      type="button"
      className="button button-secondary"
      onClick={() => {
        setActiveView("list");
        setError("");
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
            <p>Riwayat pengambilan barang dan piutang karyawan</p>
          </div>
        </div>

        <div className="debt-detail-stats">
          <div className="debt-detail-stat">
            <span>Total piutang awal</span>
            <strong>{rupiah(selectedEmployee.original_total)}</strong>
          </div>

          <div className="debt-detail-stat">
            <span>Sisa piutang</span>
            <strong>{rupiah(selectedEmployee.remaining_total)}</strong>
          </div>
        </div>

        <div className="divider" />

        <h3 className="debt-history-title">Riwayat Piutang</h3>

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

              return (
                <article className="debt-history-card" key={debt.id}>
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
                        debt.remaining_amount <= 0 ||
                        debt.status === "paid"
                          ? "paid"
                          : "unpaid"
                      }`}
                    >
                      {debt.remaining_amount <= 0 ||
                      debt.status === "paid"
                        ? "Lunas"
                        : "Belum lunas"}
                    </span>
                  </div>

                  <div className="debt-history-total">
                    <div>
                      <span>Total awal</span>
                      <strong>{rupiah(Number(debt.original_amount))}</strong>
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
                      <div className="debt-item-row" key={item.id}>
                        <div>
                          <strong>{item.product_name_snapshot}</strong>
                          <span>
                            {item.product_code_snapshot}
                            {item.brand_snapshot
                              ? ` · ${item.brand_snapshot}`
                              : ""}
                          </span>
                          <small>
                            {item.quantity} ×{" "}
                            {rupiah(Number(item.selling_price_snapshot))}
                          </small>
                        </div>

                        <strong>{rupiah(Number(item.line_total))}</strong>
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