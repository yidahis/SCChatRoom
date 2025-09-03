import React, { useState, useEffect } from 'react';

function FileList({ isOpen, onClose }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [downloadingFiles, setDownloadingFiles] = useState(new Set());

  useEffect(() => {
    if (isOpen) {
      fetchFiles();
    }
  }, [isOpen]);

  const fetchFiles = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('请先登录');
        return;
      }

      const response = await fetch('/api/files', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('获取文件列表失败');
      }

      const data = await response.json();
      if (data.success) {
        setFiles(data.files);
      } else {
        setError(data.error || '获取文件列表失败');
      }
    } catch (err) {
      console.error('获取文件列表失败:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (filename, originalName) => {
    if (downloadingFiles.has(filename)) return;

    setDownloadingFiles(prev => new Set(prev).add(filename));
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('请先登录');
        return;
      }

      const response = await fetch(`/api/download/${filename}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('下载失败');
      }

      // 创建下载链接
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = originalName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

    } catch (err) {
      console.error('下载失败:', err);
      alert(`下载失败: ${err.message}`);
    } finally {
      setDownloadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(filename);
        return newSet;
      });
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN');
  };

  const getFileIcon = (type) => {
    if (type.startsWith('.')) {
      const ext = type.toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext)) {
        return '🖼️';
      } else if (['.pdf'].includes(ext)) {
        return '📄';
      } else if (['.doc', '.docx'].includes(ext)) {
        return '📝';
      } else if (['.xls', '.xlsx'].includes(ext)) {
        return '📊';
      } else if (['.zip', '.rar', '.7z'].includes(ext)) {
        return '📦';
      } else if (['.mp3', '.wav', '.flac'].includes(ext)) {
        return '🎵';
      } else if (['.mp4', '.avi', '.mov'].includes(ext)) {
        return '🎬';
      } else {
        return '📁';
      }
    }
    return '📁';
  };

  if (!isOpen) return null;

  return (
    <div className="file-list-overlay" onClick={onClose}>
      <div className="file-list-modal" onClick={(e) => e.stopPropagation()}>
        <div className="file-list-header">
          <h3>历史文件列表</h3>
          <button className="close-btn" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <div className="file-list-content">
          {loading && (
            <div className="loading">
              <div className="spinner"></div>
              <span>加载中...</span>
            </div>
          )}

          {error && (
            <div className="error">
              <span>❌ {error}</span>
              <button onClick={fetchFiles}>重试</button>
            </div>
          )}

          {!loading && !error && files.length === 0 && (
            <div className="empty-state">
              <span>📁 暂无文件</span>
            </div>
          )}

          {!loading && !error && files.length > 0 && (
            <div className="files-grid">
              {files.map((file) => (
                <div key={file.filename} className="file-item">
                  <div className="file-icon">
                    {getFileIcon(file.type)}
                  </div>
                  <div className="file-info">
                    <div className="file-name" title={file.originalName}>
                      {file.originalName}
                    </div>
                    <div className="file-details">
                      <span className="file-size">{file.sizeFormatted}</span>
                      <span className="file-date">{formatDate(file.uploadTime)}</span>
                    </div>
                  </div>
                  <button
                    className={`download-btn ${downloadingFiles.has(file.filename) ? 'downloading' : ''}`}
                    onClick={() => handleDownload(file.filename, file.originalName)}
                    disabled={downloadingFiles.has(file.filename)}
                  >
                    {downloadingFiles.has(file.filename) ? (
                      <div className="spinner small"></div>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <polyline points="7,10 12,15 17,10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="file-list-footer">
          <button className="refresh-btn" onClick={fetchFiles} disabled={loading}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M23 4v6h-6M1 20v-6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            刷新
          </button>
          <span className="file-count">共 {files.length} 个文件</span>
        </div>
      </div>
    </div>
  );
}

export default FileList;
