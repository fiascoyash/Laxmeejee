import { useMemo } from 'react';
import type { ImportPreviewRow, ImportValidationSummary as ValidationSummary } from '../../types';
import {
  Package,
  CheckCircle,
  Plus,
  Copy,
  AlertTriangle,
  Hash,
  Percent,
  ShoppingBag,
  IndianRupee,
} from 'lucide-react';

interface Props {
  rows: ImportPreviewRow[];
  existingProducts: Map<string, boolean>; // productId -> exists in catalog
}

export function ImportValidationSummary({ rows, existingProducts }: Props) {
  const summary = useMemo<ValidationSummary>(() => {
    const totalProducts = rows.filter(r => r.decision !== 'skip').length;
    const matchedProducts = rows.filter(r => r.decision === 'match_existing').length;
    const newProducts = rows.filter(r => r.decision === 'create_new').length;

    // Products that appear multiple times in the import (potentially duplicated within this import)
    const seenProducts = new Map<string, number>();
    rows.forEach(r => {
      if (r.decision === 'match_existing' && r.selectedCandidateId) {
        const count = seenProducts.get(r.selectedCandidateId) || 0;
        seenProducts.set(r.selectedCandidateId, count + 1);
      }
    });
    const duplicateProducts = Array.from(seenProducts.values()).filter(c => c > 1).length;

    const missingHsn = rows.filter(r =>
      r.decision !== 'skip' && !r.hsnSac && (!r.resolvedProduct || !r.resolvedProduct.hsnSacCode)
    ).length;

    const missingGst = rows.filter(r =>
      r.decision !== 'skip' && r.gstPercent === 0 && (!r.resolvedProduct || r.resolvedProduct.gstPercent === 0)
    ).length;

    const missingQty = rows.filter(r =>
      r.decision !== 'skip' && r.quantity <= 0
    ).length;

    const missingPrice = rows.filter(r =>
      r.decision !== 'skip' && r.purchasePrice <= 0
    ).length;

    const warnings = rows.filter(r => r.warnings.length > 0).length;

    return {
      totalProducts,
      matchedProducts,
      newProducts,
      duplicateProducts,
      missingHsn,
      missingGst,
      missingQty,
      missingPrice,
      warnings,
    };
  }, [rows, existingProducts]);

  const hasIssues = summary.missingHsn > 0 || summary.missingGst > 0 ||
    summary.missingQty > 0 || summary.missingPrice > 0 || summary.duplicateProducts > 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
        <Package className="w-4 h-4 text-emerald-600" />
        Import Validation Summary
      </h3>

      {/* Main stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatCard
          icon={<Package className="w-4 h-4" />}
          label="Products Found"
          value={rows.length}
          color="slate"
        />
        <StatCard
          icon={<CheckCircle className="w-4 h-4" />}
          label="Matched"
          value={summary.matchedProducts}
          color="emerald"
        />
        <StatCard
          icon={<Plus className="w-4 h-4" />}
          label="New Products"
          value={summary.newProducts}
          color="blue"
        />
        <StatCard
          icon={<Copy className="w-4 h-4" />}
          label="Duplicates"
          value={summary.duplicateProducts}
          color={summary.duplicateProducts > 0 ? 'amber' : 'slate'}
        />
      </div>

      {/* Issues section */}
      <div className="border-t border-slate-200 pt-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Issues to Review
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <IssuePill
            icon={<Hash className="w-3.5 h-3.5" />}
            label="Missing HSN"
            count={summary.missingHsn}
          />
          <IssuePill
            icon={<Percent className="w-3.5 h-3.5" />}
            label="Missing GST"
            count={summary.missingGst}
          />
          <IssuePill
            icon={<ShoppingBag className="w-3.5 h-3.5" />}
            label="Missing Qty"
            count={summary.missingQty}
          />
          <IssuePill
            icon={<IndianRupee className="w-3.5 h-3.5" />}
            label="Missing Price"
            count={summary.missingPrice}
          />
        </div>
      </div>

      {/* Overall status */}
      {!hasIssues && summary.warnings === 0 && (
        <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <p className="text-sm text-emerald-700">
            All products are ready for import. No issues detected.
          </p>
        </div>
      )}

      {hasIssues && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              Some issues need your attention
            </p>
            <p className="text-xs text-amber-700 mt-1">
              Products with missing fields will still be imported, but you may want to review them.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'slate' | 'emerald' | 'blue' | 'amber';
}) {
  const colors = {
    slate: 'text-slate-600 bg-slate-50',
    emerald: 'text-emerald-600 bg-emerald-50',
    blue: 'text-blue-600 bg-blue-50',
    amber: 'text-amber-600 bg-amber-50',
  };

  return (
    <div className={`p-3 rounded-lg ${colors[color]}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <p className="text-xs text-slate-500">{label}</p>
      </div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

function IssuePill({
  icon,
  label,
  count,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  const hasIssue = count > 0;

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
      hasIssue
        ? 'bg-amber-50 border border-amber-200'
        : 'bg-slate-50 border border-slate-200'
    }`}>
      <div className={hasIssue ? 'text-amber-600' : 'text-slate-400'}>
        {icon}
      </div>
      <div className="flex-1">
        <p className={`text-xs ${hasIssue ? 'text-amber-700' : 'text-slate-500'}`}>
          {label}
        </p>
      </div>
      {hasIssue && (
        <span className="px-1.5 py-0.5 text-xs font-semibold bg-amber-200 text-amber-800 rounded">
          {count}
        </span>
      )}
    </div>
  );
}
