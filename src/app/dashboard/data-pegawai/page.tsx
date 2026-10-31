"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";

type Employee = {
  id: string;
  full_name: string;
  weekly_wage: number;
  is_active: boolean;
};

type EmployeeView = "active" | "inactive";

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
  const [editName, setEditName] = useState("");
  const [editWage, setEditWage] = useState("");

  const [listView, setListView] = useState<EmployeeView>("active");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data, error: loadError } = await supabase
        .from("employees")
        .select("id, full_name, weekly_wage, is_active")
        .order("full_name", { ascending: true });

      if (loadError) {
        setError(`Gagal memuat pegawai: ${loadError.message}`);
        return;
      }

      setEmployees((data ?? []) as Employee[]);
    } catch (err) {
      setError(
        `Gagal memuat pegawai: ${
          err instanceof Error ? err.message : "Terjadi kesalahan."
        }`
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.is_active),
    [employees]
  );

  const inactiveEmployees = useMemo(
    () => employees.filter((employee) => !employee.is_active),
    [employees]
  );

  const displayedEmployees =
    listView === "active" ? activeEmployees : inactiveEmployees;

  const totalActiveWage = activeEmployees.reduce(
    (total, employee) => total + Number(employee.weekly_wage || 0),
    0
  );

  const filteredEmployees = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("id-ID");

    return displayedEmployees.filter((employee) =>
      employee.full_name.toLocaleLowerCase("id-ID").includes(keyword)
    );
  }, [displayedEmployees, search]);

  function resetForm() {
    setName("");
    setWage("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditWage("");
  }

  function startEdit(employee: Employee) {
    setError("");
    setMessage("");
    setEditingId(employee.id);
    setEditName(employee.full_name);
    setEditWage(String(employee.weekly_wage));
  }

  function validateEmployee(
    employeeName: string,
    employeeWage: string
  ) {
    const cleanName = employeeName.trim();
    const weeklyWage = Number(employeeWage);

    if (!cleanName) {
      return "Nama pegawai wajib diisi.";
    }

    if (
      !employeeWage.trim() ||
      !Number.isSafeInteger(weeklyWage) ||
      weeklyWage <= 0
    ) {
      return "Upah mingguan harus berupa angka rupiah bulat lebih dari nol.";
    }

    return "";
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");
    setMessage("");

    const validation = validateEmployee(name, wage);

    if (validation) {
      setError(validation);
      return;
    }

    setSaving(true);

    try {
      const { error: insertError } = await supabase
        .from("employees")
        .insert({
          full_name: name.trim(),
          weekly_wage: Number(wage),
          is_active: true,
        });

      if (insertError) {
        setError(`Gagal menambahkan pegawai: ${insertError.message}`);
        return;
      }

      setMessage(`pegawai "${name.trim()}" berhasil ditambahkan.`);
      resetForm();
      await loadEmployees();
    } catch (err) {
      setError(
        `Gagal menyimpan: ${
          err instanceof Error ? err.message : "Terjadi kesalahan."
        }`
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!editingId) return;

    const validation = validateEmployee(editName, editWage);

    if (validation) {
      setError(validation);
      return;
    }

    setSavingEdit(true);

    try {
      const { error: updateError } = await supabase
        .from("employees")
        .update({
          full_name: editName.trim(),
          weekly_wage: Number(editWage),
        })
        .eq("id", editingId);

      if (updateError) {
        setError(`Gagal memperbarui pegawai: ${updateError.message}`);
        return;
      }

      const updatedName = editName.trim();

      cancelEdit();
      await loadEmployees();

      setMessage(`Data Karyawan "${updatedName}" berhasil diperbarui.`);
    } catch (err) {
      setError(
        `Gagal memperbarui pegawai: ${
          err instanceof Error ? err.message : "Terjadi kesalahan."
        }`
      );
    } finally {
      setSavingEdit(false);
    }
  }

  async function toggleActive(employee: Employee) {
    const action = employee.is_active ? "menonaktifkan" : "mengaktifkan";

    const confirmed = window.confirm(
      `Yakin ingin ${action} ${employee.full_name}?\n\nRiwayat gaji dan piutang tidak akan dihapus.`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");
    setProcessingId(employee.id);

    try {
      const { error: updateError } = await supabase
        .from("employees")
        .update({ is_active: !employee.is_active })
        .eq("id", employee.id);

      if (updateError) {
        setError(`Gagal mengubah status: ${updateError.message}`);
        return;
      }

      if (editingId === employee.id) {
        cancelEdit();
      }

      await loadEmployees();

      setMessage(
        `Status ${employee.full_name} berhasil ${
          employee.is_active ? "dinonaktifkan" : "diaktifkan kembali"
        }.`
      );
    } catch (err) {
      setError(
        `Gagal mengubah status: ${
          err instanceof Error ? err.message : "Terjadi kesalahan."
        }`
      );
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="employee-page">
      <style jsx>{`
        .employee-page {
          --emerald: #174b36;
          --emerald-dark: #103a2a;
          --emerald-soft: #edf4ef;
          --gold: #b99a62;
          --ink: #26352c;
          --line: #e8ece6;

          display: flex;
          flex-direction: column;
          gap: 22px;
          width: 100%;
          padding-bottom: 36px;
          color: var(--ink);
          font-family: var(--font-dm-sans), sans-serif;
        }

        * {
          box-sizing: border-box;
        }

       .hero {
  position: relative;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 24px;
  min-height: 150px;
  overflow: hidden;
  padding: 30px 27px;
  border: 1px solid #e5e9e1;
  border-radius: 20px;
  background:
    radial-gradient(
      circle at 92% 10%,
      rgba(185, 154, 98, 0.13),
      transparent 28%
    ),
    linear-gradient(115deg, #ffffff 0%, #f5f8f3 100%);
  box-shadow: 0 8px 28px rgba(24, 55, 37, 0.035);
}

        .hero > div:first-child {
          min-width: 0;
        }

        .hero::after {
          content: "";
          position: absolute;
          width: 180px;
          height: 180px;
          right: 90px;
          bottom: -125px;
          border: 1px solid rgba(185, 154, 98, 0.24);
          border-radius: 50%;
          pointer-events: none;
        }

        .eyebrow {
          margin-bottom: 10px;
          color: var(--gold);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 2.4px;
        }

        .title {
          margin: 0;
          color: var(--emerald-dark);
          font-family: var(--font-manrope), sans-serif;
          font-size: clamp(27px, 3vw, 35px);
          font-weight: 800;
          letter-spacing: -1.4px;
          line-height: 1.25;
        }

        .subtitle {
          margin: 9px 0 0;
          color: #7b877e;
          font-size: 13px;
          line-height: 1.7;
        }

        .count-chip {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          padding: 12px 19px;
          border: 1px solid #dce8de;
          border-radius: 11px;
          background: rgba(255, 255, 255, 0.85);
          color: var(--emerald);
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          align-items: stretch;
          gap: 16px;
        }

        .stat {
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-width: 0;
          min-height: 135px;
          overflow: hidden;
          padding: 22px 24px;
          border: 1px solid var(--line);
          border-radius: 16px;
          background: #fff;
          box-shadow: 0 5px 18px rgba(24, 55, 37, 0.035);
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease;
        }

        .stat:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 25px rgba(24, 55, 37, 0.07);
        }

        .stat::after {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          width: 3px;
          height: 42px;
          border-radius: 0 0 5px 0;
          background: var(--gold);
        }

        .stat-label {
          color: #7e8a80;
          font-size: 11px;
          font-weight: 700;
          line-height: 1.5;
        }

        .stat-value {
          margin-top: 11px;
          color: var(--emerald-dark);
          font-family: var(--font-manrope), sans-serif;
          font-size: clamp(22px, 2vw, 27px);
          font-weight: 800;
          letter-spacing: -1px;
          line-height: 1.25;
          overflow-wrap: anywhere;
        }

        .stat-caption {
          margin-top: 7px;
          color: #9aa39b;
          font-size: 10px;
          line-height: 1.6;
        }

        .panel {
  min-width: 0;
  padding: 27px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 6px 22px rgba(24, 55, 37, 0.035);
}

        .panel-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 23px;
          flex-wrap: wrap;
        }

        .panel-heading h2 {
          margin: 0 0 7px;
          color: var(--emerald-dark);
          font-family: var(--font-manrope), sans-serif;
          font-size: 17px;
          font-weight: 800;
          letter-spacing: -0.4px;
          line-height: 1.4;
        }

        .panel-heading p {
          margin: 0;
          color: #89938a;
          font-size: 11px;
          line-height: 1.75;
        }

        .step {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 35px;
          padding: 8px 13px;
          border: 1px solid #e8dfca;
          border-radius: 9px;
          background: #fbf8f0;
          color: #927545;
          font-size: 11px;
          font-weight: 800;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          align-items: start;
          gap: 20px;
        }

        .field-wrap {
          display: block;
          min-width: 0;
          width: 100%;
        }

        .field-label {
          display: flex;
          align-items: center;
          gap: 4px;
          min-height: 18px;
          margin-bottom: 9px;
          color: #526157;
          font-size: 10px;
          font-weight: 800;
        }

        .required {
          color: #bd615b;
        }

        .field {
          display: block;
          width: 100%;
          min-width: 0;
          min-height: 46px;
          padding: 0 14px;
          border: 1px solid #e2e8e1;
          border-radius: 10px;
          background: #fff;
          color: #304136;
          font-family: inherit;
          font-size: 12px;
          outline: none;
          transition:
            border-color 0.18s ease,
            box-shadow 0.18s ease;
        }

        .field::placeholder {
          color: #b1b9b1;
        }

        .field:focus {
          border-color: #789b83;
          box-shadow: 0 0 0 3px rgba(45, 105, 68, 0.09);
        }

        .button,
        .reload,
        .edit-button,
        .status-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 39px;
          padding: 0 15px;
          border-radius: 9px;
          font-family: inherit;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.18s ease;
          white-space: nowrap;
        }

        .button {
          min-height: 44px;
          padding: 0 21px;
          border: 0;
          font-size: 12px;
        }

        .primary {
          background: linear-gradient(135deg, #205a3e, #123d2b);
          color: white;
          box-shadow: 0 4px 11px rgba(23, 75, 54, 0.16);
        }

        .primary:hover:not(:disabled) {
          background: #0e3525;
          box-shadow: 0 6px 15px rgba(23, 75, 54, 0.22);
          transform: translateY(-1px);
        }

        .secondary {
          border: 1px solid #dce7dd;
          background: #f0f5f0;
          color: var(--emerald);
        }

        .secondary:hover:not(:disabled) {
          border-color: #bfd2c2;
          background: #e7f0e8;
        }

        .reload {
          min-height: 39px;
          border: 1px solid #e0e8df;
          background: #fff;
          color: #496a53;
        }

        .reload:hover:not(:disabled) {
          border-color: #bfd2c2;
          background: #f3f7f2;
        }

        .edit-button {
          border: 1px solid #dce7dd;
          background: #f0f5f0;
          color: #376547;
        }

        .edit-button:hover:not(:disabled) {
          background: #e3eee5;
          border-color: #c4d8c7;
        }

        .status-button {
          border: 1px solid #f0deda;
          background: #fff5f3;
          color: #ae5148;
        }

        .status-button.activate {
          border-color: #dce7dd;
          background: #f0f5f0;
          color: #376547;
        }

        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none !important;
        }

        .form-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 15px;
          flex-wrap: wrap;
          margin-top: 22px;
          padding-top: 19px;
          border-top: 1px solid #edf0eb;
        }

        .form-footer p {
          max-width: 430px;
          margin: 0;
          color: #89938a;
          font-size: 10px;
          line-height: 1.8;
        }

        .toolbar {
          display: flex;
          align-items: center;
          gap: 11px;
          margin-bottom: 15px;
        }

        .search-wrap {
          position: relative;
          display: block;
          flex: 1;
          min-width: 180px;
        }

        .search-icon {
          position: absolute;
          top: 50%;
          left: 14px;
          color: #8a988d;
          font-size: 19px;
          transform: translateY(-52%);
          pointer-events: none;
        }

        .search-input {
          padding-left: 40px;
        }

        .result-count {
          margin-bottom: 13px;
          color: #8b968c;
          font-size: 10px;
          font-weight: 600;
        }

        .table-wrap {
          width: 100%;
          overflow-x: auto;
          border: 1px solid #e7ece6;
          border-radius: 13px;
        }

        .table {
          width: 100%;
          min-width: 650px;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 11px;
          table-layout: fixed;
        }

        .table th {
          padding: 15px 16px;
          border-bottom: 1px solid #e6ebe5;
          background: #f5f7f3;
          color: #66766a;
          text-align: left;
          white-space: nowrap;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.45px;
        }

        .table th:nth-child(1) {
          width: 31%;
        }

        .table th:nth-child(2) {
          width: 24%;
        }

        .table th:nth-child(3) {
          width: 17%;
        }

        .table th:nth-child(4) {
          width: 28%;
        }

        .table td {
          padding: 16px;
          border-bottom: 1px solid #edf0eb;
          color: #758077;
          vertical-align: middle;
          line-height: 1.5;
        }

        .table tbody tr {
          transition: background 0.15s ease;
        }

        .table tbody tr:hover {
          background: #f8faf7;
        }

        .table tbody tr:last-child td {
          border-bottom: 0;
        }

        .employee-name {
          color: #2c4033;
          font-size: 12px;
          font-weight: 800;
          overflow-wrap: anywhere;
        }

        .wage {
          color: var(--emerald);
          font-weight: 800;
          white-space: nowrap;
        }

        .status {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          min-height: 29px;
          padding: 6px 10px;
          border-radius: 8px;
          font-size: 9px;
          font-weight: 800;
          white-space: nowrap;
        }

        .active-status {
          border: 1px solid #dcebdd;
          background: #edf6ed;
          color: #3e754b;
        }

        .inactive-status {
          border: 1px solid #e4e8e3;
          background: #f2f4f1;
          color: #778178;
        }

        .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
        }

        .action-buttons {
          display: flex;
          align-items: center;
          gap: 7px;
          flex-wrap: wrap;
        }

        .empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 150px;
          padding: 35px 18px;
          border: 1px dashed #dce5dc;
          border-radius: 13px;
          background: #fafbf9;
          color: #8a958b;
          text-align: center;
          font-size: 11px;
          line-height: 1.8;
        }

        .empty strong {
          display: block;
          margin-bottom: 6px;
          color: #42594a;
          font-family: var(--font-manrope), sans-serif;
          font-size: 13px;
          font-weight: 800;
        }

        .list-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 17px;
        }

        .list-tab {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          min-height: 39px;
          padding: 0 14px;
          border: 1px solid #e1e8df;
          border-radius: 9px;
          background: #fff;
          color: #617365;
          font-family: inherit;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.18s ease;
        }

        .list-tab:hover {
          border-color: #c5d7c8;
          background: #f6f9f5;
        }

        .list-tab span {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 22px;
          height: 22px;
          padding: 0 5px;
          border-radius: 7px;
          background: #f0f4ef;
          color: #607564;
          font-size: 10px;
        }

        .list-tab-active {
          border-color: var(--emerald);
          background: var(--emerald);
          color: white;
          box-shadow: 0 4px 10px rgba(23, 75, 54, 0.13);
        }

        .list-tab-active span {
          background: rgba(255, 255, 255, 0.17);
          color: white;
        }

        .alert {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          padding: 15px 17px;
          border-radius: 12px;
          font-size: 11px;
          line-height: 1.7;
          overflow-wrap: anywhere;
        }

        .alert-error {
          border: 1px solid #f0d9d5;
          background: #fff5f3;
          color: #a64d45;
        }

        .alert-success {
          border: 1px solid #dcebdd;
          background: #f0f7ef;
          color: #3c7046;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(15, 35, 25, 0.48);
          backdrop-filter: blur(5px);
          animation: fadeIn 0.18s ease;
        }

        .modal-card {
          width: 100%;
          max-width: 620px;
          max-height: 90vh;
          overflow-y: auto;
          padding: 29px;
          border: 1px solid #e3e9df;
          border-radius: 20px;
          background: #fff;
          box-shadow: 0 24px 80px rgba(10, 35, 22, 0.22);
          animation: modalIn 0.22s ease;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 15px;
          margin-bottom: 23px;
          padding-bottom: 19px;
          border-bottom: 1px solid #edf0eb;
        }

        .modal-eyebrow {
          margin-bottom: 7px;
          color: var(--gold);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 2px;
        }

        .modal-title {
          margin: 0;
          color: var(--emerald-dark);
          font-family: var(--font-manrope), sans-serif;
          font-size: 21px;
          font-weight: 800;
        }

        .modal-description {
          margin: 7px 0 0;
          color: #879188;
          font-size: 11px;
          line-height: 1.7;
        }

        .modal-close {
          display: grid;
          place-items: center;
          flex-shrink: 0;
          width: 36px;
          height: 36px;
          border: 1px solid #e7ece6;
          border-radius: 10px;
          background: #f8faf7;
          color: #68776b;
          font-size: 20px;
          cursor: pointer;
        }

        .modal-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          align-items: start;
          gap: 17px;
        }

        .modal-note {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-top: 20px;
          padding: 14px 16px;
          border: 1px solid #eee7d8;
          border-radius: 11px;
          background: #fbf9f3;
          color: #81775f;
          font-size: 10px;
          line-height: 1.7;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 10px;
          margin-top: 23px;
          padding-top: 19px;
          border-top: 1px solid #edf0eb;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes modalIn {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

       @media (max-width: 900px) {
  .table {
    min-width: 650px;
  }
}

@media (max-width: 700px) {
  .employee-page {
    gap: 15px;
  }

  .hero {
    grid-template-columns: 1fr;
    align-items: flex-start;
    gap: 17px;
    min-height: auto;
    padding: 23px 20px;
    border-radius: 17px;
  }

  .count-chip {
    justify-self: start;
  }

  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .stat {
    min-height: 120px;
    padding: 16px;
    border-radius: 13px;
  }

  .stat-value {
    font-size: 23px;
  }

  .panel {
    padding: 23px 20px;
    border-radius: 15px;
  }

  .panel-heading {
    align-items: flex-start;
    margin-bottom: 19px;
  }

  .form-grid {
    grid-template-columns: 1fr;
    gap: 15px;
  }

  .form-footer {
    align-items: stretch;
    flex-direction: column;
  }

  .form-footer .button {
    width: 100%;
  }

  .toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .search-wrap {
    width: 100%;
  }

  .modal-overlay {
    align-items: flex-end;
    padding: 0;
  }

  .modal-card {
    max-height: 92vh;
    padding: 21px;
    border-radius: 20px 20px 0 0;
  }

  .modal-grid {
    grid-template-columns: 1fr;
    gap: 14px;
  }

  .modal-footer {
    flex-direction: column-reverse;
  }

  .modal-footer .button {
    width: 100%;
  }

  .list-tab {
    flex: 1;
    padding: 0 10px;
  }
}

@media (max-width: 380px) {
  .stats {
    grid-template-columns: 1fr;
  }

  .stat {
    min-height: 105px;
  }

  .hero,
  .panel {
    padding-left: 18px;
    padding-right: 18px;
  }

  .title {
    font-size: 26px;
  }
}
  
      `}</style>

      <header className="hero">
        <div>
          <div className="eyebrow">MANAJEMEN TOKO</div>
          <h1 className="title">Data Karyawan</h1>
          <p className="subtitle">
            Kelola data karyawan dan upah mingguan Toko Rosyidah.
          </p>
        </div>

        <div className="count-chip">
          {activeEmployees.length} Karyawan aktif
        </div>
      </header>

      <div className="stats">
        <div className="stat">
          <div className="stat-label">Total karyawan aktif</div>
          <div className="stat-value">{activeEmployees.length}</div>
          <div className="stat-caption">Karyawan yang masih bekerja</div>
        </div>

        <div className="stat">
          <div className="stat-label">Karyawan nonaktif</div>
          <div className="stat-value">{inactiveEmployees.length}</div>
          <div className="stat-caption">Data karyawan yang dinonaktifkan</div>
        </div>

        <div className="stat">
          <div className="stat-label">Total upah mingguan</div>
          <div className="stat-value">
            {rupiah(totalActiveWage)}
          </div>
          <div className="stat-caption">
            Akumulasi upah mingguan seluruh karyawan aktif
          </div>
        </div>
      </div>

      {(error || message) && !editingId && (
        <div
          role={error ? "alert" : "status"}
          className={`alert ${error ? "alert-error" : "alert-success"}`}
        >
          <strong>{error ? "Perlu diperiksa" : "Berhasil"}</strong>
          <span>{error || message}</span>
        </div>
      )}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Tambah Karyawan Baru</h2>
            <p>
              Masukkan nama lengkap dan upah mingguan karyawan.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="field-wrap">
              <span className="field-label">
                Nama lengkap <span className="required">*</span>
              </span>
              <input
                className="field"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={150}
                required
                placeholder="Masukkan nama pegawai"
              />
            </label>

            <label className="field-wrap">
              <span className="field-label">
                Upah mingguan (7 hari) (Rp){" "}
                <span className="required">*</span>
              </span>
              <input
                className="field"
                type="number"
                min="1"
                step="1"
                value={wage}
                onChange={(event) => setWage(event.target.value)}
                required
                placeholder="Contoh: 700000"
              />
            </label>
          </div>

          <div className="form-footer">
            <button
              type="submit"
              className="button primary"
              disabled={saving}
            >
              {saving ? "Menyimpan..." : "+ Tambah karyawan"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>
              {listView === "active"
                ? "Daftar karyawan Aktif"
                : "Daftar karyawan Nonaktif"}
            </h2>
            <p>
              Lihat data karyawan, perbarui upah, atau ubah status karyawan.
            </p>

            <div className="list-tabs"></div>
          </div>
        </div>

        <div className="toolbar">
          <label className="search-wrap">
            <span className="search-icon">⌕</span>
            <input
              className="field search-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama pegawai..."
            />
          </label>
        </div>

        <div className="result-count">
          Menampilkan {filteredEmployees.length} dari{" "}
          {displayedEmployees.length} karyawan
        </div>

        {loading ? (
          <div className="empty">Memuat data karyawan...</div>
        ) : filteredEmployees.length === 0 ? (
          <div className="empty">
            <strong>karyawan tidak ditemukan</strong>
            Coba ubah kata pencarian atau periksa tab karyawan.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nama karyawan</th>
                  <th>Upah mingguan</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>

              <tbody>
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id}>
                    <td>
                      <div className="employee-name">
                        {employee.full_name}
                      </div>
                    </td>

                    <td className="wage">
                      {rupiah(Number(employee.weekly_wage))}
                    </td>

                    <td>
                      <span
                        className={`status ${
                          employee.is_active
                            ? "active-status"
                            : "inactive-status"
                        }`}
                      >
                        <span className="dot" />
                        {employee.is_active ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>

                    <td>
                      <div className="action-buttons">
                        <button
                          type="button"
                          className="edit-button"
                          onClick={() => startEdit(employee)}
                          disabled={processingId === employee.id}
                        >
                          ✎ Edit
                        </button>

                        <button
                          type="button"
                          className={`status-button ${
                            !employee.is_active ? "activate" : ""
                          }`}
                          onClick={() => void toggleActive(employee)}
                          disabled={processingId === employee.id}
                        >
                          {processingId === employee.id
                            ? "Memproses..."
                            : employee.is_active
                              ? "Nonaktifkan"
                              : "Aktifkan"}
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

      {editingId && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !savingEdit
            ) {
              cancelEdit();
            }
          }}
        >
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-employee-title"
          >
            <div className="modal-header">
              <div>
                <div className="modal-eyebrow">
                  MANAJEMEN KARYAWAN
                </div>
                <h2 className="modal-title" id="edit-employee-title">
                  Edit karyawan
                </h2>
                <p className="modal-description">
                  Perbarui nama dan upah mingguan karyawan.
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={cancelEdit}
                disabled={savingEdit}
                aria-label="Tutup"
              >
                ×
              </button>
            </div>

            <form onSubmit={saveEdit}>
              <div className="modal-grid">
                <label className="field-wrap">
                  <span className="field-label">
                    Nama lengkap <span className="required">*</span>
                  </span>
                  <input
                    className="field"
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    maxLength={150}
                    required
                  />
                </label>

                <label className="field-wrap">
                  <span className="field-label">
                    Upah mingguan (7 hari) (Rp){" "}
                    <span className="required">*</span>
                  </span>
                  <input
                    className="field"
                    type="number"
                    min="1"
                    step="1"
                    value={editWage}
                    onChange={(event) => setEditWage(event.target.value)}
                    required
                  />
                </label>
              </div>

              {error && (
                <div
                  className="alert alert-error"
                  style={{ marginTop: 15 }}
                >
                  <strong>Gagal</strong>
                  <span>{error}</span>
                </div>
              )}

              <div className="modal-note">
                <span>ⓘ</span>
                <span>
                  Perubahan upah akan digunakan untuk perhitungan
                  gaji berikutnya. Riwayat gaji dan piutang yang sudah
                  tercatat tidak dihapus.
                </span>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="button secondary"
                  onClick={cancelEdit}
                  disabled={savingEdit}
                >
                  Batal
                </button>

                <button
                  type="submit"
                  className="button primary"
                  disabled={savingEdit}
                >
                  {savingEdit ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}