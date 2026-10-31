
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
  LockKeyhole,
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

              <h1 className="title">Akun Pegawai</h1>

              <p className="subtitle">
                Kelola akses login dan akun karyawan Toko Rosyidah
                dengan mudah dan terorganisir.
              </p>
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
                Pegawai memiliki akun
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
                Pegawai berstatus aktif
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
                Pegawai aktif belum terdaftar
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
            <div>
              <h2>Buat Akun Pegawai</h2>
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
                    Pilih Karyawan
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
                      Tambahkan karyawan melalui menu Data Karyawan.
                    </p>
                  )}
                </div>

                <div className="field-wrap">
                  <label className="field-label">
                    Password Pegawai
                  </label>

                  <div className="input-icon-wrap">
                    <KeyRound size={17} />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={8}
                      required
                      autoComplete="new-password"
                      placeholder="Minimal 8 karakter"
                      className="field with-icon"
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
                  {saving ? "Membuat akun..." : "Buat Akun Pegawai"}
                  {!saving && <ArrowUpRight size={16} />}
                </button>
              </div>
            </form>

            {/* LOGIN INFORMATION */}
            <div className="info">
              <div className="info-icon">
                <LockKeyhole size={19} />
              </div>
              <div>
                <strong>Informasi Login Pegawai</strong>
                <p>
                  Pegawai login menggunakan nama lengkap dan password
                  yang telah dibuat oleh admin. Pastikan password
                  disampaikan kepada pegawai secara aman.
                </p>
              </div>
            </div>
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
                  {linkedEmployees.length} akun pegawai terdaftar
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void loadEmployees()}
              disabled={loading}
              className="button secondary reload"
            >
              <RefreshCw
                size={15}
                className={loading ? "spin" : ""}
              />
              Muat Ulang
            </button>
          </div>

          {loading ? (
            <div className="empty">
              <RefreshCw size={25} className="spin" />
              <p>Memuat data akun pegawai...</p>
            </div>
          ) : linkedEmployees.length === 0 ? (
            <div className="empty">
              <Users size={30} />
              <strong>Belum ada akun pegawai</strong>
              <p>
                Akun pegawai yang berhasil dibuat akan muncul di sini.
              </p>
            </div>
          ) : (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>No.</th>
                      <th>Kode Pegawai</th>
                      <th>Nama Pegawai</th>
                      <th>Status Karyawan</th>
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
                  Menampilkan {linkedEmployees.length} akun pegawai
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
          overflow: hidden;
          padding: 30px 34px 24px;
          border-radius: 22px;
          background: linear-gradient(
            120deg,
            var(--emerald-dark),
            var(--emerald)
          );
          color: white;
          box-shadow: 0 12px 30px rgba(16, 58, 42, 0.12);
        }

        .hero-decoration {
          position: absolute;
          border: 1px solid rgba(255, 255, 255, 0.1);
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
          margin-bottom: 13px;
          color: #e5d2a7;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.4px;
        }

        .title {
          margin: 0;
          font-family: var(--font-manrope), sans-serif;
          font-size: 30px;
          font-weight: 750;
          letter-spacing: -0.8px;
        }

        .subtitle {
          max-width: 560px;
          margin-top: 8px;
          color: rgba(255, 255, 255, 0.68);
          font-size: 13px;
          line-height: 1.7;
        }

        .hero-icon {
          display: flex;
          width: 72px;
          height: 72px;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(213, 183, 122, 0.3);
          border-radius: 19px;
          background: rgba(255, 255, 255, 0.08);
          color: #e4c98f;
        }

        .hero-bottom {
          position: relative;
          z-index: 1;
          margin-top: 23px;
        }

        .count-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 12px;
          border: 1px solid rgba(255, 255, 255, 0.17);
          border-radius: 30px;
          background: rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.85);
          font-size: 11px;
          font-weight: 600;
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
          gap: 16px;
        }

        .stat {
          display: flex;
          min-width: 0;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 21px;
          border: 1px solid var(--line);
          border-radius: 17px;
          background: white;
          box-shadow: 0 5px 20px rgba(30, 55, 43, 0.025);
        }

        .stat-label {
          color: var(--muted);
          font-size: 12px;
          font-weight: 600;
        }

        .stat-value {
          margin-top: 8px;
          color: var(--emerald-dark);
          font-family: var(--font-manrope), sans-serif;
          font-size: 30px;
          font-weight: 750;
          line-height: 1;
        }

        .stat-caption {
          margin-top: 7px;
          color: #9ba299;
          font-size: 11px;
        }

        .stat-icon,
        .heading-icon {
          display: flex;
          width: 45px;
          height: 45px;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          border-radius: 13px;
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
          overflow: hidden;
          border: 1px solid var(--line);
          border-radius: 18px;
          background: white;
          box-shadow: 0 6px 24px rgba(30, 55, 43, 0.03);
        }

        .panel-heading {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 21px 25px;
          border-bottom: 1px solid #eeefe9;
        }

        .panel-heading h2 {
          color: #2b4033;
          font-family: var(--font-manrope), sans-serif;
          font-size: 15px;
          font-weight: 750;
        }

        .panel-heading p {
          margin-top: 4px;
          color: #899087;
          font-size: 11px;
          line-height: 1.5;
        }

        .panel-body {
          padding: 25px;
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

.input-icon-wrap {
  position: relative;
  width: 100%;
}

.field {
  box-sizing: border-box;
  width: 100%;
  height: 44px;
}

.input-icon-wrap .field {
  padding-left: 40px;
}

.field-hint {
  min-height: 16px;
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
          color: #526054;
          font-size: 12px;
          font-weight: 700;
        }

        .field {
          width: 100%;
          min-width: 0;
          padding: 12px 14px;
          border: 1px solid #dedfd5;
          border-radius: 10px;
          outline: none;
          background: #fffefa;
          color: var(--ink);
          font-family: inherit;
          font-size: 13px;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .field:focus {
          border-color: #47745c;
          box-shadow: 0 0 0 3px rgba(71, 116, 92, 0.1);
        }

        .field:disabled {
          cursor: not-allowed;
          background: #f5f5f0;
          opacity: 0.7;
        }

        .input-icon-wrap {
          position: relative;
        }

        .input-icon-wrap > svg {
          position: absolute;
          top: 13px;
          left: 13px;
          color: #8b968a;
        }

        .with-icon {
          padding-left: 40px;
        }

        .field-hint {
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
          justify-content: flex-start;
          margin-top: 23px;
        }

        .button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          padding: 11px 17px;
          border-radius: 10px;
          font-family: inherit;
          font-size: 12px;
          font-weight: 700;
          transition: all 0.2s;
          cursor: pointer;
        }

        .button:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .primary {
          background: var(--emerald);
          color: white;
          box-shadow: 0 4px 10px rgba(23, 75, 54, 0.12);
        }

        .primary:hover:not(:disabled) {
          background: var(--emerald-dark);
          transform: translateY(-1px);
        }

        .secondary {
          border: 1px solid #e0e4dc;
          background: white;
          color: #526653;
        }

        .secondary:hover:not(:disabled) {
          border-color: #a8bba8;
          background: #f7f8f3;
        }

        .info {
          display: flex;
          align-items: flex-start;
          gap: 13px;
          margin-top: 25px;
          padding: 16px;
          border: 1px solid #e9dfc8;
          border-radius: 13px;
          background: #faf7ef;
        }

        .info-icon {
          display: flex;
          width: 37px;
          height: 37px;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: #f0e7d4;
          color: #9a7942;
        }

        .info strong {
          color: #6f5935;
          font-size: 12px;
        }

        .info p {
          margin-top: 5px;
          color: #8b795a;
          font-size: 11px;
          line-height: 1.7;
        }

        .table-heading {
          justify-content: space-between;
          flex-wrap: wrap;
        }

        .heading-left {
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .reload {
          padding: 9px 13px;
        }

        .table-wrap {
          width: 100%;
          overflow-x: auto;
        }

        .table {
          width: 100%;
          min-width: 580px;
          border-collapse: collapse;
          text-align: left;
          font-size: 12px;
        }

        .table thead {
          background: #f8f8f3;
        }

        .table th {
          padding: 14px 20px;
          border-bottom: 1px solid #eeede6;
          color: #818a7f;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.7px;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .table td {
          padding: 15px 20px;
          border-bottom: 1px solid #f0efe9;
          color: #59665a;
          white-space: nowrap;
        }

        .table tbody tr {
          transition: background 0.15s;
        }

        .table tbody tr:hover {
          background: #fafbf7;
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
          color: #334638;
          font-weight: 700;
        }

        .status {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 6px 10px;
          border: 1px solid;
          border-radius: 30px;
          font-size: 10px;
          font-weight: 700;
        }

        .status.approved {
          border-color: #cce2cf;
          background: #edf6ed;
          color: #397047;
        }

        .status.inactive {
          border-color: #e3e3dc;
          background: #f3f3ef;
          color: #858980;
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
          padding: 14px 20px;
          border-top: 1px solid #eeede6;
          background: #fcfcf9;
          color: #92998f;
          font-size: 11px;
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
          min-height: 190px;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 30px;
          color: #899087;
          text-align: center;
        }

        .empty strong {
          color: #425345;
          font-size: 13px;
        }

        .empty p {
          max-width: 350px;
          color: #92998f;
          font-size: 12px;
          line-height: 1.6;
        }

        .alert {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          padding: 15px 17px;
          border: 1px solid;
          border-radius: 13px;
          font-size: 12px;
        }

        .alert strong {
          display: block;
          margin-bottom: 4px;
        }

        .alert p {
          line-height: 1.6;
        }

        .success {
          border-color: #cce2cf;
          background: #edf6ee;
          color: #28613b;
        }

        .danger {
          border-color: #f1d0cb;
          background: #fff2f0;
          color: #a83e35;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 800px) {
          .employee-page {
            padding: 20px;
          }

          .stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .stats .stat:last-child {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 560px) {
          .employee-page {
            padding: 14px;
          }

          .employee-container {
            gap: 15px;
          }

          .hero {
            padding: 23px 20px;
            border-radius: 17px;
          }

          .title {
            font-size: 25px;
          }

          .subtitle {
            font-size: 12px;
          }

          .hero-icon {
            display: none;
          }

          .stats {
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .stats .stat:last-child {
            grid-column: auto;
          }

          .stat {
            padding: 16px;
          }

          .stat-value {
            font-size: 26px;
          }

          .panel-heading {
            padding: 17px;
          }

          .panel-body {
            padding: 17px;
          }

          .form-grid {
            grid-template-columns: 1fr;
            gap: 17px;
          }

          .field-wrap.full {
            grid-column: auto;
          }

          .form-footer .button {
            width: 100%;
          }

          .table-heading {
            align-items: flex-start;
          }

          .reload {
            width: 100%;
            justify-content: center;
          }

          .table-footer {
            padding: 13px 16px;
          }
        }
      `}</style>
    </main>
  );
}
