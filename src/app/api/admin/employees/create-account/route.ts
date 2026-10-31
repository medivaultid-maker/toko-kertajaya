
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return NextResponse.json(
        { error: "Konfigurasi Supabase belum lengkap." },
        { status: 500 }
      );
    }

    // Periksa sesi pengguna yang sedang login
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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    // Pastikan hanya admin yang dapat membuat akun
    const adminSupabase = createAdminClient(
      supabaseUrl,
      serviceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

   const { data: profile, error: profileError } =
  await adminSupabase
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

if (profileError) {
  console.error("PROFILE CHECK ERROR:", profileError);

  return NextResponse.json(
    {
      error: "Gagal membaca profil admin.",
      detail: profileError.message,
      user_id: user.id,
    },
    { status: 500 }
  );
}

if (!profile) {
  return NextResponse.json(
    {
      error: "Profil admin tidak ditemukan untuk sesi login ini.",
      user_id: user.id,
    },
    { status: 403 }
  );
}

if (profile.role !== "admin") {
  return NextResponse.json(
    {
      error: "Role akun bukan admin.",
      role: profile.role,
      user_id: user.id,
    },
    { status: 403 }
  );
}

if (profile.is_active !== true) {
  return NextResponse.json(
    {
      error: "Akun admin tidak aktif.",
      is_active: profile.is_active,
    },
    { status: 403 }
  );
}

    const body = await request.json();
    const employeeId = body.employee_id;
    const password = body.password;

    if (
      typeof employeeId !== "string" ||
      typeof password !== "string" ||
      password.length < 8
    ) {
      return NextResponse.json(
        { error: "Pilih pegawai dan gunakan password minimal 8 karakter." },
        { status: 400 }
      );
    }

    // Ambil data pegawai
    const { data: employee, error: employeeError } =
      await adminSupabase
        .from("employees")
        .select("id, full_name, employee_code, profile_id, is_active")
        .eq("id", employeeId)
        .single();

    if (employeeError || !employee) {
      return NextResponse.json(
        { error: "Data pegawai tidak ditemukan." },
        { status: 404 }
      );
    }

    if (!employee.is_active) {
      return NextResponse.json(
        { error: "pegawai ini tidak aktif." },
        { status: 400 }
      );
    }

    if (employee.profile_id) {
      return NextResponse.json(
        { error: "pegawai ini sudah memiliki akun." },
        { status: 409 }
      );
    }

    if (!employee.employee_code) {
      return NextResponse.json(
        { error: "Kode pegawai belum tersedia." },
        { status: 400 }
      );
    }

    // Email internal untuk Supabase Auth.
    // pegawai tidak perlu mengetahui atau menggunakan email ini.
    const internalEmail =
      `employee.${employee.employee_code.toLowerCase()}@employees.invalid`;

    // Buat akun Auth
    const { data: authData, error: createError } =
      await adminSupabase.auth.admin.createUser({
        email: internalEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: employee.full_name,
          employee_code: employee.employee_code,
          account_type: "employee",
        },
      });

    if (createError || !authData.user) {
      return NextResponse.json(
        {
          error: createError?.message || "Gagal membuat akun pegawai.",
        },
        { status: 400 }
      );
    }

    const newUserId = authData.user.id;

    // Buat atau perbarui profil akun.
    // Upsert juga menangani kemungkinan profil dibuat otomatis
    // oleh trigger Supabase yang sudah ada.
    const { error: insertProfileError } = await adminSupabase
      .from("profiles")
      .upsert(
        {
          id: newUserId,
          full_name: employee.full_name,
          role: "employee",
          is_active: true,
        },
        { onConflict: "id" }
      );

    if (insertProfileError) {
      await adminSupabase.auth.admin.deleteUser(newUserId);

      return NextResponse.json(
        { error: "Gagal membuat profil: " + insertProfileError.message },
        { status: 500 }
      );
    }

    // Hubungkan akun dengan data pegawai
    const { error: updateEmployeeError } = await adminSupabase
      .from("employees")
      .update({ profile_id: newUserId })
      .eq("id", employee.id)
      .is("profile_id", null);

    if (updateEmployeeError) {
      await adminSupabase
        .from("profiles")
        .delete()
        .eq("id", newUserId);

      await adminSupabase.auth.admin.deleteUser(newUserId);

      return NextResponse.json(
        { error: "Gagal menghubungkan akun: " + updateEmployeeError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Akun pegawai berhasil dibuat.",
      employee: {
        id: employee.id,
        full_name: employee.full_name,
        employee_code: employee.employee_code,
      },
    });
  } catch (error) {
    console.error("Create employee account error:", error);

    return NextResponse.json(
      { error: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}
