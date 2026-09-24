'use client';

import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  Users,
  UserPlus,
  Shield,
  Check,
  X,
  Mail,
  CheckCircle2,
} from 'lucide-react';

interface MemberItem {
  id: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string | null;
  };
}

export default function TeamPage() {
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('EDITOR');
  const [inviting, setInviting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const fetchTeam = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/team');
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    try {
      setInviting(true);
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
          firstName: inviteEmail.split('@')[0],
        }),
      });

      if (res.ok) {
        setShowInviteModal(false);
        setInviteEmail('');
        setSuccessMessage('Invitation sent successfully!');
        setTimeout(() => setSuccessMessage(''), 3500);
        fetchTeam();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setInviting(false);
    }
  };

  const rolePermissions = [
    { role: 'OWNER', desc: 'Full workspace ownership, billing, account & team control', color: 'text-purple-400 bg-purple-500/10' },
    { role: 'ADMIN', desc: 'Can manage accounts, publishing, schedules, and members', color: 'text-indigo-400 bg-indigo-500/10' },
    { role: 'EDITOR', desc: 'Can create, edit, schedule, and publish content', color: 'text-emerald-400 bg-emerald-500/10' },
    { role: 'VIEWER', desc: 'Read-only access to calendar, content library, and analytics', color: 'text-slate-400 bg-slate-500/10' },
  ];

  return (
    <AppLayout title="Team & Permissions">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            Team Members ({members.length})
          </h1>
          <p className="text-sm md:text-base text-slate-400 mt-1.5">
            Manage multi-user access and role-based publishing controls for your workspace.
          </p>
        </div>

        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-bold shadow-lg shadow-indigo-600/30 transition-all"
        >
          <UserPlus className="w-4 h-4" />
          <span>Invite Member</span>
        </button>
      </div>

      {successMessage && (
        <div className="mb-8 p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-sm font-semibold flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Team Members List */}
      <div className="bg-[#0d1322] border border-slate-800 rounded-3xl p-6 md:p-8 shadow-md mb-10">
        <div className="divide-y divide-slate-800">
          {members.map((member) => (
            <div
              key={member.id}
              className="py-5 first:pt-0 last:pb-0 flex items-center justify-between gap-5"
            >
              <div className="flex items-center gap-4 overflow-hidden">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-base shrink-0 shadow-md">
                  {member.user.firstName?.charAt(0) || 'U'}
                </div>
                <div className="overflow-hidden">
                  <p className="text-base font-bold text-white truncate">
                    {member.user.firstName} {member.user.lastName}
                  </p>
                  <p className="text-xs md:text-sm text-slate-400 truncate mt-0.5">{member.user.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <span
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider ${
                    member.role === 'OWNER'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : member.role === 'ADMIN'
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                >
                  {member.role}
                </span>
                <span className="text-xs text-slate-400 hidden sm:inline font-semibold">
                  Joined {new Date(member.joinedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Roles & Permissions Matrix */}
      <div className="bg-[#0d1322] border border-slate-800 rounded-3xl p-6 md:p-8 shadow-md">
        <h3 className="text-base md:text-lg font-bold text-white mb-6 flex items-center gap-2.5 pb-4 border-b border-slate-800">
          <Shield className="w-5 h-5 text-indigo-400" />
          <span>Role Permissions Matrix</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {rolePermissions.map((rp) => (
            <div key={rp.role} className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800">
              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${rp.color}`}>
                {rp.role}
              </span>
              <p className="text-xs md:text-sm text-slate-300 mt-3 leading-relaxed">{rp.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* INVITE MODAL */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-lg bg-[#0d1322] border border-slate-800 rounded-3xl p-8 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
              <h4 className="text-base md:text-lg font-bold text-white">Invite Team Member</h4>
              <button onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInvite} className="space-y-5">
              <div>
                <label className="block text-xs md:text-sm font-bold text-slate-300 mb-2">Email Address</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="w-full p-3 text-sm bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs md:text-sm font-bold text-slate-300 mb-2">Workspace Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full p-3 text-sm bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="ADMIN">Admin (Full Management)</option>
                  <option value="EDITOR">Editor (Create & Publish)</option>
                  <option value="VIEWER">Viewer (Read-Only)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3.5 pt-4">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-5 py-2.5 text-sm font-semibold text-slate-400 hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-md disabled:opacity-50"
                >
                  {inviting ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
