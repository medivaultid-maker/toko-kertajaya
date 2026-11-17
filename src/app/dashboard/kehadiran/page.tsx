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
  UserX,
  ShieldCheck,
} from "lucide-react";

type Employee = {
  id: string;
  full_name: string;
  employee_code: string | null;
};

type Session = "morning" | "afternoon";

type Attendance = {
  id: string;
  employee_id: string;
  attendance_date: string;
  check_in: string;
  attendance_session: Session;
};

type AttendanceStatus =
  | "Hadir"
  | "Tidak Hadir"
  | "Belum Absen"
  | "Belum Dibuka";

type AttendanceRow = {
  key: string;
  employee: Employee;
  attendance_date: string;
  session: Session;
  check_in: string | null;
  status: AttendanceStatus;
};

const SESSION_CONFIG: {
  key: Session;
  label: string;
  start: number;
  end: number;
}[] = [
  { key: "morning", label: "Pagi", start: 6 * 60, end: 13 * 60 },
  { key: "afternoon", label: "Siang", start: 13 * 60, end: 20 * 60 },
];

function getJakartaNow() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    minutes: Number(part("hour")) * 60 + Number(part("minute")),
  };
}

function getStatus(
  selectedDate: string,
  nowDate: string,
  nowMinutes: number,
  session: Session,
  hasRecord: boolean
): AttendanceStatus {
  if (hasRecord) return "Hadir";
  if (selectedDate > nowDate) return "Belum Dibuka";
  if (selectedDate < nowDate) return "Tidak Hadir";

  const config = SESSION_CONFIG.find((item) => item.key === session)!;

  if (nowMinutes < config.start) return "Belum Dibuka";
  if (nowMinutes >= config.end) return "Tidak Hadir";
  return "Belum Absen";
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00+07:00`).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

function formatTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function statusClass(status: AttendanceStatus) {
  if (status === "Hadir") return "approved";
  if (status === "Tidak Hadir") return "not-present";
  return "waiting";
}

export default function AttendancePage() {
  const supabase = useMemo(() => createClient(), []);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterDate, setFilterDate] = useState(() => getJakartaNow().date);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [employeeResult, attendanceResult] = await Promise.all([
        supabase
          .from("employees")
          .select("id, full_name, employee_code")
          .order("full_name", { ascending: true }),
        supabase
          .from("attendance")
          .select(
            "id, employee_id, attendance_date, check_in, attendance_session"
          )
          .eq("attendance_date", filterDate)
          .order("check_in", { ascending: true }),
      ]);

      if (employeeResult.error) throw employeeResult.error;
      if (attendanceResult.error) throw attendanceResult.error;

      setEmployees((employeeResult.data ?? []) as Employee[]);
      setRecords((attendanceResult.data ?? []) as Attendance[]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat memuat data kehadiran."
      );
      setEmployees([]);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [filterDate, refreshKey, supabase]);

  useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  // Refresh status agar sesi berubah otomatis saat jam 13.00 dan 20.00.
  useEffect(() => {
    const interval = window.setInterval(() => {
      setRefreshKey((value) => value + 1);
    }, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  const now = getJakartaNow();

  const rows = useMemo<AttendanceRow[]>(() => {
    return employees.flatMap((employee) =>
      SESSION_CONFIG.map((session) => {
        const record = records.find(
          (item) =>
            item.employee_id === employee.id &&
            item.attendance_session === session.key
        );

        return {
          key: `${employee.id}-${session.key}`,
          employee,
          attendance_date: filterDate,
          session: session.key,
          check_in: record?.check_in ?? null,
          status: getStatus(
            filterDate,
            now.date,
            now.minutes,
            session.key,
            Boolean(record)
          ),
        };
      })
    );
  }, [employees, records, filterDate, now.date, now.minutes]);

  const morningRows = rows.filter((row) => row.session === "morning");
  const afternoonRows = rows.filter((row) => row.session === "afternoon");

  const totalPresent = rows.filter((row) => row.status === "Hadir").length;
  const totalAbsent = rows.filter(
    (row) => row.status === "Tidak Hadir"
  ).length;
  
  const formatStatusLabel = (status: AttendanceStatus) => status;

  return (
    <main className="attendance-page">
      <div className="attendance-container">
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
                Pantau kehadiran karyawan Toko Kertajaya pada sesi pagi dan
                sesi siang.
              </p>
            </div>
            <div className="hero-icon">
              <CalendarCheck size={35} strokeWidth={1.5} />
            </div>
          </div>
          <div className="hero-bottom" />
        </section>

        {error && (
          <div className="alert danger" role="alert">
            <ShieldCheck size={19} />
            <div>
              <strong>Gagal memuat data kehadiran</strong>
              <p>{error}</p>
              <p className="schema-hint">
                Pastikan tabel employees memiliki kolom id, full_name,
                employee_code dan tabel attendance memiliki kolom
                attendance_session.
              </p>
            </div>
          </div>
        )}

        <section className="stats">
          <div className="stat">
            <div>
              <p className="stat-label">Total Karyawan</p>
              <h2 className="stat-value">{loading ? "—" : employees.length}</h2>
              <p className="stat-caption">Karyawan terdaftar</p>
            </div>
            <div className="stat-icon green">
              <Users size={22} />
            </div>
          </div>

          <div className="stat">
            <div>
              <p className="stat-label">Total Hadir</p>
              <h2 className="stat-value">{loading ? "—" : totalPresent}</h2>
              <p className="stat-caption">Akumulasi sesi pagi dan siang</p>
            </div>
            <div className="stat-icon green">
              <UserCheck size={22} />
            </div>
          </div>

          <div className="stat">
            <div>
              <p className="stat-label">Total Tidak Hadir</p>
              <h2 className="stat-value">{loading ? "—" : totalAbsent}</h2>
              <p className="stat-caption">Sesi yang sudah ditutup tanpa absen</p>
            </div>
            <div className="stat-icon red">
              <UserX size={22} />
            </div>
          </div>

        </section>

        <section className="panel">
          <div className="panel-heading table-heading">
            <div className="heading-left">
              <div className="heading-icon">
                <CalendarDays size={21} />
              </div>
              <div className="heading-text">
                <h2>Rekap Kehadiran Harian</h2>
                <p>
                  Setiap karyawan ditampilkan dua kali, sesuai sesi pagi dan
                  sesi siang.
                </p>
              </div>
            </div>
          </div>

          <div className="panel-body">
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
                      onChange={(event) => setFilterDate(event.target.value)}
                      className="field date-field"
                    />
                  </div>
                </div>

                {filterDate !== getJakartaNow().date && (
                  <button
                    type="button"
                    onClick={() => setFilterDate(getJakartaNow().date)}
                    className="button clear-filter"
                  >
                    <X size={15} />
                    Ke Hari Ini
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setRefreshKey((value) => value + 1)}
                  className="button refresh-button"
                  disabled={loading}
                >
                  <RefreshCw size={15} className={loading ? "spin" : ""} />
                  Muat Ulang
                </button>
              </div>
              <p className="filter-description">
                Menampilkan rekap tanggal <strong>{formatDate(filterDate)}</strong>.
                Jam operasional absensi menggunakan WIB.
              </p>
            </div>

            {loading ? (
              <div className="empty">
                <RefreshCw size={27} className="spin" />
                <strong>Memuat data kehadiran...</strong>
                <p>Mohon tunggu, sistem sedang mengambil data absensi.</p>
              </div>
            ) : error ? (
              <div className="empty">
                <ShieldCheck size={30} />
                <strong>Data belum dapat ditampilkan</strong>
                <p>Periksa struktur tabel dan koneksi Supabase, lalu coba lagi.</p>
                <button
                  type="button"
                  onClick={() => setRefreshKey((value) => value + 1)}
                  className="button primary"
                >
                  <RefreshCw size={15} />
                  Coba Lagi
                </button>
              </div>
            ) : employees.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">
                  <Users size={30} />
                </div>
                <strong>Belum ada data karyawan</strong>
                <p>
                  Data karyawan akan muncul di sini setelah tersedia pada tabel
                  employees.
                </p>
              </div>
            ) : (
              <>
                {[
                  {
                    key: "morning" as const,
                    title: "Sesi Pagi",
                    hours: "06.00–13.00 WIB",
                    data: morningRows,
                  },
                  {
                    key: "afternoon" as const,
                    title: "Sesi Siang",
                    hours: "13.00–20.00 WIB",
                    data: afternoonRows,
                  },
                ].map((session) => {
                  const present = session.data.filter(
                    (row) => row.status === "Hadir"
                  ).length;
                  const absent = session.data.filter(
                    (row) => row.status === "Tidak Hadir"
                  ).length;
                  const pending = session.data.length - present - absent;

                  return (
                    <section className="session-section" key={session.key}>
                      <div className="session-header">
                        <div>
                          <span className="session-eyebrow">ABSENSI KARYAWAN</span>
                          <h3>{session.title}</h3>
                          <p><Clock size={13} /> {session.hours}</p>
                        </div>
                        <div className="session-summary">
                          <span className="summary-present">{present} Hadir</span>
                          <span className="summary-absent">{absent} Tidak Hadir</span>
                          <span className="summary-pending">{pending} Menunggu</span>
                        </div>
                      </div>

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
                            {session.data.map((row, index) => (
                              <tr key={row.key}>
                                <td className="number-cell">{index + 1}</td>
                                <td>
                                  <span className="code">
                                    {row.employee.employee_code || "—"}
                                  </span>
                                </td>
                                <td>
                                  <div className="employee-name">
                                    <span className="employee-avatar">
                                      {row.employee.full_name
                                        ?.charAt(0)
                                        .toUpperCase() || "?"}
                                    </span>
                                    <span className="name">
                                      {row.employee.full_name}
                                    </span>
                                  </div>
                                </td>
                                <td>
                                  <span className="date-text">
                                    {formatDate(row.attendance_date)}
                                  </span>
                                </td>
                                <td>
                                  {row.check_in ? (
                                    <span className="time-chip">
                                      <Clock size={14} />
                                      {formatTime(row.check_in)} WIB
                                    </span>
                                  ) : (
                                    <span className="no-time">—</span>
                                  )}
                                </td>
                                <td>
                                  <span className={`status ${statusClass(row.status)}`}>
                                    <span className="dot" />
                                    {formatStatusLabel(row.status)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="table-footer">
                        <span>Menampilkan {session.data.length} karyawan</span>
                        <div className="footer-status">
                          <span><UserCheck size={14} /> {present} Hadir</span>
                          <span><UserX size={14} /> {absent} Tidak Hadir</span>
                        </div>
                      </div>
                    </section>
                  );
                })}
              </>
            )}
          </div>
        </section>
      </div>

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
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
}

@media (max-width: 768px) {
  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 480px) {
  .stats {
    grid-template-columns: 1fr;
  }
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
      
        .refresh-button {
          border: 1px solid #dce8de;
          background: #edf4ef;
          color: #356348;
        }
        .refresh-button:hover:not(:disabled) {
          background: #e2eee4;
        }
        .refresh-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .session-section {
          margin-top: 25px;
        }
        .session-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 14px;
          margin-bottom: 13px;
        }
        .session-eyebrow {
          color: #b99a62;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1.5px;
        }
        .session-header h3 {
          margin: 5px 0;
          color: #174b36;
          font-family: var(--font-manrope), sans-serif;
          font-size: 17px;
          font-weight: 800;
        }
        .session-header p {
          display: flex;
          align-items: center;
          gap: 6px;
          margin: 0;
          color: #89938a;
          font-size: 10px;
        }
        .session-summary {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }
        .session-summary span {
          padding: 7px 9px;
          border-radius: 7px;
          font-size: 9px;
          font-weight: 800;
        }
        .summary-present {
          background: #edf6ed;
          color: #3e754b;
        }
        .summary-absent {
          background: #fff0ee;
          color: #a64d45;
        }
        .summary-pending {
          background: #f8f3e8;
          color: #92743f;
        }
        .status.not-present {
          border-color: #f0d9d5;
          background: #fff2ef;
          color: #a64d45;
        }
        .status.waiting {
          border-color: #eee4ca;
          background: #fbf7ed;
          color: #92743f;
        }
        .status .dot {
          background: currentColor;
        }
        .stat-icon.red {
          background: #fff0ee;
          color: #b35b50;
        }
        .no-time {
          color: #a0a89f;
        }
        .schema-hint {
          margin-top: 6px !important;
          font-size: 10px;
          opacity: 0.85;
        }
        @media (max-width: 700px) {
          .session-header {
            align-items: flex-start;
            flex-direction: column;
          }
          .session-summary {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
