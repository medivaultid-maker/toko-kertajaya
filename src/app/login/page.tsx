
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import {
  ArrowLeft,
  Store,
  Mail,
  LockKeyhole,
  Eye,
  EyeOff,
  ShieldCheck,
  UserRound,
  BadgeCheck,
  ArrowRight,
} from "lucide-react";

type LoginMode = "admin" | "employee";

export default function LoginPage() {
  const router = useRouter();

  const [loginMode, setLoginMode] = useState<LoginMode>("admin");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (loginMode === "admin") {
        const supabase = createClient();

        const { data, error: loginError } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

        if (loginError || !data.session) {
          setError("Email atau password yang kamu masukkan salah.");
          return;
        }

        const params = new URLSearchParams(window.location.search);
        const next = params.get("next");

        const destination =
          next && next.startsWith("/") && !next.startsWith("//")
            ? next
            : "/";

        router.replace(destination);
        router.refresh();
        return;
      }

      const response = await fetch("/api/employee/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: fullName.trim(),
          employee_code: employeeCode.trim().toUpperCase(),
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Login pegawai gagal.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch (err) {
      console.error("Login error:", err);
      setError("Terjadi kesalahan. Periksa koneksi internet kamu.");
    } finally {
      setLoading(false);
    }
  }

  function changeLoginMode(mode: LoginMode) {
    setLoginMode(mode);
    setError("");
    setPassword("");
    setShowPassword(false);
  }

  return (
    <main className="login-page">
      <div className="login-container">
        <Link href="/" className="login-back">
          <span className="login-back-icon">
            <ArrowLeft size={18} />
          </span>
          Kembali ke Beranda
        </Link>

        <section className="login-card">
          <div className="login-brand">
            <div className="login-brand-icon">
              <Store size={34} strokeWidth={1.8} />
            </div>

            <h1>Toko Rosyidah</h1>
            <p>Sistem Manajemen Toko &amp; Kasir</p>
          </div>

          <div className="login-divider" />

          <div className="login-heading">
            <span className="login-eyebrow">SELAMAT DATANG KEMBALI</span>
            <h2>Masuk ke Akun</h2>
            <p>Pilih jenis akun untuk melanjutkan.</p>
          </div>

          <div className="login-tabs">
            <button
              type="button"
              className={loginMode === "admin" ? "active" : ""}
              onClick={() => changeLoginMode("admin")}
              aria-pressed={loginMode === "admin"}
            >
              <ShieldCheck size={18} />
              <span>Admin</span>
            </button>

            <button
              type="button"
              className={loginMode === "employee" ? "active" : ""}
              onClick={() => changeLoginMode("employee")}
              aria-pressed={loginMode === "employee"}
            >
              <UserRound size={18} />
              <span>Pegawai</span>
            </button>
          </div>

          <div className="login-mode-info">
            {loginMode === "admin" ? (
              <>
                <ShieldCheck size={17} />
                <span>Masuk menggunakan akun administrator toko.</span>
              </>
            ) : (
              <>
                <UserRound size={17} />
                <span>Masuk menggunakan nama dan kode pegawai.</span>
              </>
            )}
          </div>

          <form onSubmit={handleLogin} className="login-form">
            {loginMode === "admin" ? (
              <div className="login-field">
                <label htmlFor="email">Email Admin</label>

                <div className="login-input-wrapper">
                  <Mail size={19} className="login-input-icon" />

                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="login-field">
                  <label htmlFor="fullName">Nama Lengkap</label>

                  <div className="login-input-wrapper">
                    <UserRound size={19} className="login-input-icon" />

                    <input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Masukkan nama lengkap"
                      autoComplete="username"
                      required
                    />
                  </div>
                </div>

                <div className="login-field">
                  <label htmlFor="employeeCode">Kode Pegawai</label>

                  <div className="login-input-wrapper">
                    <BadgeCheck size={19} className="login-input-icon" />

                    <input
                      id="employeeCode"
                      type="text"
                      value={employeeCode}
                      onChange={(e) =>
                        setEmployeeCode(e.target.value.toUpperCase())
                      }
                      placeholder="Contoh: PGW001"
                      autoComplete="off"
                      required
                    />
                  </div>
                </div>
              </>
            )}

            <div className="login-field">
              <label htmlFor="password">Password</label>

              <div className="login-input-wrapper">
                <LockKeyhole size={19} className="login-input-icon" />

                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  autoComplete="current-password"
                  required
                />

                <button
                  type="button"
                  className="login-eye-button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={
                    showPassword
                      ? "Sembunyikan password"
                      : "Tampilkan password"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={19} />
                  ) : (
                    <Eye size={19} />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="login-error" role="alert">
                <span className="login-error-icon">!</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="login-submit"
              disabled={loading}
            >
              <span>
                {loading
                  ? "Memproses..."
                  : loginMode === "admin"
                    ? "Masuk sebagai Admin"
                    : "Masuk sebagai Pegawai"}
              </span>

              {!loading && <ArrowRight size={19} />}
            </button>
          </form>

          <div className="login-security">
            <ShieldCheck size={17} />
            <span>Akses aman dan terlindungi</span>
          </div>
        </section>

        <footer className="login-footer">
          <span>© {new Date().getFullYear()} Toko Rosyidah</span>
          <span className="footer-dot">•</span>
          <span>Pasar Sebaung</span>
        </footer>
      </div>

      <style jsx>{`
        .login-page {
          min-height: 100vh;
          width: 100%;
          box-sizing: border-box;
          padding: 35px 20px;
          display: flex;
          justify-content: center;
          align-items: center;
          background:
            radial-gradient(
              circle at 10% 10%,
              rgba(33, 134, 83, 0.07),
              transparent 30%
            ),
            radial-gradient(
              circle at 90% 90%,
              rgba(33, 134, 83, 0.06),
              transparent 30%
            ),
            #f4f7f5;
          color: #1b3025;
          font-family: inherit;
        }

        .login-container {
          width: 100%;
          max-width: 470px;
          margin: auto;
        }

        .login-back {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 18px;
          color: #52675a;
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
          transition: color 0.2s ease;
        }

        .login-back:hover {
          color: #176b45;
        }

        .login-back-icon {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: #e7f2ea;
          color: #176b45;
        }

        .login-card {
          width: 100%;
          box-sizing: border-box;
          padding: 35px 38px 30px;
          background: #ffffff;
          border: 1px solid #e5ece7;
          border-radius: 22px;
          box-shadow: 0 16px 50px rgba(30, 67, 44, 0.07);
        }

        .login-brand {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .login-brand-icon {
          width: 68px;
          height: 68px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 13px;
          border-radius: 20px;
          background: #e9f5ed;
          color: #176b45;
        }

        .login-brand h1 {
          margin: 0;
          color: #173b29;
          font-size: 25px;
          line-height: 1.3;
          font-weight: 800;
          letter-spacing: -0.7px;
        }

        .login-brand p {
          margin: 5px 0 0;
          color: #8b9a90;
          font-size: 13px;
          font-weight: 500;
        }

        .login-divider {
          height: 1px;
          background: #e9eeea;
          margin: 25px 0;
        }

        .login-heading {
          text-align: center;
        }

        .login-eyebrow {
          display: block;
          margin-bottom: 7px;
          color: #218653;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.5px;
        }

        .login-heading h2 {
          margin: 0;
          color: #203b2b;
          font-size: 25px;
          line-height: 1.3;
          font-weight: 800;
          letter-spacing: -0.6px;
        }

        .login-heading p {
          margin: 7px 0 0;
          color: #8b9990;
          font-size: 13px;
        }

        .login-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 9px;
          margin-top: 25px;
          padding: 5px;
          border-radius: 13px;
          background: #f2f6f3;
        }

        .login-tabs button {
          min-height: 45px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          border: 1px solid transparent;
          border-radius: 10px;
          background: transparent;
          color: #718077;
          font-family: inherit;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .login-tabs button:hover {
          color: #176b45;
        }

        .login-tabs button.active {
          background: #ffffff;
          border-color: #e0ebe3;
          color: #176b45;
          box-shadow: 0 2px 7px rgba(30, 67, 44, 0.06);
        }

        .login-mode-info {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 15px;
          color: #849389;
          font-size: 11px;
          text-align: center;
        }

        .login-mode-info svg {
          flex-shrink: 0;
          color: #218653;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 18px;
          margin-top: 23px;
        }

        .login-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-width: 0;
        }

        .login-field label {
          color: #344b3b;
          font-size: 12px;
          font-weight: 700;
        }

        .login-input-wrapper {
          width: 100%;
          height: 51px;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 0 13px;
          border: 1px solid #dfe8e2;
          border-radius: 11px;
          background: #fbfcfb;
          transition: all 0.2s ease;
        }

        .login-input-wrapper:focus-within {
          border-color: #218653;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(33, 134, 83, 0.08);
        }

        .login-input-icon {
          flex-shrink: 0;
          color: #84958a;
        }

        .login-input-wrapper input {
          flex: 1;
          min-width: 0;
          width: 100%;
          height: 100%;
          border: none;
          outline: none;
          background: transparent;
          color: #24382b;
          font-family: inherit;
          font-size: 13px;
          font-weight: 500;
        }

        .login-input-wrapper input::placeholder {
          color: #aab6af;
          opacity: 1;
        }

        .login-eye-button {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 6px;
          border: none;
          border-radius: 8px;
          background: transparent;
          color: #91a398;
          cursor: pointer;
        }

        .login-eye-button:hover {
          background: #edf5ef;
          color: #176b45;
        }

        .login-error {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: -3px;
          padding: 11px 13px;
          border: 1px solid #f1d1ce;
          border-radius: 10px;
          background: #fff6f5;
          color: #b42318;
          font-size: 12px;
          line-height: 1.5;
        }

        .login-error-icon {
          width: 19px;
          height: 19px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #fce4e1;
          font-size: 12px;
          font-weight: 800;
        }

        .login-submit {
          width: 100%;
          min-height: 52px;
          margin-top: 3px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          border: none;
          border-radius: 11px;
          background: #176b45;
          color: #ffffff;
          font-family: inherit;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 6px 15px rgba(23, 107, 69, 0.14);
          transition: all 0.2s ease;
        }

        .login-submit:hover:not(:disabled) {
          background: #125b3a;
          transform: translateY(-1px);
          box-shadow: 0 9px 20px rgba(23, 107, 69, 0.19);
        }

        .login-submit:disabled {
          opacity: 0.7;
          cursor: wait;
        }

        .login-security {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          margin-top: 23px;
          color: #91a196;
          font-size: 11px;
          font-weight: 500;
        }

        .login-security svg {
          color: #76a287;
        }

        .login-footer {
          display: flex;
          justify-content: center;
          align-items: center;
          flex-wrap: wrap;
          gap: 9px;
          margin-top: 19px;
          color: #98a59c;
          font-size: 11px;
        }

        .footer-dot {
          color: #b4c0b8;
        }

        @media (max-width: 600px) {
          .login-page {
            padding: 22px 15px;
          }

          .login-card {
            padding: 29px 22px 25px;
            border-radius: 18px;
          }

          .login-brand-icon {
            width: 62px;
            height: 62px;
            border-radius: 18px;
          }

          .login-brand h1 {
            font-size: 23px;
          }

          .login-divider {
            margin: 22px 0;
          }

          .login-heading h2 {
            font-size: 23px;
          }

          .login-form {
            gap: 16px;
          }
        }

        @media (max-height: 700px) and (min-width: 601px) {
          .login-page {
            align-items: flex-start;
          }
        }
      `}</style>
    </main>
  );
}
