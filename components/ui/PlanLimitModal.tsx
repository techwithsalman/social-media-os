import React from 'react';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export function PlanLimitModal({ isOpen, onClose, feature, limit, plan, message }: any) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-[#1c1c24] border border-[#33333e] rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center gap-3 mb-4 text-red-400">
          <ShieldCheck className="w-8 h-8" />
          <h2 className="text-xl font-bold">Plan Limit Reached</h2>
        </div>
        <p className="text-gray-300 mb-6">
          {message || `You have reached your limit for ${feature} on the ${plan} plan.`}
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <Link
            href="/billing"
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold rounded-lg transition-colors"
          >
            Upgrade Plan <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
