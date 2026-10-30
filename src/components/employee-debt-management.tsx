
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
          !Number.isFinite(Number(item.quantity)) ||
          Number(item.quantity) <= 0
      )
    ) {
      setError("Semua jumlah barang harus lebih dari nol.");
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
        setError(
          `Gagal memverifikasi harga barang: ${
            priceError?.message ?? "Data barang tidak ditemukan."
          }`
        );
        return;
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
          setError(
            `Barang ${item.product.name} tidak aktif atau harga/kodenya belum valid. Periksa kembali master barang.`
          );
          return;
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

      const { data: debt, error: debtError } = await supabase
        .from("employee_debts")
        .insert({
          employee_id: employeeId,
          total_amount: verifiedTotal,
          status: "unpaid",
          notes: notes.trim() || null,
        })
        .select("id")
        .single();

      if (debtError || !debt) {
        setError(
          `Gagal menyimpan piutang: ${
            debtError?.message ?? "ID piutang tidak diterima."
          }`
        );
        return;
      }

      const detailRows = refreshedItems.map((item) => ({
        debt_id: debt.id,
        product_id: item.product.id,
        product_code_snapshot: item.product.product_code,
        product_name_snapshot: item.product.name,
        brand_snapshot: item.product.brand ?? "",
        quantity: Number(item.quantity),
        selling_price_snapshot: Number(
          item.product.current_selling_price
        ),
        line_total:
          Number(item.quantity) *
          Number(item.product.current_selling_price),
      }));

      const { error: itemsError } = await supabase
        .from("employee_debt_items")
        .insert(detailRows);

      if (itemsError) {
        const { error: cleanupError } = await supabase
          .from("employee_debts")
          .delete()
          .eq("id", debt.id);

        setError(
          cleanupError
            ? `Rincian gagal disimpan (${itemsError.message}) dan pembersihan catatan juga gagal (${cleanupError.message}). Periksa database sebelum mencoba lagi.`
            : `Rincian gagal disimpan: ${itemsError.message}. Catatan yang belum lengkap telah dibersihkan.`
        );
        return;
      }

      setMessage(
        `Piutang berhasil disimpan sebesar ${rupiah(verifiedTotal)}.`
      );
      setItems([]);
      setEmployeeId("");
      setNotes("");
      setCode("");
    } catch (err) {
      setError(
        `Terjadi kesalahan: ${
          err instanceof Error ? err.message : "Silakan coba lagi."
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="debt-page">
      <style jsx>{`
        .debt-page {
          display: flex;
          flex-direction: column;
          gap: 22px;
          padding-bottom: 28px;
          color: #243126;
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

        .count-chip {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 14px 9px 9px;
          border: 1px solid #e4eae1;
          border-radius: 13px;
          background: #fff;
          color: #526b55;
          font-size: 12px;
          font-weight: 700;
        }

        .count-number {
          display: grid;
          place-items: center;
          width: 32px;
          height: 32px;
          border-radius: 9px;
          background: #edf4eb;
          font-size: 14px;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .stat {
          padding: 19px 21px;
          border: 1px solid #e8ede5;
          border-radius: 17px;
          background: #fff;
        }

        .stat-label {
          color: #7b8579;
          font-size: 12px;
          font-weight: 600;
        }

        .stat-value {
          margin-top: 10px;
          font-size: clamp(21px, 2.7vw, 28px);
          font-weight: 800;
          letter-spacing: -0.7px;
          overflow-wrap: anywhere;
        }

        .stat-caption {
          margin-top: 5px;
          color: #91998e;
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
          background: #fff2f0;
          border: 1px solid #f3d9d5;
        }

        .alert-success {
          color: #356d42;
          background: #eef7ed;
          border: 1px solid #d9ead5;
        }

        .alert-icon {
          font-weight: 900;
        }

        .card {
          min-width: 0;
          padding: 24px;
          border: 1px solid #e7ece4;
          border-radius: 18px;
          background: #fff;
          box-shadow: 0 4px 16px rgba(35, 55, 35, 0.025);
        }

        .section-heading {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }

        .section-icon {
          display: grid;
          place-items: center;
          flex-shrink: 0;
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: #edf4eb;
          color: #456c4c;
          font-size: 19px;
          font-weight: 800;
        }

        .section-heading h2 {
          margin: 0 0 5px;
          font-size: 16px;
          font-weight: 800;
        }

        .section-heading p {
          margin: 0;
          color: #818a7e;
          font-size: 12px;
          line-height: 1.6;
        }

        .field-label {
          display: block;
          margin-bottom: 8px;
          color: #475147;
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
          min-height: 45px;
          padding: 0 13px;
          border: 1px solid #dfe5dc;
          border-radius: 10px;
          background: #fff;
          color: #283428;
          font: inherit;
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }

        .field:focus {
          border-color: #78977b;
          box-shadow: 0 0 0 3px rgba(105, 145, 109, 0.12);
        }

        .field:disabled {
          background: #f6f7f5;
          cursor: not-allowed;
        }

        .divider {
          height: 1px;
          margin: 25px 0;
          background: #edf0eb;
        }

        .search-row {
          display: flex;
          align-items: flex-end;
          gap: 10px;
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
          min-height: 44px;
          padding: 0 17px;
          border: 0;
          border-radius: 10px;
          font: inherit;
          font-size: 12px;
          font-weight: 750;
          cursor: pointer;
          transition: background 0.15s, transform 0.15s;
        }

        .button-primary {
          background: #426b49;
          color: #fff;
        }

        .button-primary:hover:not(:disabled) {
          background: #34583a;
          transform: translateY(-1px);
        }

        .button-primary:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .button-secondary {
          background: #edf4eb;
          color: #426b49;
          border: 1px solid #e0eadc;
        }

        .button-secondary:hover {
          background: #e2eddf;
        }

        .table-wrap {
          width: 100%;
          margin-top: 22px;
          overflow-x: auto;
          border: 1px solid #e7ece4;
          border-radius: 12px;
        }

        .table {
          width: 100%;
          min-width: 680px;
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
          padding: 14px 13px;
          border-bottom: 1px solid #edf0eb;
          vertical-align: middle;
        }

        .table tbody tr:last-child td {
          border-bottom: 0;
        }

        .product-name {
          color: #2e3a2f;
          font-weight: 750;
        }

        .product-meta {
          margin-top: 5px;
          color: #899187;
          font-size: 10px;
        }

        .product-code {
          display: inline-block;
          padding: 5px 8px;
          border-radius: 6px;
          background: #f1f5ef;
          color: #596d59;
          font-size: 10px;
          font-weight: 750;
        }

        .quantity {
          width: 85px;
          min-height: 35px;
          padding: 0 8px;
          border: 1px solid #dfe5dc;
          border-radius: 8px;
          font: inherit;
          font-size: 12px;
          outline: none;
        }

        .quantity:focus {
          border-color: #78977b;
        }

        .delete-button {
          min-height: 33px;
          padding: 0 10px;
          border: 0;
          border-radius: 8px;
          background: #fff0ef;
          color: #b13e38;
          font: inherit;
          font-size: 11px;
          font-weight: 750;
          cursor: pointer;
        }

        .delete-button:hover {
          background: #ffe2df;
        }

        .empty {
          margin-top: 22px;
          padding: 27px 16px;
          text-align: center;
          border: 1px dashed #dce4d9;
          border-radius: 13px;
          background: #fafbf9;
        }

        .empty-icon {
          display: grid;
          place-items: center;
          width: 43px;
          height: 43px;
          margin: 0 auto 11px;
          border-radius: 12px;
          background: #edf4eb;
          color: #54775a;
          font-size: 20px;
        }

        .empty strong {
          display: block;
          font-size: 12px;
        }

        .empty p {
          margin: 7px 0 0;
          color: #858d82;
          font-size: 11px;
          line-height: 1.7;
        }

        .add-more {
          margin-top: 16px;
        }

        .notes {
          min-height: 84px;
          padding: 12px 13px;
          resize: vertical;
          line-height: 1.6;
        }

        .optional {
          color: #929a90;
          font-weight: 400;
        }

        .summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          flex-wrap: wrap;
          margin-top: 25px;
          padding: 21px;
          border: 1px solid #e0e9dc;
          border-radius: 15px;
          background: #f7faf5;
        }

        .total-label {
          color: #687564;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.7px;
        }

        .total-value {
          margin-top: 7px;
          color: #315c39;
          font-size: clamp(25px, 3vw, 31px);
          font-weight: 850;
          letter-spacing: -0.8px;
          overflow-wrap: anywhere;
        }

        .total-caption {
          margin-top: 5px;
          color: #899386;
          font-size: 10px;
        }

        .save-button {
          min-height: 47px;
          padding: 0 22px;
        }

        .info-box {
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

        .info-box strong {
          display: block;
          margin-bottom: 3px;
          color: #475646;
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
            padding: 14px;
            border-radius: 13px;
          }

          .stat-caption {
            line-height: 1.5;
          }

          .card {
            padding: 16px;
            border-radius: 15px;
          }

          .section-heading {
            align-items: flex-start;
            gap: 10px;
          }

          .section-icon {
            width: 36px;
            height: 36px;
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
            padding: 17px;
          }

          .save-button {
            width: 100%;
          }

          .info-box {
            padding: 13px;
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

      <div className="stats">
        <div className="stat">
          <div className="stat-label">Barang dalam transaksi</div>
          <div className="stat-value">{items.length}</div>
          <div className="stat-caption">
            Jenis barang yang akan dicatat
          </div>
        </div>

        <div className="stat">
          <div className="stat-label">Total piutang baru</div>
          <div className="stat-value">{rupiah(total)}</div>
          <div className="stat-caption">
            Total nilai barang yang diambil
          </div>
        </div>
      </div>

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
                        min="0.001"
                        step="0.001"
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
          Pencatatan piutang ini tidak mengurangi stok secara otomatis.
          Harga dan nama barang disimpan sebagai snapshot pada rincian
          piutang agar riwayat transaksi tetap tercatat.
        </div>
      </aside>
    </div>
  );
}
