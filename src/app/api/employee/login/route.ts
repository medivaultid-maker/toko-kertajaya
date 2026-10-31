
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return NextResponse.json(
        { error: "Konfigurasi Supabase belum lengkap." },
        { status: 500 }
      );
    }

    const body = await request.json();

    const fullName =
      typeof body.full_name === "string" ? body.full_name.trim() : "";
    const employeeCode =
      typeof body.employee_code === "string"
        ? body.employee_code.trim().toUpperCase()
        : "";
    const password =
      typeof body.password === "string" ? body.password : "";

    if (!fullName || !employeeCode || !password) {
      return NextResponse.json(
        { error: "Nama, kode pegawai, dan password wajib diisi." },
        { status: 400 }
      );
    }

    const admin = createAdminClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Cocokkan nama dan kode dengan data karyawan
    const { data: employee, error: employeeError } = await admin
      .from("employees")
      .select("id, full_name, employee_code, profile_id, is_active")
      .eq("full_name", fullName)
      .eq("employee_code", employeeCode)
      .maybeSingle();

    if (
      employeeError ||
      !employee ||
      !employee.profile_id ||
      !employee.is_active
    ) {
      return NextResponse.json(
        { error: "Nama, kode pegawai, atau password salah." },
        { status: 401 }
      );
    }

    // Ambil email internal akun dari Supabase Auth
    const { data: authData, error: authError } =
      await admin.auth.admin.getUserById(employee.profile_id);

    if (authError || !authData.user?.email) {
      return NextResponse.json(
        { error: "Akun pegawai tidak ditemukan." },
        { status: 401 }
      );
    }

    // Buat sesi login Supabase agar cookie tersimpan di browser
    const cookieStore = await cookies();

    const supabase = createServerClient(supabaseUrl, anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    });

    const { data: loginData, error: loginError } =
      await supabase.auth.signInWithPassword({
        email: authData.user.email,
        password,
      });

    if (loginError || !loginData.user) {
      return NextResponse.json(
        { error: "Nama, kode pegawai, atau password salah." },
        { status: 401 }
      );
    }

   return NextResponse.json({
  success: true,
  redirect: "/pegawai",
});
  } catch (error) {
    console.error("Employee login error:", error);

    return NextResponse.json(
      { error: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}
