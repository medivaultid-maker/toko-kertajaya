
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import {
  Store,
  LogOut,
  CalendarCheck,
  Clock,
  CheckCircle2,
  History,
  Wallet,
  HandCoins,
  ArrowRight,
  ShieldCheck,
  UserRound,
  RefreshCw,
  Receipt,
  Package,
  AlertCircle,
} from "lucide-react";

type Employee = {
  id: string;
  full_name: string;
  employee_code: string | null;
  profile_id: string | null;
};

type Attendance = {
  id: string;
  attendance_date: string;
  check_in: string;
};

type AttendanceRecord = {
  id: string;
  work_date: string;
  status: string;
  notes: string | null;
};

type Payroll = {
  id: string;
  week_start: string;
  week_end: string;
  gross_salary: number;
  absence_deduction: number;
  debt_deduction: number;
  net_salary: number;
  payment_status: string;
  paid_at: string | null;
  notes: string | null;
};

type Debt = {
  id: string;
  description: string | null;
  debt_date: string;
  original_amount: number;
  remaining_amount: number;
  total_amount: number;
  status: string;
  notes: string | null;
};

type DebtItem = {
  id: string;
  debt_id: string;
  product_name_snapshot: string;
  product_code_snapshot: string;
  brand_snapshot: string | null;
  quantity: number;
  selling_price_snapshot: number;
  line_total: number;
};

type MenuTab = "attendance" | "payroll" | "debt";

export default function EmployeeDashboard() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [todayAttendance, setTodayAttendance] =
    useState<Attendance | null>(null);
  const [attendanceHistory, setAttendanceHistory] =
    useState<AttendanceRecord[]>([]);
  const [attendanceTimes, setAttendanceTimes] =
    useState<Attendance[]>([]);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [debtItems, setDebtItems] = useState<DebtItem[]>([]);

  const [activeTab, setActiveTab] = useState<MenuTab>("attendance");

  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const formatDate = (date: string) => {
    if (!date) return "-";

    return new Date(`${date.slice(0, 10)}T00:00:00`).toLocaleDateString(
      "id-ID",
      {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }
    );
  };

  const formatShortDate = (date: string) => {
    if (!date) return "-";

    return new Date(`${date.slice(0, 10)}T00:00:00`).toLocaleDateString(
      "id-ID",
      {
        day: "numeric",
        month: "short",
        year: "numeric",
      }
    );
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    });
  };

  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(Number(amount) || 0);
  };

  const getStatusLabel = (status: string) => {
    const value = status.toLowerCase();

    const labels: Record<string, string> = {
      present: "Hadir",
      hadir: "Hadir",
      absent: "Tidak Hadir",
      alpa: "Alpa",
      absent_without_permission: "Alpa",
      izin: "Izin",
      permitted: "Izin",
      sick: "Sakit",
      sakit: "Sakit",
      leave: "Cuti",
      cuti: "Cuti",
    };

    return labels[value] || status;
  };

  const getStatusClass = (status: string) => {
    const value = status.toLowerCase();

    if (["present", "hadir"].includes(value)) return "status-present";
    if (["sick", "sakit", "izin", "permitted", "leave", "cuti"].includes(value))
      return "status-permission";

    return "status-absent";
  };

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      // 1. Ambil identitas akun yang sedang login
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      // 2. Cocokkan akun dengan data pegawai
      const { data: employeeData, error: employeeError } = await supabase
        .from("employees")
        .select("id, full_name, employee_code, profile_id")
        .eq("profile_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (employeeError) throw employeeError;

      if (!employeeData) {
        setError(
          "Data pegawai tidak ditemukan atau akun pegawai sudah tidak aktif. Hubungi Owner."
        );
        setLoading(false);
        return;
      }

      setEmployee(employeeData);

      const employeeId = employeeData.id;

      // 3. Ambil seluruh data berdasarkan ID pegawai
      const [
        todayResult,
        attendanceResult,
        attendanceTimeResult,
        payrollResult,
        debtResult,
      ] = await Promise.all([
        supabase
          .from("attendance")
          .select("id, attendance_date, check_in")
          .eq("employee_id", employeeId)
          .eq("attendance_date", today)
          .order("check_in", { ascending: false })
          .limit(1)
          .maybeSingle(),

        supabase
          .from("employee_attendance")
          .select("id, work_date, status, notes")
          .eq("employee_id", employeeId)
          .order("work_date", { ascending: false })
          .limit(50),

        supabase
          .from("attendance")
          .select("id, attendance_date, check_in")
          .eq("employee_id", employeeId)
          .order("attendance_date", { ascending: false })
          .limit(50),

        // Hanya menampilkan gaji yang sudah berstatus paid
        supabase
          .from("employee_payrolls")
          .select(
            "id, week_start, week_end, gross_salary, absence_deduction, debt_deduction, net_salary, payment_status, paid_at, notes"
          )
          .eq("employee_id", employeeId)
          .eq("payment_status", "paid")
          .order("week_start", { ascending: false }),

        // Mengambil seluruh catatan piutang pegawai
        supabase
          .from("employee_debts")
          .select(
            "id, description, debt_date, original_amount, remaining_amount, total_amount, status, notes"
          )
          .eq("employee_id", employeeId)
          .order("debt_date", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);

      if (todayResult.error) throw todayResult.error;
      if (attendanceResult.error) throw attendanceResult.error;
      if (attendanceTimeResult.error) throw attendanceTimeResult.error;
      if (payrollResult.error) throw payrollResult.error;
      if (debtResult.error) throw debtResult.error;

      setTodayAttendance(todayResult.data);
      setAttendanceHistory(attendanceResult.data || []);
      setAttendanceTimes(attendanceTimeResult.data || []);
      setPayrolls(payrollResult.data || []);
      setDebts(debtResult.data || []);

      // 4. Ambil detail barang dari setiap piutang
      const debtIds = (debtResult.data || []).map((debt) => debt.id);

      if (debtIds.length > 0) {
        const { data: itemData, error: itemError } = await supabase
          .from("employee_debt_items")
          .select(
            "id, debt_id, product_name_snapshot, product_code_snapshot, brand_snapshot, quantity, selling_price_snapshot, line_total"
          )
          .in("debt_id", debtIds)
          .order("created_at", { ascending: true });

        if (itemError) throw itemError;

        setDebtItems(itemData || []);
      } else {
        setDebtItems([]);
      }
    } catch (err) {
      console.error("Dashboard pegawai error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Gagal memuat data dashboard."
      );
    } finally {
      setLoading(false);
    }
  }, [supabase, router, today]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  // 5. Fungsi absen masuk
  async function handleCheckIn() {
    if (!employee) return;

    setCheckingIn(true);
    setMessage("");
    setError("");

    try {
      const { error: checkInError } = await supabase.rpc(
        "check_in_attendance"
      );

      if (checkInError) throw checkInError;

      setMessage("Absensi masuk berhasil dicatat.");
      await loadDashboard();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Gagal mencatat absensi."
      );
    } finally {
      setCheckingIn(false);
    }
  }

  // 6. Logout
  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);

    const { error: logoutError } = await supabase.auth.signOut();

    if (logoutError) {
      alert(`Gagal logout: ${logoutError.message}`);
      setLoggingOut(false);
      return;
    }

    window.location.href = "/login";
  }

  const totalDebt = debts.reduce(
    (total, debt) => total + Number(debt.remaining_amount || 0),
    0
  );

  const getAttendanceTime = (date: string) => {
    return attendanceTimes.find(
      (item) => item.attendance_date === date
    );
  };

  const getDebtItems = (debtId: string) => {
    return debtItems.filter((item) => item.debt_id === debtId);
  };

  if (loading && !employee) {
    return (
      <main className="employee-page">
        <div className="initial-loading">
          <div className="loading-spinner" />
          <strong>Menyiapkan dashboard pegawai...</strong>
          <span>Menghubungkan data akun kamu.</span>
        </div>

        <style jsx>{`
          .employee-page {
            min-height: 100vh;
            display: grid;
            place-items: center;
            background: #f5f8f5;
            color: #244332;
            font-family: inherit;
          }

          .initial-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            text-align: center;
            padding: 30px;
          }

          .initial-loading span {
            color: #8a9a90;
            font-size: 12px;
          }

          .loading-spinner {
            width: 35px;
            height: 35px;
            border: 3px solid #dcebe0;
            border-top-color: #176b45;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </main>
    );
  }

  if (error && !employee) {
    return (
      <main className="employee-page">
        <div className="error-screen">
          <AlertCircle size={40} />
          <h2>Dashboard tidak dapat dibuka</h2>
          <p>{error}</p>
          <button onClick={handleLogout}>Kembali ke Login</button>
        </div>

        <style jsx>{`
          .employee-page {
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 20px;
            background: #f5f8f5;
            font-family: inherit;
          }

          .error-screen {
            max-width: 420px;
            padding: 30px;
            text-align: center;
            background: white;
            border-radius: 18px;
            color: #b42318;
          }

          .error-screen h2 {
            color: #263e30;
            font-size: 19px;
          }

          .error-screen p {
            color: #849188;
            font-size: 13px;
            line-height: 1.7;
          }

          .error-screen button {
            padding: 12px 20px;
            border: none;
            border-radius: 9px;
            background: #176b45;
            color: white;
            cursor: pointer;
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="employee-page">
      <div className="employee-container">
        {/* HEADER */}
        <header className="employee-header">
          <div className="employee-brand">
            <div className="brand-icon">
              <Store size={23} />
            </div>

            <div>
              <strong>Toko Rosyidah</strong>
              <span>Portal Pegawai</span>
            </div>
          </div>

          <div className="header-actions">
            <button
              className="refresh-button"
              onClick={() => void loadDashboard()}
              disabled={loading}
              title="Muat ulang data"
              type="button"
            >
              <RefreshCw size={16} />
            </button>

            <button
              className="logout-button"
              onClick={handleLogout}
              disabled={loggingOut}
              type="button"
            >
              <LogOut size={16} />
              {loggingOut ? "Keluar..." : "Keluar"}
            </button>
          </div>
        </header>

      {/* WELCOME */}
<section className="welcome-section">
  <h1>
    Halo, <span>{employee?.full_name || "Pegawai"}!</span>
  </h1>

  <p>
    Selamat bekerja. Semoga harimu menyenangkan.
  </p>

  <div className="welcome-meta">
    <span>
      <CalendarCheck size={14} />
      {new Date().toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      })}
    </span>
  </div>
</section>

        {/* ERROR / MESSAGE */}
        {error && (
          <div className="notice error-notice">
            <AlertCircle size={17} />
            {error}
          </div>
        )}

        {message && (
          <div className="notice success-notice">
            <CheckCircle2 size={17} />
            {message}
          </div>
        )}

        {/* ABSENSI HARI INI */}
        <section className="attendance-card">
          <div className="card-heading">
            <div className="heading-icon">
              <CalendarCheck size={21} />
            </div>

            <div>
              <h2>Absensi Hari Ini</h2>
              <p>Status kehadiran kamu hari ini</p>
            </div>

           
          </div>

          {loading ? (
            <div className="loading-inline">
              <div className="small-spinner" />
              Memperbarui absensi...
            </div>
          ) : todayAttendance ? (
            <div className="attendance-done">
              <div className="attendance-done-top">
                <div className="done-icon">
                  <CheckCircle2 size={25} />
                </div>

                <div className="done-info">
                  <span>STATUS KEHADIRAN</span>
                  <strong>Sudah Absen Masuk</strong>
                </div>

                <span className="present-badge">Hadir</span>
              </div>

              <div className="time-panel">
                <span>Waktu Absen Masuk</span>
                <div className="time-value">
                  <Clock size={23} />
                  {formatTime(todayAttendance.check_in)}
                </div>
                <small>Waktu Indonesia Barat (WIB)</small>
              </div>
            </div>
          ) : (
            <div className="attendance-pending">
              <div className="pending-icon">
                <Clock size={29} />
              </div>

              <h3>Belum Absen Hari Ini</h3>

              <p>
                Jangan lupa mencatat waktu mulai bekerja kamu.
              </p>

              <button
                onClick={handleCheckIn}
                disabled={checkingIn}
                className="checkin-button"
                type="button"
              >
                {checkingIn ? (
                  <>
                    <span className="button-spinner" />
                    Mencatat Absensi...
                  </>
                ) : (
                  <>
                    ABSEN MASUK
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          )}
        </section>

        {/* MENU UTAMA */}
        <section className="menu-section">
          <div className="menu-title">
            <div>
              <h2>Layanan Pegawai</h2>
              <p>Pilih informasi yang ingin kamu lihat.</p>
            </div>
          </div>

          <div className="menu-grid">
            <button
              type="button"
              onClick={() => setActiveTab("attendance")}
              className={`menu-card ${
                activeTab === "attendance" ? "menu-active" : ""
              }`}
            >
              <div className="menu-icon attendance-menu-icon">
                <History size={23} />
              </div>

              <div className="menu-card-text">
                <strong>Riwayat Kehadiran</strong>
                <span>Catatan absensi kamu</span>
              </div>

              <ArrowRight size={18} className="menu-arrow" />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("payroll")}
              className={`menu-card ${
                activeTab === "payroll" ? "menu-active" : ""
              }`}
            >
              <div className="menu-icon payroll-menu-icon">
                <Wallet size={23} />
              </div>

              <div className="menu-card-text">
                <strong>Riwayat Gaji</strong>
                <span>Informasi penggajian kamu</span>
              </div>

              <ArrowRight size={18} className="menu-arrow" />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("debt")}
              className={`menu-card ${
                activeTab === "debt" ? "menu-active" : ""
              }`}
            >
              <div className="menu-icon debt-menu-icon">
                <HandCoins size={23} />
              </div>

              <div className="menu-card-text">
                <strong>Riwayat Piutang</strong>
                <span>Catatan piutang kamu</span>
              </div>

              <ArrowRight size={18} className="menu-arrow" />
            </button>
          </div>
        </section>

        {/* RIWAYAT KEHADIRAN */}
        {activeTab === "attendance" && (
          <section className="content-card">
            <div className="content-heading">
              <div className="content-heading-icon">
                <History size={21} />
              </div>

              <div>
                <h2>Riwayat Kehadiran</h2>
                <p>Catatan kehadiran dan waktu absen kamu.</p>
              </div>

              <span className="data-count">
                {attendanceHistory.length} Data
              </span>
            </div>

            {attendanceHistory.length === 0 &&
            attendanceTimes.length === 0 ? (
              <div className="empty-state">
                <CalendarCheck size={35} />
                <strong>Belum Ada Riwayat</strong>
                <span>Data kehadiran akan muncul di sini.</span>
              </div>
            ) : (
              <div className="record-list">
                {Array.from(
                  new Set([
                    ...attendanceHistory.map((item) => item.work_date),
                    ...attendanceTimes.map((item) => item.attendance_date),
                  ])
                )
                  .sort((a, b) => b.localeCompare(a))
                  .map((date) => {
                    const record = attendanceHistory.find(
                      (item) => item.work_date === date
                    );

                    const time = getAttendanceTime(date);

                    return (
                      <div className="record-item" key={date}>
                        <div className="record-icon">
                          <CalendarCheck size={19} />
                        </div>

                        <div className="record-info">
                          <strong>{formatDate(date)}</strong>
                          <span>
                            <Clock size={12} />
                            {time
                              ? `Absen masuk ${formatTime(time.check_in)}`
                              : "Tidak ada catatan jam masuk"}
                          </span>

                          {record?.notes && (
                            <small>{record.notes}</small>
                          )}
                        </div>

                        <div className="record-status">
                          {record ? (
                            <span
                              className={`status-badge ${getStatusClass(
                                record.status
                              )}`}
                            >
                              {getStatusLabel(record.status)}
                            </span>
                          ) : (
                            <span className="status-badge status-present">
                              Hadir
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            <div className="info-note">
              <ShieldCheck size={16} />
              Riwayat kehadiran diambil dari catatan absensi pegawai.
            </div>
          </section>
        )}

        {/* RIWAYAT GAJI */}
        {activeTab === "payroll" && (
          <section className="content-card">
            <div className="content-heading">
              <div className="content-heading-icon payroll-heading-icon">
                <Wallet size={21} />
              </div>

              <div>
                <h2>Riwayat Gaji</h2>
                <p>Daftar penggajian yang sudah diproses Owner.</p>
              </div>

              <span className="data-count">
                {payrolls.length} Periode
              </span>
            </div>

            <div className="salary-summary">
              <span>Total Gaji Bersih Tercatat</span>
              <strong>
                {formatRupiah(
                  payrolls.reduce(
                    (sum, item) => sum + Number(item.net_salary || 0),
                    0
                  )
                )}
              </strong>
              <small>Akumulasi periode yang sudah berstatus paid</small>
            </div>

            {payrolls.length === 0 ? (
              <div className="empty-state">
                <Wallet size={35} />
                <strong>Belum Ada Riwayat Gaji</strong>
                <span>
                  Gaji akan muncul di sini setelah Owner menyelesaikan
                  persetujuan dan pembayaran periode kamu.
                </span>
              </div>
            ) : (
              <div className="payroll-list">
                {payrolls.map((item) => (
                  <div className="payroll-item" key={item.id}>
                    <div className="payroll-top">
                      <div className="payroll-period-icon">
                        <Receipt size={19} />
                      </div>

                      <div className="payroll-period">
                        <strong>Periode Penggajian</strong>
                        <span>
                          {formatShortDate(item.week_start)} –{" "}
                          {formatShortDate(item.week_end)}
                        </span>
                      </div>

                      <span className="paid-badge">
                        <CheckCircle2 size={13} />
                        Dibayar
                      </span>
                    </div>

                    <div className="salary-detail">
                      <div>
                        <span>Gaji Kotor</span>
                        <strong>
                          {formatRupiah(item.gross_salary)}
                        </strong>
                      </div>

                      <div>
                        <span>Potongan Absensi</span>
                        <strong className="deduction">
                          -{formatRupiah(item.absence_deduction)}
                        </strong>
                      </div>

                      <div>
                        <span>Potongan Piutang</span>
                        <strong className="deduction">
                          -{formatRupiah(item.debt_deduction)}
                        </strong>
                      </div>
                    </div>

                    <div className="net-salary">
                      <div>
                        <span>Gaji Bersih</span>
                        <strong>
                          {formatRupiah(item.net_salary)}
                        </strong>
                      </div>

                      {item.paid_at && (
                        <small>
                          Dibayar pada {formatDate(
                            item.paid_at.slice(0, 10)
                          )}
                        </small>
                      )}
                    </div>

                    {item.notes && (
                      <div className="payroll-note">
                        Catatan: {item.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="info-note">
              <ShieldCheck size={16} />
              Hanya penggajian berstatus paid yang ditampilkan.
            </div>
          </section>
        )}

        {/* RIWAYAT PIUTANG */}
        {activeTab === "debt" && (
          <section className="content-card">
            <div className="content-heading">
              <div className="content-heading-icon debt-heading-icon">
                <HandCoins size={21} />
              </div>

              <div>
                <h2>Riwayat Piutang</h2>
                <p>Catatan barang dan piutang pegawai.</p>
              </div>

              <span className="data-count">
                {debts.length} Transaksi
              </span>
            </div>

            <div className="debt-summary">
              <span>Total Sisa Piutang</span>
              <strong>{formatRupiah(totalDebt)}</strong>
              <small>Akumulasi seluruh piutang yang belum lunas</small>
            </div>

            {debts.length === 0 ? (
              <div className="empty-state">
                <HandCoins size={35} />
                <strong>Belum Ada Piutang</strong>
                <span>
                  Piutang yang dicatat dan disimpan oleh Owner akan
                  muncul di halaman ini.
                </span>
              </div>
            ) : (
              <div className="debt-list">
                {debts.map((debt) => {
                  const items = getDebtItems(debt.id);

                  return (
                    <div className="debt-item" key={debt.id}>
                      <div className="debt-top">
                        <div className="debt-date-icon">
                          <Receipt size={19} />
                        </div>

                        <div className="debt-info">
                          <strong>
                            {debt.description || "Piutang Pegawai"}
                          </strong>
                          <span>{formatDate(debt.debt_date)}</span>
                        </div>

                        <span
                          className={`status-badge ${
                            debt.status === "paid"
                              ? "status-present"
                              : "status-absent"
                          }`}
                        >
                          {debt.status === "paid"
                            ? "Lunas"
                            : "Belum Lunas"}
                        </span>
                      </div>

                      {items.length > 0 && (
                        <div className="debt-products">
                          <div className="debt-products-title">
                            <Package size={15} />
                            Detail Barang
                          </div>

                          {items.map((item) => (
                            <div
                              className="debt-product"
                              key={item.id}
                            >
                              <div>
                                <strong>
                                  {item.product_name_snapshot}
                                </strong>
                                <span>
                                  {item.product_code_snapshot}
                                  {item.brand_snapshot
                                    ? ` • ${item.brand_snapshot}`
                                    : ""}
                                </span>
                                <small>
                                  {item.quantity} ×{" "}
                                  {formatRupiah(
                                    item.selling_price_snapshot
                                  )}
                                </small>
                              </div>

                              <strong>
                                {formatRupiah(item.line_total)}
                              </strong>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="debt-finance">
                        <div>
                          <span>Total Piutang</span>
                          <strong>
                            {formatRupiah(
                              debt.total_amount || debt.original_amount
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>Sisa Piutang</span>
                          <strong className="debt-remaining">
                            {formatRupiah(debt.remaining_amount)}
                          </strong>
                        </div>
                      </div>

                      {debt.notes && (
                        <div className="debt-note">
                          Catatan: {debt.notes}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="info-note">
              <ShieldCheck size={16} />
              Data piutang mengikuti pencatatan Owner.
            </div>
          </section>
        )}

        {/* FOOTER */}
        <footer className="employee-footer">
          © {new Date().getFullYear()} Toko Rosyidah
          <span>•</span>
          Sebaung
        </footer>
      </div>

      <style jsx>{`
        .employee-page {
          min-height: 100vh;
          box-sizing: border-box;
          padding: 28px 20px 18px;
          background: #f5f8f5;
          color: #20392a;
          font-family: inherit;
        }

        .employee-container {
          width: 100%;
          max-width: 850px;
          margin: 0 auto;
        }

        .employee-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 42px;
        }

        .employee-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .brand-icon {
          width: 45px;
          height: 45px;
          display: grid;
          place-items: center;
          border-radius: 13px;
          background: #e5f3e9;
          color: #176b45;
        }

        .employee-brand strong {
          display: block;
          color: #1b3929;
          font-size: 17px;
          font-weight: 800;
        }

        .employee-brand span {
          display: block;
          margin-top: 3px;
          color: #87958c;
          font-size: 11px;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .refresh-button,
        .logout-button {
          min-height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px solid #e3eae4;
          border-radius: 10px;
          background: white;
          cursor: pointer;
          transition: all 0.2s;
        }

        .refresh-button {
          width: 40px;
          color: #176b45;
        }

        .logout-button {
          padding: 0 13px;
          color: #b42318;
          font-family: inherit;
          font-size: 12px;
          font-weight: 700;
        }

        .refresh-button:hover,
        .logout-button:hover {
          background: #f0f7f1;
        }

        .welcome-section {
          margin-bottom: 27px;
        }

        .welcome-label {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #218653;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.3px;
        }

        .welcome-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #218653;
        }

        .welcome-section h1 {
          margin: 11px 0 7px;
          color: #20392a;
          font-size: 31px;
          font-weight: 800;
          letter-spacing: -0.8px;
        }

        .welcome-section h1 span {
          color: #176b45;
        }

        .welcome-section > p {
          margin: 0;
          color: #849188;
          font-size: 13px;
          line-height: 1.7;
        }

        .welcome-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
          margin-top: 15px;
        }

        .welcome-meta span {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 9px 12px;
          border: 1px solid #e2ebe4;
          border-radius: 9px;
          background: white;
          color: #52695a;
          font-size: 11px;
          font-weight: 600;
        }

        .welcome-meta svg {
          color: #218653;
        }

        .attendance-card,
        .content-card {
          padding: 24px;
          border: 1px solid #e5ebe6;
          border-radius: 17px;
          background: white;
          box-shadow: 0 4px 15px rgba(30, 67, 44, 0.025);
        }

        .attendance-card {
          margin-bottom: 27px;
        }

        .card-heading,
        .content-heading {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .heading-icon,
        .content-heading-icon {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          border-radius: 12px;
          background: #eaf5ed;
          color: #176b45;
        }

        .card-heading h2,
        .content-heading h2 {
          margin: 0;
          color: #263e30;
          font-size: 15px;
          font-weight: 800;
        }

        .card-heading p,
        .content-heading p {
          margin: 4px 0 0;
          color: #91a096;
          font-size: 11px;
        }

        .today-badge {
          margin-left: auto;
          padding: 6px 9px;
          border-radius: 7px;
          background: #edf7ef;
          color: #176b45;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.5px;
        }

        .loading-inline {
          min-height: 130px;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 10px;
          color: #87958c;
          font-size: 12px;
        }

        .small-spinner,
        .button-spinner,
        .loading-spinner {
          border: 2px solid #dce9df;
          border-top-color: #176b45;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .small-spinner {
          width: 18px;
          height: 18px;
        }

        .attendance-done {
          margin-top: 24px;
          padding: 19px;
          border: 1px solid #dcefe2;
          border-radius: 13px;
          background: #f8fcf9;
        }

        .attendance-done-top {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .done-icon {
          width: 41px;
          height: 41px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          border-radius: 12px;
          background: #e3f4e8;
          color: #218653;
        }

        .done-info {
          flex: 1;
        }

        .done-info span {
          display: block;
          margin-bottom: 4px;
          color: #8b9c90;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.9px;
        }

        .done-info strong {
          color: #176b45;
          font-size: 13px;
        }

        .present-badge,
        .paid-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 9px;
          border-radius: 20px;
          background: #e6f5ea;
          color: #176b45;
          font-size: 10px;
          font-weight: 700;
          white-space: nowrap;
        }

        .time-panel {
          margin-top: 19px;
          padding-top: 17px;
          border-top: 1px solid #e5eee7;
        }

        .time-panel > span {
          color: #8a9a8f;
          font-size: 11px;
        }

        .time-value {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 7px;
          color: #20392a;
          font-size: 30px;
          font-weight: 800;
          letter-spacing: -0.7px;
        }

        .time-value svg {
          color: #218653;
        }

        .time-panel small {
          display: block;
          margin-top: 5px;
          color: #9aa69e;
          font-size: 10px;
        }

        .attendance-pending {
          margin-top: 24px;
          padding: 25px 20px 19px;
          border: 1px dashed #dce9df;
          border-radius: 13px;
          background: #fbfdfb;
          text-align: center;
        }

        .pending-icon {
          width: 57px;
          height: 57px;
          display: grid;
          place-items: center;
          margin: 0 auto 14px;
          border-radius: 17px;
          background: #e9f5ed;
          color: #176b45;
        }

        .attendance-pending h3 {
          margin: 0;
          color: #263e30;
          font-size: 16px;
          font-weight: 800;
        }

        .attendance-pending p {
          margin: 8px 0 0;
          color: #89968d;
          font-size: 12px;
          line-height: 1.7;
        }

        .checkin-button {
          width: 100%;
          max-width: 340px;
          min-height: 49px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-top: 20px;
          padding: 12px 18px;
          border: none;
          border-radius: 10px;
          background: #176b45;
          color: white;
          font-family: inherit;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.2s;
        }

        .checkin-button:hover:not(:disabled) {
          background: #125b3a;
          transform: translateY(-1px);
        }

        .checkin-button:disabled {
          opacity: 0.7;
          cursor: wait;
        }

        .button-spinner {
          width: 15px;
          height: 15px;
          border-color: rgba(255, 255, 255, 0.3);
          border-top-color: white;
        }

        .menu-section {
          margin-bottom: 22px;
        }

        .menu-title {
          margin-bottom: 14px;
        }

        .menu-title h2 {
          margin: 0;
          color: #263e30;
          font-size: 17px;
          font-weight: 800;
        }

        .menu-title p {
          margin: 5px 0 0;
          color: #91a096;
          font-size: 11px;
        }

        .menu-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 11px;
        }

        .menu-card {
          min-width: 0;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 15px;
          padding: 17px;
          border: 1px solid #e5ebe6;
          border-radius: 14px;
          background: white;
          color: #263e30;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s;
        }

        .menu-card:hover,
        .menu-active {
          border-color: #a9cbb3;
          background: #f7fbf8;
          box-shadow: 0 4px 14px rgba(30, 67, 44, 0.05);
        }

        .menu-icon {
          width: 43px;
          height: 43px;
          display: grid;
          place-items: center;
          border-radius: 12px;
        }

        .attendance-menu-icon {
          background: #eaf5ed;
          color: #176b45;
        }

        .payroll-menu-icon {
          background: #edf1fb;
          color: #4766a3;
        }

        .debt-menu-icon {
          background: #fbf3e7;
          color: #a47734;
        }

        .menu-card-text {
          display: flex;
          flex-direction: column;
          gap: 5px;
          flex: 1;
        }

        .menu-card-text strong {
          font-size: 12px;
          font-weight: 800;
        }

        .menu-card-text span {
          color: #8d9b91;
          font-size: 10px;
          line-height: 1.5;
        }

        .menu-arrow {
          color: #91a096;
          align-self: flex-end;
        }

        .content-card {
          margin-bottom: 20px;
        }

        .content-heading {
          margin-bottom: 21px;
        }

        .content-heading > div:nth-child(2) {
          flex: 1;
          min-width: 0;
        }

        .payroll-heading-icon {
          background: #edf1fb;
          color: #4766a3;
        }

        .debt-heading-icon {
          background: #fbf3e7;
          color: #a47734;
        }

        .data-count {
          padding: 6px 9px;
          border-radius: 8px;
          background: #f2f6f3;
          color: #607568;
          font-size: 10px;
          font-weight: 700;
          white-space: nowrap;
        }

        .empty-state {
          min-height: 175px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 9px;
          padding: 20px;
          color: #91a096;
          text-align: center;
        }

        .empty-state svg {
          margin-bottom: 3px;
          color: #a0b5a7;
        }

        .empty-state strong {
          color: #52695a;
          font-size: 14px;
        }

        .empty-state span {
          max-width: 340px;
          font-size: 11px;
          line-height: 1.7;
        }

        .record-list,
        .payroll-list,
        .debt-list {
          display: flex;
          flex-direction: column;
        }

        .record-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 0;
          border-bottom: 1px solid #edf1ee;
        }

        .record-item:last-child {
          border-bottom: none;
        }

        .record-icon,
        .payroll-period-icon,
        .debt-date-icon {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          border-radius: 11px;
          background: #f0f6f2;
          color: #42815b;
        }

        .record-info {
          flex: 1;
          min-width: 0;
        }

        .record-info strong {
          display: block;
          color: #344b3b;
          font-size: 12px;
          font-weight: 700;
        }

        .record-info span {
          display: flex;
          align-items: center;
          gap: 5px;
          margin-top: 5px;
          color: #9aa69e;
          font-size: 10px;
        }

        .record-info small {
          display: block;
          margin-top: 5px;
          color: #718579;
          font-size: 10px;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 6px 9px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 700;
          white-space: nowrap;
        }

        .status-present {
          background: #e6f5ea;
          color: #176b45;
        }

        .status-permission {
          background: #fff6e8;
          color: #9b702c;
        }

        .status-absent {
          background: #fff0ef;
          color: #b42318;
        }

        .salary-summary,
        .debt-summary {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 18px;
          margin-bottom: 18px;
          border: 1px solid #e3eee5;
          border-radius: 13px;
          background: #f7fbf8;
        }

        .salary-summary span,
        .debt-summary span {
          color: #82958a;
          font-size: 11px;
        }

        .salary-summary strong,
        .debt-summary strong {
          color: #176b45;
          font-size: 25px;
          font-weight: 800;
          letter-spacing: -0.5px;
        }

        .salary-summary small,
        .debt-summary small {
          color: #91a096;
          font-size: 10px;
        }

        .payroll-item,
        .debt-item {
          padding: 17px 0;
          border-bottom: 1px solid #edf1ee;
        }

        .payroll-item:last-child,
        .debt-item:last-child {
          border-bottom: none;
        }

        .payroll-top,
        .debt-top {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .payroll-period,
        .debt-info {
          flex: 1;
          min-width: 0;
        }

        .payroll-period strong,
        .debt-info strong {
          display: block;
          color: #344b3b;
          font-size: 12px;
          font-weight: 800;
        }

        .payroll-period span,
        .debt-info span {
          display: block;
          margin-top: 5px;
          color: #91a096;
          font-size: 10px;
        }

        .salary-detail {
          display: flex;
          flex-direction: column;
          gap: 11px;
          margin-top: 17px;
          padding: 15px;
          border-radius: 10px;
          background: #f8faf8;
        }

        .salary-detail > div,
        .net-salary > div,
        .debt-finance > div {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .salary-detail span,
        .net-salary span,
        .debt-finance span {
          color: #829187;
          font-size: 11px;
        }

        .salary-detail strong,
        .debt-finance strong {
          color: #405447;
          font-size: 11px;
          font-weight: 700;
          text-align: right;
        }

        .salary-detail .deduction {
          color: #b66b4b;
        }

        .net-salary {
          margin-top: 12px;
          padding: 14px;
          border: 1px solid #dcefe2;
          border-radius: 10px;
          background: #f4faf5;
        }

        .net-salary strong {
          color: #176b45;
          font-size: 16px;
          font-weight: 800;
        }

        .net-salary small {
          display: block;
          margin-top: 9px;
          color: #8b9c90;
          font-size: 10px;
        }

        .payroll-note,
        .debt-note {
          margin-top: 11px;
          color: #839187;
          font-size: 10px;
          line-height: 1.6;
        }

        .debt-products {
          margin-top: 15px;
          padding: 13px;
          border-radius: 10px;
          background: #fafbf9;
        }

        .debt-products-title {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 11px;
          color: #536b5a;
          font-size: 11px;
          font-weight: 800;
        }

        .debt-product {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          padding: 10px 0;
          border-bottom: 1px solid #edf1ee;
        }

        .debt-product:last-child {
          border-bottom: none;
        }

        .debt-product > div {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .debt-product > div strong {
          color: #344b3b;
          font-size: 11px;
        }

        .debt-product > div span,
        .debt-product > div small {
          color: #91a096;
          font-size: 9px;
        }

        .debt-product > strong {
          color: #52695a;
          font-size: 11px;
          white-space: nowrap;
        }

        .debt-finance {
          display: flex;
          flex-direction: column;
          gap: 11px;
          margin-top: 13px;
          padding: 14px;
          border-radius: 10px;
          background: #f8faf8;
        }

        .debt-finance .debt-remaining {
          color: #b66b4b;
          font-size: 13px;
          font-weight: 800;
        }

        .info-note {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-top: 19px;
          padding: 11px 12px;
          border-radius: 9px;
          background: #f5f8f5;
          color: #84958a;
          font-size: 10px;
          line-height: 1.6;
        }

        .info-note svg {
          flex-shrink: 0;
          color: #76a287;
        }

        .notice {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          margin-bottom: 15px;
          padding: 12px 14px;
          border-radius: 10px;
          font-size: 12px;
          line-height: 1.6;
        }

        .notice svg {
          flex-shrink: 0;
          margin-top: 1px;
        }

        .error-notice {
          background: #fff3f2;
          color: #b42318;
        }

        .success-notice {
          background: #edf8f0;
          color: #176b45;
        }

        .employee-security {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 7px;
          margin-top: 25px;
          color: #91a096;
          font-size: 10px;
        }

        .employee-security svg {
          color: #83a18c;
        }

        .employee-footer {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 9px;
          padding: 22px 0 10px;
          color: #9aa69e;
          font-size: 10px;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 600px) {
          .employee-page {
            padding: 19px 14px 10px;
          }

          .employee-header {
            margin-bottom: 31px;
          }

          .employee-brand strong {
            font-size: 15px;
          }

          .welcome-section h1 {
            font-size: 27px;
          }

          .attendance-card,
          .content-card {
            padding: 18px;
            border-radius: 15px;
          }

          .menu-grid {
            grid-template-columns: 1fr;
          }

          .menu-card {
            flex-direction: row;
            align-items: center;
            gap: 12px;
            padding: 13px;
          }

          .menu-card-text {
            gap: 4px;
          }

          .menu-arrow {
            margin-left: auto;
          }

          .time-value {
            font-size: 27px;
          }

          .record-item {
            gap: 9px;
          }

          .record-info strong {
            font-size: 11px;
          }

          .record-status .status-badge {
            padding: 5px 7px;
            font-size: 9px;
          }

          .salary-summary strong,
          .debt-summary strong {
            font-size: 22px;
          }
        }

        @media (max-width: 380px) {
          .logout-button {
            padding: 0 9px;
          }

          .welcome-section h1 {
            font-size: 24px;
          }

          .content-heading {
            gap: 8px;
          }

          .content-heading h2 {
            font-size: 13px;
          }

          .data-count {
            font-size: 9px;
            padding: 5px 7px;
          }
        }
      `}</style>
    </main>
  );
}
