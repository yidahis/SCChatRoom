import React, { useState, useRef } from 'react';
import SparkMD5 from 'spark-md5';

// 获取后端服务器地址,绕过webpack代理
const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3678'
  : `http://${window.location.hostname}:3678`;

function MessageInput({ onSendMessage }) {
  const [message, setMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [remainingTime, setRemainingTime] = useState(0);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [uploadQueue, setUploadQueue] = useState([]);
  const [currentUploadIndex, setCurrentUploadIndex] = useState(0);
  const [uploadResults, setUploadResults] = useState([]);
  const [showUploadSummary, setShowUploadSummary] = useState(false);
  const fileInputRef = useRef(null);
  const generalFileInputRef = useRef(null);
  const uploadStartTimeRef = useRef(null);
  const perFileUploadedRef = useRef({});
  const messageInputRef = useRef(null);

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // 格式化速度
  const formatSpeed = (bytesPerSecond) => {
    return formatFileSize(bytesPerSecond) + '/s';
  };

  // 格式化时间
  const formatTime = (seconds) => {
    if (seconds < 60) return `${Math.round(seconds)}秒`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}分${remainingSeconds}秒`;
  };

  // 从文件名中提取 hash 值
  const extractHashFromFilename = (filename) => {
    // 匹配 "-[32位hex]" 模式（在扩展名之前）
    const hashPattern = /-([a-f0-9]{32})(?=\.[^.]*$)/i;
    const match = filename.match(hashPattern);
    return match ? match[1] : null;
  };

  // 计算文件的 MD5 哈希值
  const calculateFileHash = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const spark = new SparkMD5.ArrayBuffer();

      reader.onload = (e) => {
        try {
          spark.append(e.target.result);
          const hash = spark.end();
          resolve(hash);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => {
        reject(new Error('读取文件失败'));
      };

      // 分块读取大文件，避免内存溢出
      const chunkSize = 2 * 1024 * 1024; // 2MB
      const chunks = Math.ceil(file.size / chunkSize);
      let currentChunk = 0;

      const loadNext = () => {
        const start = currentChunk * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const slice = file.slice(start, end);

        reader.onload = (e) => {
          spark.append(e.target.result);
          currentChunk++;

          if (currentChunk < chunks) {
            // 使用 setTimeout 避免阻塞 UI
            setTimeout(loadNext, 0);
          } else {
            const hash = spark.end();
            resolve(hash);
          }
        };

        reader.readAsArrayBuffer(slice);
      };

      loadNext();
    });
  };

  // 检查文件是否已存在
  const checkFileExists = async (hash, token) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/check-file-hash?hash=${hash}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('检查文件存在性失败:', error);
      return { success: false, exists: false };
    }
  };

  // 重置上传状态
  const resetUploadState = () => {
    setUploadProgress(0);
    setUploadSpeed(0);
    setRemainingTime(0);
    setUploadedBytes(0);
    setTotalBytes(0);
    uploadStartTimeRef.current = null;
    perFileUploadedRef.current = {};
  };

  // 处理粘贴事件：从剪贴板中提取图片
  const handlePaste = async (e) => {
    if (!e.clipboardData) return;

    const items = e.clipboardData.items;
    if (!items) return;

    const imageFiles = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      // 检查是否为图片类型
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) {
          imageFiles.push(file);
        }
      }
    }

    // 如果粘贴板中有图片，自动上传
    if (imageFiles.length > 0) {
      e.preventDefault(); // 阻止默认粘贴行为（避免粘贴图片的 URL 或其他表示）
      const token = localStorage.getItem('token');
      if (token) {
        await uploadMultipleFiles(imageFiles, 'image', token);
      } else {
        alert('请先登录');
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage({ message, type: 'text' });
      setMessage('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    // 验证所有文件类型
    const invalidFiles = files.filter(file => !file.type.startsWith('image/'));
    if (invalidFiles.length > 0) {
      alert(`以下文件不是图片格式：${invalidFiles.map(f => f.name).join(', ')}`);
      return;
    }

    // 检查文件大小 (5MB)
    const oversizedFiles = files.filter(file => file.size > 5 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      alert(`以下图片文件大小超过5MB：${oversizedFiles.map(f => f.name).join(', ')}`);
      return;
    }

    // 获取token
    const token = localStorage.getItem('token');
    if (!token) {
      alert('请先登录');
      return;
    }

    await uploadMultipleFiles(files, 'image', token);
    
    // 清空文件输入
     if (fileInputRef.current) {
       fileInputRef.current.value = '';
     }
   };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    // 文件大小检查已移除，允许上传任意大小的文件

    // 检查危险文件扩展名
    const dangerousExts = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.jar', '.js', '.vbs', '.ps1'];
    const dangerousFiles = files.filter(file => {
      const fileExt = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      return dangerousExts.includes(fileExt);
    });
    if (dangerousFiles.length > 0) {
      alert(`不允许上传以下可执行文件：${dangerousFiles.map(f => f.name).join(', ')}`);
      return;
    }

    // 获取token
    const token = localStorage.getItem('token');
    if (!token) {
      alert('请先登录');
      return;
    }

    await uploadMultipleFiles(files, 'file', token);
    
    // 清空文件输入
    if (generalFileInputRef.current) {
      generalFileInputRef.current.value = '';
    }
  };

  // 并发控制器
  const runWithConcurrency = async (items, limit, worker) => {
    const results = new Array(items.length);
    let nextIndex = 0;
    let activeCount = 0;

    return new Promise((resolve, reject) => {
      const launchNext = () => {
        while (activeCount < limit && nextIndex < items.length) {
          const current = nextIndex++;
          activeCount++;
          setCurrentUploadIndex(current);
          worker(items[current], current)
            .then((res) => {
              results[current] = res;
            })
            .catch((err) => {
              results[current] = {
                success: false,
                error: err?.message || String(err) || '上传失败',
                fileName: items[current]?.name
              };
            })
            .finally(() => {
              activeCount--;
              if (nextIndex >= items.length && activeCount === 0) {
                resolve(results);
              } else {
                launchNext();
              }
            });
        }
      };

      launchNext();
    });
  };

  // 多文件上传函数（受控并发）
  const uploadMultipleFiles = async (files, type, token) => {
    setIsUploading(true);
    setUploadQueue(files);
    setCurrentUploadIndex(0);
    setUploadResults([]);

    // 先重置状态，再设置总大小
    resetUploadState();
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    setTotalBytes(totalSize);
    uploadStartTimeRef.current = Date.now();
    perFileUploadedRef.current = {};

    const concurrency = 4; // 受控并发数

    const results = await runWithConcurrency(files, concurrency, async (file, index) => {
      console.log(`🔄 上传文件 ${index + 1}/${files.length}: ${file.name}`);
      const result = await uploadSingleFile(file, type, token, index, totalSize);
      if (result?.success) {
        if (type === 'image') {
          onSendMessage({
            type: 'image',
            imageUrl: result.imageUrl,
            message: ''
          });
        } else {
          onSendMessage({
            type: 'file',
            fileUrl: result.fileUrl,
            filename: result.filename,
            originalName: result.originalName,
            size: result.size,
            mimetype: result.mimetype,
            message: ''
          });
        }
      }
      return result;
    });

    // 填充结果中的 fileName
    const finalResults = results.map((result, index) => ({
      ...result,
      fileName: result.fileName || files[index]?.name
    }));

    setUploadResults(finalResults);

    // 显示上传结果清单
    setShowUploadSummary(true);

    setIsUploading(false);
    resetUploadState();
    setUploadQueue([]);
    setCurrentUploadIndex(0);
  };

  // 关闭上传结果清单
  const closeUploadSummary = () => {
    setShowUploadSummary(false);
    setUploadResults([]);
  };
  
  // 单文件上传函数（带全局进度聚合）
  const uploadSingleFile = async (file, type, token, fileIndex, totalBytesValue) => {
    try {
      // 尝试从文件名中提取 hash
      const filenameHash = extractHashFromFilename(file.name);
      let fileHash;

      if (filenameHash) {
        // 文件名包含 hash，直接使用
        fileHash = filenameHash;
        console.log(`✅ [前端] 从文件名提取hash: ${file.name} → ${fileHash}`);
      } else {
        // 文件名不包含 hash，需要计算
        console.log(`🔍 [前端] 开始计算文件hash: ${file.name} (${formatFileSize(file.size)})`);
        fileHash = await calculateFileHash(file);
        console.log(`✅ [前端] 文件hash计算完成: ${fileHash}`);
      }

      // 检查文件是否已存在
      console.log(`🔍 [前端] 检查文件是否已存在...`);
      const checkResult = await checkFileExists(fileHash, token);

      if (checkResult.success && checkResult.exists) {
        // 文件已存在，直接使用已有文件
        console.log(`✅ [前端] 文件已存在，跳过上传: ${file.name}`);
        const result = {
          success: true,
          isDuplicate: true,
          fileUrl: checkResult.fileUrl,
          filename: checkResult.filename,
          originalName: checkResult.originalName,
          size: checkResult.size,
          mimetype: file.type,
          message: '文件已存在，使用已有文件',
          fileName: file.name
        };

        // 更新进度
        perFileUploadedRef.current[fileIndex] = file.size;
        const sumUploaded = Object.values(perFileUploadedRef.current).reduce((s, v) => s + (v || 0), 0);
        setUploadedBytes(sumUploaded);
        const progress = totalBytesValue > 0 ? (sumUploaded / totalBytesValue) * 100 : 0;
        setUploadProgress(progress);

        return result;
      }

      // 文件不存在，执行上传
      console.log(`📤 [前端] 文件不存在，开始上传: ${file.name}`);

      return new Promise((resolve) => {
        const formData = new FormData();
        const fieldName = type === 'image' ? 'image' : 'file';
        const endpoint = type === 'image' ? '/api/upload/image' : '/api/upload/file';
        // 使用完整后端URL,绕过webpack代理
        const fullUrl = `${BACKEND_URL}${endpoint}`;
        formData.append(fieldName, file);

        const xhr = new XMLHttpRequest();

        const updateAggregatedProgress = (bytesForThisFile) => {
          perFileUploadedRef.current[fileIndex] = bytesForThisFile;
          const sumUploaded = Object.values(perFileUploadedRef.current).reduce((s, v) => s + (v || 0), 0);
          setUploadedBytes(sumUploaded);
          const progress = totalBytesValue > 0 ? (sumUploaded / totalBytesValue) * 100 : 0;
          setUploadProgress(progress);

          const currentTime = Date.now();
          const elapsedTime = (currentTime - (uploadStartTimeRef.current || currentTime)) / 1000;
          if (elapsedTime > 0) {
            const speed = sumUploaded / elapsedTime;
            setUploadSpeed(speed);
            const remaining = Math.max((totalBytesValue - sumUploaded) / (speed || 1), 0);
            setRemainingTime(remaining);
          }
        };

        // 监听上传进度
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            updateAggregatedProgress(event.loaded);
          }
        });
        
        xhr.onload = () => {
          try {
            if (xhr.status >= 200 && xhr.status < 300) {
              const result = JSON.parse(xhr.responseText);
              // 确保最终计入该文件完整大小
              updateAggregatedProgress(file.size);
              resolve({ ...result, fileName: file.name });
            } else {
              resolve({ success: false, error: `HTTP ${xhr.status}`, fileName: file.name });
            }
          } catch (e) {
            resolve({ success: false, error: '响应解析失败', fileName: file.name });
          }
        };
        
        xhr.onerror = () => {
          resolve({ success: false, error: '网络错误', fileName: file.name });
        };

        xhr.ontimeout = () => {
          resolve({ success: false, error: '上传超时', fileName: file.name });
        };

        xhr.open('POST', fullUrl);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.withCredentials = false; // 绕过CORS预检

        // 对于文件上传，将 hash 作为额外的字段发送
        if (type === 'file') {
          formData.append('hash', fileHash);
        }

        // 根据文件大小动态设置超时时间
        // 基础5分钟 + 每MB增加1秒,最大2小时
        const fileSizeMB = file.size / (1024 * 1024);
        const baseTimeout = 5 * 60 * 1000; // 5分钟
        const additionalTimeout = Math.min(fileSizeMB * 1000, 115 * 60 * 1000); // 最多再加115分钟
        const dynamicTimeout = baseTimeout + additionalTimeout;
        xhr.timeout = dynamicTimeout; // 动态超时时间

        console.log(`⏱️ [前端] 文件: ${file.name}, 大小: ${formatFileSize(file.size)}, 超时设置: ${(dynamicTimeout / 60000).toFixed(1)}分钟, 直接访问后端: ${fullUrl}`);

        xhr.send(formData);
      });
    } catch (error) {
      console.error('❌ [前端] 文件上传失败:', error);
      return { success: false, error: error.message, fileName: file.name };
    }
  };

  const handleImageButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileButtonClick = () => {
    generalFileInputRef.current?.click();
  };

  return (
    <form onSubmit={handleSubmit} className="message-form">
      {/* 上传进度显示 */}
      {isUploading && (
        <div className="upload-progress-container">
          {/* 多文件上传队列信息 */}
          {uploadQueue.length > 1 && (
            <div className="upload-queue-info">
              <span className="queue-status">
                正在上传第 {currentUploadIndex + 1} 个文件，共 {uploadQueue.length} 个
              </span>
              <span className="current-file-name">
                {uploadQueue[currentUploadIndex]?.name}
              </span>
            </div>
          )}
          
          <div className="upload-progress-bar">
            <div 
              className="upload-progress-fill" 
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
          <div className="upload-info">
            <div className="upload-stats">
              <span className="upload-percentage">{uploadProgress.toFixed(1)}%</span>
              <span className="upload-size">
                {formatFileSize(uploadedBytes)} / {formatFileSize(totalBytes)}
              </span>
            </div>
            <div className="upload-speed-info">
              <span className="upload-speed">
                {uploadSpeed > 0 ? formatSpeed(uploadSpeed) : '计算中...'}
              </span>
              {remainingTime > 0 && (
                <span className="upload-remaining">
                  剩余 {formatTime(remainingTime)}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 上传结果清单 */}
      {showUploadSummary && uploadResults.length > 0 && (
        <div className="upload-summary-container">
          <div className="upload-summary-header">
            <div className="upload-summary-title">
              上传完成
              <span className="upload-summary-count">
                {uploadResults.filter(r => r && r.success).length}/{uploadResults.length}
              </span>
            </div>
            <button className="upload-summary-close" onClick={closeUploadSummary}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          <div className="upload-summary-list">
            {uploadResults.map((result, index) => {
              const file = uploadQueue[index];
              const fileName = result.fileName || file?.name || `文件 ${index + 1}`;

              return (
                <div key={index} className={`upload-summary-item ${result.success ? 'success' : 'failed'}`}>
                  <div className="upload-item-icon">
                    {result.success ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    )}
                  </div>
                  <div className="upload-item-info">
                    <div className="upload-item-name" title={fileName}>{fileName}</div>
                    <div className="upload-item-status">
                      {result.success ? (
                        result.isDuplicate ? '已存在（使用缓存）' : '上传成功'
                      ) : (
                        result.error || '上传失败'
                      )}
                    </div>
                  </div>
                  {file && (
                    <div className="upload-item-size">{formatFileSize(file.size)}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="input-container">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageUpload}
          accept="image/*"
          multiple
          style={{ display: 'none' }}
        />
        <input
          type="file"
          ref={generalFileInputRef}
          onChange={handleFileUpload}
          multiple
          style={{ display: 'none' }}
        />
        <button
          type="button"
          className="file-btn"
          onClick={handleFileButtonClick}
          disabled={isUploading}
          title="发送文件"
        >
          {isUploading ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  values="0 12 12;360 12 12"
                  dur="1s"
                  repeatCount="indefinite"/>
              </path>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2"/>
              <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2"/>
              <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="2"/>
              <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="2"/>
              <polyline points="10,9 9,9 8,9" stroke="currentColor" strokeWidth="2"/>
            </svg>
          )}
        </button>
        <button
          type="button"
          className="image-btn"
          onClick={handleImageButtonClick}
          disabled={isUploading}
          title="发送图片"
        >
          {isUploading ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  values="0 12 12;360 12 12"
                  dur="1s"
                  repeatCount="indefinite"/>
              </path>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
              <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="2"/>
              <polyline points="21,15 16,10 5,21" stroke="currentColor" strokeWidth="2"/>
            </svg>
          )}
        </button>
        <input
          ref={messageInputRef}
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          onPaste={handlePaste}
          placeholder="输入消息..."
          maxLength="500"
          autoComplete="off"
          className="message-input"
        />
        <button 
          type="submit" 
          className="send-btn"
          disabled={!message.trim()}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </form>
  );
}

export default MessageInput;