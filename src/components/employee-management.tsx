
"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

type Employee = {
  id: string;
  full_name: string;
  weekly_wage: number;
  is_active: boolean;
};

const rupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

export default function EmployeeManagement() {
  const [supabase] = useState(() => createClient());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [name, setName] = useState("");
  const [wage, setWage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("employees")
      .select("id, full_name, weekly_wage, is_active")
      .order("full_name", { ascending: true });

    if (error) {
      setError(`Gagal memuat karyawan: ${error.message}`);
    } else {
      setEmployees((data ?? []) as Employee[]);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  function resetForm() {
    setName("");
    setWage("");
    setEditingId(null);
  }

  function startEdit(employee: Employee) {
    setEditingId(employee.id);
    setName(employee.full_name);
    setWage(String(employee.weekly_wage));
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const cleanName = name.trim();
    const weeklyWage = Number(wage);

    if (!cleanName) {
      setError("Nama karyawan wajib diisi.");
      return;
    }

    if (!wage.trim() || !Number.isSafeInteger(weeklyWage) || weeklyWage <= 0) {
      setError("Upah mingguan harus berupa angka rupiah bulat lebih dari nol.");
      return;
    }

    setSaving(true);

    const result = editingId
      ? await supabase
          .from("employees")
          .update({ full_name: cleanName, weekly_wage: weeklyWage })
          .eq("id", editingId)
      : await supabase.from("employees").insert({
          full_name: cleanName,
          weekly_wage: weeklyWage,
          is_active: true,
        });

    setSaving(false);

    if (result.error) {
      setError(`Gagal menyimpan: ${result.error.message}`);
      return;
    }

    setMessage(
      editingId
        ? "Data karyawan berhasil diperbarui."
        : "Karyawan baru berhasil ditambahkan."
    );

    resetForm();
    await loadEmployees();
  }

  async function toggleActive(employee: Employee) {
    const action = employee.is_active ? "menonaktifkan" : "mengaktifkan";
    const confirmed = window.confirm(
      `Yakin ingin ${action} ${employee.full_name}? Riwayat gaji dan piutang tidak dihapus.`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    const { error } = await supabase
      .from("employees")
      .update({ is_active: !employee.is_active })
      .eq("id", employee.id);

    if (error) {
      setError(`Gagal mengubah status: ${error.message}`);
      return;
    }

    setMessage(`Status ${employee.full_name} berhasil diperbarui.`);
    await loadEmployees();
  }

  return (
    <div className="employee-page">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Data Karyawan
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Kelola nama karyawan dan upah mingguan untuk perhitungan gaji mingguan.
        </p>
      </div>

      {(error || message) && (
        <div
          role="status"
          className={`rounded-xl border p-4 text-sm ${
            error
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-green-200 bg-green-50 text-green-700"
          }`}
        >
          {error || message}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        <h2 className="font-semibold text-gray-900">
          {editingId ? "Edit Karyawan" : "Tambah Karyawan"}
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-gray-700">
            Nama lengkap
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={150}
              required
              placeholder="Masukkan nama karyawan"
              className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 font-normal outline-none focus:border-blue-500"
            />
          </label>

          <label className="block text-sm font-medium text-gray-700">
            Upah mingguan (7 hari) (Rp)
            <input
              type="number"
              min="1"
              step="1"
              value={wage}
              onChange={(event) => setWage(event.target.value)}
              required
              placeholder="Contoh: 700000"
              className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 font-normal outline-none focus:border-blue-500"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving
              ? "Menyimpan..."
              : editingId
                ? "Simpan Perubahan"
                : "Tambah Karyawan"}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-gray-300 px-5 py-3 font-medium text-gray-700 hover:bg-gray-50"
            >
              Batal Edit
            </button>
          )}
        </div>
      </form>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 p-5">
          <div>
            <h2 className="font-semibold text-gray-900">
              Daftar Karyawan
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {employees.length} karyawan tercatat
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadEmployees()}
            disabled={loading}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
          >
            Muat Ulang
          </button>
        </div>

        {loading ? (
          <p className="p-6 text-sm text-gray-500">
            Memuat data karyawan...
          </p>
        ) : employees.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">
            Belum ada karyawan. Tambahkan karyawan melalui formulir di atas.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-5 py-4 font-medium">Nama</th>
                  <th className="px-5 py-4 font-medium">Upah Mingguan</th>
                  <th className="px-5 py-4 font-medium">Status</th>
                  <th className="px-5 py-4 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {employees.map((employee) => (
                  <tr key={employee.id}>
                    <td className="px-5 py-4 font-medium text-gray-900">
                      {employee.full_name}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-gray-700">
                      {rupiah(Number(employee.weekly_wage))}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          employee.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {employee.is_active ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => startEdit(employee)}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleActive(employee)}
                          className="font-medium text-gray-600 hover:underline"
                        >
                          {employee.is_active ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
