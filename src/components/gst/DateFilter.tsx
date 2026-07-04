import React from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { DateFilterType, DateRange, getDateRange } from '../../utils/gstReports';

interface DateFilterProps {
  filterType: DateFilterType;
  customRange: DateRange;
  onFilterChange: (type: DateFilterType) => void;
  onCustomRangeChange: (range: DateRange) => void;
}

export const DateFilter: React.FC<DateFilterProps> = ({
  filterType,
  customRange,
  onFilterChange,
  onCustomRangeChange,
}) => {
  const filterOptions: { value: DateFilterType; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'this_month', label: 'This Month' },
    { value: 'last_month', label: 'Last Month' },
    { value: 'financial_year', label: 'Financial Year' },
    { value: 'custom', label: 'Custom Date' },
  ];

  const handlePresetChange = (type: DateFilterType) => {
    onFilterChange(type);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-slate-600">
          <Calendar className="w-5 h-5" />
          <span className="text-sm font-medium">Date Filter:</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handlePresetChange(option.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filterType === option.value && option.value !== 'custom'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {filterType === 'custom' && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="startDate" className="text-sm text-slate-600">From:</label>
            <input
              type="date"
              id="startDate"
              value={customRange.startDate}
              onChange={(e) => onCustomRangeChange({ ...customRange, startDate: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="endDate" className="text-sm text-slate-600">To:</label>
            <input
              type="date"
              id="endDate"
              value={customRange.endDate}
              onChange={(e) => onCustomRangeChange({ ...customRange, endDate: e.target.value })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>
      )}
    </div>
  );
};
