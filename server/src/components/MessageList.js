import React, { useState } from 'react';

function MessageList({ messages, currentUser }) {
  const [modalImage, setModalImage] = useState(null);
  const [downloadingFiles, setDownloadingFiles] = useState(new Set());
  const [downloadStatus, setDownloadStatus] = useState(new Map()); // filename -> { received, total, percent, speed }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond) => {
    if (!bytesPerSecond || bytesPerSecond <= 0) return '计算中...';
    return formatFileSize(bytesPerSecond) + '/s';
  };

  const getFileIcon = (mimetype) => {
    if (mimetype.startsWith('image/')) {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
          <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="2"/>
          <polyline points="21,15 16,10 5,21" stroke="currentColor" strokeWidth="2"/>
        </svg>
      );
    } else if (mimetype.includes('pdf')) {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2"/>
          <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2"/>
          <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="2"/>
          <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="2"/>
        </svg>
      );
    } else if (mimetype.includes('video')) {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <polygon points="23 7 16 12 23 17 23 7" stroke="currentColor" strokeWidth="2"/>
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
        </svg>
      );
    } else if (mimetype.includes('audio')) {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" stroke="currentColor" strokeWidth="2"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" stroke="currentColor" strokeWidth="2"/>
        </svg>
      );
    } else {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2"/>
          <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2"/>
        </svg>
      );
    }
  };

  const handleFileDownload = async (filename, originalName) => {
    // 防止重复下载
    if (downloadingFiles.has(filename)) {
      return;
    }

    try {
      // 设置下载状态
      setDownloadingFiles(prev => new Set(prev).add(filename));
      setDownloadStatus(prev => {
        const next = new Map(prev);
        next.set(filename, { received: 0, total: 0, percent: 0, speed: 0, startTime: Date.now() });
        return next;
      });
      
      const token = localStorage.getItem('token');
      if (!token) {
        alert('请先登录');
        return;
      }

      console.log('🔽 [前端] 开始下载文件:', {
        filename,
        originalName,
        timestamp: new Date().toISOString()
      });

      const response = await fetch(`/api/download/${encodeURIComponent(filename)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        console.error('❌ [前端] 下载失败:', {
          status: response.status,
          statusText: response.statusText
        });
        alert('文件下载失败');
        return;
      }

      const contentLengthHeader = response.headers.get('content-length');
      const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;

      const reader = response.body.getReader();
      const chunks = [];
      let received = 0;
      const startTime = Date.now();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.length;
          const elapsedSec = Math.max((Date.now() - startTime) / 1000, 0.001);
          const speed = received / elapsedSec;
          const percent = totalBytes > 0 ? (received / totalBytes) * 100 : 0;
          setDownloadStatus(prev => {
            const next = new Map(prev);
            const current = next.get(filename) || { received: 0, total: totalBytes, percent: 0, speed: 0, startTime };
            next.set(filename, { ...current, received, total: totalBytes, percent, speed });
            return next;
          });
        }
      }

      // 合并为 Blob 并保存
      const blob = new Blob(chunks);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = originalName || filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // 结束时强制 100%
      setDownloadStatus(prev => {
        const next = new Map(prev);
        const current = next.get(filename);
        if (current) {
          next.set(filename, { ...current, received: totalBytes || current.received, total: totalBytes || current.total, percent: 100, speed: 0 });
        }
        return next;
      });

      console.log('🎉 [前端] 文件下载成功:', originalName || filename);
    } catch (error) {
      console.error('💥 [前端] 下载错误:', error);
      alert('文件下载失败');
    } finally {
      // 清除下载状态
      setDownloadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(filename);
        return newSet;
      });
      // 稍后清理进度条展示
      setTimeout(() => {
        setDownloadStatus(prev => {
          const next = new Map(prev);
          next.delete(filename);
          return next;
        });
      }, 2000);
    }
  };
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isOwnMessage = (message) => {
    if (message.type === 'system') return false;
    const messageUsername = message.user ? message.user.username : message.username;
    return currentUser && messageUsername === currentUser.username;
  };

  return (
    <>
      <div className="messages-list">
        {messages.map((message, index) => {
          const isOwn = isOwnMessage(message);
          const messageUsername = message.user ? message.user.username : message.username;
          const messageContent = message.content || message.message;
          const dl = message.type === 'file' ? downloadStatus.get(message.filename) : null;
          
          return (
            <div 
              key={index} 
              className={`message ${message.type === 'system' ? 'system' : ''} ${isOwn ? 'own' : ''}`}
            >
              {message.type === 'system' ? (
                <div className="message-content">
                  {messageContent}
                </div>
              ) : (
                <div className="message-content">
                  <div className="message-header">
                    <span className="message-username">
                      {messageUsername}
                    </span>
                    <span className="message-time">
                      {formatTime(message.timestamp)}
                    </span>
                  </div>
                  {message.type === 'image' ? (
                    <div className="message-image-container">
                      <img 
                        src={message.imageUrl} 
                        alt="发送的图片" 
                        className="message-image"
                        onClick={() => setModalImage(message.imageUrl)}
                      />
                      {message.content && (
                        <div className="message-text">
                          {message.content}
                        </div>
                      )}
                    </div>
                  ) : message.type === 'file' ? (
                    <div className="message-file-container">
                      <div className="file-info" onClick={() => handleFileDownload(message.filename, message.originalName)}>
                        <div className="file-icon">
                          {getFileIcon(message.mimetype)}
                        </div>
                        <div className="file-details">
                          <div className="file-name">{message.originalName}</div>
                          <div className="file-size">{formatFileSize(message.size)}</div>
                          {/* 下载进度显示 */}
                          {dl && (
                            <div className="download-progress">
                              <div className="download-progress-bar">
                                <div className="download-progress-fill" style={{ width: `${Math.min(100, dl.percent || 0)}%` }}></div>
                              </div>
                              <div className="download-progress-info">
                                <span className="download-percentage">{(dl.percent || 0).toFixed(1)}%</span>
                                <span className="download-size">
                                  {formatFileSize(dl.received)}{dl.total ? ` / ${formatFileSize(dl.total)}` : ''}
                                </span>
                                <span className="download-speed">{formatSpeed(dl.speed)}</span>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="download-icon">
                          {downloadingFiles.has(message.filename) ? (
                            <div className="download-loading">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="loading-spinner">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="31.416" strokeDashoffset="31.416">
                                  <animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416" repeatCount="indefinite"/>
                                  <animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416" repeatCount="indefinite"/>
                                </circle>
                              </svg>
                            </div>
                          ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2"/>
                              <polyline points="7,10 12,15 17,10" stroke="currentColor" strokeWidth="2"/>
                              <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2"/>
                            </svg>
                          )}
                        </div>
                      </div>
                      {message.content && (
                        <div className="message-text">
                          {message.content}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="message-text">
                      {messageContent}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* 图片模态视图 */}
      {modalImage && (
        <div className="image-modal" onClick={() => setModalImage(null)}>
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="image-modal-close" onClick={() => setModalImage(null)}>
              ×
            </button>
            <img src={modalImage} alt="查看图片" className="image-modal-image" />
          </div>
        </div>
      )}
    </>
  );
}

export default MessageList;