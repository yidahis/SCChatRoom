import React, { useState, useEffect, useRef } from 'react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import UsersSidebar from './UsersSidebar';
import FileList from './FileList';

function ChatScreen({ currentUser, socket, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [showUsersSidebar, setShowUsersSidebar] = useState(false);
  const [showFileList, setShowFileList] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    // 监听消息
    socket.on('message', (messageData) => {
      setMessages(prev => [...prev, messageData]);
    });

    // 监听用户列表更新
    socket.on('usersList', (users) => {
      setOnlineUsers(users);
    });

    // 监听用户加入（仅用于更新在线用户列表，系统消息由后端直接发送）
    socket.on('userJoined', (data) => {
      // 系统消息现在由后端直接通过 'message' 事件发送
      console.log('用户加入:', data.user.username);
    });

    // 监听用户离开（仅用于更新在线用户列表，系统消息由后端直接发送）
    socket.on('userLeft', (data) => {
      // 系统消息现在由后端直接通过 'message' 事件发送
      console.log('用户离开:', data.user.username);
    });

    return () => {
      socket.off('message');
      socket.off('usersList');
      socket.off('userJoined');
      socket.off('userLeft');
    };
  }, [socket]);

  useEffect(() => {
    // 自动滚动到底部
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (messageData) => {
    if (socket) {
      if (messageData.type === 'image') {
        socket.emit('send_message', messageData);
      } else if (messageData.type === 'file') {
        socket.emit('send_message', messageData);
      } else if (messageData.message && messageData.message.trim()) {
        socket.emit('send_message', messageData);
      }
    }
  };

  const handleLogout = () => {
    if (socket) {
      socket.disconnect();
    }
    onLogout();
  };

  return (
    <div className="chat-screen">
      {/* 头部 */}
      <header className="chat-header">
        <div className="header-content">
          <div className="chat-info">
            <h2>WJAirDrop - 全局聊天室</h2>
            <span className="user-count">{onlineUsers.length} 人在线</span>
          </div>
          <div className="header-actions">
            <div className="user-profile">
              <div className="current-user-avatar">
                {currentUser?.username?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <span className="current-username">{currentUser?.username}</span>
            </div>
            <button 
              className="files-toggle"
              onClick={() => setShowFileList(true)}
              title="历史文件列表"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="10,9 9,9 8,9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button 
              className="users-toggle"
              onClick={() => setShowUsersSidebar(true)}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
                <path d="M23 21v-2a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button className="logout-btn" onClick={handleLogout}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="16,17 21,12 16,7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* 用户侧边栏 */}
      <UsersSidebar 
        users={onlineUsers}
        isOpen={showUsersSidebar}
        onClose={() => setShowUsersSidebar(false)}
      />

      {/* 文件列表 */}
      <FileList 
        isOpen={showFileList}
        onClose={() => setShowFileList(false)}
      />

      {/* 消息区域 */}
      <main className="chat-main">
        <div className="messages-container">
          <MessageList 
            messages={messages} 
            currentUser={currentUser}
          />
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* 输入区域 - 固定在底部 */}
      <footer className="chat-footer">
        <MessageInput onSendMessage={handleSendMessage} />
      </footer>
    </div>
  );
}

export default ChatScreen;