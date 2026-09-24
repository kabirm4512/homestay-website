'use client';

import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  ShieldCheck,
  UserCog,
  ChefHat,
  KeyRound,
  Lock,
  Mail,
  Phone,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  Power,
  Eye,
  EyeOff,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Info,
  X,
} from 'lucide-react';
import { StaffAccount, StaffRole } from '@/types/crm';
import { useCRM } from '@/context/CRMContext';

export default function AdminStaffManagement() {
  const {
    staffAccounts,
    currentUser,
    addStaffAccount,
    updateStaffAccount,
    deleteStaffAccount,
    showToast,
  } = useCRM();

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffAccount | null>(null);
  const [passwordResetStaff, setPasswordResetStaff] = useState<StaffAccount | null>(null);
  const [deleteConfirmStaff, setDeleteConfirmStaff] = useState<StaffAccount | null>(null);

  // New staff form state
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState<StaffRole>('manager');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Edit form state
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<StaffRole>('manager');
  const [editError, setEditError] = useState<string | null>(null);

  // Reset password form state
  const [newResetPassword, setNewResetPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // Stats
  const totalAccounts = staffAccounts.length;
  const activeCount = staffAccounts.filter((a) => a.isActive).length;
  const adminCount = staffAccounts.filter((a) => a.role === 'admin' && a.isActive).length;
  const managerCount = staffAccounts.filter((a) => a.role === 'manager' && a.isActive).length;
  const kitchenCount = staffAccounts.filter((a) => a.role === 'kitchen_staff' && a.isActive).length;

  const roleConfig: Record<
    StaffRole,
    {
      title: string;
      icon: React.ElementType;
      badgeClass: string;
      borderClass: string;
      desc: string;
    }
  > = {
    admin: {
      title: 'Administrator',
      icon: ShieldCheck,
      badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      borderClass: 'border-emerald-500',
      desc: 'Unrestricted Access (Ledger, Staff, P&L, Operations, CMS)',
    },
    manager: {
      title: 'Duty Manager',
      icon: UserCog,
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
      borderClass: 'border-amber-500',
      desc: 'Operations & Front Desk (Tape Chart, Check-ins, Dispatch)',
    },
    kitchen_staff: {
      title: 'Kitchen Staff',
      icon: ChefHat,
      badgeClass: 'bg-orange-100 text-orange-900 border-orange-300',
      borderClass: 'border-orange-500',
      desc: 'Kitchen Mandate (Meal Counts CP/MAP/AP, Live Orders, Menu)',
    },
  };

  const handleOpenAddModal = () => {
    setNewFullName('');
    setNewEmail('');
    setNewPassword('');
    setNewPhone('+91 ');
    setNewRole('manager');
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!newFullName.trim()) {
      setFormError('Please enter the staff member’s full name.');
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(newEmail.trim())) {
      setFormError('Please provide a valid email address for login.');
      return;
    }

    const duplicate = staffAccounts.some((a) => a.email.toLowerCase() === newEmail.trim().toLowerCase());
    if (duplicate) {
      setFormError('An account with this email address already exists.');
      return;
    }

    if (newPassword.trim().length < 6) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }

    try {
      await addStaffAccount({
        fullName: newFullName.trim(),
        email: newEmail.trim().toLowerCase(),
        password: newPassword.trim(),
        phone: newPhone.trim() || undefined,
        role: newRole,
        isActive: true,
      });

      setIsAddModalOpen(false);
    } catch {
      setFormError('Failed to create account. Please try again.');
    }
  };

  const handleOpenEditModal = (account: StaffAccount) => {
    setEditingStaff(account);
    setEditFullName(account.fullName);
    setEditEmail(account.email);
    setEditPhone(account.phone || '');
    setEditRole(account.role);
    setEditError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    setEditError(null);

    if (!editFullName.trim()) {
      setEditError('Full name is required.');
      return;
    }

    const duplicate = staffAccounts.some(
      (a) => a.id !== editingStaff.id && a.email.toLowerCase() === editEmail.trim().toLowerCase()
    );
    if (duplicate) {
      setEditError('Another user is already using this email address.');
      return;
    }

    // Protection: If changing role away from admin, ensure there's at least one other active admin
    if (editingStaff.role === 'admin' && editRole !== 'admin') {
      const otherAdmins = staffAccounts.filter((a) => a.role === 'admin' && a.id !== editingStaff.id && a.isActive);
      if (otherAdmins.length === 0) {
        setEditError('Cannot change the role of the last active administrator.');
        return;
      }
    }

    await updateStaffAccount(editingStaff.id, {
      fullName: editFullName.trim(),
      email: editEmail.trim().toLowerCase(),
      phone: editPhone.trim() || undefined,
      role: editRole,
    });

    setEditingStaff(null);
  };

  const handleToggleStatus = async (account: StaffAccount) => {
    if (currentUser?.id === account.id && account.isActive) {
      showToast('You cannot deactivate your own currently active session.', 'error');
      return;
    }

    if (account.role === 'admin' && account.isActive) {
      const activeAdmins = staffAccounts.filter((a) => a.role === 'admin' && a.id !== account.id && a.isActive);
      if (activeAdmins.length === 0) {
        showToast('Cannot deactivate the last remaining active administrator.', 'error');
        return;
      }
    }

    const newStatus = !account.isActive;
    await updateStaffAccount(account.id, { isActive: newStatus });
    showToast(`${account.fullName} is now ${newStatus ? 'Active' : 'Deactivated'}`);
  };

  const handleOpenResetPassword = (account: StaffAccount) => {
    setPasswordResetStaff(account);
    setNewResetPassword('');
    setResetError(null);
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordResetStaff) return;
    setResetError(null);

    if (newResetPassword.trim().length < 6) {
      setResetError('New password must be at least 6 characters.');
      return;
    }

    await updateStaffAccount(passwordResetStaff.id, { password: newResetPassword.trim() });
    showToast(`Password updated for ${passwordResetStaff.fullName}`);
    setPasswordResetStaff(null);
  };

  const handleDeleteAccount = async () => {
    if (!deleteConfirmStaff) return;
    const res = await deleteStaffAccount(deleteConfirmStaff.id);
    if (res.success) {
      setDeleteConfirmStaff(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Header & Quick Actions */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-sand-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-emerald-800 mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Admin Control Panel &bull; RBAC</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-forest-950">
            Staff & User Management
          </h1>
          <p className="text-xs sm:text-sm text-forest-700/80 mt-1 max-w-2xl">
            Create and maintain individual credentials for Administrators, Duty Managers, and Kitchen Staff.
            Control access boundaries and reset passwords instantly.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleOpenAddModal}
            className="min-h-[44px] px-5 py-2.5 bg-forest-900 hover:bg-forest-800 text-white font-bold rounded-2xl shadow-md transition-all flex items-center space-x-2 text-xs sm:text-sm shrink-0"
          >
            <UserPlus className="w-4 h-4 text-amber-300" />
            <span>Add Staff Member</span>
          </button>
        </div>
      </div>

      {/* 2. Key Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-sand-200 shadow-xs">
          <div className="flex items-center justify-between text-forest-600 text-xs font-semibold">
            <span>Total Accounts</span>
            <Users className="w-4 h-4 text-forest-400" />
          </div>
          <div className="text-2xl font-serif font-bold text-forest-950 mt-1">
            {totalAccounts}
          </div>
          <span className="text-[10px] text-emerald-700 font-medium">
            {activeCount} currently active
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-emerald-200 shadow-xs">
          <div className="flex items-center justify-between text-emerald-800 text-xs font-semibold">
            <span>Admins</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-serif font-bold text-emerald-950 mt-1">
            {adminCount}
          </div>
          <span className="text-[10px] text-emerald-700">
            Full Financial & Staff Control
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-amber-200 shadow-xs">
          <div className="flex items-center justify-between text-amber-800 text-xs font-semibold">
            <span>Duty Managers</span>
            <UserCog className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-serif font-bold text-amber-950 mt-1">
            {managerCount}
          </div>
          <span className="text-[10px] text-amber-700">
            Front Desk & Operations
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-orange-200 shadow-xs">
          <div className="flex items-center justify-between text-orange-800 text-xs font-semibold">
            <span>Kitchen Staff</span>
            <ChefHat className="w-4 h-4 text-orange-600" />
          </div>
          <div className="text-2xl font-serif font-bold text-orange-950 mt-1">
            {kitchenCount}
          </div>
          <span className="text-[10px] text-orange-700">
            Dining Mandate & Live Orders
          </span>
        </div>
      </div>

      {/* 3. Role Access Matrix Explainer Banner */}
      <div className="bg-forest-900 text-white rounded-3xl p-5 sm:p-6 border border-forest-800 shadow-sm">
        <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-amber-300 mb-3">
          <Info className="w-4 h-4" />
          <span>Role-Based Access Control (RBAC) Architecture</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-forest-950/60 rounded-2xl p-3.5 border border-forest-700/60">
            <div className="flex items-center space-x-2 text-emerald-300 font-bold mb-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>Admin (Estate Owner)</span>
            </div>
            <p className="text-sand-300 text-[11px] leading-relaxed">
              Complete access to Tape Chart, Daily Operations, Live Orders, <strong className="text-white">Financial Ledger & P&L</strong>, and this <strong className="text-white">Staff Management portal</strong>.
            </p>
          </div>

          <div className="bg-forest-950/60 rounded-2xl p-3.5 border border-forest-700/60">
            <div className="flex items-center space-x-2 text-amber-300 font-bold mb-1.5">
              <UserCog className="w-4 h-4" />
              <span>Duty Manager</span>
            </div>
            <p className="text-sand-300 text-[11px] leading-relaxed">
              Manages Tape Chart, Check-ins/Check-outs, Housekeeping checklists, and Transport Dispatch. <strong className="text-rose-300">Strictly locked out</strong> of Financial Ledger, P&L, and Staff Management.
            </p>
          </div>

          <div className="bg-forest-950/60 rounded-2xl p-3.5 border border-forest-700/60">
            <div className="flex items-center space-x-2 text-orange-300 font-bold mb-1.5">
              <ChefHat className="w-4 h-4" />
              <span>Kitchen Staff</span>
            </div>
            <p className="text-sand-300 text-[11px] leading-relaxed">
              Streamlined Kitchen View: Daily Meal Plan headcounts (CP/MAP/AP tallies), live QR Food Orders queue, and In/Out of stock menu switches.
            </p>
          </div>
        </div>
      </div>

      {/* 4. Staff Accounts Directory */}
      <div className="bg-white rounded-3xl border border-sand-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-sand-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-forest-700" />
            <h2 className="font-serif font-bold text-base text-forest-950">
              Staff Accounts Directory
            </h2>
            <span className="text-[11px] bg-sand-100 text-forest-800 font-bold px-2 py-0.5 rounded-full">
              {staffAccounts.length}
            </span>
          </div>
        </div>

        <div className="divide-y divide-sand-100 overflow-x-auto">
          {staffAccounts.map((account) => {
            const roleInfo = roleConfig[account.role];
            const RoleIcon = roleInfo.icon;
            const isSelf = currentUser?.id === account.id;

            return (
              <div
                key={account.id}
                className={`p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors hover:bg-sand-50/50 ${
                  !account.isActive ? 'opacity-60 bg-gray-50/50' : ''
                }`}
              >
                {/* User Info Column */}
                <div className="flex items-start space-x-3.5">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center font-serif font-bold text-sm text-white shrink-0 shadow-xs ${
                      account.role === 'admin'
                        ? 'bg-emerald-800'
                        : account.role === 'manager'
                        ? 'bg-amber-800'
                        : 'bg-orange-800'
                    }`}
                  >
                    {account.fullName
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')}
                  </div>

                  <div>
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <h3 className="font-bold text-sm sm:text-base text-forest-950">
                        {account.fullName}
                      </h3>
                      {isSelf && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold px-2 py-0.5 rounded-full">
                          You (Current Session)
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center space-x-1 ${roleInfo.badgeClass}`}
                      >
                        <RoleIcon className="w-3 h-3" />
                        <span>{roleInfo.title}</span>
                      </span>
                      {account.isActive ? (
                        <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium px-2 py-0.5 rounded-full flex items-center space-x-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="text-[10px] bg-gray-100 text-gray-600 border border-gray-300 font-medium px-2 py-0.5 rounded-full">
                          Suspended
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-4 text-xs text-forest-700/80 mt-1 flex-wrap gap-y-1">
                      <div className="flex items-center space-x-1.5">
                        <Mail className="w-3.5 h-3.5 text-forest-400" />
                        <span className="font-mono text-[11px]">{account.email}</span>
                      </div>
                      {account.phone && (
                        <div className="flex items-center space-x-1.5">
                          <Phone className="w-3.5 h-3.5 text-forest-400" />
                          <span className="text-[11px]">{account.phone}</span>
                        </div>
                      )}
                      <div className="flex items-center space-x-1.5 text-forest-500">
                        <Lock className="w-3.5 h-3.5" />
                        <span className="text-[11px]">
                          Password: <code className="bg-sand-100 px-1.5 py-0.5 rounded text-[10px] font-mono">{account.password}</code>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions Column */}
                <div className="flex items-center space-x-2 self-end md:self-center shrink-0">
                  {/* Reset Password Button */}
                  <button
                    onClick={() => handleOpenResetPassword(account)}
                    className="min-h-[38px] px-3 py-1.5 text-xs font-semibold bg-sand-100 hover:bg-sand-200 text-forest-900 rounded-xl transition-colors flex items-center space-x-1.5"
                    title="Change or reset password"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-amber-700" />
                    <span>Reset Key</span>
                  </button>

                  {/* Edit Details */}
                  <button
                    onClick={() => handleOpenEditModal(account)}
                    className="min-h-[38px] px-3 py-1.5 text-xs font-semibold bg-sand-100 hover:bg-sand-200 text-forest-900 rounded-xl transition-colors flex items-center space-x-1.5"
                    title="Edit name, role or phone"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-forest-600" />
                    <span>Edit</span>
                  </button>

                  {/* Active / Inactive Toggle */}
                  <button
                    onClick={() => handleToggleStatus(account)}
                    disabled={isSelf}
                    className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors flex items-center space-x-1.5 ${
                      account.isActive
                        ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200'
                    } ${isSelf ? 'opacity-40 cursor-not-allowed' : ''}`}
                    title={account.isActive ? 'Deactivate account' : 'Activate account'}
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>{account.isActive ? 'Suspend' : 'Activate'}</span>
                  </button>

                  {/* Delete Button */}
                  <button
                    onClick={() => setDeleteConfirmStaff(account)}
                    disabled={isSelf}
                    className={`min-h-[38px] p-2 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-xl transition-colors ${
                      isSelf ? 'opacity-30 cursor-not-allowed' : ''
                    }`}
                    title="Delete staff account"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. ADD STAFF MODAL */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-950/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full border border-sand-300 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-forest-900 text-white px-6 py-5 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-forest-800 flex items-center justify-center">
                  <UserPlus className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base">Add New Staff Account</h3>
                  <p className="text-[11px] text-sand-300">
                    Create credentials for an employee to access Savera Homestay
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                aria-label="Close"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-sand-200 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-forest-900 block mb-1">
                  Full Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pemba Sherpa"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-sand-300 bg-sand-50/50 focus:ring-1 focus:ring-forest-800"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-forest-900 block mb-1">
                    Email / Login ID <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. pemba@saverahomestay.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-sand-300 bg-sand-50/50 focus:ring-1 focus:ring-forest-800"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-forest-900 block mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 81012 98882"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-sand-300 bg-sand-50/50 focus:ring-1 focus:ring-forest-800"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-forest-900">
                    Initial Password <span className="text-rose-600">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const randomPass = 'wp' + Math.floor(100000 + Math.random() * 900000);
                      setNewPassword(randomPass);
                    }}
                    className="text-[10px] text-amber-700 hover:text-amber-800 font-semibold flex items-center space-x-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Auto-Generate</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full text-xs p-3 pr-10 rounded-xl border border-sand-300 bg-sand-50/50 font-mono focus:ring-1 focus:ring-forest-800"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-forest-700"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-forest-900 block mb-2">
                  System Role & RBAC Permissions <span className="text-rose-600">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['admin', 'manager', 'kitchen_staff'] as StaffRole[]).map((r) => {
                    const info = roleConfig[r];
                    const Icon = info.icon;
                    const isSelected = newRole === r;

                    return (
                      <button
                        type="button"
                        key={r}
                        onClick={() => setNewRole(r)}
                        className={`p-3 rounded-2xl border text-left flex flex-col items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-forest-900 text-white border-forest-900 shadow-sm'
                            : 'bg-sand-50 hover:bg-sand-100 text-forest-900 border-sand-300'
                        }`}
                      >
                        <Icon className={`w-5 h-5 mb-1 ${isSelected ? 'text-amber-300' : 'text-forest-600'}`} />
                        <span className="text-xs font-bold">{info.title.split(' ')[0]}</span>
                        <span className={`text-[9px] mt-0.5 text-center ${isSelected ? 'text-sand-300' : 'text-forest-600'}`}>
                          {r === 'admin' ? 'All Modules' : r === 'manager' ? 'Ops & Desk' : 'Kitchen View'}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 p-2.5 bg-sand-50 rounded-xl text-[11px] text-forest-700 border border-sand-200">
                  <span className="font-semibold">Role Scope:</span> {roleConfig[newRole].desc}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-sand-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-forest-800 hover:bg-sand-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold bg-forest-900 hover:bg-forest-800 text-white rounded-xl shadow-md transition-all flex items-center space-x-1.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Create Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. EDIT STAFF MODAL */}
      {editingStaff && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-950/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setEditingStaff(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full border border-sand-300 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-forest-900 text-white px-6 py-5 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-forest-800 flex items-center justify-center">
                  <Edit2 className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base">Edit Staff Profile</h3>
                  <p className="text-[11px] text-sand-300">{editingStaff.fullName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                aria-label="Close"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-sand-200 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {editError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs">
                  {editError}
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-forest-900 block mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-sand-300 bg-sand-50/50"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-forest-900 block mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-sand-300 bg-sand-50/50"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-forest-900 block mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-sand-300 bg-sand-50/50"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-forest-900 block mb-2">
                  System Role
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['admin', 'manager', 'kitchen_staff'] as StaffRole[]).map((r) => {
                    const info = roleConfig[r];
                    const Icon = info.icon;
                    const isSelected = editRole === r;

                    return (
                      <button
                        type="button"
                        key={r}
                        onClick={() => setEditRole(r)}
                        className={`p-2.5 rounded-xl border text-center flex flex-col items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-forest-900 text-white border-forest-900'
                            : 'bg-sand-50 hover:bg-sand-100 text-forest-900 border-sand-300'
                        }`}
                      >
                        <Icon className={`w-4 h-4 mb-1 ${isSelected ? 'text-amber-300' : 'text-forest-600'}`} />
                        <span className="text-xs font-bold">{info.title.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-sand-200">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-4 py-2 text-xs font-bold text-forest-800 hover:bg-sand-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold bg-forest-900 hover:bg-forest-800 text-white rounded-xl shadow-md"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. RESET PASSWORD MODAL */}
      {passwordResetStaff && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-950/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setPasswordResetStaff(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-sm w-full border border-sand-300 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-forest-900 text-white px-6 py-5 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-forest-800 flex items-center justify-center">
                  <KeyRound className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-base">Reset Password</h3>
                  <p className="text-[11px] text-sand-300">{passwordResetStaff.fullName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPasswordResetStaff(null)}
                aria-label="Close"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-sand-200 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="p-6 space-y-4">
              {resetError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs">
                  {resetError}
                </div>
              )}

              <div>
                <span className="text-xs text-forest-700 block mb-1">
                  Updating password for <strong>{passwordResetStaff.email}</strong>
                </span>
                <div className="flex items-center justify-between mb-1 mt-3">
                  <label className="text-xs font-bold text-forest-900">
                    New Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const pass = 'pass' + Math.floor(100000 + Math.random() * 900000);
                      setNewResetPassword(pass);
                    }}
                    className="text-[10px] text-amber-700 hover:text-amber-800 font-semibold flex items-center space-x-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Auto-Suggest</span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter new password (min 6 chars)"
                    value={newResetPassword}
                    onChange={(e) => setNewResetPassword(e.target.value)}
                    className="w-full text-xs p-3 pr-10 rounded-xl border border-sand-300 bg-sand-50/50 font-mono focus:ring-1 focus:ring-forest-800"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-forest-700"
                  >
                    {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-sand-200">
                <button
                  type="button"
                  onClick={() => setPasswordResetStaff(null)}
                  className="px-4 py-2 text-xs font-bold text-forest-800 hover:bg-sand-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold bg-forest-900 hover:bg-forest-800 text-white rounded-xl shadow-md"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. DELETE CONFIRM MODAL */}
      {deleteConfirmStaff && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-950/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setDeleteConfirmStaff(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-sm w-full border border-sand-300 shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setDeleteConfirmStaff(null)}
              aria-label="Close"
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-sand-100 hover:bg-sand-200 text-forest-700 flex items-center justify-center transition-all cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="font-serif font-bold text-lg text-forest-950">
                Remove Staff Account?
              </h3>
              <p className="text-xs text-forest-700/80 mt-1">
                Are you sure you want to delete the account for{' '}
                <strong>{deleteConfirmStaff.fullName}</strong> ({deleteConfirmStaff.email})?
                This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmStaff(null)}
                className="flex-1 py-2.5 text-xs font-bold text-forest-800 bg-sand-100 hover:bg-sand-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-xl shadow-md transition-colors cursor-pointer"
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
