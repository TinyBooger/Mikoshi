import React from 'react';
import ButtonBlack from './ButtonBlack';
import ButtonWhite from './ButtonWhite';
import defaultPic from '../assets/images/default-picture.png';


// Accept all required props for the sidebar
export default function CharacterSidebar({
    characterSidebarVisible,
    onToggleCharacterSidebar,
    initModal,
    setInitModal,
    selectedCharacter,
    selectedPersona,
    selectedScene,
    personaModal,
    setPersonaModal,
    sceneModal,
    setSceneModal,
    characterModal,
    setCharacterModal,
    userData,
    characterId,
    selectedChat,
    editingChatId,
    newTitle,
    setNewTitle,
    setEditingChatId,
    menuOpenId,
    setMenuOpenId,
    handleRename,
    handleDelete,
    loadChat,
    showChatHistory,
    setShowChatHistory,
    initializeChat,
    likeCharacter,
    hasLiked,
    likes,
    setSelectedPersona,
    setSelectedScene,
    setSelectedCharacter,
    navigate,
    isMobile = false // allow parent to pass isMobile, default false
}) {
  // Sidebar animation style for both mobile and desktop
  const sidebarStyle = isMobile
    ? {
        position: 'fixed',
        top: '7dvh', // Place below the topbar
        right: 0,
        width: '70vw',
        maxWidth: '20rem',
        height: 'calc(100dvh - 7dvh)',
        zIndex: 1000,
        background: 'rgba(255, 255, 255, 0.90)',
        boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
        transform: characterSidebarVisible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.35s cubic-bezier(.4,0,.2,1)',
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',
        display: 'flex',
        flexDirection: 'column',
        pointerEvents: characterSidebarVisible ? 'auto' : 'none',
        opacity: characterSidebarVisible ? 1 : 0,
        borderRadius: '1.5rem',
      }
    : {
        position: 'relative',
        width: '15rem',
        height: 'calc(100dvh - 7dvh)',
        transform: characterSidebarVisible ? 'translateX(0)' : 'translateX(15rem)',
        marginLeft: characterSidebarVisible ? '0' : '-15rem', // Pull back the reserved space
        transition: 'transform 0.35s ease, margin-left 0.35s ease',
        boxShadow: '2px 0 8px rgba(0,0,0,0.05)',
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',
        display: 'flex',
        flexDirection: 'column',
        pointerEvents: characterSidebarVisible ? 'auto' : 'none',
        opacity: characterSidebarVisible ? 1 : 0,
        flexShrink: 0,
        background: 'rgba(255, 255, 255, 0.90)',
        borderRadius: '1.5rem',
      };
  return (
    <>
      {/* Overlay for mobile CharacterSidebar */}
      {isMobile && characterSidebarVisible && (
        <div
          onClick={() => onToggleCharacterSidebar()}
          style={{
            position: 'fixed',
            top: '7dvh', // Start below the topbar
            left: 0,
            width: '100vw',
            height: 'calc(100dvh - 7dvh)', // Only cover below the topbar
            background: 'rgba(0,0,0,0.3)',
            zIndex: 999,
            cursor: 'pointer',
            touchAction: 'manipulation',
          }}
        />
      )}
      <div style={sidebarStyle}>
  <aside style={{ width: '100%', minHeight: 0, background: 'transparent', borderRadius: '1.2rem', margin: 0, boxShadow: 'none', display: 'flex', flexDirection: 'column', padding: '1.2rem 1.2rem 0.96rem 1.2rem', height: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.6rem' }}>
            <img
            src={selectedCharacter?.picture || defaultPic}
            alt="Character Avatar"
            style={{ width: 102, height: 102, objectFit: 'cover', borderRadius: '50%', border: '2.4px solid #e9ecef', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginRight: 19 }}
            />
            <div>
                <div style={{ color: '#888', fontSize: 13, marginBottom: 2 }}>
                    <i className="bi bi-person-fill me-1"></i> By:
                    <span
                    style={{ color: '#18191a', fontWeight: 600, marginLeft: 6, cursor: 'pointer' }}
                    onClick={() => navigate(`/profile/${selectedCharacter?.creator_id}`)}
                    >
                    {selectedCharacter?.creator_name || 'Unknown'}
                    </span>
                </div>
                <div style={{ color: '#888', fontSize: 13, marginBottom: 2 }}>
                    <i className="bi bi-calendar me-1"></i> {selectedCharacter && new Date(selectedCharacter.created_time).toLocaleDateString()}
                </div>
                <div style={{ color: '#888', fontSize: 13 }}>
                    <i className="bi bi-chat-square-text me-1"></i> {selectedCharacter?.views || 0} chats
                </div>
            </div>
        </div>
      <h3 style={{ fontWeight: 700, textAlign: 'center', marginBottom: 6, color: '#18191a', fontSize: '1.2rem', letterSpacing: '0.4px' }}>{selectedCharacter?.name}</h3>
      {selectedCharacter?.tagline && (
        <p style={{ textAlign: 'center', color: '#888', marginBottom: 19, fontStyle: 'italic', fontSize: '0.86rem' }}>
          "{selectedCharacter.tagline}"
        </p>
      )}
        {/* New Chat Button */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
              <ButtonBlack
                type="button"
                isMobile={isMobile}
                onClick={() => setInitModal(true)}
              >
                <i className="bi bi-plus-circle me-2"></i> New Chat
              </ButtonBlack>
        </div>
      {/* Chat History Section */}
      {userData?.chat_history?.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h6 style={{ fontWeight: 700, margin: 0, fontSize: '1.02rem', color: '#18191a' }}>Chat History</h6>
            <ButtonWhite
              type="button"
              isMobile={isMobile}
              onClick={() => setShowChatHistory(!showChatHistory)}
            >
              {showChatHistory ? 'Hide' : 'Show'}
            </ButtonWhite>
          </div>
          {showChatHistory && (
            <div style={{ maxHeight: 220, overflowY: 'auto', borderRadius: 12, background: '#f5f6fa', padding: 8 }}>
              {userData.chat_history
                .filter(chat => chat.character_id === characterId)
                .sort((a, b) => new Date(b.last_updated) - new Date(a.last_updated))
                .map((chat) => (
                  <div
                    key={chat.chat_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.5rem 1rem',
                      borderRadius: 10,
                      background: selectedChat?.chat_id === chat.chat_id ? '#18191a' : 'transparent',
                      color: selectedChat?.chat_id === chat.chat_id ? '#fff' : '#232323',
                      marginBottom: 4,
                      cursor: 'pointer',
                      fontWeight: 500,
                      fontSize: '0.98rem',
                      transition: 'background 0.18s, color 0.18s',
                    }}
                    onClick={() => loadChat(chat)}
                  >
                    {editingChatId === chat.chat_id ? (
                      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <input
                          type="text"
                          className="form-control form-control-sm me-2"
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRename(chat.chat_id, chat.title);
                            if (e.key === 'Escape') setEditingChatId(null);
                          }}
                          autoFocus
                          style={{ flex: 1, borderRadius: 8, border: '1.5px solid #e9ecef', fontSize: '0.98rem' }}
                        />
                        <button
                          className="btn btn-sm btn-success"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRename(chat.chat_id, chat.title);
                          }}
                        >
                          <i className="bi bi-check"></i>
                        </button>
                        <button
                          className="btn btn-sm btn-danger ms-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingChatId(null);
                          }}
                        >
                          <i className="bi bi-x"></i>
                        </button>
                      </div>
                    ) : (
                      <>
                        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {chat.title || chat.messages.find(m => m.role === 'user')?.content || 'New Chat'}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <small style={{ color: selectedChat?.chat_id === chat.chat_id ? '#fff' : '#888', fontWeight: 400 }}>
                            {new Date(chat.last_updated).toLocaleDateString()}
                          </small>
                          <div className="dropdown">
                            <button
                              className="btn btn-sm btn-link text-muted p-0"
                              onClick={(e) => toggleMenu(chat.chat_id, e)}
                              style={{ position: 'relative', zIndex: menuOpenId === chat.chat_id ? 1000 : 'auto', color: selectedChat?.chat_id === chat.chat_id ? '#fff' : '#888' }}
                            >
                              <i className="bi bi-three-dots-vertical"></i>
                            </button>
                            {menuOpenId === chat.chat_id && (
                              <div
                                className="dropdown-menu show"
                                style={{
                                  position: 'fixed',
                                  right: '1rem',
                                  zIndex: 9999,
                                  minWidth: '120px',
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                                }}
                              >
                                <button
                                  className="dropdown-item"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setNewTitle(chat.title || '');
                                    setEditingChatId(chat.chat_id);
                                    setMenuOpenId(null);
                                  }}
                                >
                                  <i className="bi bi-pencil me-2"></i> Rename
                                </button>
                                <button
                                  className="dropdown-item text-danger"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(chat.chat_id);
                                    setMenuOpenId(null);
                                  }}
                                >
                                  <i className="bi bi-trash me-2"></i> Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
      {/* Like Button */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
        <button
          onClick={likeCharacter}
          disabled={hasLiked}
            style={{
              background: hasLiked ? '#e53935' : '#fff',
              color: hasLiked ? '#fff' : '#e53935',
              border: hasLiked ? 'none' : '1.2px solid #e53935',
              borderRadius: '1.6rem',
              fontWeight: 600,
              fontSize: '0.86rem',
              padding: '0.32rem 1.2rem',
              boxShadow: hasLiked ? '0 2px 8px rgba(229,57,53,0.08)' : 'none',
              cursor: hasLiked ? 'not-allowed' : 'pointer',
              opacity: hasLiked ? 0.8 : 1,
              transition: 'all 0.14s',
              outline: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
        >
          <i className={`bi ${hasLiked ? 'bi-heart-fill' : 'bi-heart'}`} style={{ fontSize: 20 }}></i>
          <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>{likes}</span>
        </button>
      </div>
      {/* Tags */}
      {selectedCharacter?.tags?.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <h6 style={{ fontWeight: 700, marginBottom: 6, textAlign: 'center', color: '#18191a', fontSize: '0.82rem' }}>Tags</h6>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 6 }}>
            {selectedCharacter.tags.map((tag, i) => (
              <span key={i} style={{
                background: '#f5f6fa',
                color: '#232323',
                border: '1.2px solid #e9ecef',
                borderRadius: '1.2rem',
                fontWeight: 600,
                fontSize: '0.78rem',
                padding: '0.24rem 0.88rem',
                marginBottom: 2
              }}>
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}
      </aside>
      </div>
    </>
  );
}
