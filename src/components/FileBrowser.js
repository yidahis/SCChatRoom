import React, { useState, useEffect, useRef } from 'react';

function FileBrowser({ isOpen, onClose }) {
  const [currentPath, setCurrentPath] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [homeDir, setHomeDir] = useState('');
  const [showHidden, setShowHidden] = useState(false); // 添加显示隐藏文件的状态
  const fileInputRef = useRef(null);

  // 初始化时获取根目录
  useEffect(() => {
    if (isOpen) {
      getHomeDirectory();
    }
  }, [isOpen]);

  // 获取用户主目录
  const getHomeDirectory = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('请先登录');
        return;
      }

      const response = await fetch('/api/filesystem/root', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('获取系统信息失败');
      }

      const data = await response.json();
      if (data.success) {
        setHomeDir(data.homeDir);
        listDirectory(data.homeDir);
      } else {
        setError(data.error || '获取系统信息失败');
      }
    } catch (err) {
      console.error('获取系统信息失败:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 获取目录内容
  const listDirectory = async (path) => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('请先登录');
        return;
      }

      const response = await fetch(`/api/filesystem/list?dirPath=${encodeURIComponent(path)}&showHidden=${showHidden}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('获取目录内容失败');
      }

      const data = await response.json();
      if (data.success) {
        setFiles(data.items);
        setCurrentPath(data.path);
      } else {
        setError(data.error || '获取目录内容失败');
      }
    } catch (err) {
      console.error('获取目录内容失败:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 处理目录点击
  const handleDirectoryClick = (dirPath) => {
    listDirectory(dirPath);
  };

  // 处理文件点击（下载文件）
  const handleFileClick = (filePath, fileName) => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('请先登录');
      return;
    }
    
    // 创建下载链接
    const downloadUrl = `/api/filesystem/download?filePath=${encodeURIComponent(filePath)}`;
    
    // 使用fetch下载文件
    fetch(downloadUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('下载失败');
      }
      return response.blob();
    })
    .then(blob => {
      // 创建一个临时的URL来下载文件
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'download';
      document.body.appendChild(a);
      a.click();
      
      // 清理
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);
    })
    .catch(error => {
      console.error('下载失败:', error);
      setError('文件下载失败: ' + error.message);
    });
  };

  // 打开系统文件选择器
  const openSystemFilePicker = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // 处理文件选择
  const handleFileSelect = (event) => {
    const selectedFiles = Array.from(event.target.files);
    if (selectedFiles.length > 0) {
      // 将选中的文件添加到文件列表中
      const newFiles = selectedFiles.map(file => ({
        name: file.name,
        type: file.type || (file.webkitRelativePath ? 'directory' : 'file'),
        size: file.size,
        modified: new Date(file.lastModified),
        path: file.path || null,
        fileObject: file // 保存文件对象以便后续使用
      }));
      
      setFiles(prevFiles => [...prevFiles, ...newFiles]);
    }
  };

  // 返回上级目录
  const goBack = () => {
    const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
    if (parentPath && parentPath !== currentPath) {
      listDirectory(parentPath);
    }
  };

  // 切换显示隐藏文件
  const toggleShowHidden = () => {
    const newShowHidden = !showHidden;
    setShowHidden(newShowHidden);
    
    // 重新加载当前目录
    listDirectory(currentPath);
  };

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '-';
    if (bytes < 0) return '-';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 格式化日期
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN');
  };

  if (!isOpen) return null;

  return (
    <div className="file-browser-overlay" onClick={onClose}>
      <div className="file-browser-modal" onClick={(e) => e.stopPropagation()}>
        <div className="file-browser-header">
          <h3>文件浏览器</h3>
          <button className="close-btn" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <div className="file-browser-content">
          <div className="file-browser-path">
            <div className="path-controls">
              <button 
                className="back-btn" 
                onClick={goBack}
                disabled={currentPath === homeDir || !currentPath}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <span className="current-path" title={currentPath}>{currentPath}</span>
            </div>
          </div>
          
          {loading && (
            <div className="loading">
              <div className="spinner"></div>
              <span>加载中...</span>
            </div>
          )}

          {error && (
            <div className="error">
              <span>❌ {error}</span>
              <button onClick={() => listDirectory(currentPath)}>重试</button>
            </div>
          )}

          {!loading && !error && (
            <div className="file-browser-list">
              <div className="file-list-header">
                <div className="file-list-header-item name">名称</div>
                <div className="file-list-header-item size">大小</div>
                <div className="file-list-header-item modified">修改时间</div>
              </div>
              <div className="file-list-content">
                {files.map((file, index) => (
                  <div 
                    key={index} 
                    className={`file-list-item ${file.type === 'directory' ? 'directory' : 'file'}`}
                    onClick={() => {
                      if (file.type === 'directory') {
                        handleDirectoryClick(file.path);
                      } else {
                        handleFileClick(file.path, file.name);
                      }
                    }}
                  >
                    <div className="file-list-item-name">
                      <div className="file-icon">
                        {file.type === 'directory' ? '📁' : '📄'}
                      </div>
                      <span className="file-name" title={file.name}>
                        {file.name}
                      </span>
                    </div>
                    <div className="file-list-item-size">
                      {file.type === 'directory' ? '-' : formatFileSize(file.size)}
                    </div>
                    <div className="file-list-item-modified">
                      {formatDate(file.modified)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="file-browser-footer">
          <div className="footer-controls">
            <button className="refresh-btn" onClick={() => listDirectory(currentPath)} disabled={loading}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M23 4v6h-6M1 20v-6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              刷新
            </button>
            <button 
              className={`toggle-hidden-btn ${showHidden ? 'active' : ''}`}
              onClick={toggleShowHidden}
              title={showHidden ? '隐藏隐藏文件' : '显示隐藏文件'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {showHidden ? '隐藏隐藏文件' : '显示隐藏文件'}
            </button>
          </div>
          <div className="footer-actions">
            <button className="select-files-btn" onClick={openSystemFilePicker}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="17,8 12,3 7,8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              选择文件
            </button>
            <span className="file-count">共 {files.length} 项</span>
          </div>
        </div>
        
        {/* 隐藏的文件输入元素 */}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileSelect}
          multiple
        />
      </div>
    </div>
  );
}

export default FileBrowser;