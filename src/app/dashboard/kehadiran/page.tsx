
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import {
  CalendarCheck,
  Clock,
  RefreshCw,
  Users,
  CalendarDays,
  Filter,
  X,
  UserCheck,
  ClipboardList,
  ShieldCheck,
} from "lucide-react";

type Attendance = {
  id: string;
  attendance_date: string;
  check_in: string;
  employees:
    | {
        full_name: string;
        employee_code: string | null;
      }
    | null;
};

export default function AttendancePage() {
  const supabase = useMemo(() => createClient(), []);

  const [records, setRecords] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterDate, setFilterDate] = useState("");

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      let query = supabase
        .from("attendance")
        .select(`
          id,
          attendance_date,
          check_in,
          employees (
            full_name,
            employee_code
          )
        `)
        .order("attendance_date", { ascending: false })
        .order("check_in", { ascending: false });

      if (filterDate) {
        query = query.eq("attendance_date", filterDate);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      setRecords((data || []) as unknown as Attendance[]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat memuat data."
      );
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [filterDate, supabase]);

  useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
  }).format(new Date());

  const todayCount = records.filter(
    (record) => record.attendance_date === today
  ).length;

  const formatDate = (date: string) =>
    new Date(`${date}T00:00:00+07:00`).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

  const formatTime = (date: string) =>
    new Date(date).toLocaleTimeString("id-ID", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

  return (
    <main className="attendance-page">
      <div className="attendance-container">

        {/* HEADER */}
        <section className="hero">
          <div className="hero-decoration hero-decoration-one" />
          <div className="hero-decoration hero-decoration-two" />

          <div className="hero-content">
            <div>
              <div className="eyebrow">
                <ShieldCheck size={14} />
                MANAJEMEN KARYAWAN
              </div>

              <h1 className="title">Kehadiran Pegawai</h1>

              <p className="subtitle">
                Pantau aktivitas kehadiran dan riwayat absensi
                seluruh pegawai Toko Rosyidah.
              </p>
            </div>

            <div className="hero-icon">
              <CalendarCheck size={35} strokeWidth={1.5} />
            </div>
          </div>

          <div className="hero-bottom">
            <span className="count-chip">
              <span className="count-dot" />
              MONITORING KEHADIRAN
            </span>
          </div>
        </section>

        {/* ERROR NOTIFICATION */}
        {error && (
          <div className="alert danger" role="alert">
            <ShieldCheck size={19} />
            <div>
              <strong>Gagal memuat data kehadiran</strong>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* STATISTICS */}
        <section className="stats">
          <div className="stat">
            <div>
              <p className="stat-label">
                Total Catatan Ditampilkan
              </p>

              <h2 className="stat-value">
                {records.length}
              </h2>

              <p className="stat-caption">
                Jumlah data kehadiran
              </p>
            </div>

            <div className="stat-icon green">
              <ClipboardList size={22} />
            </div>
          </div>

          <div className="stat">
            <div>
              <p className="stat-label">Hadir Hari Ini</p>

              <h2 className="stat-value">
                {filterDate ? "—" : todayCount}
              </h2>

              <p className="stat-caption">
                {filterDate
                  ? "Tersedia pada tampilan semua tanggal"
                  : "Pegawai tercatat hadir hari ini"}
              </p>
            </div>

            <div className="stat-icon gold">
              <UserCheck size={22} />
            </div>
          </div>
        </section>

        {/* ATTENDANCE TABLE */}
        <section className="panel">

          {/* PANEL HEADER */}
          <div className="panel-heading table-heading">
            <div className="heading-left">
              <div className="heading-icon">
                <CalendarDays size={21} />
              </div>

              <div>
                <h2>Riwayat Kehadiran</h2>
                <p>
                  Catatan kehadiran diurutkan dari yang terbaru.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void loadAttendance()}
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

          <div className="panel-body">

            {/* FILTER */}
            <div className="filter-area">
              <div className="filter-label">
                <Filter size={15} />
                FILTER DATA
              </div>

              <div className="filter-controls">
                <div className="field-wrap">
                  <label className="field-label">
                    Pilih Tanggal
                  </label>

                  <div className="date-input-wrap">
                    <CalendarDays size={17} />

                    <input
                      type="date"
                      value={filterDate}
                      onChange={(e) =>
                        setFilterDate(e.target.value)
                      }
                      className="field date-field"
                    />
                  </div>
                </div>

                {filterDate && (
                  <button
                    type="button"
                    onClick={() => setFilterDate("")}
                    className="button clear-filter"
                  >
                    <X size={15} />
                    Hapus Filter
                  </button>
                )}
              </div>

              {filterDate && (
                <p className="filter-description">
                  Menampilkan catatan tanggal{" "}
                  <strong>{formatDate(filterDate)}</strong>
                </p>
              )}
            </div>

            {/* LOADING */}
            {loading ? (
              <div className="empty">
                <RefreshCw size={27} className="spin" />
                <strong>Memuat data kehadiran...</strong>
                <p>
                  Mohon tunggu, sistem sedang mengambil data absensi.
                </p>
              </div>
            ) : error ? (
              <div className="empty">
                <ShieldCheck size={30} />
                <strong>Data belum dapat ditampilkan</strong>
                <p>
                  Periksa koneksi dan coba muat ulang data.
                </p>

                <button
                  type="button"
                  onClick={() => void loadAttendance()}
                  className="button primary"
                >
                  <RefreshCw size={15} />
                  Coba Lagi
                </button>
              </div>
            ) : records.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">
                  <CalendarCheck size={30} />
                </div>

                <strong>Belum ada catatan kehadiran</strong>

                <p>
                  {filterDate
                    ? "Tidak ditemukan catatan kehadiran pada tanggal yang dipilih."
                    : "Catatan kehadiran pegawai akan muncul di bagian ini."}
                </p>
              </div>
            ) : (
              <>
                {/* TABLE */}
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>No.</th>
                        <th>Kode Pegawai</th>
                        <th>Nama Pegawai</th>
                        <th>Tanggal</th>
                        <th>Jam Hadir</th>
                        <th>Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {records.map((record, index) => (
                        <tr key={record.id}>
                          <td className="number-cell">
                            {index + 1}
                          </td>

                          <td>
                            <span className="code">
                              {record.employees?.employee_code || "-"}
                            </span>
                          </td>

                          <td>
                            <div className="employee-name">
                              <span className="employee-avatar">
                                {record.employees?.full_name
                                  ?.charAt(0)
                                  .toUpperCase() || "?"}
                              </span>

                              <span className="name">
                                {record.employees?.full_name ||
                                  "Data pegawai tidak ditemukan"}
                              </span>
                            </div>
                          </td>

                          <td>
                            <span className="date-text">
                              {formatDate(record.attendance_date)}
                            </span>
                          </td>

                          <td>
                            <span className="time-chip">
                              <Clock size={14} />
                              {formatTime(record.check_in)} WIB
                            </span>
                          </td>

                          <td>
                            <span className="status approved">
                              <span className="dot" />
                              Hadir
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* TABLE FOOTER */}
                <div className="table-footer">
                  <span>
                    Menampilkan {records.length} catatan kehadiran
                  </span>

                  <div className="footer-status">
                    <span>
                      <UserCheck size={14} />
                      {records.length} Catatan Hadir
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

      </div>

      {/* PAGE CSS */}
      <style jsx>{`
        .attendance-page {
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

        .attendance-container {
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
          grid-template-columns: repeat(2, minmax(0, 1fr));
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

        .gold {
          background: #f6f1e6;
          color: #a1844d;
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

        .table-heading {
          justify-content: space-between;
          flex-wrap: wrap;
        }

        .heading-left {
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .panel-body {
          padding: 25px;
        }

        .button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          padding: 11px 15px;
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

        .secondary {
          border: 1px solid #e0e4dc;
          background: white;
          color: #526653;
        }

        .secondary:hover:not(:disabled) {
          border-color: #a8bba8;
          background: #f7f8f3;
        }

        .reload {
          padding: 9px 13px;
        }

        .filter-area {
          margin-bottom: 22px;
          padding: 17px;
          border: 1px solid #eeede6;
          border-radius: 13px;
          background: #fcfcf9;
        }

        .filter-label {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 13px;
          color: #758176;
          font-size: 10px;
          font-weight: 750;
          letter-spacing: 1px;
        }

        .filter-controls {
          display: flex;
          align-items: flex-end;
          flex-wrap: wrap;
          gap: 13px;
        }

        .field-wrap {
          display: flex;
          width: 260px;
          max-width: 100%;
          flex-direction: column;
          gap: 8px;
        }

        .field-label {
          color: #526054;
          font-size: 12px;
          font-weight: 700;
        }

        .date-input-wrap {
          position: relative;
        }

        .date-input-wrap > svg {
          position: absolute;
          top: 13px;
          left: 13px;
          color: #849087;
          pointer-events: none;
        }

        .field {
          box-sizing: border-box;
          width: 100%;
          height: 44px;
          padding: 11px 13px;
          border: 1px solid #dedfd5;
          border-radius: 10px;
          outline: none;
          background: #fffefa;
          color: var(--ink);
          font-family: inherit;
          font-size: 12px;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .field:focus {
          border-color: #47745c;
          box-shadow: 0 0 0 3px rgba(71, 116, 92, 0.1);
        }

        .date-field {
          padding-left: 40px;
        }

        .clear-filter {
          height: 44px;
          border: 1px solid #ead9d4;
          background: #fff8f6;
          color: #a35d50;
        }

        .clear-filter:hover {
          background: #fff0ec;
        }

        .filter-description {
          margin-top: 12px;
          color: #899087;
          font-size: 11px;
        }

        .filter-description strong {
          color: #526653;
        }

        .table-wrap {
          width: 100%;
          overflow-x: auto;
        }

        .table {
          width: 100%;
          min-width: 760px;
          border-collapse: collapse;
          text-align: left;
          font-size: 12px;
        }

        .table thead {
          background: #f8f8f3;
        }

        .table th {
          padding: 14px 16px;
          border-bottom: 1px solid #eeede6;
          color: #818a7f;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.7px;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .table td {
          padding: 15px 16px;
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

        .employee-name {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .employee-avatar {
          display: flex;
          width: 31px;
          height: 31px;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          border: 1px solid #dce8dd;
          border-radius: 9px;
          background: #edf4ef;
          color: #47745c;
          font-size: 12px;
          font-weight: 750;
        }

        .name {
          color: #334638;
          font-weight: 700;
        }

        .date-text {
          color: #58675a;
        }

        .time-chip {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 6px 9px;
          border: 1px solid #e8ece6;
          border-radius: 8px;
          background: #f8f9f5;
          color: #566c5b;
          font-size: 11px;
          font-weight: 600;
        }

        .time-chip svg {
          color: #849087;
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
          color: #56815c;
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

        .empty-icon {
          display: flex;
          width: 58px;
          height: 58px;
          align-items: center;
          justify-content: center;
          margin-bottom: 3px;
          border-radius: 17px;
          background: #f1f3ed;
          color: #829080;
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

        .primary {
          background: var(--emerald);
          color: white;
        }

        .primary:hover {
          background: var(--emerald-dark);
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
          .attendance-page {
            padding: 20px;
          }

          .stats {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 560px) {
          .attendance-page {
            padding: 14px;
          }

          .attendance-container {
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

          .table-heading {
            align-items: flex-start;
          }

          .reload {
            width: 100%;
            justify-content: center;
          }

          .filter-controls {
            align-items: stretch;
            flex-direction: column;
          }

          .field-wrap {
            width: 100%;
          }

          .clear-filter {
            width: 100%;
          }

          .table-footer {
            padding: 13px 16px;
          }
        }
      `}</style>
    </main>
  );
}
