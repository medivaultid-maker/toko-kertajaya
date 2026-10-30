
"use client";

import { useEffect, useState } from "react";
import {
  CalendarCheck,
  Clock,
  LogOut,
  Store,
  CheckCircle2,
  History,
  ShieldCheck,
  UserRound,
  ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase";

type Attendance = {
  id: string;
  attendance_date: string;
  check_in: string;
};

export default function EmployeeDashboard({
  userName,
}: {
  userName: string;
}) {
  const [supabase] = useState(() => createClient());
  const [todayAttendance, setTodayAttendance] =
    useState<Attendance | null>(null);
  const [history, setHistory] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [message, setMessage] = useState("");

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Jakarta",
  });

  async function loadAttendance() {
    setLoading(true);

    const { data, error } = await supabase
      .from("attendance")
      .select("id, attendance_date, check_in")
      .eq("attendance_date", today)
      .order("check_in", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error) {
      setTodayAttendance(data);
    }

    const { data: historyData } = await supabase
      .from("attendance")
      .select("id, attendance_date, check_in")
      .order("attendance_date", { ascending: false })
      .limit(7);

    setHistory(historyData || []);
    setLoading(false);
  }

  useEffect(() => {
    void loadAttendance();
  }, []);

  async function handleCheckIn() {
    setCheckingIn(true);
    setMessage("");

    const { error } = await supabase.rpc("check_in_attendance");

    if (error) {
      setMessage(error.message);
      setCheckingIn(false);
      return;
    }

    setMessage("Absen masuk berhasil dicatat.");
    await loadAttendance();
    setCheckingIn(false);
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      alert(`Gagal logout: ${error.message}`);
      return;
    }

    window.location.href = "/login";
  }

  function formatDate(date: string) {
    return new Date(`${date}T00:00:00`).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function formatTime(date: string) {
    return new Date(date).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    });
  }

  return (
    <main className="employee-page">
      <div className="employee-container">
        <header className="employee-header">
          <div className="employee-brand">
            <div className="employee-brand-icon">
              <Store size={23} />
            </div>

            <div>
              <strong>Toko Rosyidah</strong>
              <span>Portal Pegawai</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="logout-button"
            type="button"
          >
            <LogOut size={16} />
            <span>Keluar</span>
          </button>
        </header>

        <section className="welcome-section">
          <div className="welcome-label">
            <span className="welcome-dot" />
            SELAMAT DATANG
          </div>

          <h1>
            Halo, <span>{userName}!</span>
          </h1>

          <p>
            Selamat bekerja. Jangan lupa melakukan absensi saat mulai bekerja.
          </p>

          <div className="welcome-date">
            <CalendarCheck size={16} />
            {new Date().toLocaleDateString("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: "Asia/Jakarta",
            })}
          </div>
        </section>

        <section className="attendance-card">
          <div className="section-heading">
            <div className="section-icon">
              <CalendarCheck size={21} />
            </div>

            <div>
              <h2>Absensi Hari Ini</h2>
              <p>Status kehadiran kamu hari ini</p>
            </div>
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner" />
              <span>Memuat data absensi...</span>
            </div>
          ) : todayAttendance ? (
            <div className="attendance-success">
              <div className="attendance-success-top">
                <div className="success-icon">
                  <CheckCircle2 size={25} />
                </div>

                <div>
                  <span className="status-label">STATUS KEHADIRAN</span>
                  <strong>Sudah Absen Masuk</strong>
                </div>

                <span className="status-badge">
                  <span />
                  Hadir
                </span>
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
              <div className="pending-illustration">
                <Clock size={30} />
              </div>

              <h3>Belum Absen Hari Ini</h3>
              <p>
                Silakan tekan tombol di bawah untuk mencatat waktu mulai
                bekerja kamu.
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
                    <ArrowRight size={19} />
                  </>
                )}
              </button>
            </div>
          )}

          {message && (
            <div
              className={`attendance-message ${
                message.includes("berhasil") ? "success" : "error"
              }`}
              role="status"
            >
              {message.includes("berhasil") ? (
                <CheckCircle2 size={17} />
              ) : (
                <ShieldCheck size={17} />
              )}
              {message}
            </div>
          )}
        </section>

        <section className="history-card">
          <div className="history-heading">
            <div className="section-heading">
              <div className="section-icon history-icon">
                <History size={21} />
              </div>

              <div>
                <h2>Riwayat Kehadiran</h2>
                <p>Catatan absensi terakhir kamu</p>
              </div>
            </div>

            <span className="history-count">
              {history.length} Data
            </span>
          </div>

          {loading ? (
            <div className="history-empty">
              Memuat riwayat kehadiran...
            </div>
          ) : history.length === 0 ? (
            <div className="history-empty">
              <div className="empty-icon">
                <History size={25} />
              </div>
              <strong>Belum Ada Riwayat</strong>
              <span>Riwayat absensi kamu akan muncul di sini.</span>
            </div>
          ) : (
            <div className="history-list">
              {history.map((item, index) => (
                <div className="history-item" key={item.id}>
                  <div className="history-date-icon">
                    <CalendarCheck size={18} />
                  </div>

                  <div className="history-info">
                    <strong>{formatDate(item.attendance_date)}</strong>
                    <span>
                      <Clock size={12} />
                      Absen masuk
                    </span>
                  </div>

                  <div className="history-time">
                    <strong>{formatTime(item.check_in)}</strong>
                    <span>Hadir</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="employee-security">
          <ShieldCheck size={16} />
          Data kehadiran tersimpan dengan aman.
        </div>

        <footer className="employee-footer">
          © {new Date().getFullYear()} Toko Rosyidah
          <span>•</span>
          Pasar Sebaung
        </footer>
      </div>

      <style jsx>{`
        .employee-page {
          min-height: 100vh;
          box-sizing: border-box;
          padding: 28px 20px 15px;
          background: #f5f7f6;
          color: #183328;
          font-family: inherit;
        }

        .employee-container {
          max-width: 850px;
          width: 100%;
          margin: 0 auto;
        }

        .employee-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          margin-bottom: 39px;
        }

        .employee-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .employee-brand-icon {
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

        .logout-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 39px;
          padding: 0 13px;
          border: 1px solid #e6ebe7;
          border-radius: 10px;
          background: #ffffff;
          color: #b42318;
          font-family: inherit;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .logout-button:hover {
          background: #fff5f4;
          border-color: #f1d4d1;
        }

        .welcome-section {
          margin-bottom: 26px;
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
          margin: 10px 0 7px;
          color: #20392a;
          font-size: 30px;
          line-height: 1.3;
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

        .welcome-date {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-top: 16px;
          padding: 9px 12px;
          border: 1px solid #e2ebe4;
          border-radius: 9px;
          background: #ffffff;
          color: #52695a;
          font-size: 11px;
          font-weight: 600;
        }

        .welcome-date svg {
          color: #218653;
        }

        .attendance-card,
        .history-card {
          padding: 24px;
          border: 1px solid #e5ebe6;
          border-radius: 17px;
          background: #ffffff;
          box-shadow: 0 4px 15px rgba(30, 67, 44, 0.025);
        }

        .attendance-card {
          margin-bottom: 19px;
        }

        .section-heading {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .section-icon {
          width: 41px;
          height: 41px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          border-radius: 12px;
          background: #eaf5ed;
          color: #176b45;
        }

        .section-heading h2 {
          margin: 0;
          color: #263e30;
          font-size: 15px;
          font-weight: 800;
        }

        .section-heading p {
          margin: 4px 0 0;
          color: #91a096;
          font-size: 11px;
        }

        .loading-state {
          min-height: 150px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: #87958c;
          font-size: 12px;
        }

        .loading-spinner,
        .button-spinner {
          width: 17px;
          height: 17px;
          border: 2px solid #dce9df;
          border-top-color: #176b45;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .attendance-success {
          margin-top: 25px;
          padding: 19px;
          border: 1px solid #dcefe2;
          border-radius: 13px;
          background: #f8fcf9;
        }

        .attendance-success-top {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .success-icon {
          display: grid;
          place-items: center;
          width: 40px;
          height: 40px;
          flex-shrink: 0;
          border-radius: 12px;
          background: #e3f4e8;
          color: #218653;
        }

        .attendance-success-top > div:nth-child(2) {
          flex: 1;
        }

        .status-label {
          display: block;
          margin-bottom: 4px;
          color: #8b9c90;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.9px;
        }

        .attendance-success-top strong {
          color: #176b45;
          font-size: 13px;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 9px;
          border-radius: 20px;
          background: #e6f5ea;
          color: #176b45;
          font-size: 10px;
          font-weight: 700;
        }

        .status-badge span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #218653;
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
          margin-top: 25px;
          padding: 25px 20px 19px;
          border: 1px dashed #dce9df;
          border-radius: 13px;
          background: #fbfdfb;
          text-align: center;
        }

        .pending-illustration {
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
          max-width: 350px;
          margin: 8px auto 0;
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
          color: #ffffff;
          font-family: inherit;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.3px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .checkin-button:hover:not(:disabled) {
          background: #125b3a;
          transform: translateY(-1px);
        }

        .checkin-button:disabled {
          background: #91aa99;
          cursor: wait;
        }

        .button-spinner {
          width: 15px;
          height: 15px;
          border-color: rgba(255, 255, 255, 0.3);
          border-top-color: #ffffff;
        }

        .attendance-message {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 15px;
          padding: 11px 13px;
          border-radius: 9px;
          font-size: 12px;
          line-height: 1.5;
        }

        .attendance-message.success {
          background: #edf8f0;
          color: #176b45;
        }

        .attendance-message.error {
          background: #fff3f2;
          color: #b42318;
        }

        .history-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 13px;
        }

        .history-icon {
          background: #f0f3f1;
          color: #62776a;
        }

        .history-count {
          padding: 6px 9px;
          border-radius: 8px;
          background: #f2f6f3;
          color: #607568;
          font-size: 10px;
          font-weight: 700;
        }

        .history-empty {
          min-height: 130px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: #9aa69e;
          font-size: 11px;
          text-align: center;
        }

        .empty-icon {
          width: 43px;
          height: 43px;
          display: grid;
          place-items: center;
          margin-bottom: 3px;
          border-radius: 13px;
          background: #f2f6f3;
          color: #82958a;
        }

        .history-empty strong {
          color: #617368;
          font-size: 13px;
        }

        .history-list {
          display: flex;
          flex-direction: column;
        }

        .history-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 0;
          border-bottom: 1px solid #edf1ee;
        }

        .history-item:last-child {
          border-bottom: none;
          padding-bottom: 3px;
        }

        .history-date-icon {
          width: 37px;
          height: 37px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          border-radius: 11px;
          background: #f0f6f2;
          color: #42815b;
        }

        .history-info {
          flex: 1;
          min-width: 0;
        }

        .history-info strong {
          display: block;
          color: #344b3b;
          font-size: 12px;
          font-weight: 700;
        }

        .history-info span {
          display: flex;
          align-items: center;
          gap: 5px;
          margin-top: 5px;
          color: #9aa69e;
          font-size: 10px;
        }

        .history-time {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 5px;
        }

        .history-time strong {
          color: #176b45;
          font-size: 13px;
          font-weight: 800;
        }

        .history-time span {
          color: #8d9c92;
          font-size: 10px;
        }

        .employee-security {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          margin-top: 22px;
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
            margin-bottom: 30px;
          }

          .employee-brand strong {
            font-size: 15px;
          }

          .welcome-section h1 {
            font-size: 26px;
          }

          .welcome-section > p {
            font-size: 12px;
          }

          .attendance-card,
          .history-card {
            padding: 18px;
            border-radius: 15px;
          }

          .attendance-success {
            padding: 15px;
          }

          .time-value {
            font-size: 27px;
          }

          .attendance-pending {
            padding: 21px 13px 17px;
          }

          .history-item {
            gap: 9px;
          }

          .history-info strong {
            font-size: 11px;
          }

          .history-time strong {
            font-size: 12px;
          }
        }

        @media (max-width: 360px) {
          .logout-button {
            padding: 0 10px;
          }

          .welcome-section h1 {
            font-size: 23px;
          }

          .status-badge {
            padding: 5px 7px;
            font-size: 9px;
          }
        }
      `}</style>
    </main>
  );
}
