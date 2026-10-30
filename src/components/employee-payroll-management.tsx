
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";
import {
  Wallet,
  RefreshCw,
  Calculator,
  CheckCircle2,
  Clock,
  CalendarDays,
  AlertCircle,
} from "lucide-react";

type Employee = {
  id: string;
  full_name: string;
  employee_code: string | null;
  weekly_wage: number;
};

type Payroll = {
  id: string;
  employee_id: string;
  week_start: string;
  week_end: string;
  daily_wage_snapshot: number;
  scheduled_days: number;
  absent_days: number;
  gross_salary: number;
  absence_deduction: number;
  debt_deduction: number;
  net_salary: number;
  payment_status: "draft" | "paid";
  paid_at: string | null;
  employees: {
    full_name: string;
    employee_code: string | null;
  } | null;
};

type Debt = {
  employee_id: string;
  remaining_amount: number;
};

type Period = {
  start: string;
  end: string;
};

const FIRST_PERIOD = "2026-11-01";

const rupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

function addDays(date: string, days: number) {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00+07:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function jakartaToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
  }).format(new Date());
}

export default function EmployeePayrollManagement() {
  const [supabase] = useState(() => createClient());

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [selectedStart, setSelectedStart] = useState(FIRST_PERIOD);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [payingId, setPayingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const periods = useMemo(() => {
    const result: Period[] = [];

    for (let i = 0; i < 26; i++) {
      const start = addDays(FIRST_PERIOD, i * 7);
      result.push({
        start,
        end: addDays(start, 6),
      });
    }

    return result;
  }, []);

  const selectedPeriod = periods.find(
    (period) => period.start === selectedStart
  ) ?? periods[0];

  const today = jakartaToday();
  const paymentDate = addDays(selectedPeriod.end, 1);
  const canProcess = today >= paymentDate;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    const [employeeResult, payrollResult, debtResult] = await Promise.all([
      supabase
        .from("employees")
        .select("id, full_name, employee_code, weekly_wage")
        .eq("is_active", true)
        .order("full_name"),

      supabase
        .from("employee_payrolls")
        .select(`
          *,
          employees (
            full_name,
            employee_code
          )
        `)
        .order("week_start", { ascending: false }),

      supabase
        .from("employee_debts")
        .select("employee_id, remaining_amount")
        .eq("status", "unpaid")
        .gt("remaining_amount", 0),
    ]);

    if (employeeResult.error) {
      setError(employeeResult.error.message);
      setEmployees([]);
    } else {
      setEmployees((employeeResult.data || []) as Employee[]);
    }

    if (payrollResult.error) {
      setError((previous) =>
        previous
          ? `${previous} | ${payrollResult.error.message}`
          : payrollResult.error.message
      );
      setPayrolls([]);
    } else {
      setPayrolls((payrollResult.data || []) as unknown as Payroll[]);
    }

    if (debtResult.error) {
      setError((previous) =>
        previous
          ? `${previous} | ${debtResult.error.message}`
          : debtResult.error.message
      );
      setDebts([]);
    } else {
      setDebts((debtResult.data || []) as Debt[]);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const currentPayrolls = payrolls.filter(
    (item) => item.week_start === selectedStart
  );

  const payrollByEmployee = new Map(
    currentPayrolls.map((item) => [item.employee_id, item])
  );

  const totalDebtByEmployee = useMemo(() => {
    const result: Record<string, number> = {};

    for (const debt of debts) {
      result[debt.employee_id] =
        (result[debt.employee_id] || 0) +
        Number(debt.remaining_amount || 0);
    }

    return result;
  }, [debts]);

  const paidCount = currentPayrolls.filter(
    (item) => item.payment_status === "paid"
  ).length;

  const draftCount = currentPayrolls.filter(
    (item) => item.payment_status === "draft"
  ).length;

  async function generatePayroll() {
    if (!canProcess) {
      setError("Periode belum selesai. Penggajian belum dapat dibuat.");
      return;
    }

    if (!confirm(
      `Hitung gaji seluruh pegawai untuk periode ${formatDate(
        selectedPeriod.start
      )} sampai ${formatDate(selectedPeriod.end)}?`
    )) {
      return;
    }

    setProcessing(true);
    setError("");
    setSuccess("");

    const { error } = await supabase.rpc("generate_employee_payrolls", {
      p_week_start: selectedStart,
    });

    if (error) {
      setError(`Gagal menghitung gaji: ${error.message}`);
    } else {
      setSuccess("Penggajian berhasil dihitung.");
      await loadData();
    }

    setProcessing(false);
  }

  async function payEmployee(payroll: Payroll) {
    const employeeName =
      payroll.employees?.full_name || "pegawai ini";

    const remainingDebt =
      totalDebtByEmployee[payroll.employee_id] || 0;

    const estimatedDeduction =
      Math.min(
        remainingDebt,
        Math.max(0, payroll.gross_salary - payroll.absence_deduction)
      );

    const estimatedNet =
      payroll.gross_salary -
      payroll.absence_deduction -
      estimatedDeduction;

    const confirmed = confirm(
      `Konfirmasi pembayaran gaji ${employeeName}?\n\n` +
      `Gaji kotor: ${rupiah(payroll.gross_salary)}\n` +
      `Potongan absen: ${rupiah(payroll.absence_deduction)}\n` +
      `Perkiraan potongan utang: ${rupiah(estimatedDeduction)}\n` +
      `Perkiraan diterima: ${rupiah(estimatedNet)}\n\n` +
      `Pembayaran yang sudah dikonfirmasi tidak dapat dibatalkan.`
    );

    if (!confirmed) return;

    setPayingId(payroll.id);
    setError("");
    setSuccess("");

    const { error } = await supabase.rpc("pay_employee_payroll", {
      p_payroll_id: payroll.id,
    });

    if (error) {
      setError(`Gagal membayar gaji: ${error.message}`);
    } else {
      setSuccess(`Gaji ${employeeName} berhasil ditandai sudah dibayar.`);
      await loadData();
    }

    setPayingId("");
  }

  const formatPaidAt = (date: string | null) => {
    if (!date) return "-";

    return new Date(date).toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-green-700">
            <Wallet size={18} />
            PENGELOLAAN GAJI
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Gaji Mingguan
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Hitung dan bayarkan gaji pegawai satu per satu.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadData()}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={16} />
          Muat ulang
        </button>
      </div>

      {error && (
        <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={18} className="shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          <CheckCircle2 size={18} className="shrink-0" />
          {success}
        </div>
      )}

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <CalendarDays size={19} className="text-green-700" />
          <h2 className="font-semibold text-gray-900">
            Periode Penggajian
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Pilih periode
            </label>
            <select
              value={selectedStart}
              onChange={(event) => setSelectedStart(event.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-green-600"
            >
              {periods.map((period, index) => (
                <option key={period.start} value={period.start}>
                  Periode {index + 1}: {formatDate(period.start)} –{" "}
                  {formatDate(period.end)}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-xl bg-green-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
              Tanggal pembayaran
            </p>
            <p className="mt-1 text-lg font-bold text-green-900">
              {formatDate(paymentDate)}
            </p>
            <p className="mt-1 text-xs text-green-700">
              Sekaligus hari pertama periode berikutnya.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <div className="text-sm text-gray-600">
            Status periode:{" "}
            {canProcess ? (
              <span className="font-semibold text-green-700">
                Siap dihitung / dibayar
              </span>
            ) : (
              <span className="font-semibold text-orange-600">
                Belum memasuki tanggal pembayaran
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => void generatePayroll()}
            disabled={
              loading ||
              processing ||
              !canProcess ||
              employees.length === 0
            }
            className="flex items-center justify-center gap-2 rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Calculator size={17} />
            {processing ? "Menghitung..." : "Hitung Gaji"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Total pegawai aktif</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {employees.length}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Menunggu pembayaran</p>
          <p className="mt-1 text-2xl font-bold text-orange-600">
            {draftCount}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Sudah dibayar</p>
          <p className="mt-1 text-2xl font-bold text-green-700">
            {paidCount}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b p-5">
          <h2 className="font-semibold text-gray-900">
            Rincian Gaji Pegawai
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Periode {formatDate(selectedPeriod.start)} sampai{" "}
            {formatDate(selectedPeriod.end)}
          </p>
        </div>

        {loading ? (
          <div className="py-14 text-center text-sm text-gray-500">
            Memuat data penggajian...
          </div>
        ) : employees.length === 0 ? (
          <div className="py-14 text-center text-sm text-gray-500">
            Belum ada pegawai aktif.
          </div>
        ) : (
          <div className="divide-y">
            {employees.map((employee) => {
              const payroll = payrollByEmployee.get(employee.id);
              const debt = totalDebtByEmployee[employee.id] || 0;

              const absentDays = payroll?.absent_days ?? 0;
              const absenceDeduction =
                payroll?.absence_deduction ??
                Math.round(
                  Number(employee.weekly_wage) * absentDays / 7 * 100
                ) / 100;

              const grossSalary =
                payroll?.gross_salary ?? Number(employee.weekly_wage);

              const salaryAfterAbsence =
                Math.max(0, grossSalary - absenceDeduction);

              const debtDeduction =
                payroll?.payment_status === "paid"
                  ? payroll.debt_deduction
                  : Math.min(debt, salaryAfterAbsence);

              const netSalary =
                payroll?.payment_status === "paid"
                  ? payroll.net_salary
                  : salaryAfterAbsence - debtDeduction;

              return (
                <div key={employee.id} className="p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-gray-900">
                        {employee.full_name}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {employee.employee_code || "Tanpa kode pegawai"}
                      </p>
                    </div>

                    {payroll ? (
                      payroll.payment_status === "paid" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700">
                          <CheckCircle2 size={14} />
                          Sudah dibayar
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1.5 text-xs font-semibold text-orange-700">
                          <Clock size={14} />
                          Menunggu pembayaran
                        </span>
                      )
                    ) : (
                      <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600">
                        Belum dihitung
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <Detail
                      label="Gaji mingguan"
                      value={rupiah(grossSalary)}
                    />
                    <Detail
                      label="Tidak hadir"
                      value={`${absentDays} dari 7 hari`}
                    />
                    <Detail
                      label="Potongan absen"
                      value={rupiah(absenceDeduction)}
                    />
                    <Detail
                      label="Sisa utang"
                      value={rupiah(
                        payroll?.payment_status === "paid"
                          ? Math.max(0, debt)
                          : debt
                      )}
                    />
                    <Detail
                      label="Potongan utang"
                      value={rupiah(debtDeduction)}
                    />
                    <Detail
                      label="Gaji bersih"
                      value={rupiah(netSalary)}
                      highlight
                    />
                  </div>

                  {payroll?.payment_status === "paid" ? (
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-green-700">
                      <CheckCircle2 size={14} />
                      Dibayar pada {formatPaidAt(payroll.paid_at)}
                    </div>
                  ) : payroll ? (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-gray-500">
                        Nominal utang dan gaji bersih di atas merupakan
                        perkiraan sampai pembayaran dikonfirmasi.
                      </p>
                      <button
                        type="button"
                        onClick={() => void payEmployee(payroll)}
                        disabled={!canProcess || payingId !== ""}
                        className="rounded-xl bg-green-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50"
                      >
                        {payingId === payroll.id
                          ? "Memproses..."
                          : "Bayar Pegawai"}
                      </button>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-gray-500">
                      Pegawai ini akan muncul sebagai draft setelah tombol
                      Hitung Gaji digunakan.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <strong>Informasi:</strong> Potongan utang dihitung kembali oleh
        database saat admin menekan tombol Bayar Pegawai. Utang tertua
        dipotong lebih dahulu. Riwayat gaji yang sudah dibayar tidak
        dapat diubah.
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b p-5">
          <h2 className="font-semibold text-gray-900">
            Riwayat Penggajian
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Riwayat periode yang pernah dibuat.
          </p>
        </div>

        {payrolls.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">
            Belum ada riwayat penggajian.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3">Pegawai</th>
                  <th className="px-4 py-3">Periode</th>
                  <th className="px-4 py-3">Gaji bersih</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Tanggal bayar</th>
                </tr>
              </thead>
              <tbody>
                {payrolls.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {item.employees?.full_name || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatDate(item.week_start)} –{" "}
                      {formatDate(item.week_end)}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {rupiah(item.net_salary)}
                    </td>
                    <td className="px-4 py-3">
                      {item.payment_status === "paid" ? (
                        <span className="font-semibold text-green-700">
                          Dibayar
                        </span>
                      ) : (
                        <span className="font-semibold text-orange-600">
                          Draft
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatPaidAt(item.paid_at)}
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

function Detail({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl bg-gray-50 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p
        className={`mt-1 text-sm font-bold ${
          highlight ? "text-green-700" : "text-gray-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
