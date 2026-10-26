import 'jspdf';

declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: {
      finalY: number;
    };
  }
}

declare module 'jspdf-autotable' {
  import jsPDF from 'jspdf';

  interface TableStyles {
    fillColor?: number[];
    textColor?: number[];
    fontStyle?: string;
    fontSize?: number;
    halign?: 'left' | 'center' | 'right';
  }

  interface UserOptions {
    startY?: number;
    head?: (string | number)[][];
    body?: (string | number)[][];
    theme?: 'striped' | 'grid' | 'plain';
    headStyles?: TableStyles;
    bodyStyles?: TableStyles;
    columnStyles?: Record<string, { cellWidth?: number; halign?: 'left' | 'center' | 'right' }>;
    margin?: { left?: number; right?: number; top?: number; bottom?: number };
    tableWidth?: 'auto' | 'wrap' | number;
  }

  function autoTable(doc: jsPDF, options: UserOptions): void;

  export default autoTable;
}
