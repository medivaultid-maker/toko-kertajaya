"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import {
  UserPlus,
  Users,
  RefreshCw,
  KeyRound,
  CheckCircle2,
  ShieldCheck,
  UserCheck,
  UserX,
  ArrowUpRight,
} from "lucide-react";

type Employee = {
  id: string;
  full_name: string;
  employee_code: string | null;
  profile_id: string | null;
  is_active: boolean;
};

export default function EmployeeAccountManagement() {
  const supabase = useMemo(() => createClient(), []);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("employees")
      .select("id, full_name, employee_code, profile_id, is_active")
      .order("full_name", { ascending: true });

    if (error) {
      setError("Gagal memuat data karyawan: " + error.message);
      setEmployees([]);
    } else {
      setEmployees((data || []) as Employee[]);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  const availableEmployees = employees.filter(
    (employee) => employee.is_active && !employee.profile_id
  );

  const linkedEmployees = employees.filter(
    (employee) => employee.profile_id
  );

  const activeLinkedEmployees = linkedEmployees.filter(
    (employee) => employee.is_active
  );

  const inactiveLinkedEmployees = linkedEmployees.filter(
    (employee) => !employee.is_active
  );

  async function handleCreateAccount(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setMessage("");
    setError("");

    if (!employeeId) {
      setError("Pilih karyawan terlebih dahulu.");
      return;
    }

    if (password.length < 8) {
      setError("Password minimal 8 karakter.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Konfirmasi password tidak sama.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        "/api/admin/employees/create-account",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            employee_id: employeeId,
            password,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Gagal membuat akun.");
      }

      setMessage(
        `Akun ${result.employee.full_name} berhasil dibuat.`
      );

      setEmployeeId("");
      setPassword("");
      setConfirmPassword("");

      await loadEmployees();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Terjadi kesalahan."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="employee-page">
      <div className="employee-container">

        {/* HEADER */}
        <section className="hero">
          <div className="hero-decoration hero-decoration-one" />
          <div className="hero-decoration hero-decoration-two" />

          <div className="hero-content">
            <div>
              <div className="eyebrow">
                <ShieldCheck size={14} />
                MANAJEMEN AKUN
              </div>

              <h1 className="title">Akun Karyawan</h1>
            </div>

            <div className="hero-icon">
              <Users size={35} strokeWidth={1.5} />
            </div>
          </div>

          <div className="hero-bottom">
            <span className="count-chip">
              <span className="count-dot" />
              {employees.length} Data Karyawan
            </span>
          </div>
        </section>

        {/* NOTIFICATION */}
        {message && (
          <div className="alert success">
            <CheckCircle2 size={19} />
            <div>
              <strong>Berhasil</strong>
              <p>{message}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="alert danger" role="alert">
            <ShieldCheck size={19} />
            <div>
              <strong>Terjadi kesalahan</strong>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* STATISTICS */}
        <section className="stats">
          <div className="stat">
            <div>
              <p className="stat-label">Total Akun Terhubung</p>
              <h2 className="stat-value">
                {linkedEmployees.length}
              </h2>
              <p className="stat-caption">
                Karyawan memiliki akun
              </p>
            </div>
            <div className="stat-icon green">
              <Users size={22} />
            </div>
          </div>

          <div className="stat">
            <div>
              <p className="stat-label">Akun Aktif</p>
              <h2 className="stat-value">
                {activeLinkedEmployees.length}
              </h2>
              <p className="stat-caption">
                Karyawan berstatus aktif
              </p>
            </div>
            <div className="stat-icon gold">
              <UserCheck size={22} />
            </div>
          </div>

          <div className="stat">
            <div>
              <p className="stat-label">Belum Memiliki Akun</p>
              <h2 className="stat-value">
                {availableEmployees.length}
              </h2>
              <p className="stat-caption">
                Karyawan aktif belum terdaftar
              </p>
            </div>
            <div className="stat-icon neutral">
              <UserPlus size={22} />
            </div>
          </div>
        </section>

        {/* CREATE ACCOUNT */}
        <section className="panel">
         <div className="panel-heading">
  <div className="heading-icon">
    <UserPlus size={21} />
  </div>
  <div className="heading-text">
    <h2>Buat Akun Karyawan</h2>
    <p>
      Buat akses login untuk karyawan yang belum memiliki akun.
    </p>
  </div>
</div>

          <div className="panel-body">
            <form onSubmit={handleCreateAccount}>
              <div className="form-grid">
                <div className="field-wrap full">
                  <label className="field-label">
                    Pilih karyawan
                  </label>

                  <select
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    required
                    disabled={
                      loading ||
                      saving ||
                      availableEmployees.length === 0
                    }
                    className="field"
                  >
                    <option value="">-- Pilih karyawan --</option>

                    {availableEmployees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.full_name}
                      </option>
                    ))}
                  </select>

                  {!loading && availableEmployees.length === 0 && (
                    <p className="field-hint warning">
                      Tidak ada karyawan aktif yang belum memiliki akun.
                      Tambahkan karyawan melalui menu Data karyawan.
                    </p>
                  )}
                </div>

                <div className="field-wrap">
                  <label className="field-label">
  <KeyRound size={14} />
  Password karyawan
</label>

                  <div className="input-icon-wrap">
  <input
    type="password"
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    minLength={8}
    required
    autoComplete="new-password"
    placeholder="Minimal 8 karakter"
    className="field"
  />
</div>

                  <p className="field-hint">
                    Password minimal 8 karakter.
                  </p>
                </div>

                <div className="field-wrap">
                  <label className="field-label">
                    Konfirmasi Password
                  </label>

                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) =>
                      setConfirmPassword(e.target.value)
                    }
                    minLength={8}
                    required
                    autoComplete="new-password"
                    placeholder="Ulangi password"
                    className="field"
                  />

                  {confirmPassword.length > 0 &&
                    password !== confirmPassword && (
                      <p className="field-hint danger-text">
                        Password belum sama.
                      </p>
                    )}
                </div>
              </div>

              <div className="form-footer">
                <button
                  type="submit"
                  disabled={
                    saving ||
                    loading ||
                    availableEmployees.length === 0
                  }
                  className="button primary"
                >
                  <UserPlus size={17} />
                  {saving ? "Membuat akun..." : "Buat Akun Karyawan"}
                  {!saving && <ArrowUpRight size={16} />}
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* LINKED ACCOUNTS */}
        <section className="panel">
          <div className="panel-heading table-heading">
            <div className="heading-left">
              <div className="heading-icon gold-heading">
                <Users size={21} />
              </div>
              <div>
                <h2>Daftar Akun Terhubung</h2>
                <p>
                  {linkedEmployees.length} akun karyawan terdaftar
                </p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="empty">
              <RefreshCw size={25} className="spin" />
              <p>Memuat data akun karyawan...</p>
            </div>
          ) : linkedEmployees.length === 0 ? (
            <div className="empty">
              <Users size={30} />
              <strong>Belum ada akun karyawan</strong>
              <p>
                Akun karyawan yang berhasil dibuat akan muncul di sini.
              </p>
            </div>
          ) : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>No.</th>
                      <th>Kode karyawan</th>
                      <th>Nama karyawan</th>
                      <th>Status karyawan</th>
                    </tr>
                  </thead>

                  <tbody>
                    {linkedEmployees.map((employee, index) => (
                      <tr key={employee.id}>
                        <td className="number-cell">
                          {index + 1}
                        </td>

                        <td>
                          <span className="code">
                            {employee.employee_code || "-"}
                          </span>
                        </td>

                        <td>
                          <span className="name">
                            {employee.full_name}
                          </span>
                        </td>

                        <td>
                          {employee.is_active ? (
                            <span className="status approved">
                              <span className="dot" />
                              Aktif
                            </span>
                          ) : (
                            <span className="status inactive">
                              <span className="dot" />
                              Nonaktif
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="table-footer">
                <span>
                  Menampilkan {linkedEmployees.length} akun karyawan
                </span>

                <div className="footer-status">
                  <span>
                    <UserCheck size={14} />
                    {activeLinkedEmployees.length} Aktif
                  </span>
                  <span>
                    <UserX size={14} />
                    {inactiveLinkedEmployees.length} Nonaktif
                  </span>
                </div>
              </div>
            </>
          )}
        </section>

      </div>

      {/* PAGE CSS */}
      <style jsx>{`
        .employee-page {
          --emerald: #174b36;
          --emerald-dark: #103a2a;
          --emerald-soft: #edf4ef;
          --gold: #b99a62;
          --ivory: #f8f8f4;
          --ink: #26352c;
          --muted: #849087;
          --line: #e8ece6;

          min-height: 100vh;
          padding: 28px;
          background: var(--ivory);
          color: var(--ink);
          font-family: var(--font-dm-sans), sans-serif;
        }

        .employee-container {
          width: 100%;
          max-width: 1440px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 22px;
        }

        .hero {
          position: relative;
          display: grid;
          grid-template-columns: 1fr;
          align-items: center;
          gap: 24px;
          min-height: 150px;
          overflow: hidden;
          padding: 30px 27px;
          border: 1px solid #e5e9e1;
          border-radius: 20px;
          background:
            radial-gradient(
              circle at 92% 10%,
              rgba(185, 154, 98, 0.13),
              transparent 28%
            ),
            linear-gradient(115deg, #ffffff 0%, #f5f8f3 100%);
          color: var(--ink);
          box-shadow: 0 8px 28px rgba(24, 55, 37, 0.035);
        }

        .hero-decoration {
          position: absolute;
          border: 1px solid rgba(185, 154, 98, 0.24);
          border-radius: 50%;
          pointer-events: none;
        }

        .hero-decoration-one {
          width: 240px;
          height: 240px;
          right: -45px;
          top: -115px;
        }

        .hero-decoration-two {
          width: 175px;
          height: 175px;
          right: 5px;
          top: -82px;
        }

        .hero-content {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
        }

        .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
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
          line-height: 1.25;
        }

        .hero-icon {
          display: flex;
          width: 65px;
          height: 65px;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          border: 1px solid #e8dfca;
          border-radius: 15px;
          background: rgba(255, 255, 255, 0.8);
          color: var(--gold);
        }

        .hero-bottom {
          position: relative;
          z-index: 1;
          margin-top: 0;
        }

        .count-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 13px;
          border: 1px solid #dce8de;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.85);
          color: var(--emerald);
          font-size: 11px;
          font-weight: 800;
        }

        .count-dot,
        .dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #8fc69a;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          align-items: stretch;
          gap: 16px;
        }

        .stat {
          position: relative;
          display: flex;
          min-width: 0;
          min-height: 135px;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          overflow: hidden;
          padding: 22px 24px;
          border: 1px solid var(--line);
          border-radius: 16px;
          background: #fff;
          box-shadow: 0 5px 18px rgba(24, 55, 37, 0.035);
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease;
        }

        .stat:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 25px rgba(24, 55, 37, 0.07);
        }

        .stat-label {
          color: #7e8a80;
          font-size: 11px;
          font-weight: 700;
          line-height: 1.5;
        }

        .stat-value {
          margin-top: 11px;
          color: var(--emerald-dark);
          font-family: var(--font-manrope), sans-serif;
          font-size: clamp(22px, 2vw, 27px);
          font-weight: 800;
          letter-spacing: -1px;
          line-height: 1.25;
        }

        .stat-caption {
          margin-top: 7px;
          color: #9aa39b;
          font-size: 10px;
          line-height: 1.6;
        }

        .stat-icon,
        .heading-icon {
          display: flex;
          width: 45px;
          height: 45px;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
        }

        .green,
        .heading-icon {
          background: var(--emerald-soft);
          color: #47745c;
        }

        .gold,
        .gold-heading {
          background: #f6f1e6;
          color: #a1844d;
        }

        .neutral {
          background: #f1f2ed;
          color: #818d7e;
        }

        .panel {
          min-width: 0;
          padding: 27px;
          border: 1px solid var(--line);
          border-radius: 18px;
          background: #fff;
          box-shadow: 0 6px 22px rgba(24, 55, 37, 0.035);
        }

       .panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 13px;
  margin-bottom: 23px;
  flex-wrap: nowrap;
  text-align: left;
}

        .panel-heading h2 {
          margin: 0 0 7px;
          color: var(--emerald-dark);
          font-family: var(--font-manrope), sans-serif;
          font-size: 17px;
          font-weight: 800;
          letter-spacing: -0.4px;
          line-height: 1.4;
        }

        .panel-heading p {
          margin: 0;
          color: #89938a;
          font-size: 11px;
          line-height: 1.75;
        }

        .panel-body {
          padding: 0;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          align-items: start;
          gap: 20px;
        }

        .field-wrap {
          display: flex;
          min-width: 0;
          flex-direction: column;
          gap: 8px;
        }

        .field-wrap.full {
          grid-column: 1 / -1;
        }

        .field-label {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 18px;
  color: #526157;
  font-size: 10px;
  font-weight: 800;
  text-align: left;
}

.field-label svg {
  color: #a1844d;
  flex-shrink: 0;
}

        .input-icon-wrap {
          position: relative;
          width: 100%;
        }

        .input-icon-wrap > svg {
          position: absolute;
          top: 14px;
          left: 14px;
          color: #8b968a;
        }

        .field {
          box-sizing: border-box;
          display: block;
          width: 100%;
          min-width: 0;
          min-height: 46px;
          padding: 0 14px;
          border: 1px solid #e2e8e1;
          border-radius: 10px;
          outline: none;
          background: #fff;
          color: #304136;
          font-family: inherit;
          font-size: 12px;
          transition:
            border-color 0.18s ease,
            box-shadow 0.18s ease;
        }

        .field::placeholder {
          color: #b1b9b1;
        }

        .field:focus {
          border-color: #789b83;
          box-shadow: 0 0 0 3px rgba(45, 105, 68, 0.09);
        }

        .field:disabled {
          cursor: not-allowed;
          background: #f5f5f0;
          opacity: 0.7;
        }

        .with-icon {
          padding-left: 40px;
        }

        .field-hint {
          min-height: 16px;
          color: #969c93;
          font-size: 11px;
          line-height: 1.5;
        }

        .field-hint.warning {
          color: #a17b39;
        }

        .field-hint.danger-text {
          color: #c04c43;
        }

        .form-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 15px;
          flex-wrap: wrap;
          margin-top: 22px;
          padding-top: 19px;
          border-top: 1px solid #edf0eb;
        }

        .button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          min-height: 44px;
          padding: 0 21px;
          border: 0;
          border-radius: 9px;
          font-family: inherit;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.18s ease;
        }

        .button:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .primary {
          background: linear-gradient(135deg, #205a3e, #123d2b);
          color: white;
          box-shadow: 0 4px 11px rgba(23, 75, 54, 0.16);
        }

        .primary:hover:not(:disabled) {
          background: #0e3525;
          box-shadow: 0 6px 15px rgba(23, 75, 54, 0.22);
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

        .table-heading {
          justify-content: space-between;
        }

        .heading-left {
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .table-wrap {
          width: 100%;
          overflow-x: auto;
          border: 1px solid #e7ece6;
          border-radius: 13px;
        }

        .table {
          width: 100%;
          min-width: 580px;
          border-collapse: separate;
          border-spacing: 0;
          text-align: left;
          font-size: 11px;
          table-layout: fixed;
        }

        .table thead {
          background: #f5f7f3;
        }

        .table th {
          padding: 15px 16px;
          border-bottom: 1px solid #e6ebe5;
          color: #66766a;
          text-align: left;
          white-space: nowrap;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.45px;
        }

        .table td {
          padding: 16px;
          border-bottom: 1px solid #edf0eb;
          color: #758077;
          vertical-align: middle;
          line-height: 1.5;
        }

        .table tbody tr {
          transition: background 0.15s ease;
        }

        .table tbody tr:hover {
          background: #f8faf7;
        }

        .table tbody tr:last-child td {
          border-bottom: 0;
        }

        .number-cell {
          color: #92998f !important;
        }

        .code {
          display: inline-flex;
          padding: 5px 9px;
          border: 1px solid #e8e5d9;
          border-radius: 7px;
          background: #f8f6ef;
          color: #79633d;
          font-family: monospace;
          font-size: 11px;
          font-weight: 700;
        }

        .name {
          color: #2c4033;
          font-size: 12px;
          font-weight: 800;
          overflow-wrap: anywhere;
        }

        .status {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          min-height: 29px;
          padding: 6px 10px;
          border: 1px solid;
          border-radius: 8px;
          font-size: 9px;
          font-weight: 800;
          white-space: nowrap;
        }

        .status.approved {
          border-color: #dcebdd;
          background: #edf6ed;
          color: #3e754b;
        }

        .status.inactive {
          border-color: #e4e8e3;
          background: #f2f4f1;
          color: #778178;
        }

        .status.inactive .dot {
          background: #a0a39a;
        }

        .table-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 13px;
          color: #8b968c;
          font-size: 10px;
        }

        .footer-status {
          display: flex;
          flex-wrap: wrap;
          gap: 15px;
        }

        .footer-status span {
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }

        .empty {
          display: flex;
          min-height: 150px;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 35px 18px;
          border: 1px dashed #dce5dc;
          border-radius: 13px;
          background: #fafbf9;
          color: #8a958b;
          text-align: center;
          font-size: 11px;
          line-height: 1.8;
        }

        .empty strong {
          color: #42594a;
          font-family: var(--font-manrope), sans-serif;
          font-size: 13px;
          font-weight: 800;
        }

        .empty p {
          max-width: 350px;
          margin: 0;
          color: #92998f;
          font-size: 11px;
          line-height: 1.7;
        }

        .alert {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          padding: 15px 17px;
          border: 1px solid;
          border-radius: 12px;
          font-size: 11px;
          line-height: 1.7;
          overflow-wrap: anywhere;
        }

        .alert strong {
          display: block;
          margin-bottom: 4px;
        }

        .alert p {
          margin: 0;
          line-height: 1.6;
        }

        .success {
          border-color: #dcebdd;
          background: #f0f7ef;
          color: #3c7046;
        }

        .danger {
          border-color: #f0d9d5;
          background: #fff5f3;
          color: #a64d45;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 900px) {
          .table {
            min-width: 580px;
          }
        }

        @media (max-width: 700px) {
          .employee-page {
            padding: 20px;
          }

          .employee-container {
            gap: 15px;
          }

          .hero {
            min-height: auto;
            padding: 23px 20px;
            border-radius: 17px;
          }

          .title {
            font-size: 26px;
          }

          .hero-icon {
            width: 48px;
            height: 48px;
          }

          .stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }

          .stats .stat:last-child {
            grid-column: 1 / -1;
          }

          .stat {
            min-height: 120px;
            padding: 16px;
            border-radius: 13px;
          }

          .stat-value {
            font-size: 23px;
          }

          .panel {
            padding: 23px 20px;
            border-radius: 15px;
          }

          .panel-heading {
            align-items: flex-start;
            margin-bottom: 19px;
          }

       .heading-text {
  flex: 1;
  min-width: 0;

          .form-grid {
            grid-template-columns: 1fr;
            gap: 15px;
          }

          .field-wrap.full {
            grid-column: auto;
          }

          .form-footer {
            align-items: stretch;
            flex-direction: column;
          }

          .form-footer .button {
            width: 100%;
          }

          .table-heading {
            align-items: flex-start;
          }

          .table-footer {
            padding: 0;
          }
        }

        @media (max-width: 380px) {
          .employee-page {
            padding: 14px;
          }

          .stats {
            grid-template-columns: 1fr;
          }

          .stats .stat:last-child {
            grid-column: auto;
          }

          .stat {
            min-height: 105px;
          }

          .hero,
          .panel {
            padding-left: 18px;
            padding-right: 18px;
          }

          .title {
            font-size: 26px;
          }

          .hero-icon {
            display: none;
          }
        }
      `}</style>
    </main>
  );
}