import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  User,
  FileText, 
  CheckSquare, 
  AlertTriangle, 
  Send,
  ShieldCheck,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { FileUploadField } from './components/FileUploadField';
import { 
  DealFormData, 
  PropertyType, 
  FileCategory, 
  UploadedFile 
} from './types';

const INITIAL_DATA: DealFormData = {
  propertyName: '',
  propertyAddress: '',
  propertyType: '',
  unitCount: '',
  submitterName: '',
  submitterPhone: '',
  submitterEmail: '',
  finalAcknowledgement: false,
};

const REQUIRED_FILES: { category: FileCategory; label: string }[] = [
  { category: 'financialInfo', label: 'Financial Information' },
];

const OPTIONAL_FILES: { category: FileCategory; label: string }[] = [
  { category: 'pnl', label: 'Profit & Loss (P&L)' },
  { category: 'rentRoll', label: 'Rent Roll' },
  { category: 't12', label: 'Trailing 12 (T12)' },
  { category: 'om', label: 'Offering Memo (OM)' },
  { category: 'capex', label: 'CapEx Summary' },
  { category: 'utility', label: 'Utility Bills' },
];

export default function App() {
  const [formData, setFormData] = useState<DealFormData>(INITIAL_DATA);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // --- Handlers ---

  const handleInputChange = (field: keyof DealFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = (file: File, category: FileCategory) => {
    const newFile: UploadedFile = {
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      category,
      file
    };
    // Replace existing file of same category if exists
    setFiles(prev => [...prev.filter(f => f.category !== category), newFile]);
  };

  const handleFileRemove = (category: FileCategory) => {
    setFiles(prev => prev.filter(f => f.category !== category));
  };

  // --- Validation ---

  const validation = useMemo(() => {
    const errors: string[] = [];
    
    // Property
    if (!formData.propertyName) errors.push("Property Name is required");
    if (!formData.propertyType) errors.push("Property Type is required");

    // Submitter Info
    if (!formData.submitterName) errors.push("Your Name is required");
    if (!formData.submitterPhone) errors.push("Your Phone is required");
    if (!formData.submitterEmail) errors.push("Your Email is required");

    // Files
    const uploadedCategories = new Set(files.map(f => f.category));
    REQUIRED_FILES.forEach(req => {
      if (!uploadedCategories.has(req.category)) {
        errors.push(`${req.label} is required`);
      }
    });

    // Final Check
    if (!formData.finalAcknowledgement) errors.push("Final acknowledgement is required");

    return {
      isValid: errors.length === 0,
      errors
    };
  }, [formData, files]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (validation.isValid) {
      setIsSubmitting(true);
      
      try {
        const payload = new FormData();

        // Append regular form fields
        Object.entries(formData).forEach(([key, value]) => {
          if (value !== null) {
            payload.append(key, String(value));
          }
        });

        // Append files
        files.forEach(f => {
          payload.append(f.category, f.file);
        });

        // Metadata
        payload.append('submissionTimestamp', new Date().toISOString());
        payload.append('totalFiles', String(files.length));

        // Send to backend API (serverless function handles webhook securely)
        const response = await fetch('/api/submit-deal', {
          method: 'POST',
          body: payload,
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to submit deal');
        }

        setIsSubmitted(true);
        window.scrollTo(0,0);
        
      } catch (error) {
        console.error("Submission failed:", error);
        setSubmitError("Failed to submit the deal. Please check your connection and try again.");
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setSubmitError("Please correct the errors before submitting.");
    }
  };

  // --- Render ---

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border-t-4 border-green-500">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Submission Received</h2>
          <p className="text-gray-600 mb-6 leading-relaxed">
            Thanks for submitting this deal. Our team will review the financials and follow up if it meets initial criteria.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 text-left text-sm text-gray-500 mb-6">
            <p className="font-medium mb-2">Submission Summary:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Property: {formData.propertyName}</li>
              <li>Submitted by: {formData.submitterName} ({formData.submitterEmail})</li>
              <li>Files: {files.length} documents uploaded</li>
            </ul>
          </div>
          <p className="text-xs text-gray-400">A confirmation email has been sent to you.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight sm:text-4xl">
            Submit a Deal
          </h1>
          <p className="mt-3 max-w-2xl mx-auto text-lg text-gray-500">
            Strict vetting process. Only deals with verified decision-maker access and complete financials will be reviewed.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Section 1: Property Details */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-brand-50 px-6 py-4 border-b border-brand-100 flex items-center gap-3">
              <Building2 className="text-brand-500 w-5 h-5" />
              <h2 className="text-lg font-semibold text-brand-900">Property Details</h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Property Name</label>
                <input
                  type="text"
                  required
                  value={formData.propertyName}
                  onChange={(e) => handleInputChange('propertyName', e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 border p-2 bg-white text-gray-900"
                  placeholder="e.g. Sunny Acres MHP"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
                <select
                  required
                  value={formData.propertyType}
                  onChange={(e) => handleInputChange('propertyType', e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 border p-2 bg-white text-gray-900"
                >
                  <option value="" className="text-gray-500">Select Type...</option>
                  {Object.values(PropertyType).map(type => (
                    <option key={type} value={type} className="text-gray-900">{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit/Pad Count</label>
                <input
                  type="number"
                  value={formData.unitCount}
                  onChange={(e) => handleInputChange('unitCount', e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 border p-2 bg-white text-gray-900"
                  placeholder="Total units"
                />
              </div>
              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  value={formData.propertyAddress}
                  onChange={(e) => handleInputChange('propertyAddress', e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 border p-2 bg-white text-gray-900"
                  placeholder="Street Address, City, State, Zip"
                />
              </div>
            </div>
          </div>

          {/* Section: Submitter Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-brand-50 px-6 py-4 border-b border-brand-100 flex items-center gap-3">
              <User className="text-brand-500 w-5 h-5" />
              <h2 className="text-lg font-semibold text-brand-900">Your Contact Information <span className="text-xs bg-brand-200 text-brand-900 px-2 py-0.5 rounded ml-2">REQUIRED</span></h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
                <input
                  type="text"
                  required
                  value={formData.submitterName}
                  onChange={(e) => handleInputChange('submitterName', e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 border p-2 bg-white text-gray-900"
                  placeholder="Full Name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Phone</label>
                <input
                  type="tel"
                  required
                  value={formData.submitterPhone}
                  onChange={(e) => handleInputChange('submitterPhone', e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 border p-2 bg-white text-gray-900"
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Email</label>
                <input
                  type="email"
                  required
                  value={formData.submitterEmail}
                  onChange={(e) => handleInputChange('submitterEmail', e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 border p-2 bg-white text-gray-900"
                  placeholder="you@example.com"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Financials */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
             <div className="bg-brand-50 px-6 py-4 border-b border-brand-100 flex items-center gap-3">
              <FileText className="text-brand-500 w-5 h-5" />
              <h2 className="text-lg font-semibold text-brand-900">Financial Documents <span className="text-xs bg-brand-200 text-brand-900 px-2 py-0.5 rounded ml-2">REQUIRED</span></h2>
            </div>
            <div className="p-6">
              <div className="bg-brand-50 text-brand-900 text-sm p-3 rounded-md mb-6 flex gap-2">
                <ShieldCheck className="w-4 h-4 mt-0.5 text-brand-500" />
                No placeholders allowed. Valid uploads required for submission.
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Required Documents</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {REQUIRED_FILES.map((fileType) => (
                      <FileUploadField
                        key={fileType.category}
                        category={fileType.category}
                        label={fileType.label}
                        required={true}
                        uploadedFile={files.find(f => f.category === fileType.category)}
                        onUpload={handleFileUpload}
                        onRemove={handleFileRemove}
                      />
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                   <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Optional (Recommended)</h3>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {OPTIONAL_FILES.map((fileType) => (
                      <FileUploadField
                        key={fileType.category}
                        category={fileType.category}
                        label={fileType.label}
                        uploadedFile={files.find(f => f.category === fileType.category)}
                        onUpload={handleFileUpload}
                        onRemove={handleFileRemove}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Final Acknowledgement */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center gap-3">
              <CheckSquare className="text-gray-600 w-5 h-5" />
              <h2 className="text-lg font-semibold text-brand-900">Final Validation</h2>
            </div>
            <div className="p-6">
               <label className="flex items-start gap-3 cursor-pointer p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex items-center h-5">
                  <input
                    type="checkbox"
                    required
                    checked={formData.finalAcknowledgement}
                    onChange={(e) => handleInputChange('finalAcknowledgement', e.target.checked)}
                    className="h-5 w-5 text-brand-500 border-gray-300 rounded focus:ring-brand-500"
                  />
                </div>
                <div className="text-sm text-gray-900 font-medium">
                  I understand that commercial deals will not be reviewed without complete financials and verified access to the decision maker.
                </div>
              </label>
            </div>
          </div>

          {/* Submit Action */}
          <div className="sticky bottom-4 z-10">
            <div className="max-w-4xl mx-auto">
              <button
                type="submit"
                disabled={!validation.isValid || isSubmitting}
                className={`
                  w-full flex items-center justify-center gap-2 py-4 px-8 rounded-xl font-bold text-lg shadow-lg transition-all duration-200
                  ${validation.isValid && !isSubmitting
                    ? 'bg-brand-500 hover:bg-brand-600 text-white transform hover:-translate-y-1' 
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'}
                `}
              >
                {isSubmitting ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Sending...</span>
                    </>
                ) : (
                    <>
                        {validation.isValid ? <Send className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                        {validation.isValid ? 'Submit Deal Packet' : 'Complete Requirements to Submit'}
                    </>
                )}
              </button>
            </div>
          </div>

          {/* Error Message Display */}
          {(submitError || (!validation.isValid && (formData.hasDirectAccess === true || formData.hasDirectAccess === null))) && (
            <div className={`border rounded-lg p-4 mt-4 shadow-sm ${submitError ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
              
              {/* Validation Errors */}
              {!validation.isValid && !submitError && (
                <>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Missing Requirements:</h4>
                  <ul className="text-sm text-red-600 list-disc pl-5 space-y-1">
                    {validation.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </>
              )}

              {/* API/Submission Error */}
              {submitError && (
                 <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <p className="text-sm text-red-700 font-medium">{submitError}</p>
                 </div>
              )}
            </div>
          )}

        </form>
      </div>
    </div>
  );
}