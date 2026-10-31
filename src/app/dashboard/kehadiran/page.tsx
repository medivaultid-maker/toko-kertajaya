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

              <h1 className="title">Kehadiran Karyawan</h1>

              <p className="subtitle">
                Pantau aktivitas kehadiran dan riwayat absensi
                seluruh karyawan Toko Rosyidah.
              </p>
            </div>

            <div className="hero-icon">
              <CalendarCheck size={35} strokeWidth={1.5} />
            </div>
          </div>

          <div className="hero-bottom"></div>
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
                  : "Karyawan tercatat hadir hari ini"}
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

              <div className="heading-text">
                <h2>Riwayat Kehadiran</h2>
                <p>
                  Catatan kehadiran diurutkan dari yang terbaru.
                </p>
              </div>
            </div>
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
        <CalendarDays size={15} />
        <span>Pilih Tanggal</span>
      </label>

      <div className="date-input-wrap">
  <input
    type="date"
    value={filterDate}
    onChange={(e) => setFilterDate(e.target.value)}
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
                    : "Catatan kehadiran karyawan akan muncul di bagian ini."}
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
                        <th>Kode Karyawan</th>
                        <th>Nama Karyawan</th>
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

        /* HEADER */
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

        .subtitle {
          max-width: 560px;
          margin-top: 8px;
          color: #89938a;
          font-size: 12px;
          line-height: 1.7;
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

        /* STATISTICS */
        .stats {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
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

        .gold {
          background: #f6f1e6;
          color: #a1844d;
        }

        /* PANEL */
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
          text-align: left;
        }

        .panel-heading p {
          margin: 0;
          color: #89938a;
          font-size: 11px;
          line-height: 1.75;
          text-align: left;
        }

        .table-heading {
          justify-content: flex-start;
        }

        .heading-left {
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .heading-text {
          flex: 1;
          min-width: 0;
          text-align: left;
        }

        .panel-body {
          padding: 0;
        }

        /* FILTER */
        .filter-area {
          margin-bottom: 22px;
          padding: 17px;
          border: 1px solid #e8ece6;
          border-radius: 12px;
          background: #f8faf7;
        }

        .filter-label {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 13px;
          color: #758176;
          font-size: 10px;
          font-weight: 800;
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
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 7px;
  text-align: left;
}

.field-label svg {
  color: #b99a62;
  flex-shrink: 0;
}
        

        .date-input-wrap {
          position: relative;
        }

        .date-input-wrap > svg {
          position: absolute;
          top: 14px;
          left: 14px;
          color: #8b968a;
          pointer-events: none;
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

        .field:focus {
          border-color: #789b83;
          box-shadow: 0 0 0 3px rgba(45, 105, 68, 0.09);
        }

        .date-field {
          padding-left: 40px;
        }

        .button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          min-height: 44px;
          padding: 0 17px;
          border: 0;
          border-radius: 9px;
          font-family: inherit;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.18s ease;
        }

        .clear-filter {
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

        /* TABLE */
        .table-wrap {
          width: 100%;
          overflow-x: auto;
          border: 1px solid #e7ece6;
          border-radius: 13px;
        }

        .table {
          width: 100%;
          min-width: 760px;
          border-collapse: separate;
          border-spacing: 0;
          text-align: left;
          font-size: 11px;
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
          white-space: nowrap;
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
          color: #2c4033;
          font-size: 12px;
          font-weight: 800;
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

        /* TABLE FOOTER */
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
          color: #56815c;
        }

        /* EMPTY STATE */
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

        .empty-icon {
          display: flex;
          width: 58px;
          height: 58px;
          align-items: center;
          justify-content: center;
          margin-bottom: 3px;
          border-radius: 15px;
          background: #edf4ef;
          color: #47745c;
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

        .primary {
          background: linear-gradient(135deg, #205a3e, #123d2b);
          color: white;
          box-shadow: 0 4px 11px rgba(23, 75, 54, 0.16);
        }

        .primary:hover {
          background: #0e3525;
          box-shadow: 0 6px 15px rgba(23, 75, 54, 0.22);
          transform: translateY(-1px);
        }

        /* ALERT */
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

        /* RESPONSIVE */
        @media (max-width: 900px) {
          .table {
            min-width: 760px;
          }
        }

        @media (max-width: 700px) {
          .attendance-page {
            padding: 20px;
          }

          .attendance-container {
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

          .filter-area {
            padding: 15px;
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
            padding: 0;
          }
        }

        @media (max-width: 380px) {
          .attendance-page {
            padding: 14px;
          }

          .stats {
            grid-template-columns: 1fr;
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