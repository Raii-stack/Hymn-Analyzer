import { useCallback, useState } from 'react';
import { Upload, X, FileCheck } from 'lucide-react';
import { cn } from './ui/utils';

// Color scheme
const colors = {
  BG: '#080603',
  SURFACE: '#120e06',
  ACCENT: '#bc9106',
  GOLD: '#cfa726',
  SECONDARY: '#735b0c',
  TEXT: '#f8f6ed',
  SUBTEXT: '#a6a292',
  SUCCESS: '#4caf50'
};

interface FileDropzoneProps {
  onFileSelect: (file: File | null) => void;
  accept?: Record<string, string[]>;
  icon?: React.ReactNode;
  label?: string;
  file?: File | null;
}

export function FileDropzone({ 
  onFileSelect, 
  accept, 
  icon, 
  label = "Drop file here or click to browse",
  file 
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      onFileSelect(droppedFile);
      e.dataTransfer.clearData();
    }
  }, [onFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  }, [onFileSelect]);

  const handleRemoveFile = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onFileSelect(null);
  }, [onFileSelect]);

  const acceptString = accept 
    ? Object.entries(accept)
        .map(([mimeType, extensions]) => `${mimeType},${extensions.join(',')}`)
        .join(',')
    : undefined;

  return (
    <div
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className="relative border-2 border-dashed rounded-lg p-4 sm:p-6 md:p-8 transition-all cursor-pointer"
      style={{
        borderColor: isDragging ? colors.GOLD : file ? colors.SUCCESS : colors.SECONDARY,
        backgroundColor: isDragging ? `${colors.GOLD}15` : file ? `${colors.SUCCESS}15` : colors.BG
      }}
      onClick={() => document.getElementById(`file-input-${label}`)?.click()}
    >
      <input
        id={`file-input-${label}`}
        type="file"
        className="hidden"
        accept={acceptString}
        onChange={handleFileInput}
      />

      {file ? (
        <div className="flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <FileCheck className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 flex-shrink-0" style={{ color: colors.SUCCESS }} />
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate text-sm sm:text-base" style={{ color: colors.TEXT }}>{file.name}</p>
              <p className="text-xs sm:text-sm" style={{ color: colors.SUBTEXT }}>
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
          <button
            onClick={handleRemoveFile}
            className="p-2 rounded-full transition-colors flex-shrink-0"
            style={{ backgroundColor: 'transparent' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.SECONDARY}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: colors.SUBTEXT }} />
          </button>
        </div>
      ) : (
        <div className="text-center">
          <div className="flex justify-center mb-3 sm:mb-4" style={{ color: colors.SUBTEXT }}>
            {icon || <Upload className="w-10 h-10 sm:w-12 sm:h-12" />}
          </div>
          <p className="mb-1 sm:mb-2 text-sm sm:text-base" style={{ color: colors.TEXT }}>{label}</p>
          <p className="text-xs sm:text-sm" style={{ color: colors.SUBTEXT }}>
            {isDragging ? "Drop it!" : "Drag and drop or click to browse"}
          </p>
        </div>
      )}
    </div>
  );
}