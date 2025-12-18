import React from 'react';
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';

import InfoCard from './InfoCard';
import ProblemReportModal from './ProblemReportModal';
import { useTranslation } from 'react-i18next';


// Accept all required props for the sidebar
export default function CharacterSidebar({
  characterSidebarVisible,
  onToggleCharacterSidebar,
  onNewChat,
  selectedCharacter,
  selectedPersona,
  selectedScene,
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
  const [showProblemReport, setShowProblemReport] = React.useState(false);
  const { t } = useTranslation();
  // Fix: Toggle menu for chat history dropdown, prevent event bubbling
  const toggleMenu = (chatId, e) => {
    e.stopPropagation();
    setMenuOpenId(menuOpenId === chatId ? null : chatId);
  };
  // Determine entry mode based on which entity is currently selected
  // Priority: if scene is selected, we're in scene mode (even if character is also selected)
  // Otherwise, if character is selected, we're in character mode
  const isSceneMode = !!selectedScene;
  const isCharacterMode = !!selectedCharacter && !selectedScene;
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
        background: 'rgba(255, 255, 255, 0.98)',
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
        background: 'rgba(255, 255, 255, 0.98)',
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
          {/* Main Entity InfoCard */}
          <div style={{
            background: '#fff',
            borderRadius: '1.2rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            marginBottom: 18,
            paddingTop: '1.2rem',
            zIndex: 1,
            position: 'relative',
          }}>
            <InfoCard
              character={isCharacterMode ? selectedCharacter : undefined}
              scene={isSceneMode ? selectedScene : undefined}
              persona={undefined}
              creatorHover={creatorHover}
              setCreatorHover={setCreatorHover}
              onCreatorClick={() => {
                const entity = isCharacterMode ? selectedCharacter : isSceneMode ? selectedScene : null;
                if (entity?.creator_id) navigate(`/profile/${entity.creator_id}`);
              }}
              hasLiked={isCharacterMode ? { character: hasLiked.character } : isSceneMode ? { scene: hasLiked.scene } : {}}
              onLike={() => {
                if (isCharacterMode && selectedCharacter) {
                  if (hasLiked.character) {
                    unlikeEntity('character', selectedCharacter.id);
                  } else {
                    likeEntity('character', selectedCharacter.id);
                  }
                } else if (isSceneMode && selectedScene) {
                  if (hasLiked.scene) {
                    unlikeEntity('scene', selectedScene.id);
                  } else {
                    likeEntity('scene', selectedScene.id);
                  }
                }
              }}
              showFullTagline={showFullTagline}
              setShowFullTagline={setShowFullTagline}
              isPlaceholder={!selectedCharacter && !selectedScene}
            />
            {/* Report button */}
            {(selectedCharacter || selectedScene) && (
              <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0 12px 0' }}>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => setShowProblemReport(true)}
                  title={t('topbar.report_problem')}
                  aria-label={t('topbar.report_problem')}
                  style={{ borderRadius: '50%', width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <i className="bi bi-flag" style={{ fontSize: '14px' }}></i>
                </button>
              </div>
            )}
          </div>

          {/* Character Selection Box (only in Scene Mode) */}
          {isSceneMode && selectedCharacter && (
            <div style={{
              background: '#f5f6fa',
              borderRadius: '0.9rem',
              padding: '0.8rem',
              marginBottom: 14,
              border: '1px solid rgba(24, 25, 26, 0.08)',
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.01em' }}>
                {t('chat.selected_character')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <img
                  src={selectedCharacter.picture
                    ? `${window.API_BASE_URL.replace(/\/$/, '')}/${selectedCharacter.picture.replace(/^\//, '')}`
                    : `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect fill='%236b8cff' width='40' height='40'/%3E%3C/svg%3E`
                  }
                  alt={selectedCharacter.name}
                  style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#232323', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedCharacter.name}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Persona Selection Box (Character and Scene Mode) */}
          {(isCharacterMode || isSceneMode) && (
            <div style={{
              background: selectedPersona ? '#f5f6fa' : '#fff',
              borderRadius: '0.9rem',
              padding: '0.8rem',
              marginBottom: 14,
              border: selectedPersona ? '1px solid rgba(24, 25, 26, 0.08)' : '1.2px dashed #d1d5db',
              cursor: 'pointer',
              transition: 'all 0.16s',
            }}
            onMouseEnter={(e) => {
              if (!selectedPersona) {
                e.currentTarget.style.borderColor = '#18191a';
                e.currentTarget.style.background = '#f9fafb';
              }
            }}
            onMouseLeave={(e) => {
              if (!selectedPersona) {
                e.currentTarget.style.borderColor = '#d1d5db';
                e.currentTarget.style.background = '#fff';
              }
            }}
            onClick={() => {
              // TODO: Open persona selector modal or show available personas
              // For now, just a placeholder
            }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.01em' }}>
                {t('chat.persona')}
              </div>
              {selectedPersona ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <img
                    src={selectedPersona.picture
                      ? `${window.API_BASE_URL.replace(/\/$/, '')}/${selectedPersona.picture.replace(/^\//, '')}`
                      : `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect fill='%23a28bff' width='40' height='40'/%3E%3C/svg%3E`
                      }
                    alt={selectedPersona.name}
                    style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#232323', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedPersona.name}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.88rem', color: '#888', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <i className="bi bi-plus-circle" style={{ fontSize: '0.9rem' }}></i>
                  {t('chat.add_persona')}
                </div>
              )}
            </div>
          )}

        {/* New Chat Button */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <PrimaryButton
            type="button"
            isMobile={isMobile}
            onClick={onNewChat}
          >
            <i className="bi bi-plus-circle me-2"></i> {t('chat.new_chat')}
          </PrimaryButton>
        </div>

        {/* Chat History Section */}
        {userData?.chat_history?.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h6 style={{ fontWeight: 700, margin: 0, fontSize: '1.02rem', color: '#18191a' }}>{t('chat.chat_history')}</h6>
              <SecondaryButton
                type="button"
                isMobile={isMobile}
                onClick={() => setShowChatHistory(!showChatHistory)}
              >
                {showChatHistory ? t('chat.hide') : t('chat.show')}
              </SecondaryButton>
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
                            {chat.title || chat.messages.find(m => m.role === 'user')?.content || t('chat.new_chat_title')}
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
                                    <i className="bi bi-pencil me-2"></i> {t('chat.rename')}
                                  </button>
                                  <button
                                    className="dropdown-item text-danger"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(chat.chat_id);
                                      setMenuOpenId(null);
                                    }}
                                  >
                                    <i className="bi bi-trash me-2"></i> {t('chat.delete')}
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
      {/* Problem Report Modal via portal */}
      <ProblemReportModal
        show={showProblemReport}
        onClose={() => setShowProblemReport(false)}
        targetType={isCharacterMode ? 'character' : isSceneMode ? 'scene' : null}
        targetId={isCharacterMode ? selectedCharacter?.id : isSceneMode ? selectedScene?.id : null}
        targetName={isCharacterMode ? selectedCharacter?.name : isSceneMode ? selectedScene?.name : null}
      />
    </>
  );
}
