import React, { useCallback, useState } from 'react';
import { Upload, AlertCircle } from 'lucide-react';

interface UploadPDFProps {
  onUpload: (file: File) => void;
}

export const UploadPDF: React.FC<UploadPDFProps> = ({ onUpload }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setUploading(true);

      console.log('UploadPDF: Processing file...');
      console.log('UploadPDF: File name:', file.name);
      console.log('UploadPDF: File type:', file.type);
      console.log('UploadPDF: File size:', file.size);

      // Validate file type
      if (file.type !== 'application/pdf') {
        setError(`Invalid file type: ${file.type}. Please upload a PDF file.`);
        setUploading(false);
        return;
      }

      // Validate file size (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        setError('File is too large. Maximum size is 50MB.');
        setUploading(false);
        return;
      }

      // Quick validation: read first 5 bytes to check PDF header
      try {
        const headerBuffer = await file.slice(0, 5).arrayBuffer();
        const header = String.fromCharCode.apply(null, Array.from(new Uint8Array(headerBuffer)));
        console.log('UploadPDF: File header:', header);

        if (!header.startsWith('%PDF-')) {
          setError('This does not appear to be a valid PDF file.');
          setUploading(false);
          return;
        }

        console.log('UploadPDF: Calling onUpload callback with File object...');
        onUpload(file);
        console.log('UploadPDF: Upload complete');

      } catch (err) {
        console.error('UploadPDF: Error reading PDF header:', err);
        setError(`Failed to read the PDF file: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setUploading(false);
      }
    },
    [onUpload]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      console.log('UploadPDF: Files dropped');
      const files = e.dataTransfer.files;
      console.log('UploadPDF: Number of files:', files.length);

      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      console.log('UploadPDF: File input changed');
      console.log('UploadPDF: Files selected:', files?.length || 0);

      if (files && files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile]
  );

  return (
    <div className="p-8">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold text-slate-800 mb-2">
            Upload Supplier Bill
          </h2>
          <p className="text-slate-600">
            Upload a digital PDF invoice from your supplier.
            <br />
            The system will let you teach it which values to import.
          </p>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${
            isDragging
              ? 'border-emerald-500 bg-emerald-50 scale-[1.02]'
              : 'border-slate-300 hover:border-emerald-400 hover:bg-slate-50'
          } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <div className="flex flex-col items-center">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                isDragging ? 'bg-emerald-100' : 'bg-slate-100'
              }`}
            >
              {uploading ? (
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
              ) : (
                <Upload
                  className={`w-8 h-8 ${
                    isDragging ? 'text-emerald-600' : 'text-slate-400'
                  }`}
                />
              )}
            </div>
            <p className="text-lg font-medium text-slate-700 mb-2">
              {uploading ? 'Processing...' : 'Drop your PDF here'}
            </p>
            {!uploading && (
              <>
                <p className="text-slate-500 mb-4">or</p>
                <label className="cursor-pointer">
                  <span className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors inline-block">
                    Browse Files
                  </span>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileInput}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-800 font-medium">Upload Error</p>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Info Card */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-blue-800 font-medium mb-2">How it works</h3>
          <ul className="text-blue-700 text-sm space-y-1">
            <li>1. Upload a digital PDF (no scanned images)</li>
            <li>2. View and zoom the PDF pages</li>
            <li>3. Click on text values to teach the system</li>
            <li>4. Review and edit the extracted products</li>
            <li>5. Match products to your catalog</li>
            <li>6. Confirm and update inventory</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
