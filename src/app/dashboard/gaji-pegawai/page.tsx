
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase";
import {
  Wallet,
  RefreshCw,
  Calculator,
  CheckCircle2,
  Clock,
  CalendarDays,
  AlertCircle,
  Users,
  Banknote,
  History,
  Search,
  ChevronDown,
  Info,
  CreditCard,
  Receipt,
  TrendingUp,
  CalendarCheck,
  CircleDollarSign,
  ArrowDownRight,
  UserRound,
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

function formatPaidAt(date: string | null) {
  if (!date) return "-";

  return new Date(date).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    timeStyle: "short",
  });
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

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

const [selectedHistoryStart, setSelectedHistoryStart] = useState<string | null>(null);
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

  const selectedPeriod =
    periods.find((period) => period.start === selectedStart) ?? periods[0];

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

  const totalEstimatedSalary = employees.reduce((total, employee) => {
    const payroll = payrollByEmployee.get(employee.id);

    if (payroll?.payment_status === "paid") {
      return total + Number(payroll.net_salary);
    }

    const gross = Number(payroll?.gross_salary ?? employee.weekly_wage);
    const absence = Number(payroll?.absence_deduction ?? 0);
    const afterAbsence = Math.max(0, gross - absence);
    const debt = totalDebtByEmployee[employee.id] || 0;

    return total + afterAbsence - Math.min(debt, afterAbsence);
  }, 0);

  const totalGrossSalary = employees.reduce((total, employee) => {
    const payroll = payrollByEmployee.get(employee.id);
    return total + Number(payroll?.gross_salary ?? employee.weekly_wage);
  }, 0);

  const totalOutstandingDebt = employees.reduce((total, employee) => {
    return total + (totalDebtByEmployee[employee.id] || 0);
  }, 0);

 const filteredEmployees = employees.filter((employee) => {
  const payroll = payrollByEmployee.get(employee.id);

  const matchesSearch =
    employee.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (employee.employee_code || "")
      .toLowerCase()
      .includes(search.toLowerCase());

  const matchesStatus =
    statusFilter === "all" ||
    (statusFilter === "paid" && payroll?.payment_status === "paid") ||
    (statusFilter === "draft" && payroll?.payment_status === "draft") ||
    (statusFilter === "not-calculated" && !payroll);

  return matchesSearch && matchesStatus;
});

  // RIWAYAT PENGGAJIAN PER PERIODE
const historyPeriods = useMemo(() => {
  const grouped = new Map<string, Payroll[]>();

  for (const payroll of payrolls) {
    const existing = grouped.get(payroll.week_start) || [];
    existing.push(payroll);
    grouped.set(payroll.week_start, existing);
  }

  return Array.from(grouped.entries())
    .map(([start, items]) => {
      const period = periods.find((item) => item.start === start);

      const paid = items.filter(
        (item) => item.payment_status === "paid"
      ).length;

      const draft = items.filter(
        (item) => item.payment_status === "draft"
      ).length;

      return {
        start,
        end: period?.end || items[0].week_end,
        items,
        paid,
        draft,
        totalGross: items.reduce(
          (sum, item) => sum + Number(item.gross_salary || 0),
          0
        ),
        totalDeduction: items.reduce(
          (sum, item) =>
            sum +
            Number(item.absence_deduction || 0) +
            Number(item.debt_deduction || 0),
          0
        ),
        totalNet: items.reduce(
          (sum, item) => sum + Number(item.net_salary || 0),
          0
        ),
      };
    })
    .sort((a, b) => b.start.localeCompare(a.start));
}, [payrolls, periods]);

const selectedHistoryPeriod = historyPeriods.find(
  (period) => period.start === selectedHistoryStart
);

  async function generatePayroll() {
    if (!canProcess) {
      setError("Periode belum selesai. Penggajian belum dapat dibuat.");
      return;
    }

    if (
      !confirm(
        `Hitung gaji seluruh karyawan untuk periode ${formatDate(
          selectedPeriod.start
        )} sampai ${formatDate(selectedPeriod.end)}?`
      )
    ) {
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
    const employeeName = payroll.employees?.full_name || "Karyawan ini";

    const remainingDebt =
      totalDebtByEmployee[payroll.employee_id] || 0;

    const salaryAfterAbsence = Math.max(
      0,
      payroll.gross_salary - payroll.absence_deduction
    );

    const estimatedDeduction = Math.min(
      remainingDebt,
      salaryAfterAbsence
    );

    const estimatedNet = salaryAfterAbsence - estimatedDeduction;

    const confirmed = confirm(
      `Konfirmasi pembayaran gaji ${employeeName}?\n\n` +
        `Gaji kotor: ${rupiah(payroll.gross_salary)}\n` +
        `Potongan absen: ${rupiah(payroll.absence_deduction)}\n` +
        `Perkiraan potongan piutang: ${rupiah(estimatedDeduction)}\n` +
        `Perkiraan diterima: ${rupiah(estimatedNet)}\n\n` +
        `Piutang baru benar-benar dikurangi setelah pembayaran berhasil.\n` +
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
      setSuccess(`Gaji ${employeeName} berhasil dibayar.`);
      await loadData();
    }

    setPayingId("");
  }

  return (
    <div className="payroll-page">
      
       <style jsx>{`

        .payroll-page {
          --green: #174b36;
          --green-dark: #103a2a;
          --green-soft: #edf4ef;
          --gold: #b99a62;
          --ivory: #f8f8f4;
          --ink: #26352c;
          --muted: #849087;
          --line: #e8ece6;

          width: 100%;
          min-height: 100%;
          padding: 28px;
          padding-bottom: 36px;
          border-radius: 18px;
          background: var(--ivory);
          color: var(--ink);
          font-family: var(--font-dm-sans), sans-serif;
        }

        .payroll-page * {
          box-sizing: border-box;
        }

        /* HEADER */

        .page-header {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          min-height: 150px;
          margin-bottom: 22px;
          padding: 30px 27px;
          overflow: hidden;
          border: 1px solid #e5e9e1;
          border-radius: 20px;
          background:
            radial-gradient(circle at 94% 10%, rgba(185,154,98,.13), transparent 24%),
            linear-gradient(120deg, #ffffff 0%, #f1f6f0 100%);
          box-shadow: 0 5px 18px rgba(31,57,41,.035);
        }

        .page-header > div {
          position: relative;
          z-index: 1;
          min-width: 0;
        }

        .eyebrow {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
          color: var(--gold);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 2.2px;
        }

        .eyebrow-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--gold);
        }

        .page-title {
          margin: 0;
          color: var(--green);
          font-family: var(--font-manrope), sans-serif;
          font-size: 32px;
          font-weight: 800;
          letter-spacing: -.045em;
          line-height: 1.2;
          text-align: left;
        }

        .page-description {
          margin: 9px 0 0;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.7;
          text-align: left;
        }

        .gold-line {
          width: 43px;
          height: 3px;
          margin-top: 16px;
          border-radius: 20px;
          background: var(--gold);
        }

        .refresh-button {
          position: relative;
          z-index: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 42px;
          flex-shrink: 0;
          padding: 0 15px;
          border: 1px solid var(--line);
          border-radius: 10px;
          background: white;
          color: #526157;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          transition: .2s ease;
        }

        .refresh-button:hover:not(:disabled) {
          border-color: #cbd9ce;
          background: var(--green-soft);
          color: var(--green);
        }

        .refresh-button:disabled {
          cursor: not-allowed;
          opacity: .5;
        }

        /* NOTIFICATION */

        .notice {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          margin-bottom: 17px;
          padding: 14px 16px;
          border: 1px solid;
          border-radius: 12px;
          font-size: 12px;
          line-height: 1.6;
        }

        .notice.error {
          border-color: #f1cccc;
          background: #fff7f7;
          color: #a43e3e;
        }

        .notice.success {
          border-color: #d6e7d9;
          background: #edf4ef;
          color: var(--green);
        }

        .notice svg {
          flex-shrink: 0;
          margin-top: 1px;
        }

        /* FINANCIAL OVERVIEW */

        .overview-card {
          position: relative;
          display: grid;
          grid-template-columns: 1.3fr 1fr;
          gap: 24px;
          overflow: hidden;
          margin-bottom: 18px;
          padding: 27px;
          border: 1px solid #214e39;
          border-radius: 19px;
          background: linear-gradient(120deg, #174b36 0%, #103a2a 100%);
          color: white;
          box-shadow: 0 8px 22px rgba(16,58,42,.11);
        }

        .overview-card::before {
          position: absolute;
          top: -100px;
          right: 5%;
          width: 280px;
          height: 280px;
          border: 1px solid rgba(255,255,255,.09);
          border-radius: 50%;
          content: "";
          pointer-events: none;
        }

        .overview-card::after {
          position: absolute;
          right: 12%;
          bottom: -150px;
          width: 300px;
          height: 300px;
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 50%;
          content: "";
          pointer-events: none;
        }

        .overview-main,
        .overview-side {
          position: relative;
          z-index: 1;
          min-width: 0;
        }

        .overview-label {
          display: flex;
          align-items: center;
          gap: 8px;
          color: rgba(255,255,255,.7);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .12em;
        }

        .overview-amount {
          margin-top: 13px;
          color: white;
          font-family: var(--font-manrope), sans-serif;
          font-size: clamp(25px, 3vw, 36px);
          font-weight: 800;
          letter-spacing: -.05em;
          line-height: 1.25;
          overflow-wrap: anywhere;
        }

        .overview-caption {
          max-width: 470px;
          margin: 10px 0 0;
          color: rgba(255,255,255,.67);
          font-size: 11px;
          line-height: 1.7;
        }

        .overview-side {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          align-content: center;
          gap: 12px;
        }

        .overview-mini {
          min-width: 0;
          padding: 16px;
          border: 1px solid rgba(255,255,255,.14);
          border-radius: 13px;
          background: rgba(255,255,255,.075);
          backdrop-filter: blur(5px);
        }

        .overview-mini-label {
          color: rgba(255,255,255,.7);
          font-size: 10px;
          font-weight: 700;
        }

        .overview-mini-value {
          margin-top: 9px;
          color: white;
          font-size: 17px;
          font-weight: 800;
          letter-spacing: -.03em;
          overflow-wrap: anywhere;
        }

        .overview-mini-note {
          margin-top: 5px;
          color: rgba(255,255,255,.55);
          font-size: 9px;
        }

        /* STATISTICS */

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 22px;
        }

        .stat-card {
          min-width: 0;
          padding: 21px;
          border: 1px solid var(--line);
          border-radius: 16px;
          background: white;
          box-shadow: 0 3px 12px rgba(31,57,41,.025);
          transition: .22s ease;
        }

        .stat-card:hover {
          transform: translateY(-3px);
          border-color: #d3dfd4;
          box-shadow: 0 9px 20px rgba(31,57,41,.06);
        }

        .stat-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .stat-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 43px;
          height: 43px;
          flex-shrink: 0;
          border-radius: 12px;
        }

        .stat-icon.green {
          background: #edf4ef;
          color: #174b36;
        }

        .stat-icon.gold {
          background: #f8f2e8;
          color: #a7803f;
        }

        .stat-icon.gray {
          background: #f1f4f0;
          color: #657368;
        }

        .stat-label {
          margin: 0;
          color: #849087;
          font-size: 10px;
          font-weight: 700;
        }

        .stat-value {
          margin: 15px 0 0;
          color: var(--ink);
          font-family: var(--font-manrope), sans-serif;
          font-size: 25px;
          font-weight: 800;
          letter-spacing: -.045em;
          line-height: 1.2;
          overflow-wrap: anywhere;
        }

        .stat-value.compact {
          font-size: 17px;
        }

        .stat-note {
          margin: 6px 0 0;
          color: #9aa49b;
          font-size: 9px;
        }

        /* PANELS */

        .panel {
          margin-bottom: 21px;
          overflow: hidden;
          border: 1px solid var(--line);
          border-radius: 18px;
          background: white;
          box-shadow: 0 3px 14px rgba(25,52,35,.03);
        }

        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 21px 25px;
          border-bottom: 1px solid #edf0eb;
        }

        .panel-heading {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 13px;
          min-width: 0;
          text-align: left;
        }

        .panel-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          flex-shrink: 0;
          border-radius: 12px;
          background: var(--green-soft);
          color: var(--green);
        }

        .panel-heading > div:last-child {
          flex: 1;
          min-width: 0;
          text-align: left;
        }

        .panel-title {
          margin: 0;
          color: var(--green);
          font-family: var(--font-manrope), sans-serif;
          font-size: 16px;
          font-weight: 800;
          letter-spacing: -.025em;
          text-align: left;
        }

        .panel-subtitle {
          margin: 5px 0 0;
          color: var(--muted);
          font-size: 10px;
          line-height: 1.6;
          text-align: left;
        }

        /* PERIOD */

        .period-content {
          display: grid;
          grid-template-columns: 1.25fr .75fr;
          gap: 20px;
          padding: 23px 25px;
        }

        .field-label {
          display: block;
          margin-bottom: 9px;
          color: #526157;
          font-size: 10px;
          font-weight: 800;
        }

        .select-wrap {
          position: relative;
        }

        .field {
          width: 100%;
          min-height: 46px;
          padding: 0 40px 0 14px;
          appearance: none;
          border: 1px solid #e2e8e1;
          border-radius: 10px;
          outline: none;
          background: white;
          color: var(--ink);
          font-family: var(--font-dm-sans), sans-serif;
          font-size: 11px;
          font-weight: 600;
          transition: .2s ease;
        }

        .field:focus {
          border-color: var(--green);
          box-shadow: 0 0 0 3px rgba(23,75,54,.075);
        }

        .field-icon {
          position: absolute;
          top: 50%;
          right: 13px;
          transform: translateY(-50%);
          color: #849087;
          pointer-events: none;
        }

        .payment-date-box {
          display: flex;
          align-items: center;
          gap: 14px;
          min-height: 78px;
          padding: 15px 17px;
          border: 1px solid #e3eae2;
          border-radius: 12px;
          background: linear-gradient(120deg, #f7faf6, #fbfcf9);
        }

        .payment-date-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 43px;
          height: 43px;
          flex-shrink: 0;
          border-radius: 12px;
          background: #edf4ef;
          color: var(--green);
        }

        .payment-date-label {
          color: #849087;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .payment-date-value {
          margin-top: 5px;
          color: var(--green);
          font-family: var(--font-manrope), sans-serif;
          font-size: 15px;
          font-weight: 800;
        }

        .payment-date-note {
          margin-top: 4px;
          color: #849087;
          font-size: 9px;
        }

        .period-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 13px;
          padding: 16px 25px;
          border-top: 1px solid #edf0eb;
          background: #fbfcfa;
        }

        .period-status {
          display: flex;
          align-items: center;
          gap: 9px;
          color: #526157;
          font-size: 10px;
          font-weight: 700;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          flex-shrink: 0;
          border-radius: 50%;
          background: #c99a45;
        }

        .status-dot.ready {
          background: #39845a;
          box-shadow: 0 0 0 3px rgba(57,132,90,.1);
        }

        .primary-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 43px;
          padding: 0 17px;
          border: 1px solid var(--green);
          border-radius: 10px;
          background: linear-gradient(135deg, #205a40, #174b36);
          color: white;
          font-size: 10px;
          font-weight: 800;
          box-shadow: 0 4px 10px rgba(23,75,54,.13);
          transition: .2s ease;
          cursor: pointer;
        }

        .primary-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          background: var(--green-dark);
          box-shadow: 0 7px 16px rgba(23,75,54,.2);
        }

        .primary-btn:disabled {
          cursor: not-allowed;
          opacity: .42;
          box-shadow: none;
        }

        /* EMPLOYEE TOOLBAR */

        .employee-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 13px;
          padding: 16px 24px;
          border-bottom: 1px solid #edf0eb;
          background: #fbfcfa;
        }

        .toolbar-search {
          position: relative;
          flex: 1;
          min-width: 190px;
        }

        .search-icon {
          position: absolute;
          top: 50%;
          left: 14px;
          transform: translateY(-50%);
          color: #9aa49b;
          pointer-events: none;
        }

        .search-field {
          width: 100%;
          min-height: 44px;
          padding: 0 14px 0 40px;
          border: 1px solid #e2e8e1;
          border-radius: 10px;
          outline: none;
          background: white;
          color: var(--ink);
          font-family: var(--font-dm-sans), sans-serif;
          font-size: 11px;
          transition: .2s ease;
        }

        .search-field::placeholder {
          color: #a2aba3;
        }

        .search-field:focus {
          border-color: var(--green);
          box-shadow: 0 0 0 3px rgba(23,75,54,.06);
        }

        .filter-wrap {
          position: relative;
          width: 205px;
        }

        .filter-field {
          width: 100%;
          min-height: 44px;
          padding: 0 36px 0 13px;
          appearance: none;
          border: 1px solid #e2e8e1;
          border-radius: 10px;
          outline: none;
          background: white;
          color: #526157;
          font-family: var(--font-dm-sans), sans-serif;
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
        }

        .filter-field:focus {
          border-color: var(--green);
        }

        .employee-count {
          padding: 8px 12px;
          border: 1px solid #e0eae1;
          border-radius: 20px;
          background: #edf4ef;
          color: var(--green);
          font-size: 10px;
          font-weight: 800;
          white-space: nowrap;
        }

        /* EMPLOYEE CARDS */

        .employee-list {
          display: grid;
          gap: 13px;
          padding: 20px;
        }

        .employee-card {
          overflow: hidden;
          border: 1px solid #e7ece5;
          border-radius: 15px;
          background: white;
          transition: .22s ease;
        }

        .employee-card:hover {
          border-color: #cddbcf;
          box-shadow: 0 7px 20px rgba(31,57,41,.045);
        }

        .employee-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          padding: 17px 19px;
        }

        .employee-identity {
          display: flex;
          align-items: center;
          gap: 13px;
          min-width: 0;
        }

        .employee-avatar {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 45px;
          height: 45px;
          flex-shrink: 0;
          border: 1px solid #e1ebe2;
          border-radius: 13px;
          background: linear-gradient(145deg, #f2f7f2, #e9f1e9);
          color: var(--green);
        }

        .employee-name {
          color: var(--ink);
          font-family: var(--font-manrope), sans-serif;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: -.02em;
          overflow-wrap: anywhere;
        }

        .employee-code {
          margin-top: 5px;
          color: #929d94;
          font-size: 10px;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          padding: 7px 11px;
          border-radius: 20px;
          font-size: 9px;
          font-weight: 800;
          white-space: nowrap;
        }

        .status-badge.green {
          background: #edf4ef;
          color: #174b36;
        }

        .status-badge.gold {
          background: #f8f2e8;
          color: #9a753e;
        }

        .status-badge.gray {
          background: #f1f3f0;
          color: #77847a;
        }

        .employee-details {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 9px;
          padding: 0 19px 18px;
        }

        .detail-box {
          min-width: 0;
          padding: 12px 11px;
          border: 1px solid #edf0eb;
          border-radius: 10px;
          background: #fafbf9;
        }

        .detail-label {
          margin: 0;
          color: #879188;
          font-size: 9px;
          font-weight: 700;
          line-height: 1.5;
        }

        .detail-value {
          margin: 8px 0 0;
          color: var(--ink);
          font-size: 11px;
          font-weight: 800;
          line-height: 1.5;
          overflow-wrap: anywhere;
          font-variant-numeric: tabular-nums;
        }

        .detail-value.negative {
          color: #a66e42;
        }

        .detail-value.highlight {
          color: var(--green);
          font-size: 12px;
        }

        .employee-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 13px;
          padding: 13px 19px;
          border-top: 1px solid #edf0eb;
          background: #fcfdfb;
        }

        .employee-note {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          max-width: 470px;
          color: #849087;
          font-size: 10px;
          line-height: 1.7;
        }

        .employee-note svg {
          flex-shrink: 0;
          margin-top: 2px;
        }

        .paid-info {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 13px 19px;
          border-top: 1px solid #e1ebe2;
          background: #f3f8f3;
          color: var(--green);
          font-size: 10px;
          font-weight: 700;
        }

        .empty-state {
          padding: 48px 20px;
          color: #849087;
          text-align: center;
          font-size: 11px;
          line-height: 1.7;
        }

        .empty-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 47px;
          height: 47px;
          margin: 0 auto 13px;
          border-radius: 13px;
          background: #f1f4f0;
          color: #849087;
        }

        /* INFORMATION */

        .information-box {
          display: flex;
          align-items: flex-start;
          gap: 13px;
          margin-bottom: 21px;
          padding: 17px 19px;
          border: 1px solid #e3eae2;
          border-radius: 13px;
          background: linear-gradient(120deg, #f7faf6, #fbfcf9);
        }

        .information-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          flex-shrink: 0;
          border-radius: 11px;
          background: #edf4ef;
          color: var(--green);
        }

        .information-title {
          color: var(--green);
          font-size: 11px;
          font-weight: 800;
        }

        .information-list {
          display: grid;
          gap: 6px;
          margin-top: 9px;
          color: #66746a;
          font-size: 10px;
          line-height: 1.7;
        }

        /* HISTORY TABLE */

        .history-wrap {
          overflow-x: auto;
        }

        .history-table {
          width: 100%;
          min-width: 690px;
          border-collapse: separate;
          border-spacing: 0;
          text-align: left;
        }

        .history-table th {
          padding: 14px 17px;
          background: #f5f7f3;
          color: #78847a;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .08em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .history-table td {
          padding: 15px 17px;
          border-top: 1px solid #edf0eb;
          color: #526157;
          font-size: 10px;
          vertical-align: middle;
        }

        .history-table tbody tr {
          transition: background .18s ease;
        }

        .history-table tbody tr:hover {
          background: #fafcf9;
        }

        .history-name {
          color: var(--ink);
          font-size: 11px;
          font-weight: 800;
        }

        .history-code {
          margin-top: 5px;
          color: #929d94;
          font-size: 9px;
        }

        .history-amount {
          color: var(--green) !important;
          font-weight: 800 !important;
          white-space: nowrap;
          font-variant-numeric: tabular-nums;
        }

        .history-date {
          white-space: nowrap;
        }

        .history-deduction {
          color: #a66e42 !important;
          white-space: nowrap;
        }

        .history-empty {
          display: grid;
          justify-items: center;
          gap: 9px;
          padding: 45px 20px;
          color: #849087;
          text-align: center;
          font-size: 10px;
        }

        .history-empty strong {
          color: #526157;
          font-size: 12px;
        }

        .history-empty-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 47px;
          height: 47px;
          margin-bottom: 3px;
          border-radius: 13px;
          background: #f1f4f0;
          color: #849087;
        }

        .history-loading-icon {
          animation: history-spin 1s linear infinite;
        }

        @keyframes history-spin {
          to {
            transform: rotate(360deg);
          }
        }

        /* HISTORY PERIOD LIST */

        .history-period-list {
          display: grid;
          gap: 12px;
          padding: 20px;
        }

        .history-list-intro {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 5px;
        }

        .history-list-intro strong {
          color: var(--ink);
          font-family: var(--font-manrope), sans-serif;
          font-size: 13px;
          font-weight: 800;
        }

        .history-list-intro p {
          margin: 5px 0 0;
          color: #849087;
          font-size: 10px;
          line-height: 1.6;
        }

        .history-list-intro > span {
          padding: 7px 11px;
          border-radius: 20px;
          background: #edf4ef;
          color: var(--green);
          font-size: 9px;
          font-weight: 800;
          white-space: nowrap;
        }

        .history-period-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          width: 100%;
          padding: 17px;
          border: 1px solid var(--line);
          border-radius: 14px;
          background: white;
          color: var(--ink);
          text-align: left;
          cursor: pointer;
          transition: .2s ease;
        }

        .history-period-card:hover {
          transform: translateY(-2px);
          border-color: #b9cfbd;
          background: #fbfdfb;
          box-shadow: 0 7px 18px rgba(23,75,54,.06);
        }

        .history-period-left {
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 0;
        }

        .history-period-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 45px;
          height: 45px;
          flex-shrink: 0;
          border-radius: 12px;
          background: #edf4ef;
          color: var(--green);
        }

        .history-period-info {
          min-width: 0;
        }

        .history-period-number {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 6px;
          color: #929d94;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: .09em;
        }

        .history-period-number span {
          color: #a7803f;
        }

        .history-period-info > strong {
          display: block;
          color: var(--ink);
          font-family: var(--font-manrope), sans-serif;
          font-size: 12px;
          font-weight: 800;
        }

        .history-period-meta {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 11px;
          margin-top: 9px;
        }

        .history-period-meta span {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: #849087;
          font-size: 9px;
          font-weight: 600;
        }

        .history-period-meta .history-meta-paid {
          color: #39845a;
        }

        .history-period-meta .history-meta-draft {
          color: #a7803f;
        }

        .history-period-right {
          min-width: 145px;
          text-align: right;
        }

        .history-period-total-label {
          color: #929d94;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: .07em;
        }

        .history-period-right > strong {
          display: block;
          margin-top: 7px;
          color: var(--green);
          font-family: var(--font-manrope), sans-serif;
          font-size: 14px;
          font-weight: 800;
        }

        .history-period-status {
          display: inline-flex;
          margin-top: 8px;
          padding: 6px 9px;
          border-radius: 20px;
          font-size: 8px;
          font-weight: 800;
        }

        .history-period-status.completed {
          background: #edf4ef;
          color: #39845a;
        }

        .history-period-status.pending {
          background: #f8f2e8;
          color: #9a753e;
        }

        .history-period-arrow {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 31px;
          height: 31px;
          flex-shrink: 0;
          border-radius: 9px;
          background: #f4f6f2;
          color: #718075;
          transform: rotate(-90deg);
        }

        .history-back-button {
          min-height: 37px;
          flex-shrink: 0;
          padding: 0 12px;
          border: 1px solid #dfe8df;
          border-radius: 9px;
          background: #f7faf6;
          color: var(--green);
          font-size: 9px;
          font-weight: 800;
          cursor: pointer;
          transition: .2s ease;
        }

        .history-back-button:hover {
          border-color: #b9cfbd;
          background: #edf4ef;
        }

        /* HISTORY DETAIL */

        .history-detail-summary {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 11px;
          padding: 19px 21px;
          border-bottom: 1px solid #edf0eb;
          background: #fbfcfa;
        }

        .history-detail-item {
          display: grid;
          gap: 8px;
          min-width: 0;
          padding: 14px;
          border: 1px solid #e8ece6;
          border-radius: 11px;
          background: white;
        }

        .history-detail-item span {
          color: #849087;
          font-size: 9px;
          font-weight: 700;
        }

        .history-detail-item strong {
          color: var(--ink);
          font-size: 12px;
          font-weight: 800;
          overflow-wrap: anywhere;
        }

        .history-detail-item .history-green {
          color: var(--green);
        }

        .history-detail-item .history-gold {
          color: #a7803f;
        }

        .history-detail-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 19px 21px 13px;
        }

        .history-detail-heading h3 {
          margin: 0;
          color: var(--ink);
          font-family: var(--font-manrope), sans-serif;
          font-size: 13px;
          font-weight: 800;
          text-align: left;
        }

        .history-detail-heading p {
          margin: 5px 0 0;
          color: #849087;
          font-size: 10px;
          line-height: 1.6;
          text-align: left;
        }

        .history-detail-heading > span {
          color: #849087;
          font-size: 9px;
          font-weight: 700;
        }

        .history-total-footer {
          display: flex;
          justify-content: flex-end;
          padding: 16px 21px;
          border-top: 1px solid #edf0eb;
          background: #f8faf7;
        }

        .history-total-footer > div {
          display: grid;
          gap: 6px;
          text-align: right;
        }

        .history-total-footer span {
          color: #849087;
          font-size: 9px;
          font-weight: 700;
        }

        .history-total-footer strong {
          color: var(--green);
          font-family: var(--font-manrope), sans-serif;
          font-size: 18px;
          font-weight: 800;
        }

        /* RESPONSIVE */

        @media (max-width: 1100px) {
          .stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .employee-details {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .history-detail-summary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 700px) {
          .payroll-page {
            padding: 20px;
          }

          .page-header {
            align-items: flex-start;
            padding: 23px 20px;
          }

          .page-title {
            font-size: 27px;
          }

          .overview-card {
            grid-template-columns: 1fr;
            gap: 20px;
            padding: 22px;
          }

          .overview-side {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .period-content {
            grid-template-columns: 1fr;
            padding: 19px 20px;
          }

          .panel-header {
            padding: 18px 20px;
          }

          .employee-toolbar {
            padding: 14px 16px;
          }

          .employee-list {
            padding: 14px;
          }

          .employee-top {
            padding: 15px;
          }

          .employee-details {
            padding: 0 15px 15px;
          }

          .employee-footer {
            padding: 13px 15px;
          }

          .information-box {
            padding: 15px;
          }

          .history-period-list {
            padding: 15px;
          }

          .history-detail-summary {
            padding: 15px;
          }

          .history-detail-heading {
            padding: 16px 17px 12px;
          }
        }

        @media (max-width: 480px) {
          .payroll-page {
            padding: 14px;
          }

          .page-header {
            flex-direction: column;
            gap: 15px;
            padding: 21px 18px;
            border-radius: 16px;
          }

          .page-title {
            font-size: 24px;
          }

          .page-description {
            max-width: 100%;
            font-size: 10px;
          }

          .refresh-button {
            min-height: 37px;
            padding: 0 12px;
            font-size: 9px;
          }

          .overview-card {
            padding: 19px;
            border-radius: 16px;
          }

          .overview-amount {
            font-size: 27px;
          }

          .overview-mini {
            padding: 12px;
          }

          .overview-mini-value {
            font-size: 13px;
          }

          .stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 9px;
          }

          .stat-card {
            padding: 14px;
            border-radius: 13px;
          }

          .stat-label {
            font-size: 9px;
          }

          .stat-icon {
            width: 34px;
            height: 34px;
          }

          .stat-value {
            margin-top: 12px;
            font-size: 21px;
          }

          .stat-value.compact {
            font-size: 14px;
          }

          .stat-note {
            font-size: 8px;
            line-height: 1.5;
          }

          .panel {
            border-radius: 15px;
          }

          .panel-header {
            align-items: flex-start;
            padding: 16px;
          }

          .panel-icon {
            width: 39px;
            height: 39px;
          }

          .panel-title {
            font-size: 14px;
          }

          .panel-subtitle {
            font-size: 9px;
          }

          .period-content {
            padding: 16px;
          }

          .period-footer {
            align-items: stretch;
            padding: 14px 16px;
          }

          .period-footer .primary-btn {
            width: 100%;
          }

          .toolbar-search {
            flex-basis: 100%;
            min-width: 0;
          }

          .filter-wrap {
            width: 100%;
          }

          .employee-count {
            font-size: 9px;
          }

          .employee-list {
            padding: 10px;
          }

          .employee-top {
            align-items: flex-start;
            padding: 13px;
          }

          .employee-details {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 7px;
            padding: 0 13px 13px;
          }

          .detail-box {
            padding: 10px 9px;
          }

          .detail-label {
            font-size: 8px;
          }

          .detail-value {
            font-size: 10px;
          }

          .employee-footer {
            align-items: stretch;
            padding: 12px 13px;
          }

          .employee-footer .primary-btn {
            width: 100%;
          }

          .employee-note {
            font-size: 9px;
          }

          .history-period-card {
            align-items: flex-start;
            flex-wrap: wrap;
            padding: 13px;
          }

          .history-period-left {
            gap: 10px;
          }

          .history-period-icon {
            width: 39px;
            height: 39px;
          }

          .history-period-info > strong {
            font-size: 10px;
          }

          .history-period-meta {
            gap: 7px;
          }

          .history-period-meta span {
            font-size: 8px;
          }

          .history-period-right {
            min-width: 0;
            margin-left: 49px;
            text-align: left;
          }

          .history-period-arrow {
            margin-left: auto;
          }

          .history-detail-summary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 7px;
            padding: 13px;
          }

          .history-detail-item {
            padding: 10px;
          }

          .history-detail-item strong {
            font-size: 10px;
          }

          .history-back-button {
            min-height: 33px;
            font-size: 8px;
          }

          .history-detail-heading {
            padding: 14px;
          }

          .history-total-footer {
            padding: 14px;
          }
        }

        @media (max-width: 360px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }

          .overview-side {
            grid-template-columns: 1fr;
          }

          .employee-details {
            grid-template-columns: 1fr 1fr;
          }
        }
`}</style>

      {/* HEADER */}
      <header className="page-header">
        <div>
          <div className="eyebrow">
          
            MANAJEMEN KEUANGAN KARYAWAN
          </div>

          <h1 className="page-title">Gaji Mingguan</h1>

          <p className="page-description">
            Kelola penggajian, potongan, piutang, dan pembayaran karyawan.
          </p>

       
        </div>

      </header>

      {/* NOTIFICATIONS */}
      {error && (
        <div className="notice error">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="notice success">
          <CheckCircle2 size={17} />
          <span>{success}</span>
        </div>
      )}

      {/* MAIN FINANCIAL OVERVIEW */}
      <section className="overview-card">
        <div className="overview-main">
          <div className="overview-label">
            <Wallet size={15} />
            Estimasi total gaji bersih
          </div>

          <div className="overview-amount">
            {rupiah(totalEstimatedSalary)}
          </div>

          <p className="overview-caption">
            Perkiraan total gaji yang akan diterima seluruh karyawan
            setelah potongan ketidakhadiran dan estimasi piutang.
          </p>
        </div>

        <div className="overview-side">
          <div className="overview-mini">
            <div className="overview-mini-label">Total gaji kotor</div>
            <div className="overview-mini-value">
              {rupiah(totalGrossSalary)}
            </div>
            <div className="overview-mini-note">Sebelum potongan</div>
          </div>

          <div className="overview-mini">
            <div className="overview-mini-label">Total sisa piutang</div>
            <div className="overview-mini-value">
              {rupiah(totalOutstandingDebt)}
            </div>
            <div className="overview-mini-note">Seluruh karyawan aktif</div>
          </div>
        </div>
      </section>

      {/* SUMMARY CARDS */}
      <section className="stats-grid">
        <StatCard
          icon={<Users size={17} />}
          label="Karyawan Aktif"
          value={String(employees.length)}
          note="Total karyawan aktif"
          tone="green"
        />

        <StatCard
          icon={<Clock size={17} />}
          label="Menunggu Bayar"
          value={String(draftCount)}
          note="Gaji masih berstatus draft"
          tone="gold"
        />

        <StatCard
          icon={<CheckCircle2 size={17} />}
          label="Sudah Dibayar"
          value={String(paidCount)}
          note="Pembayaran berhasil"
          tone="green"
        />

        <StatCard
          icon={<CalendarCheck size={17} />}
          label="Belum Dihitung"
          value={String(
            Math.max(0, employees.length - currentPayrolls.length)
          )}
          note="Belum masuk penggajian"
          tone="gray"
        />
      </section>

      {/* PERIOD */}
      <section className="panel">
        <div className="panel-header">
          <div className="panel-heading">
            <div className="panel-icon">
              <CalendarDays size={17} />
            </div>

            <div>
              <h2 className="panel-title">Periode Penggajian</h2>
              <p className="panel-subtitle">
                Tentukan periode mingguan yang akan diproses.
              </p>
            </div>
          </div>
        </div>

        <div className="period-content">
          <div>
            <label className="field-label">Pilih periode</label>

            <div className="select-wrap">
              <select
                value={selectedStart}
                onChange={(event) => setSelectedStart(event.target.value)}
                className="field"
              >
                {periods.map((period, index) => (
                  <option key={period.start} value={period.start}>
                    Periode {index + 1}: {formatDate(period.start)} –{" "}
                    {formatDate(period.end)}
                  </option>
                ))}
              </select>

          
            </div>
          </div>

          <div className="payment-date-box">
            <div className="payment-date-icon">
              <CalendarCheck size={19} />
            </div>

            <div>
              <div className="payment-date-label">Tanggal pembayaran</div>
              <div className="payment-date-value">
                {formatDate(paymentDate)}
              </div>
              <div className="payment-date-note">
                Sehari setelah periode berakhir.
              </div>
            </div>
          </div>
        </div>

        <div className="period-footer">
          <div className="period-status">
            <span className={`status-dot ${canProcess ? "ready" : ""}`} />
            {canProcess
              ? "Periode sudah selesai dan siap diproses"
              : "Menunggu periode penggajian berakhir"}
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
            className="primary-btn"
          >
            <Calculator size={15} />
            {processing ? "Menghitung..." : "Hitung Gaji"}
          </button>
        </div>
      </section>

      {/* EMPLOYEE LIST */}
      <section className="panel">
        <div className="panel-header">
          <div className="panel-heading">
            <div className="panel-icon">
              <Users size={17} />
            </div>

            <div>
              <h2 className="panel-title">Rincian Gaji Karyawan</h2>
              <p className="panel-subtitle">
                Periode {formatDate(selectedPeriod.start)} –{" "}
                {formatDate(selectedPeriod.end)}
              </p>
            </div>
          </div>

          <span className="employee-count">
            {filteredEmployees.length} Karyawan
          </span>
        </div>

        {/* SEARCH AND FILTER */}
        <div className="employee-toolbar">
          <div className="toolbar-search">
          

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama atau kode karyawan..."
              className="search-field"
            />
          </div>

          <div className="filter-wrap">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="filter-field"
            >
              <option value="all">Semua status</option>
              <option value="paid">Sudah dibayar</option>
              <option value="draft">Menunggu pembayaran</option>
              <option value="not-calculated">Belum dihitung</option>
            </select>

        
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <RefreshCw
              size={23}
              className="mx-auto mb-3 animate-spin"
            />
            Memuat data penggajian...
          </div>
        ) : employees.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Users size={20} />
            </div>
            Belum ada karyawan aktif.
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Search size={20} />
            </div>
            Tidak ada karyawan yang sesuai dengan pencarian.
          </div>
        ) : (
          <div className="employee-list">
            {filteredEmployees.map((employee) => {
              const payroll = payrollByEmployee.get(employee.id);
              const debt = totalDebtByEmployee[employee.id] || 0;

              const absentDays = payroll?.absent_days ?? 0;

              const absenceDeduction =
                payroll?.absence_deduction ??
                Math.round(
                  (Number(employee.weekly_wage) * absentDays) / 7 * 100
                ) / 100;

              const grossSalary =
                payroll?.gross_salary ?? Number(employee.weekly_wage);

              const salaryAfterAbsence = Math.max(
                0,
                grossSalary - absenceDeduction
              );

              const debtDeduction =
                payroll?.payment_status === "paid"
                  ? payroll.debt_deduction
                  : Math.min(debt, salaryAfterAbsence);

              const netSalary =
                payroll?.payment_status === "paid"
                  ? payroll.net_salary
                  : salaryAfterAbsence - debtDeduction;

              return (
                <article key={employee.id} className="employee-card">
                  <div className="employee-top">
                    <div className="employee-identity">
                      <div className="employee-avatar">
                        <UserRound size={19} />
                      </div>

                      <div>
                        <div className="employee-name">
                          {employee.full_name}
                        </div>

                        <div className="employee-code">
                          {employee.employee_code || "Tanpa kode karyawan"}
                        </div>
                      </div>
                    </div>

                    {payroll ? (
                      payroll.payment_status === "paid" ? (
                        <StatusBadge tone="green">
                          <CheckCircle2 size={12} />
                          Sudah dibayar
                        </StatusBadge>
                      ) : (
                        <StatusBadge tone="gold">
                          <Clock size={12} />
                          Menunggu pembayaran
                        </StatusBadge>
                      )
                    ) : (
                      <StatusBadge tone="gray">
                        Belum dihitung
                      </StatusBadge>
                    )}
                  </div>

                  <div className="employee-details">
                    <Detail
                      label="Gaji mingguan"
                      value={rupiah(grossSalary)}
                    />

                    <Detail
                      label="Tidak hadir"
                      value={`${absentDays} / 7 hari`}
                    />

                    <Detail
                      label="Potongan absen"
                      value={rupiah(absenceDeduction)}
                      negative
                    />

                    <Detail
                      label="Sisa piutang"
                      value={rupiah(debt)}
                    />

                    <Detail
                      label="Potongan piutang"
                      value={rupiah(debtDeduction)}
                      negative
                    />

                    <Detail
                      label="Gaji bersih"
                      value={rupiah(netSalary)}
                      highlight
                    />
                  </div>

                  {payroll?.payment_status === "paid" ? (
                    <div className="paid-info">
                      <CheckCircle2 size={14} />
                      Pembayaran berhasil pada {formatPaidAt(payroll.paid_at)}
                    </div>
                  ) : payroll ? (
                    <div className="employee-footer">
                      <div className="employee-note">
                        <Info size={14} />
                        <span>
                          Potongan piutang masih berupa estimasi.
                          Saldo piutang baru dikurangi setelah pembayaran berhasil.
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => void payEmployee(payroll)}
                        disabled={!canProcess || payingId !== ""}
                        className="primary-btn"
                      >
                        <CreditCard size={14} />
                        {payingId === payroll.id
                          ? "Memproses..."
                          : "Bayar karyawan"}
                      </button>
                    </div>
                  ) : (
                    <div className="employee-footer">
                      <div className="employee-note">
                        <Info size={14} />
                        <span>
                          Karyawan ini akan masuk ke daftar penggajian setelah
                          tombol Hitung Gaji digunakan.
                        </span>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>



     {/* HISTORY */}
<section className="panel history-panel">
  <div className="panel-header">
    <div className="panel-heading">
      <div className="panel-icon">
        <History size={17} />
      </div>

      <div>
        <h2 className="panel-title">
          {selectedHistoryPeriod
            ? "Detail Riwayat Penggajian"
            : "Riwayat Penggajian"}
        </h2>

        <p className="panel-subtitle">
          {selectedHistoryPeriod
            ? `${formatDate(selectedHistoryPeriod.start)} – ${formatDate(
                selectedHistoryPeriod.end
              )}`
            : "Pilih periode untuk melihat rincian penggajian karyawan."}
        </p>
      </div>
    </div>

    {selectedHistoryPeriod && (
      <button
        type="button"
        className="history-back-button"
        onClick={() => setSelectedHistoryStart(null)}
      >
        ← Kembali ke Periode
      </button>
    )}
  </div>

  {loading ? (
    <div className="history-empty">
      <RefreshCw size={23} className="history-loading-icon" />
      Memuat riwayat penggajian...
    </div>
  ) : payrolls.length === 0 ? (
    <div className="history-empty">
      <div className="history-empty-icon">
        <Receipt size={22} />
      </div>
      <strong>Belum ada riwayat penggajian</strong>
      <span>
        Periode penggajian yang sudah dihitung akan muncul di sini.
      </span>
    </div>
  ) : selectedHistoryPeriod ? (
    <>
      <div className="history-detail-summary">
        <div className="history-detail-item">
          <span>Total karyawan</span>
          <strong>{selectedHistoryPeriod.items.length} karyawan</strong>
        </div>

        <div className="history-detail-item">
          <span>Sudah dibayar</span>
          <strong className="history-green">
            {selectedHistoryPeriod.paid} karyawan
          </strong>
        </div>

        <div className="history-detail-item">
          <span>Menunggu pembayaran</span>
          <strong className="history-gold">
            {selectedHistoryPeriod.draft} karyawan
          </strong>
        </div>

        <div className="history-detail-item">
          <span>Total gaji bersih</span>
          <strong className="history-green">
            {rupiah(selectedHistoryPeriod.totalNet)}
          </strong>
        </div>
      </div>

      <div className="history-detail-heading">
        <div>
          <h3>Rincian Karyawan</h3>
          <p>
            Rincian gaji seluruh karyawan pada periode ini.
          </p>
        </div>

        <span>{selectedHistoryPeriod.items.length} data</span>
      </div>

      <div className="history-wrap">
        <table className="history-table">
          <thead>
            <tr>
              <th>Karyawan</th>
              <th>Gaji kotor</th>
              <th>Potongan absen</th>
              <th>Potongan piutang</th>
              <th>Gaji bersih</th>
              <th>Status</th>
              <th>Tanggal bayar</th>
            </tr>
          </thead>

          <tbody>
            {selectedHistoryPeriod.items
              .slice()
              .sort((a, b) =>
                (a.employees?.full_name || "").localeCompare(
                  b.employees?.full_name || ""
                )
              )
              .map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="history-name">
                      {item.employees?.full_name || "-"}
                    </div>
                    <div className="history-code">
                      {item.employees?.employee_code || "-"}
                    </div>
                  </td>

                  <td>{rupiah(Number(item.gross_salary))}</td>

                  <td className="history-deduction">
                    {rupiah(Number(item.absence_deduction))}
                  </td>

                  <td className="history-deduction">
                    {rupiah(Number(item.debt_deduction))}
                  </td>

                  <td className="history-amount">
                    {rupiah(Number(item.net_salary))}
                  </td>

                  <td>
                    {item.payment_status === "paid" ? (
                      <StatusBadge tone="green">
                        <CheckCircle2 size={11} />
                        Dibayar
                      </StatusBadge>
                    ) : (
                      <StatusBadge tone="gold">
                        <Clock size={11} />
                        Draft
                      </StatusBadge>
                    )}
                  </td>

                  <td className="history-date">
                    {formatPaidAt(item.paid_at)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="history-total-footer">
        <div>
          <span>Total gaji bersih periode ini</span>
          <strong>
            {rupiah(selectedHistoryPeriod.totalNet)}
          </strong>
        </div>
      </div>
    </>
  ) : (
    <div className="history-period-list">
      <div className="history-list-intro">
        <div>
          <strong>Daftar Periode</strong>
          <p>
            Klik salah satu periode untuk melihat rincian gaji karyawan.
          </p>
        </div>

        <span>{historyPeriods.length} periode</span>
      </div>

      {historyPeriods.map((period, index) => {
        const allPaid =
          period.items.length > 0 && period.draft === 0;

        return (
          <button
            type="button"
            key={period.start}
            className="history-period-card"
            onClick={() => setSelectedHistoryStart(period.start)}
          >
            <div className="history-period-left">
              <div className="history-period-icon">
                <CalendarDays size={19} />
              </div>

              <div className="history-period-info">
                <div className="history-period-number">
                  PERIODE PENGGAJIAN
                  <span>#{historyPeriods.length - index}</span>
                </div>

                <strong>
                  {formatDate(period.start)} – {formatDate(period.end)}
                </strong>

                <div className="history-period-meta">
                  <span>
                    <Users size={12} />
                    {period.items.length} karyawan
                  </span>

                  <span className="history-meta-paid">
                    <CheckCircle2 size={12} />
                    {period.paid} dibayar
                  </span>

                  {period.draft > 0 && (
                    <span className="history-meta-draft">
                      <Clock size={12} />
                      {period.draft} draft
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="history-period-right">
              <div className="history-period-total-label">
                TOTAL GAJI BERSIH
              </div>

              <strong>{rupiah(period.totalNet)}</strong>

              <span
                className={`history-period-status ${
                  allPaid ? "completed" : "pending"
                }`}
              >
                {allPaid ? "Semua dibayar" : "Belum selesai"}
              </span>
            </div>

            <div className="history-period-arrow">
              <ChevronDown size={17} />
            </div>
          </button>
        );
      })}
    </div>
  )}
</section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  note,
  tone = "gray",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  note: string;
  tone?: "green" | "gold" | "gray";
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <p className="stat-label">{label}</p>
        <div className={`stat-icon ${tone}`}>
          {icon}
        </div>
      </div>

      <p className={`stat-value ${value.length > 13 ? "compact" : ""}`}>
        {value}
      </p>

      <p className="stat-note">{note}</p>
    </div>
  );
}

function Detail({
  label,
  value,
  highlight = false,
  negative = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="detail-box">
      <p className="detail-label">{label}</p>

      <p
        className={`detail-value ${
          highlight ? "highlight" : negative ? "negative" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function StatusBadge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "green" | "gold" | "gray";
}) {
  return (
    <span className={`status-badge ${tone}`}>
      {children}
    </span>
  );
}
