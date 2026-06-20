import React, { useState, useEffect, useRef } from 'react';
import { api } from '../utils/api';
import { Upload, Link2, CheckCircle2, AlertCircle, FileSpreadsheet, Eye, Play, History, Download, RefreshCw, BarChart2 } from 'lucide-react';

export default function ImportEngine({ onRefreshLeads }) {
  const [file, setFile] = useState(null);
  const [sheetUrl, setSheetUrl] = useState('');
  const [duplicateStrategy, setDuplicateStrategy] = useState('skip'); // skip, update, merge

  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Header mapping states
  const [mappings, setMappings] = useState({});
  const [sourceHeaders, setSourceHeaders] = useState([]);
  const [rawRecords, setRawRecords] = useState([]);

  // Active import progress tracking
  const [importing, setImporting] = useState(false);
  const [activeImportId, setActiveImportId] = useState(null);
  const [progressInfo, setProgressInfo] = useState(null);

  // Past imports history
  const [historyList, setHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const fileInputRef = useRef(null);
  const progressIntervalRef = useRef(null);

  const crmFields = [
    { key: 'name', label: 'Customer Name (Required)', defaultPatterns: ['name', 'leadname', 'customername', 'clientname'] },
    { key: 'phone1', label: 'Primary Mobile (Required)', defaultPatterns: ['phone1', 'phone', 'mobile', 'mobilenumber', 'phone_1'] },
    { key: 'phone2', label: 'Alternate Mobile', defaultPatterns: ['phone2', 'alternate', 'alternatenumber', 'phone_2'] },
    { key: 'phone_whatsapp', label: 'WhatsApp Number', defaultPatterns: ['whatsapp', 'whatsappnumber', 'phone_whatsapp', 'whatsapp_phone'] },
    { key: 'city', label: 'City', defaultPatterns: ['city', 'location'] },
    { key: 'state', label: 'State', defaultPatterns: ['state'] },
    { key: 'budget', label: 'Budget', defaultPatterns: ['budget', 'price'] },
    { key: 'project', label: 'Project Name', defaultPatterns: ['project', 'projectname'] },
    { key: 'requirement', label: 'Requirement Details', defaultPatterns: ['requirement', 'requirements', 'details'] },
    { key: 'comments', label: 'Remarks / Comments', defaultPatterns: ['comments', 'remarks', 'remark', 'comment'] },
    { key: 'lead_source', label: 'Lead Source', defaultPatterns: ['leadsource', 'source'] },
    { key: 'status', label: 'Initial Status', defaultPatterns: ['status', 'leadstatus'] },
    { key: 'profession', label: 'Profession', defaultPatterns: ['profession', 'occupation'] },
    { key: 'investor_or_end_user', label: 'Investor / End User', defaultPatterns: ['investororenduser', 'investor_or_end_user', 'type'] },
  ];

  useEffect(() => {
    fetchHistory();
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await api.getImportHistory();
      setHistoryList(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setSheetUrl('');
      resetPreview();
    }
  };

  const resetPreview = () => {
    setPreviewData(null);
    setMappings({});
    setSourceHeaders([]);
    setRawRecords([]);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handlePreviewSubmit = async (e) => {
    e.preventDefault();
    if (!file && !sheetUrl) {
      setErrorMsg('Please select a local CSV/Excel file or input a public Google Sheets URL.');
      return;
    }

    setLoadingPreview(true);
    setErrorMsg('');
    setSuccessMsg('');
    resetPreview();

    try {
      const res = await api.previewImportLeads(file, sheetUrl);
      setPreviewData(res);
      setSourceHeaders(res.headers || []);
      setRawRecords(res.preview || []);

      // Auto map matching headers
      const initialMap = {};
      crmFields.forEach(field => {
        const match = res.headers.find(header => {
          const cleanHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');
          return field.defaultPatterns.some(pat => cleanHeader === pat || cleanHeader.includes(pat));
        });
        initialMap[field.key] = match || '';
      });
      setMappings(initialMap);

      if (res.total === 0) {
        setErrorMsg('The uploaded sheet is empty or contains no records.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to read preview from file.');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleMapChange = (fieldKey, val) => {
    setMappings(prev => ({
      ...prev,
      [fieldKey]: val
    }));
  };

  const handleRunImport = async () => {
    // Validate mapping
    if (!mappings.name) {
      alert('Mapping error: Customer Name is a required field.');
      return;
    }
    if (!mappings.phone1) {
      alert('Mapping error: Primary Mobile is a required field.');
      return;
    }

    // Process all records by mapping sheet columns to database keys
    // We send raw preview data for this simulation or let the backend do mapping if it supports it.
    // In our backend, server.js expects the raw rows, parses them using lowercase key matches.
    // Since we have custom mapping, let's map the records client-side first so it strictly respects the user's manual mapping!
    const mappedRecords = rawRecords.map((rawRow, idx) => {
      const record = {};
      crmFields.forEach(field => {
        const sourceColName = mappings[field.key];
        record[field.key] = sourceColName ? rawRow[sourceColName] : '';
      });
      return record;
    });

    setImporting(true);
    setErrorMsg('');
    setSuccessMsg('');
    setProgressInfo({
      total: previewData.total,
      current: 0,
      imported: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      status: 'Processing'
    });

    try {
      const filename = file ? file.name : 'Google Sheet Import';
      // Start import run (returns history record immediately)
      const runRes = await api.runImportLeads(mappedRecords, filename, duplicateStrategy);
      
      setActiveImportId(runRes.history.id);
      
      // Start polling for real-time progress update
      pollProgress(runRes.history.id);
    } catch (err) {
      setErrorMsg(err.message || 'Import failed to initiate.');
      setImporting(false);
    }
  };

  const pollProgress = (importId) => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    
    progressIntervalRef.current = setInterval(async () => {
      try {
        const historyData = await api.getImportHistory();
        const activeItem = historyData.find(h => h.id === importId);
        
        if (activeItem) {
          const currentProgress = activeItem.imported_records + activeItem.updated_records + activeItem.skipped_records + activeItem.failed_records;
          const total = activeItem.total_records || 1;
          
          setProgressInfo({
            total: total,
            current: currentProgress,
            imported: activeItem.imported_records,
            updated: activeItem.updated_records,
            skipped: activeItem.skipped_records,
            failed: activeItem.failed_records,
            failed_logs: activeItem.failed_logs || [],
            status: currentProgress >= total ? 'Completed' : 'Processing'
          });

          if (currentProgress >= total) {
            clearInterval(progressIntervalRef.current);
            setImporting(false);
            setSuccessMsg(`Bulk import completed: ${activeItem.imported_records} imported, ${activeItem.updated_records} updated, ${activeItem.skipped_records} skipped.`);
            fetchHistory();
            onRefreshLeads();
          }
        }
      } catch (e) {
        console.error('Polling error:', e);
      }
    }, 1500);
  };

  const downloadFailedLogs = (logs) => {
    if (!logs || logs.length === 0) return;
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Row,Name,Error\n"
      + logs.map(l => `"${l.row}","${l.name}","${l.error}"`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "failed_records_log.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getPercent = () => {
    if (!progressInfo) return 0;
    return Math.min(Math.round((progressInfo.current / progressInfo.total) * 100), 100);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Import Settings Card */}
      <div class="alerts-panel" style={{ maxHeight: 'none', height: 'fit-content' }}>
        <div class="alerts-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 class="alerts-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileSpreadsheet size={20} style={{ color: 'var(--primary)' }} />
            Lead Import Wizard
          </h3>
          <button 
            type="button" 
            class="btn btn-secondary" 
            style={{ display: 'flex', gap: '6px', padding: '6px 12px', fontSize: '12px' }}
            onClick={() => {
              setShowHistory(!showHistory);
              fetchHistory();
            }}
          >
            <History size={14} /> {showHistory ? 'Hide History' : 'Show Import History'}
          </button>
        </div>

        {!importing ? (
          <form onSubmit={handlePreviewSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              {/* Local File Upload */}
              <div style={{ background: 'var(--bg-main)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>
                  <Upload size={14} style={{ color: 'var(--primary)' }} /> Upload File (CSV or Excel)
                </label>
                <input 
                  type="file" 
                  class="form-control"
                  ref={fileInputRef}
                  accept=".csv, .xlsx, .xls"
                  onChange={handleFileChange}
                  style={{ background: 'var(--bg-card)', padding: '6px' }}
                />
              </div>

              {/* Google Sheets URL */}
              <div style={{ background: 'var(--bg-main)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-color)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>
                  <Link2 size={14} style={{ color: 'var(--primary)' }} /> Google Sheets Public URL
                </label>
                <input 
                  type="url" 
                  class="form-control"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={sheetUrl}
                  onChange={(e) => {
                    setSheetUrl(e.target.value);
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    resetPreview();
                  }}
                  style={{ background: 'var(--bg-card)' }}
                />
              </div>
            </div>

            {/* Duplicate Settings */}
            <div style={{ background: 'var(--bg-main)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>Duplicate Resolution Strategy</span>
              <div style={{ display: 'flex', gap: '24px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  <input 
                    type="radio" 
                    name="strategy" 
                    value="skip"
                    checked={duplicateStrategy === 'skip'} 
                    onChange={() => setDuplicateStrategy('skip')}
                  />
                  <span>Skip Duplicates (Recommended)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  <input 
                    type="radio" 
                    name="strategy" 
                    value="update" 
                    checked={duplicateStrategy === 'update'} 
                    onChange={() => setDuplicateStrategy('update')}
                  />
                  <span>Overwrite Existing Fields</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  <input 
                    type="radio" 
                    name="strategy" 
                    value="merge" 
                    checked={duplicateStrategy === 'merge'} 
                    onChange={() => setDuplicateStrategy('merge')}
                  />
                  <span>Merge (Fill Blank Columns Only)</span>
                </label>
              </div>
            </div>

            <button type="submit" class="btn btn-primary" disabled={loadingPreview} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {loadingPreview ? (
                <>
                  <RefreshCw size={16} class="bell-animation" /> Reading File and Analyzing...
                </>
              ) : (
                <>
                  <Eye size={16} /> Load Data Sheet Preview
                </>
              )}
            </button>
          </form>
        ) : (
          /* Active Progress Bar */
          <div style={{ marginTop: '16px', background: 'var(--bg-main)', padding: '24px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', marginBottom: '12px' }}>
              <RefreshCw size={18} class="bell-animation" /> Background Import in Progress...
            </h4>
            <div style={{ background: 'var(--bg-card)', height: '24px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', position: 'relative', marginBottom: '16px' }}>
              <div 
                style={{ 
                  width: `${getPercent()}%`, 
                  background: 'linear-gradient(90deg, var(--primary) 0%, #10b981 100%)', 
                  height: '100%', 
                  transition: 'width 0.4s ease-out' 
                }}
              ></div>
              <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>
                {getPercent()}% Completed ({progressInfo?.current} of {progressInfo?.total})
              </span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', textAlign: 'center' }}>
              <div style={{ background: 'var(--bg-card)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Imported (New)</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--color-success)' }}>{progressInfo?.imported}</div>
              </div>
              <div style={{ background: 'var(--bg-card)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Updated (Existing)</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--primary)' }}>{progressInfo?.updated}</div>
              </div>
              <div style={{ background: 'var(--bg-card)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Skipped (Duplicates)</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-muted)' }}>{progressInfo?.skipped}</div>
              </div>
              <div style={{ background: 'var(--bg-card)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Failed (Errors)</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--color-hot)' }}>{progressInfo?.failed}</div>
              </div>
            </div>
          </div>
        )}

        {errorMsg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-hot)', background: 'var(--color-hot-bg)', border: '1px solid rgba(255, 94, 94, 0.2)', padding: '12px', borderRadius: 'var(--radius-md)', marginTop: '16px' }}>
            <AlertCircle size={16} />
            <span style={{ fontSize: '13px' }}>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-success)', background: 'var(--color-success-bg)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '12px', borderRadius: 'var(--radius-md)', marginTop: '16px' }}>
            <CheckCircle2 size={16} />
            <span style={{ fontSize: '13px' }}>{successMsg}</span>
          </div>
        )}
      </div>

      {/* History Log Section */}
      {showHistory && (
        <div class="alerts-panel" style={{ maxHeight: '400px' }}>
          <div class="alerts-header">
            <h3 class="alerts-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <History size={16} style={{ color: 'var(--primary)' }} />
              Past Upload Log Registry
            </h3>
          </div>
          {loadingHistory ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>Loading history...</div>
          ) : historyList.length === 0 ? (
            <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No past imports recorded.</div>
          ) : (
            <div style={{ overflowX: 'auto', marginTop: '12px' }}>
              <table class="table" style={{ fontSize: '12px' }}>
                <thead>
                  <tr>
                    <th>Uploaded At</th>
                    <th>Filename</th>
                    <th style={{ textAlign: 'center' }}>Total</th>
                    <th style={{ textAlign: 'center' }}>Imported</th>
                    <th style={{ textAlign: 'center' }}>Updated</th>
                    <th style={{ textAlign: 'center' }}>Skipped</th>
                    <th style={{ textAlign: 'center' }}>Failed</th>
                    <th>Action Logs</th>
                  </tr>
                </thead>
                <tbody>
                  {historyList.map(h => (
                    <tr key={h.id}>
                      <td>{new Date(h.created_at).toLocaleString()}</td>
                      <td style={{ fontWeight: 'bold' }}>{h.filename}</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{h.total_records}</td>
                      <td style={{ textAlign: 'center', color: 'var(--color-success)' }}>{h.imported_records}</td>
                      <td style={{ textAlign: 'center', color: 'var(--primary)' }}>{h.updated_records}</td>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{h.skipped_records}</td>
                      <td style={{ textAlign: 'center', color: 'var(--color-hot)' }}>{h.failed_records}</td>
                      <td>
                        {h.failed_logs && h.failed_logs.length > 0 ? (
                          <button 
                            class="btn btn-secondary" 
                            style={{ padding: '2px 8px', fontSize: '10px', display: 'flex', gap: '4px', alignItems: 'center' }}
                            onClick={() => downloadFailedLogs(h.failed_logs)}
                          >
                            <Download size={10} /> Download Errors ({h.failed_logs.length})
                          </button>
                        ) : (
                          <span style={{ color: 'var(--color-success)', fontSize: '11px' }}>Clean Upload</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Header Mapping Preview Card */}
      {previewData && previewData.total > 0 && !importing && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          
          {/* Header Mapping Form */}
          <div class="alerts-panel" style={{ maxHeight: 'none', height: 'fit-content' }}>
            <div class="alerts-header">
              <h3 class="alerts-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart2 size={18} style={{ color: 'var(--primary)' }} />
                Map Import Headers
              </h3>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Map database target fields to the headers detected in your sheet. Required fields must be mapped.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {crmFields.map(field => (
                <div key={field.key} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', alignItems: 'center', gap: '12px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600' }}>{field.label}</label>
                  <select 
                    class="form-control"
                    value={mappings[field.key] || ''}
                    onChange={(e) => handleMapChange(field.key, e.target.value)}
                    style={{ fontSize: '12px', padding: '6px' }}
                  >
                    <option value="">-- Ignored / Not in Sheet --</option>
                    {sourceHeaders.map(sh => (
                      <option key={sh} value={sh}>{sh}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <button 
              type="button" 
              class="btn btn-primary" 
              style={{ width: '100%', display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center', marginTop: '24px' }}
              onClick={handleRunImport}
            >
              <Play size={16} /> Execute Lead Import Run ({previewData.total} Records)
            </button>
          </div>

          {/* Sheet Preview Grid (First 5 Rows) */}
          <div class="alerts-panel" style={{ maxHeight: 'none', height: 'fit-content' }}>
            <div class="alerts-header">
              <h3 class="alerts-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Eye size={18} style={{ color: 'var(--primary)' }} />
                Data Preview (First 5 rows)
              </h3>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Showing sample data rows parsed directly from the uploaded source.
            </p>
            
            <div style={{ overflowX: 'auto' }}>
              <table class="table" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                <thead>
                  <tr>
                    {sourceHeaders.map(sh => (
                      <th key={sh}>{sh}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rawRecords.slice(0, 5).map((row, idx) => (
                    <tr key={idx}>
                      {sourceHeaders.map(sh => (
                        <td key={sh}>{String(row[sh] || '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
