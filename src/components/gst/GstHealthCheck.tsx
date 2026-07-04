import React from 'react';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
} from 'lucide-react';
import { ValidationResult, ValidationIssue } from '../../utils/gstReports';

interface GstHealthCheckProps {
  validationResult: ValidationResult;
  onViewInvoices: (issue: ValidationIssue) => void;
}

export const GstHealthCheck: React.FC<GstHealthCheckProps> = ({
  validationResult,
  onViewInvoices,
}) => {
  const { issues, healthyCount, warningCount, errorCount, overallStatus } = validationResult;

  const getStatusIcon = () => {
    switch (overallStatus) {
      case 'healthy':
        return <ShieldCheck className="w-6 h-6 text-emerald-500" />;
      case 'warnings':
        return <ShieldAlert className="w-6 h-6 text-amber-500" />;
      case 'needs_attention':
        return <ShieldX className="w-6 h-6 text-red-500" />;
    }
  };

  const getStatusColor = () => {
    switch (overallStatus) {
      case 'healthy':
        return 'bg-emerald-50 border-emerald-200';
      case 'warnings':
        return 'bg-amber-50 border-amber-200';
      case 'needs_attention':
        return 'bg-red-50 border-red-200';
    }
  };

  const getStatusText = () => {
    switch (overallStatus) {
      case 'healthy':
        return { title: 'All Checks Passed', subtitle: 'Your GST data is healthy', textColor: 'text-emerald-700' };
      case 'warnings':
        return { title: 'Warnings Found', subtitle: 'Some issues need attention', textColor: 'text-amber-700' };
      case 'needs_attention':
        return { title: 'Issues Found', subtitle: 'Please review and fix errors', textColor: 'text-red-700' };
    }
  };

  const statusText = getStatusText();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className={`px-4 py-3 border-b ${getStatusColor()}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div>
              <h3 className={`font-semibold ${statusText.textColor}`}>GST Health Check</h3>
              <p className={`text-xs ${statusText.textColor} opacity-80`}>{statusText.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-emerald-600 font-medium">{healthyCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-amber-600 font-medium">{warningCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5 text-red-500" />
              <span className="text-red-600 font-medium">{errorCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Validation Cards Grid */}
      <div className="p-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10 gap-2">
          {issues.map((issue) => (
            <ValidationCard
              key={issue.id}
              issue={issue}
              onViewInvoices={() => onViewInvoices(issue)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// Individual Validation Card Component
interface ValidationCardProps {
  issue: ValidationIssue;
  onViewInvoices: () => void;
}

const ValidationCard: React.FC<ValidationCardProps> = ({ issue, onViewInvoices }) => {
  const getSeverityStyles = () => {
    switch (issue.severity) {
      case 'success':
        return {
          bg: 'bg-emerald-50',
          border: 'border-emerald-200',
          icon: <CheckCircle className="w-4 h-4 text-emerald-500" />,
          badge: 'bg-emerald-100 text-emerald-700',
          hover: 'hover:border-emerald-300 hover:bg-emerald-100',
        };
      case 'warning':
        return {
          bg: 'bg-amber-50',
          border: 'border-amber-200',
          icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
          badge: 'bg-amber-100 text-amber-700',
          hover: 'hover:border-amber-300 hover:bg-amber-100',
        };
      case 'error':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          icon: <XCircle className="w-4 h-4 text-red-500" />,
          badge: 'bg-red-100 text-red-700',
          hover: 'hover:border-red-300 hover:bg-red-100',
        };
    }
  };

  const styles = getSeverityStyles();
  const hasIssues = issue.affectedCount > 0;

  return (
    <div
      className={`${styles.bg} ${styles.border} ${styles.hover} border rounded-lg p-2.5 transition-all cursor-pointer group`}
      onClick={hasIssues ? onViewInvoices : undefined}
      title={issue.description}
    >
      <div className="flex items-start justify-between mb-1.5">
        {styles.icon}
        {hasIssues && (
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${styles.badge}`}>
            {issue.affectedCount}
          </span>
        )}
      </div>
      <p className="text-xs font-medium text-slate-700 leading-tight line-clamp-2">
        {issue.name}
      </p>
      {hasIssues && (
        <button
          className="mt-2 flex items-center gap-1 text-xs text-slate-500 group-hover:text-slate-700 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onViewInvoices();
          }}
        >
          <span>View</span>
          <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};
