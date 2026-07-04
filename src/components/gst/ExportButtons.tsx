import React from 'react';
import { FileDown, FileSpreadsheet, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ExportButtonsProps {
  data: any[];
  reportName: string;
  columns: { header: string; key: string }[];
}

export const ExportButtons: React.FC<ExportButtonsProps> = ({ data, reportName, columns }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const exportToCSV = () => {
    const csvData = data.map((row) => {
      const csvRow: Record<string, string> = {};
      columns.forEach((col) => {
        const value = row[col.key];
        if (typeof value === 'number') {
          csvRow[col.header] = value.toFixed(2);
        } else {
          csvRow[col.header] = String(value || '');
        }
      });
      return csvRow;
    });

    const ws = XLSX.utils.json_to_sheet(csvData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `${reportName.replace(/\s+/g, '_')}.csv`);
  };

  const exportToExcel = () => {
    const worksheetData = data.map((row) => {
      const excelRow: Record<string, string | number> = {};
      columns.forEach((col) => {
        const value = row[col.key];
        excelRow[col.header] = value || 0;
      });
      return excelRow;
    });

    const ws = XLSX.utils.json_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `${reportName.replace(/\s+/g, '_')}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text(reportName, pageWidth / 2, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, pageWidth / 2, 22, { align: 'center' });

    const tableColumn = columns.map((col) => col.header);
    const tableRows = data.map((row) =>
      columns.map((col) => {
        const value = row[col.key];
        if (typeof value === 'number') {
          return formatCurrency(value);
        }
        return String(value || '');
      })
    );

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 28,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    doc.save(`${reportName.replace(/\s+/g, '_')}.pdf`);
  };

  if (data.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={exportToPDF}
        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
      >
        <FileDown className="w-4 h-4" />
        PDF
      </button>
      <button
        onClick={exportToExcel}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
      >
        <FileSpreadsheet className="w-4 h-4" />
        Excel
      </button>
      <button
        onClick={exportToCSV}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
      >
        <FileText className="w-4 h-4" />
        CSV
      </button>
    </div>
  );
};
