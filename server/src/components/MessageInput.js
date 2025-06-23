import React, { useState, useRef } from 'react';

function MessageInput({ onSendMessage }) {
  const [message, setMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const generalFileInputRef = useRef(null);

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
    const file = e.target.files[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件');
      return;
    }

    // 图片大小验证已移除，允许上传任意大小的图片

    // 获取token
    const token = localStorage.getItem('token');
    if (!token) {
      alert('请先登录');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/upload/image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        // 发送图片消息
        onSendMessage({
          type: 'image',
          imageUrl: result.imageUrl,
          message: '' // 可以添加图片描述
        });
      } else {
        alert(result.error || '图片上传失败');
      }
    } catch (error) {
      console.error('图片上传错误:', error);
      alert('图片上传失败');
    } finally {
      setIsUploading(false);
      // 清空文件输入
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 文件大小验证已移除，允许上传任意大小的文件

    // 获取token
    const token = localStorage.getItem('token');
    if (!token) {
      alert('请先登录');
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload/file', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        // 发送文件消息
        onSendMessage({
          type: 'file',
          fileUrl: result.fileUrl,
          filename: result.filename,
          originalName: result.originalName,
          size: result.size,
          mimetype: result.mimetype,
          message: '' // 可以添加文件描述
        });
      } else {
        alert(result.error || '文件上传失败');
      }
    } catch (error) {
      console.error('文件上传错误:', error);
      alert('文件上传失败');
    } finally {
      setIsUploading(false);
      // 清空文件输入
      if (generalFileInputRef.current) {
        generalFileInputRef.current.value = '';
      }
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
      <div className="input-container">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageUpload}
          accept="image/*"
          style={{ display: 'none' }}
        />
        <input
          type="file"
          ref={generalFileInputRef}
          onChange={handleFileUpload}
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
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
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