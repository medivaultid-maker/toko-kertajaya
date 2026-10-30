
"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { CalendarCheck, Clock, RefreshCw, Users } from "lucide-react";

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
  const supabase = createClient();

  const [records, setRecords] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterDate, setFilterDate] = useState("");

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    setError("");

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
      setError(error.message);
      setRecords([]);
    } else {
      setRecords((data || []) as unknown as Attendance[]);
    }

    setLoading(false);
  }, [filterDate, supabase]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

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

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
  }).format(new Date());

  const todayCount = records.filter(
    (record) => record.attendance_date === today
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Kehadiran Pegawai
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Pantau dan lihat riwayat kehadiran seluruh pegawai.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
              <Users size={22} />
            </div>
            <div>
              <p className="text-sm text-gray-500">
                Total catatan yang ditampilkan
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {records.length}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-green-50 p-3 text-green-600">
              <CalendarCheck size={22} />
            </div>
            <div>
              <p className="text-sm text-gray-500">
                Hadir hari ini
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {filterDate ? "-" : todayCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gray-900">
              Riwayat Kehadiran
            </h2>
            <p className="text-sm text-gray-500">
              Data diurutkan dari catatan terbaru.
            </p>
          </div>

          <button
            type="button"
            onClick={loadAttendance}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={16} />
            Muat ulang
          </button>
        </div>

        <div className="mb-5 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Filter tanggal
            </label>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="rounded-xl border px-3 py-2 text-sm"
            />
          </div>

          {filterDate && (
            <button
              type="button"
              onClick={() => setFilterDate("")}
              className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
            >
              Hapus filter
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            Gagal memuat kehadiran: {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-500">
            Memuat data kehadiran...
          </div>
        ) : records.length === 0 ? (
          <div className="rounded-xl bg-gray-50 py-12 text-center">
            <CalendarCheck
              size={32}
              className="mx-auto mb-3 text-gray-400"
            />
            <p className="font-medium text-gray-700">
              Belum ada catatan kehadiran
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Catatan kehadiran pegawai akan muncul di sini.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-gray-600">
                  <th className="px-4 py-3 font-semibold">No.</th>
                  <th className="px-4 py-3 font-semibold">Kode</th>
                  <th className="px-4 py-3 font-semibold">Nama Pegawai</th>
                  <th className="px-4 py-3 font-semibold">Tanggal</th>
                  <th className="px-4 py-3 font-semibold">Jam Hadir</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record, index) => (
                  <tr
                    key={record.id}
                    className="border-b last:border-0 hover:bg-gray-50"
                  >
                    <td className="px-4 py-4">{index + 1}</td>
                    <td className="px-4 py-4 font-medium text-gray-700">
                      {record.employees?.employee_code || "-"}
                    </td>
                    <td className="px-4 py-4 font-medium text-gray-900">
                      {record.employees?.full_name || "Data pegawai tidak ditemukan"}
                    </td>
                    <td className="px-4 py-4">
                      {formatDate(record.attendance_date)}
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1">
                        <Clock size={14} className="text-gray-400" />
                        {formatTime(record.check_in)} WIB
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                        Hadir
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
