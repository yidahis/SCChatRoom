import React from 'react';

function UsersSidebar({ users, isOpen, onClose }) {
  return (
    <div className={`users-sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <h3>在线用户</h3>
        <button className="close-btn" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
      <div className="users-list">
        {users.map((user, index) => (
          <div key={index} className="user-item">
            <div className="user-avatar">
              {user.username?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="user-name">
              {user.username}
            </div>
          </div>
        ))}
        {users.length === 0 && (
          <div className="no-users">
            暂无在线用户
          </div>
        )}
      </div>
    </div>
  );
}

export default UsersSidebar;