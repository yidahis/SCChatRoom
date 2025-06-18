import React, { useState } from 'react';

function MessageList({ messages, currentUser }) {
  const [modalImage, setModalImage] = useState(null);
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