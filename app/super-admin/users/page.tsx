import Link from 'next/link';
import { getAdminUserRows } from '@/lib/admin-data';

import { Search, Shield, ChevronRight } from 'lucide-react';

// I will make a standard page with search client-side
export default async function SuperAdminUsersPage() {
  const users = await getAdminUserRows();

  return (
    <div className="p-6 md:p-10 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Users</h1>
          <p className="text-slate-400 mt-1 text-sm md:text-base font-semibold">
            Manage system users, workspaces, and plans.
          </p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50">
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Workspace</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Plan</th>
<th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Payment Status</th>
<th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Renewal Date</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-800/20 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold border border-slate-700">
                        {user.firstName[0]}{user.lastName[0]}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                          {user.name}
                          {user.systemRole === 'SUPER_ADMIN' && (
                            <Shield className="w-3.5 h-3.5 text-amber-400" />
                          )}
                        </div>
                        <div className="text-xs text-slate-400 font-semibold">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.workspace ? (
                      <div>
                        <div className="text-sm font-bold text-slate-200">{user.workspace.name}</div>
                        <div className="text-xs text-slate-500 font-semibold">{user.workspace.slug}</div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500 font-bold">No Workspace</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-black text-indigo-400">{user.currentPlan}</div>
                    <div className="text-xs text-slate-500 font-bold uppercase">{user.subscriptionStatus}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black ${
                      user.status === 'ACTIVE'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : user.status === 'SUSPENDED'
                        ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                        : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <Link
                      href={`/super-admin/users/${user.id}`}
                      className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-400 hover:text-indigo-400 transition-colors"
                    >
                      <span>Manage</span>
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-semibold text-sm">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

