import { useState, useRef } from 'react';
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
  const batchInputRef = useRef(null);

  const autoMatchFiles = (fileList) => {
    const arr = Array.from(fileList);
    const newFiles = { ...files };
    let matched = 0;

    arr.forEach(file => {
      const name = file.name.toLowerCase().replace(/[\s_\-]/g, '');

      if (name.includes('student')) {
        newFiles.student_numbers = file;
        matched++;
      } else if (name.includes('clinical') && name.includes('conflict')) {
        newFiles.clinical_conflicts = file;
        matched++;
      } else if (name.includes('pharmd') && name.includes('conflict')) {
        newFiles.pharmd_conflicts = file;
        matched++;
      } else if (name.includes('clinical')) {
        newFiles.clinical_courses = file;
        matched++;
      } else if (name.includes('pharmd')) {
        newFiles.pharmd_courses = file;
        matched++;
      }
    });

    setFiles(newFiles);
    if (matched > 0) {
      setError('');
      setSuccess(`Successfully detected and matched ${matched} file(s) from your local folder! Review below and click Upload.`);
    } else {
      setError('Could not automatically match the selected files. Please ensure file names contain keywords like "student", "pharmd", "clinical", "conflict".');
    }
  };

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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (e.dataTransfer.files.length > 1) {
        autoMatchFiles(e.dataTransfer.files);
      } else {
        setFiles(prev => ({
          ...prev,
          [id]: e.dataTransfer.files[0]
        }));
      }
    }
  };

  const handleFileChange = (e) => {
    const { name, files: selectedFiles } = e.target;
    if (selectedFiles && selectedFiles[0]) {
      setFiles(prev => ({
        ...prev,
        [name]: selectedFiles[0]
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!files.student_numbers && (!files.pharmd_courses || !files.clinical_courses)) {
      setError('Please select at least the Student Numbers CSV file (or course files) before uploading.');
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('session_id', sessionId);

      Object.keys(files).forEach(key => {
        if (files[key] && files[key].size) {
          formData.append(key, files[key]);
        }
      });

      const response = await axios.post('/api/scheduler/upload', formData);

      if (response.data.success) {
        setSuccess(`Successfully processed ${response.data.stats.courses} courses and ${response.data.stats.conflicts} conflicts!`);
        setTimeout(() => {
          onFilesUploaded();
        }, 1200);
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
      const response = await axios.post('/api/scheduler/load-sample', { session_id: sessionId });
      if (response.data.success) {
        setFiles({
          student_numbers: { name: 'student_numbers.csv (Sample Data)' },
          pharmd_courses: { name: 'pharmd_courses.csv (Sample Data)' },
          clinical_courses: { name: 'clinical_courses.csv (Sample Data)' },
          pharmd_conflicts: { name: 'pharmd_conflicts.csv (Sample Data)' },
          clinical_conflicts: { name: 'clinical_conflicts.csv (Sample Data)' }
        });
        setSuccess(`Loaded sample files (${response.data.stats.courses} courses, ${response.data.stats.conflicts} conflicts)! Proceeding...`);
        setTimeout(() => {
          onFilesUploaded();
        }, 1200);
      } else {
        setError('Failed to load sample data: ' + response.data.error);
      }
    } catch (err) {
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-6 border-b border-slate-100">
        <div>
          <h2 className="mb-1">Upload Files</h2>
          <p className="text-slate-500 text-sm">
            Upload student numbers, course lists, and conflict matrices (.csv or .xlsx format)
          </p>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <input
            type="file"
            ref={batchInputRef}
            multiple
            accept=".csv,.xlsx,.xls"
            onChange={(e) => autoMatchFiles(e.target.files)}
            className="hidden"
          />
          
          <button
            type="button"
            onClick={() => batchInputRef.current?.click()}
            disabled={loading}
            className="btn text-xs border-indigo-300 bg-indigo-50 text-indigo-900 hover:bg-indigo-100 flex items-center gap-1.5 shadow-sm font-semibold py-2 px-3"
          >
            <span>📂</span> Select Local CSV Folder / Files
          </button>

          <button
            type="button"
            onClick={handleLoadSampleData}
            disabled={loading}
            className="btn text-xs border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 flex items-center gap-1.5 shadow-sm font-semibold py-2 px-3"
          >
            <span>⚡</span> Auto-Fill Built-in Samples
          </button>
        </div>
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
