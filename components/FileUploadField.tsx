import React, { useRef, useState } from 'react';
import { Upload, X, FileText, CheckCircle2 } from 'lucide-react';
import { UploadedFile, FileCategory } from '../types';

interface FileUploadFieldProps {
  category: FileCategory;
  label: string;
  required?: boolean;
  uploadedFile?: UploadedFile;
  onUpload: (file: File, category: FileCategory) => void;
  onRemove: (category: FileCategory) => void;
  accept?: string;
}

export const FileUploadField: React.FC<FileUploadFieldProps> = ({
  category,
  label,
  required = false,
  uploadedFile,
  onUpload,
  onRemove,
  accept = ".pdf,.csv,.xlsx,.xls"
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndUpload(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndUpload(e.target.files[0]);
    }
  };

  const validateAndUpload = (file: File) => {
    // Max 25MB
    if (file.size > 25 * 1024 * 1024) {
      alert("File is too large. Max 25MB allowed.");
      return;
    }
    onUpload(file, category);
  };

  if (uploadedFile) {
    return (
      <div className="flex items-center justify-between p-3 bg-brand-50 border border-brand-200 rounded-lg">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="bg-brand-100 p-2 rounded-full flex-shrink-0">
            <FileText className="w-5 h-5 text-brand-600" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-brand-900 truncate block">
              {uploadedFile.name}
            </span>
            <span className="text-xs text-brand-600">
              {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
            </span>
          </div>
        </div>
        <button
          onClick={() => onRemove(category)}
          className="text-gray-400 hover:text-red-500 transition-colors p-1"
          title="Remove file"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative group">
      <input
        type="file"
        ref={inputRef}
        onChange={handleChange}
        accept={accept}
        className="hidden"
      />
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all
          ${isDragging 
            ? 'border-brand-500 bg-brand-50' 
            : 'border-gray-300 hover:border-brand-400 hover:bg-gray-50'
          }
          ${required ? 'bg-white' : 'bg-transparent'}
        `}
      >
        <div className="mb-2 p-2 rounded-full bg-gray-100 group-hover:bg-brand-100 transition-colors">
          <Upload className={`w-5 h-5 ${isDragging ? 'text-brand-600' : 'text-gray-500'}`} />
        </div>
        <h4 className="text-sm font-medium text-gray-900 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </h4>
        <p className="text-xs text-gray-500">
          Drag & drop or click to upload
        </p>
      </div>
    </div>
  );
};