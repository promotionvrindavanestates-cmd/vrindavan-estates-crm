import React, { useState, useRef } from 'react';
import { api } from '../utils/api';
import { Download, Upload, FileText, Database, ShieldAlert, CheckCircle } from 'lucide-react';

export default function BackupMgmt({ onRefreshLeads, currentUser = {} }) {
  const [importLoading, setImportLoading] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [importError, setImportError] = useState('');
  const importFileRef = useRef(null);

  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');
  const [backupError, setBackupError] = useState('');
  const restoreFileRef = useRef(null);

  const handleExport = async (format) => {
    try {
      await api.exportLeads(format);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    }
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    const file = importFileRef.current?.files?.[0];
    if (!file) {
      setImportError('Please select a CSV or Excel file to import.');
      return;
    }

    setImportLoading(true);
    setImportError('');
    setImportMsg('');

    try {
      const res = await api.importLeads(file);
      setImportMsg(res.message || 'Leads imported successfully!');
      if (importFileRef.current) importFileRef.current.value = '';
      onRefreshLeads();
    } catch (err) {
      setImportError(err.message || 'Import failed. Verify column structures.');
    } finally {
      setImportLoading(false);
    }
  };

  const handleBackupDownload = async () => {
    setBackupLoading(true);
    setBackupError('');
    setBackupMsg('');
    try {
      await api.downloadBackup();
      setBackupMsg('Database backup downloaded successfully!');
    } catch (err) {
      setBackupError(err.message || 'Backup failed.');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestoreSubmit = async (e) => {
    e.preventDefault();
    const file = restoreFileRef.current?.files?.[0];
    if (!file) {
      setBackupError('Please select a valid JSON backup file.');
      return;
    }

    const confirmRestore = window.confirm(
      "WARNING: Restoring the database will overwrite your current leads, users, and call logs with the backup contents. Are you absolutely sure you want to continue?"
    );
    if (!confirmRestore) return;

    setRestoreLoading(true);
    setBackupError('');
    setBackupMsg('');

    try {
      const res = await api.restoreBackup(file);
      setBackupMsg(res.message || 'Database restored successfully!');
      if (restoreFileRef.current) restoreFileRef.current.value = '';
      onRefreshLeads();
    } catch (err) {
      setBackupError(err.message || 'Restore failed. Make sure the file format is valid.');
    } finally {
      setRestoreLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
      
      {/* Left: Export and Import Panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Export Card */}
        <div class="alerts-panel" style={{ maxHeight: 'none', height: 'fit-content' }}>
          <div class="alerts-header">
            <h3 class="alerts-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Download size={18} style={{ color: 'var(--primary)' }} />
              Export CRM Data
            </h3>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Export all leads matching your credentials into formatted CSV or Excel worksheets.
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              class="btn btn-secondary" 
              style={{ flex: 1, display: 'flex', gap: '8px', alignItems: 'center' }}
              onClick={() => handleExport('csv')}
            >
              <FileText size={16} /> Export to CSV
            </button>
            <button 
              class="btn btn-primary" 
              style={{ flex: 1, display: 'flex', gap: '8px', alignItems: 'center' }}
              onClick={() => handleExport('xlsx')}
            >
              <Download size={16} /> Export to Excel (.xlsx)
            </button>
          </div>
        </div>

        {/* Import Card */}
        {currentUser.role === 'admin' && (
          <div class="alerts-panel" style={{ maxHeight: 'none', height: 'fit-content' }}>
            <div class="alerts-header">
              <h3 class="alerts-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Upload size={18} style={{ color: 'var(--primary)' }} />
                Bulk Import Leads
              </h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Upload an Excel (.xlsx) or CSV file to bulk insert leads. Make sure columns map to fields like: 
              <code style={{ color: 'var(--primary)', background: 'var(--bg-main)', padding: '2px 6px', borderRadius: '4px', marginLeft: '4px', fontSize: '11px' }}>
                Name, Phone1, Project, City, Budget, Requirement
              </code>.
            </p>

            {importError && (
              <div style={{ background: 'var(--color-hot-bg)', color: 'var(--color-hot)', padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '13px', border: '1px solid rgba(255, 94, 94, 0.2)' }}>
                {importError}
              </div>
            )}

            {importMsg && (
              <div style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)', padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '13px', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle size={14} />
                {importMsg}
              </div>
            )}

            <form onSubmit={handleImportSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div class="form-group">
                <input
                  type="file"
                  class="form-control"
                  ref={importFileRef}
                  accept=".csv, .xlsx, .xls"
                  disabled={importLoading}
                  style={{ background: 'var(--bg-main)', border: '1px dashed var(--border-color)', padding: '12px' }}
                />
              </div>
              <button type="submit" class="btn btn-primary" disabled={importLoading}>
                {importLoading ? 'Uploading and Parsing...' : 'Import Data Sheet'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Right: Cloud Database Backup & Restore */}
      {currentUser.role === 'admin' && (
        <div class="alerts-panel" style={{ maxHeight: 'none', height: 'fit-content' }}>
          <div class="alerts-header">
            <h3 class="alerts-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={18} style={{ color: 'var(--primary)' }} />
              System Backup & Restore
            </h3>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Download a full system JSON backup containing all leads, users, and logs, or restore database state from a saved file.
          </p>

          {backupError && (
            <div style={{ background: 'var(--color-hot-bg)', color: 'var(--color-hot)', padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '13px', border: '1px solid rgba(255, 94, 94, 0.2)' }}>
              {backupError}
            </div>
          )}

          {backupMsg && (
            <div style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)', padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '13px', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle size={14} />
              {backupMsg}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Backup Download Button */}
            <div style={{ background: 'var(--bg-main)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <h4 style={{ marginBottom: '8px', fontSize: '14px' }}>Download Full Backup</h4>
              <button 
                type="button" 
                class="btn btn-secondary" 
                style={{ width: '100%', display: 'flex', gap: '8px', alignItems: 'center' }}
                onClick={handleBackupDownload}
                disabled={backupLoading}
              >
                <Download size={16} /> {backupLoading ? 'Generating...' : 'Download system_backup.json'}
              </button>
            </div>

            {/* Restore Database Upload */}
            <div style={{ background: 'var(--bg-main)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <h4 style={{ marginBottom: '8px', fontSize: '14px', color: 'var(--color-hot)' }}>Restore Database from File</h4>
              <form onSubmit={handleRestoreSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input
                  type="file"
                  class="form-control"
                  ref={restoreFileRef}
                  accept=".json"
                  disabled={restoreLoading}
                  style={{ background: 'var(--bg-card)', padding: '8px' }}
                />
                <button 
                  type="submit" 
                  class="btn btn-danger" 
                  style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
                  disabled={restoreLoading}
                >
                  <Upload size={16} /> {restoreLoading ? 'Restoring...' : 'Restore System Backup'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
