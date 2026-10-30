
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

 
async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  setError("");
  setLoading(true);

  try {
    const supabase = createClient();

    const { data, error: loginError } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    if (loginError) {
      setError(loginError.message);
      return;
    }

    if (!data.session) {
      setError("Login berhasil, tetapi sesi belum terbentuk.");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");

    const destination =
      next && next.startsWith("/") && !next.startsWith("//")
        ? next
        : "/dashboard";

    window.location.replace(destination);
  } catch (err) {
    console.error("Login error:", err);
    setError("Terjadi kesalahan saat login. Periksa koneksi internet.");
  } finally {
    setLoading(false);
  }
}


  return (
    <main className="login-page">
      <form className="login-card" onSubmit={handleLogin}>
        <div className="login-logo">TK</div>
        <h1>TOKO ROSYIDAH</h1>
        <p>Silakan masuk ke sistem toko</p>

        <label htmlFor="email">Email akun</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Masukkan email"
          autoComplete="username"
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Masukkan password"
          autoComplete="current-password"
          required
        />

        {error && <p className="login-error">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Memproses..." : "Masuk"}
        </button>

        <small>Alamat: Pasar Sebaung</small>
      </form>
    </main>
  );
}
