import { useState } from 'react';
import axios from 'axios';

function FileUpload({ sessionId, onFilesUploaded, onBack }) {
  const [files, setFiles] = useState({
    pharmd_courses: null,
    clinical_courses: null,
    pharmd_conflicts: null,
    clinical_conflicts: null,
    student_numbers: null
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dragActive, setDragActive] = useState({});

  const handleDrag = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(prev => ({ ...prev, [id]: true }));
    } else if (e.type === "dragleave") {
      setDragActive(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleDrop = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(prev => ({ ...prev, [id]: false }));
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFiles(prev => ({
        ...prev,
        [id]: e.dataTransfer.files[0]
      }));
    }
  };

  const handleFileChange = (e) => {
    const { name, files: selectedFiles } = e.target;
    if (selectedFiles && selectedFiles[0]) {
      console.log(`[FileUpload] File selected for "${name}":`, selectedFiles[0].name);
      setFiles(prev => ({
        ...prev,
        [name]: selectedFiles[0]
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('[FileUpload] handleSubmit called! sessionId:', sessionId);
    console.log('[FileUpload] Current files state:', Object.fromEntries(
      Object.entries(files).map(([k, v]) => [k, v ? v.name : null])
    ));
    
    setLoading(true);
    setError('');
    setSuccess('');

    if (!files.student_numbers && (!files.pharmd_courses || !files.clinical_courses)) {
      const msg = 'Please select at least the Student Numbers CSV file (or both PharmD and Clinical Course CSV files) before clicking Upload & Process.';
      console.log('[FileUpload] Validation failed:', msg);
      setError(msg);
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('session_id', sessionId);

      Object.keys(files).forEach(key => {
        if (files[key]) {
          formData.append(key, files[key]);
          console.log(`[FileUpload] Appending ${key}: ${files[key].name}`);
        }
      });

      console.log('[FileUpload] Sending POST to /api/scheduler/upload...');
      const response = await axios.post('/api/scheduler/upload', formData);
      console.log('[FileUpload] Response:', response.data);

      if (response.data.success) {
        setSuccess(`Successfully processed ${response.data.stats.courses} courses and ${response.data.stats.conflicts} conflicts`);
        setTimeout(() => {
          onFilesUploaded();
        }, 1500);
      } else {
        setError('Failed to process files: ' + (response.data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('[FileUpload] Upload error:', err);
      const apiErr = err.response?.data?.error;
      const errMsg = typeof apiErr === 'object' ? apiErr.message : apiErr;
      setError(errMsg || 'An error occurred while uploading files. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSampleData = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      console.log('[FileUpload] Loading sample data for sessionId:', sessionId);
      const response = await axios.post('/api/scheduler/load-sample', { session_id: sessionId });
      if (response.data.success) {
        setFiles({
          student_numbers: { name: 'student_numbers.csv (Sample Data Loaded)' },
          pharmd_courses: { name: 'pharmd_courses.csv (Sample Data Loaded)' },
          clinical_courses: { name: 'clinical_courses.csv (Sample Data Loaded)' },
          pharmd_conflicts: { name: 'pharmd_conflicts.csv (Sample Data Loaded)' },
          clinical_conflicts: { name: 'clinical_conflicts.csv (Sample Data Loaded)' }
        });
        setSuccess(`Successfully loaded sample files (${response.data.stats.courses} courses, ${response.data.stats.conflicts} conflicts)! Proceeding...`);
        setTimeout(() => {
          onFilesUploaded();
        }, 1200);
      } else {
        setError('Failed to load sample data: ' + response.data.error);
      }
    } catch (err) {
      console.error('[FileUpload] Sample load error:', err);
      const apiErr = err.response?.data?.error;
      const errMsg = typeof apiErr === 'object' ? apiErr.message : apiErr;
      setError(errMsg || 'Failed to load sample data files.');
    } finally {
      setLoading(false);
    }
  };

  const renderUploadArea = (id, label, isRequired = false) => {
    const isActive = dragActive[id];
    const fileSelected = files[id];

    return (
      <div
        className={`relative group rounded-xl border-2 border-dashed transition-all p-6 text-center
          ${isActive ? 'border-hue-navy bg-hue-navy/5' : fileSelected ? 'border-semantic-success/50 bg-semantic-success/5' : 'border-slate-200 hover:border-hue-navy/50 bg-slate-50 hover:bg-slate-50/50'}`}
        onDragEnter={(e) => handleDrag(e, id)}
        onDragOver={(e) => handleDrag(e, id)}
        onDragLeave={(e) => handleDrag(e, id)}
        onDrop={(e) => handleDrop(e, id)}
      >
        <span className="block font-semibold text-slate-700 mb-2">{label} {isRequired && <span className="text-red-500">*</span>}</span>
        <span className="block text-sm text-slate-500 mb-4">Click "Select File" or drag & drop .csv or .xlsx file here</span>
        <label
          htmlFor={id}
          className="inline-flex items-center justify-center px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 cursor-pointer shadow-sm transition-colors"
        >
          {fileSelected ? 'Change File' : 'Select File'}
        </label>
        <input
          type="file"
          id={id}
          name={id}
          accept=".csv,.xlsx,.xls"
          onChange={handleFileChange}
          className="hidden"
        />
        {fileSelected && (
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-semantic-success/10 text-semantic-success rounded-lg text-sm font-medium">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
            <span className="truncate">{fileSelected.name}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="card max-w-3xl mx-auto">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="mb-1">Upload Files</h2>
          <p className="text-slate-500 text-sm">
            Upload student numbers, course lists, and conflict matrices (.csv or .xlsx format)
          </p>
        </div>
        <button
          type="button"
          onClick={handleLoadSampleData}
          disabled={loading}
          className="btn btn-secondary text-xs border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 shrink-0 flex items-center gap-1.5 shadow-sm font-semibold py-2 px-3"
        >
          <span>⚡</span> Auto-Fill Sample Data Files
        </button>
      </div>

      {error && <div className="bg-semantic-danger/10 border border-semantic-danger/20 text-semantic-danger px-4 py-3 rounded-xl mb-6 text-sm font-medium">{error}</div>}
      {success && <div className="bg-semantic-success/10 border border-semantic-success/20 text-semantic-success px-4 py-3 rounded-xl mb-6 text-sm font-medium">{success}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {renderUploadArea('student_numbers', '1. Student Numbers File (Master Course List & Counts)', true)}
        {renderUploadArea('pharmd_courses', '2. PharmD Courses File (Course Levels & Metadata)', false)}
        {renderUploadArea('clinical_courses', '3. PharmD Clinical Courses File (Course Levels & Metadata)', false)}
        {renderUploadArea('pharmd_conflicts', '4. PharmD Conflict Matrix (Program Conflicts)', false)}
        {renderUploadArea('clinical_conflicts', '5. PharmD Clinical Conflict Matrix (Program Conflicts)', false)}

        <div className="flex gap-4 mt-8 pt-6 border-t border-slate-100">
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            Back
          </button>
          <button 
            type="submit" 
            className="btn btn-primary flex-1 shadow-glow-primary text-base py-3"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Processing & Saving Courses...
              </span>
            ) : 'Upload Files & Process Courses'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default FileUpload;
