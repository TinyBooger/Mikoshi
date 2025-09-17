import React from 'react';
import ButtonBlack from './ButtonBlack';
import ButtonWhite from './ButtonWhite';
import defaultPic from '../assets/images/default-picture.png';

import InfoCard from './InfoCard';


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
  likeEntity, // <-- add likeEntity
  unlikeEntity, // <-- add unlikeEntity
  likes,
  setSelectedPersona,
  setSelectedScene,
  setSelectedCharacter,
  navigate,
  hasLiked,
  isMobile = false // allow parent to pass isMobile, default false
}) {
  const [creatorHover, setCreatorHover] = React.useState(false);
  const [showFullTagline, setShowFullTagline] = React.useState(false);
  // Track which entity type is currently shown: 'character', 'scene', 'persona'
  const entityTypes = [];
  if (selectedCharacter) entityTypes.push('character');
  if (selectedScene) entityTypes.push('scene');
  if (selectedPersona) entityTypes.push('persona');
  // Default to character if available
  const [currentEntityType, setCurrentEntityType] = React.useState(entityTypes[0] || null);
  // Keep currentEntityType in sync with available entities
  React.useEffect(() => {
    if (!entityTypes.includes(currentEntityType)) {
      setCurrentEntityType(entityTypes[0] || null);
    }
    // eslint-disable-next-line
  }, [selectedCharacter, selectedScene, selectedPersona]);
  // Fix: Toggle menu for chat history dropdown, prevent event bubbling
  const toggleMenu = (chatId, e) => {
    e.stopPropagation();
    setMenuOpenId(menuOpenId === chatId ? null : chatId);
  };
  // Sidebar animation style for both mobile and desktop
  const sidebarStyle = isMobile
    ? {
        position: 'fixed',
        top: '7dvh', // Place below the topbar
        right: 0,
  width: '90vw',
  maxWidth: '19rem', // Reduced max width for mobile
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
        width: '19rem', // Reduced width for desktop
        height: 'calc(100dvh - 7dvh)',
        transform: characterSidebarVisible ? 'translateX(0)' : 'translateX(19rem)',
        marginLeft: characterSidebarVisible ? '0' : '-19rem', // Pull back the reserved space
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
            top: '7dvh',
            left: 0,
            width: '100vw',
            height: 'calc(100dvh - 7dvh)',
            background: 'rgba(0,0,0,0.3)',
            zIndex: 999,
            cursor: 'pointer',
            touchAction: 'manipulation',
          }}
        />
      )}
      <div style={sidebarStyle}>
        <aside style={{ width: '100%', minHeight: 0, background: 'transparent', borderRadius: '1.2rem', margin: 0, boxShadow: 'none', display: 'flex', flexDirection: 'column', padding: '1.2rem 1.2rem 0.96rem 1.2rem', height: 'auto' }}>
          {/* Modern Tabs for entity type switching */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-end',
            gap: 4,
            marginBottom: '-0.3rem',
            zIndex: 2,
            position: 'relative',
          }}>
            {['character', 'scene', 'persona'].map((type) => (
              <button
                key={type}
                disabled={!entityTypes.includes(type)}
                onClick={() => setCurrentEntityType(type)}
                style={{
                  padding: '0.28rem 0.7rem',
                  border: 'none',
                  borderTopLeftRadius: type === 'character' ? '0.7rem' : '0.35rem',
                  borderTopRightRadius: type === 'persona' ? '0.7rem' : '0.35rem',
                  borderBottom: currentEntityType === type ? '2px solid #18191a' : '2px solid transparent',
                  background: currentEntityType === type ? '#fff' : '#f5f6fa',
                  color: !entityTypes.includes(type) ? '#bbb' : currentEntityType === type ? '#18191a' : '#888',
                  fontWeight: 600,
                  fontSize: '0.93rem',
                  cursor: !entityTypes.includes(type) ? 'not-allowed' : 'pointer',
                  boxShadow: currentEntityType === type ? '0 -1.5px 6px rgba(0,0,0,0.03)' : 'none',
                  transition: 'all 0.16s',
                  outline: 'none',
                  marginBottom: currentEntityType === type ? '-2px' : 0,
                  opacity: !entityTypes.includes(type) ? 0.5 : 1,
                  position: 'relative',
                  minWidth: '64px',
                  letterSpacing: '0.01em',
                }}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
          {/* InfoCard, visually connected to tabs */}
          <div style={{
            background: '#fff',
            borderRadius: '1.2rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            marginTop: 0,
            marginBottom: 18,
            paddingTop: '1.2rem',
            borderTopLeftRadius: '0 0 1.2rem 1.2rem',
            borderTopRightRadius: '0 0 1.2rem 1.2rem',
            borderTop: 'none',
            zIndex: 1,
            position: 'relative',
          }}>
            <InfoCard
              character={currentEntityType === 'character' ? selectedCharacter : undefined}
              scene={currentEntityType === 'scene' ? selectedScene : undefined}
              persona={currentEntityType === 'persona' ? selectedPersona : undefined}
              creatorHover={creatorHover}
              setCreatorHover={setCreatorHover}
              onCreatorClick={() => {
                const entity =
                  currentEntityType === 'character' ? selectedCharacter :
                  currentEntityType === 'scene' ? selectedScene :
                  currentEntityType === 'persona' ? selectedPersona : null;
                if (entity?.creator_id) navigate(`/profile/${entity.creator_id}`);
              }}
              hasLiked={hasLiked}
              onLike={() => {
                if (currentEntityType === 'character' && selectedCharacter) {
                  if (hasLiked.character) {
                    unlikeEntity('character', selectedCharacter.id);
                  } else {
                    likeEntity('character', selectedCharacter.id);
                  }
                } else if (currentEntityType === 'scene' && selectedScene) {
                  if (hasLiked.scene) {
                    unlikeEntity('scene', selectedScene.id);
                  } else {
                    likeEntity('scene', selectedScene.id);
                  }
                } else if (currentEntityType === 'persona' && selectedPersona) {
                  if (hasLiked.persona) {
                    unlikeEntity('persona', selectedPersona.id);
                  } else {
                    likeEntity('persona', selectedPersona.id);
                  }
                }
              }}
              showFullTagline={showFullTagline}
              setShowFullTagline={setShowFullTagline}
              isPlaceholder={!selectedCharacter && !selectedScene && !selectedPersona}
            />
          </div>

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
        </aside>
      </div>
    </>
  );
}
