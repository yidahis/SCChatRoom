import React, { useState, useEffect, useRef } from 'react';

function FileBrowser({ isOpen, onClose }) {
  const [currentPath, setCurrentPath] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [homeDir, setHomeDir] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [disks, setDisks] = useState([]); // 添加磁盘列表状态
  const [showDiskSelector, setShowDiskSelector] = useState(false); // 控制磁盘选择器显示
  const fileInputRef = useRef(null);

  // 初始化时获取根目录
  useEffect(() => {
    if (isOpen) {
      getHomeDirectory();
      loadDisks(); // 加载磁盘列表
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

  // 加载磁盘列表
  const loadDisks = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return;
      }

      const response = await fetch('/api/filesystem/disks', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('获取磁盘信息失败');
      }

      const data = await response.json();
      if (data.success) {
        setDisks(data.drives);
      }
    } catch (err) {
      console.error('获取磁盘信息失败:', err);
      // 不设置错误状态，因为这不是关键功能
    }
  };

  // 获取目录内容
  const listDirectory = async (path) => {
    setLoading(true);
    setError(null);
    setShowDiskSelector(false); // 切换到目录视图时隐藏磁盘选择器
    
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

  // 处理下载（文件或文件夹）
  const handleDownload = async (path, name, isDirectory) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('请先登录');
        return;
      }
      
      // 创建下载链接，根据是否为目录使用不同的API
      if (isDirectory) {
        // 遍历目录并为每个文件创建单独的浏览器下载任务
        setLoading(true);
        setError(null);

        const filesToDownload = [];

        // 递归遍历目录，收集文件路径与相对名称
        const traverse = async (dirPath, relBase) => {
          const listResp = await fetch(`/api/filesystem/list?dirPath=${encodeURIComponent(dirPath)}&showHidden=${showHidden}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (!listResp.ok) {
            throw new Error('列出目录失败: ' + dirPath);
          }
          const listData = await listResp.json();
          if (!listData.success) {
            throw new Error(listData.error || '列出目录失败');
          }

          for (const item of listData.items) {
            const itemRel = relBase ? `${relBase}/${item.name}` : item.name;
            if (item.type === 'file') {
              filesToDownload.push({ path: item.path, name: itemRel });
            } else if (item.type === 'directory') {
              // 递归子目录
              await traverse(item.path, itemRel);
            }
          }
        };

        try {
          await traverse(path, name || '');

          if (filesToDownload.length === 0) {
            setError('目录中没有可下载的文件');
            setLoading(false);
            return;
          }

          // 为每个文件构建下载链接并触发浏览器下载
          let index = 0;
          for (const f of filesToDownload) {
            index += 1;
            // 可以在UI上显示进度信息（例如：正在创建下载任务 3 / 12）
            console.log(`触发下载 ${index}/${filesToDownload.length}:`, f.path);

            const downloadUrl = `/api/filesystem/download?filePath=${encodeURIComponent(f.path)}&token=${encodeURIComponent(token)}`;
            const a = document.createElement('a');
            a.href = downloadUrl;
            // 使用相对路径名作为下载文件名，保留目录名以区分同名文件
            a.download = f.name || '';
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();

            // 逐步清理，给浏览器一点时间去处理下载任务，避免短时间内触发太多弹窗被浏览器拦截
            await new Promise((r) => setTimeout(r, 250));
            try { document.body.removeChild(a); } catch (e) {}
          }

        } catch (trErr) {
          console.error('遍历或触发下载失败:', trErr);
          setError('下载失败: ' + trErr.message);
        } finally {
          // 浏览器会处理实际下载，短延时后隐藏 loading
          setTimeout(() => setLoading(false), 1000);
        }

        return;
      }

      // 单个文件直接让浏览器下载
      const baseUrl = `/api/filesystem/download?filePath=${encodeURIComponent(path)}`;
      const sep = baseUrl.includes('?') ? '&' : '?';
      const downloadUrl = `${baseUrl}${sep}token=${encodeURIComponent(token)}`;

      // 让浏览器直接处理下载（不会把数据读入内存），创建隐藏链接并点击
      setLoading(true);
      const a = document.createElement('a');
      a.href = downloadUrl;
      // 指定下载文件名为原始名字（浏览器会优先使用 Content-Disposition 的 filename）
      a.download = name || '';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      // 清理
      setTimeout(() => {
        try { document.body.removeChild(a); } catch (e) {}
      }, 1000);
      // 浏览器会接管下载，异步清理 loading 状态（不影响真正的下载进度显示）
      setTimeout(() => setLoading(false), 1500);

      // 浏览器会接管下载，异步清理 loading 状态（不影响真正的下载进度显示）
      setTimeout(() => setLoading(false), 1500);
    } catch (error) {
      console.error('下载失败:', error);
      setError('下载失败: ' + error.message);
    } finally {
      setLoading(false);
    }
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
    if (!currentPath) return;

    // 规范化路径：去掉末尾斜杠（除根 '/' 外）
    let p = currentPath;
    if (p !== '/' && p.endsWith('/')) {
      p = p.slice(0, -1);
    }

    // 如果已经是根目录，无法再返回
    if (p === '/') return;

    const lastSlash = p.lastIndexOf('/');
    // 如果 lastSlash <= 0，则父路径为根 '/'
    const parentPath = lastSlash > 0 ? p.substring(0, lastSlash) : '/';

    // 防止无效递归
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

  // 切换磁盘选择器显示
  const toggleDiskSelector = () => {
    setShowDiskSelector(!showDiskSelector);
  };

  // 处理磁盘选择
  const handleDiskSelect = (mountPoint) => {
    // 在切换到磁盘时，确保路径正确处理
    if (!mountPoint) {
      console.error('磁盘挂载点为空');
      setError('无效的磁盘挂载点');
      return;
    }
    
    try {
      // 确保路径格式正确（处理Windows和macOS/Linux的路径差异）
      const normalizedPath = mountPoint.replace(/\\/g, '/');

      // 对于根路径 '/'，直接使用 '/'；其他挂载点确保以斜杠结尾
      const pathToUse = (normalizedPath === '/' )
        ? '/'
        : (normalizedPath.endsWith('/') ? normalizedPath : normalizedPath + '/');

      console.log('选择磁盘，处理后的路径:', pathToUse);
      listDirectory(pathToUse);
    } catch (err) {
      console.error('处理磁盘路径出错:', err);
      setError('处理磁盘路径出错: ' + err.message);
    }
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

  // 格式化磁盘大小
  const formatDiskSize = (bytes) => {
    if (!bytes) return '未知大小';
    return formatFileSize(bytes);
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
                // 在根路径 '/' 时禁用返回按钮；也在没有路径时禁用
                disabled={currentPath === '/' || !currentPath}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <span className="current-path" title={currentPath}>{currentPath}</span>
            </div>
            {disks.length > 0 && (
              <button 
                className="disk-selector-toggle"
                onClick={toggleDiskSelector}
                title="选择其他磁盘"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M3 6h18M6 12h12M9 18h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
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

          {!loading && !error && showDiskSelector && disks.length > 0 && (
            <div className="disk-selector">
              <h4>选择磁盘:</h4>
              <div className="disk-list">
                {disks.map((disk, index) => (
                  <div 
                    key={index} 
                    className="disk-item"
                    onClick={() => handleDiskSelect(disk.mountPoint)}
                  >
                    <div className="disk-icon">💾</div>
                    <div className="disk-info">
                      <div className="disk-mount">{disk.mountPoint}</div>
                      <div className="disk-description">{disk.description}</div>
                    </div>
                    <div className="disk-size">{formatDiskSize(disk.size)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && !error && !showDiskSelector && (
            <div className="file-browser-list">
              <div className="file-list-header">
                <div className="file-list-header-item name">名称</div>
                <div className="file-list-header-item size">大小</div>
                <div className="file-list-header-item modified">修改时间</div>
                <div className="file-list-header-item actions">操作</div>
              </div>
              <div className="file-list-content">
                {files.map((file, index) => (
                  <div 
                    key={index} 
                    className={`file-list-item ${file.type === 'directory' ? 'directory' : 'file'}`}
                  >
                    <div 
                      className="file-list-item-name"
                      onClick={() => {
                        if (file.type === 'directory') {
                          handleDirectoryClick(file.path);
                        }
                      }}
                    >
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
                    <div className="file-list-item-actions">
                      <button 
                        className="download-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(file.path, file.name, file.type === 'directory');
                        }}
                        title={file.type === 'directory' ? '下载文件夹' : '下载文件'}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <polyline points="7,10 12,15 17,10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
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