import { CheckCircle, AlertCircle, AlertTriangle, XCircle, Info } from 'lucide-react';
import type { ConfidenceIssue } from '../../types';

interface Props {
  score: number;
  issues: ConfidenceIssue[];
  showDetails?: boolean;
}

export function ConfidenceScoreDisplay({ score, issues, showDetails = true }: Props) {
  const getLevelInfo = () => {
    if (score >= 90) {
      return {
        label: 'Fully Detected',
        icon: CheckCircle,
        color: 'text-emerald-600',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        description: 'All fields detected with high confidence',
      };
    }
    if (score >= 70) {
      return {
        label: 'Review Recommended',
        icon: AlertCircle,
        color: 'text-blue-600',
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        description: 'Most fields detected, review suggested',
      };
    }
    if (score >= 50) {
      return {
        label: 'Manual Mapping Required',
        icon: AlertTriangle,
        color: 'text-amber-600',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        description: 'Several fields need manual attention',
      };
    }
    return {
      label: 'Critical - Review Required',
      icon: XCircle,
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-200',
      description: 'Significant issues detected, manual intervention needed',
    };
  };

  const { label, icon: Icon, color, bg, border, description } = getLevelInfo();

  const criticalIssues = issues.filter(i => i.severity === 'critical');
  const warningIssues = issues.filter(i => i.severity === 'warning');
  const infoIssues = issues.filter(i => i.severity === 'info');

  return (
    <div className={`${bg} border ${border} rounded-xl p-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${bg}`}>
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-bold ${color}`}>{score}%</span>
              <span className={`text-sm font-medium ${color}`}>{label}</span>
            </div>
            <p className="text-sm text-slate-600 mt-0.5">{description}</p>
          </div>
        </div>

        {/* Score gauge */}
        <div className="flex-shrink-0">
          <div className="w-16 h-16 relative">
            <svg className="w-16 h-16 transform -rotate-90">
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="#e5e7eb"
                strokeWidth="6"
                fill="none"
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke={score >= 90 ? '#10b981' : score >= 70 ? '#3b82f6' : score >= 50 ? '#f59e0b' : '#ef4444'}
                strokeWidth="6"
                fill="none"
                strokeDasharray={`${(score / 100) * 175.9} 175.9`}
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>

      {showDetails && issues.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-200">
          {criticalIssues.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5" />
                Critical Issues
              </p>
              <ul className="space-y-1">
                {criticalIssues.map((issue, idx) => (
                  <li key={idx} className="text-sm text-red-700 flex items-start gap-2">
                    <span className="text-red-400 mt-1">-</span>
                    <span><strong>{issue.field}:</strong> {issue.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {warningIssues.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Warnings
              </p>
              <ul className="space-y-1">
                {warningIssues.map((issue, idx) => (
                  <li key={idx} className="text-sm text-amber-700 flex items-start gap-2">
                    <span className="text-amber-400 mt-1">-</span>
                    <span><strong>{issue.field}:</strong> {issue.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {infoIssues.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                Additional Notes
              </p>
              <ul className="space-y-1">
                {infoIssues.map((issue, idx) => (
                  <li key={idx} className="text-sm text-slate-600 flex items-start gap-2">
                    <span className="text-slate-300 mt-1">-</span>
                    <span>{issue.field}: {issue.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
