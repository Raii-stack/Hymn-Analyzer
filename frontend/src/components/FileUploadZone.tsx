import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File, Image as ImageIcon, CheckCircle2, X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface FileUploadZoneProps {
  label: string;
  accept: Record<string, string[]>;
  icon: 'pdf' | 'image';
  file: File | null;
  onFileSelect: (file: File | null) => void;
  className?: string;
}

export function FileUploadZone({ label, accept, icon, file, onFileSelect, className }: FileUploadZoneProps) {
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles.length > 0) {
      setError(`Invalid file type. Please upload a ${icon === 'pdf' ? 'PDF' : 'valid image'}.`);
      return;
    }
    setError(null);
    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0]);
    }
  }, [icon, onFileSelect]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept,
    maxFiles: 1,
    multiple: false
  });

  const IconComponent = icon === 'pdf' ? File : ImageIcon;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span className="text-sm font-medium text-neutral-300 ml-1">{label}</span>
      <div
        {...getRootProps()}
        className={cn(
          "relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-200 ease-in-out min-h-[140px]",
          isDragActive ? "border-yellow-500 bg-yellow-500/10" : "border-yellow-900/40 bg-neutral-900/50 hover:bg-neutral-900 hover:border-yellow-700/60",
          isDragReject && "border-red-500 bg-red-500/10",
          file && "border-green-600/50 bg-green-900/10 hover:border-green-500/80"
        )}
      >
        <input {...getInputProps()} />
        
        {file ? (
          <div className="flex flex-col items-center gap-3 w-full">
            <div className="relative">
              <IconComponent className="w-10 h-10 text-green-500" />
              <CheckCircle2 className="w-4 h-4 text-green-400 absolute -bottom-1 -right-1 bg-neutral-900 rounded-full" />
            </div>
            <div className="flex flex-col items-center text-center px-4 overflow-hidden w-full">
              <p className="text-sm font-medium text-neutral-200 truncate w-full" title={file.name}>
                {file.name}
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFileSelect(null);
              }}
              className="absolute top-2 right-2 p-1 text-neutral-500 hover:text-red-400 hover:bg-neutral-800 rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-neutral-400">
            <UploadCloud className={cn("w-10 h-10 transition-colors", isDragActive ? "text-yellow-400" : "text-yellow-600/50")} />
            <div className="text-center">
              <p className="text-sm font-medium text-neutral-300">
                <span className="text-yellow-500">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                {icon === 'pdf' ? 'PDF files only' : 'PNG, JPG or JPEG'}
              </p>
            </div>
          </div>
        )}
      </div>
      {error && <span className="text-xs text-red-400 ml-1">{error}</span>}
    </div>
  );
}
