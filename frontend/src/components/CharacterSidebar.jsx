import React from 'react';
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';

import InfoCard from './InfoCard';
import ProblemReportModal from './ProblemReportModal';
import { useTranslation } from 'react-i18next';
import {
  getContextWindowTierOptions,
  normalizeContextWindowTier,
} from '../utils/contextWindow';
import { useToast } from '../components/ToastProvider';


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
  advancedChatConfig,
  setAdvancedChatConfig,
  onResetAdvancedChatConfig,
  canUseAdvancedChatConfig,
  wallpaperOptions,
  selectedWallpaperId,
  onSelectWallpaper,
  pinnedMemories,
  maxPinnedMemories = 10,
  onJumpToPinnedMemory,
  onUnpinMemory,
  isMobile = false, // allow parent to pass isMobile, default false
  setPersonaModalShow, // <-- new prop to open PersonaModal
  onShareChatLink // <-- handler for share button
}) {
  const [creatorHover, setCreatorHover] = React.useState(false);
  const toast = useToast();
  const [showFullTagline, setShowFullTagline] = React.useState(false);
  const [showProblemReport, setShowProblemReport] = React.useState(false);
  const [showWallpaperPicker, setShowWallpaperPicker] = React.useState(false);
  const [showMemoryManagement, setShowMemoryManagement] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('chat');
  const [activeHintKey, setActiveHintKey] = React.useState(null);
  const [shareIconFocused, setShareIconFocused] = React.useState(false);
  const [reportIconFocused, setReportIconFocused] = React.useState(false);
  const { t } = useTranslation();
  const isProUser = !!userData?.is_pro;
  const TOKEN_LIMITS_BY_MODEL = {
    'deepseek-chat': { min: 1, max: 8192, defaultValue: 4096 },
    'deepseek-reasoner': { min: 1, max: 65536, defaultValue: 32768 },
  };
  const TOKEN_TIERS_BY_MODEL = {
    'deepseek-chat': [
      { value: 1024, labelKey: 'short_sentence' },
      { value: 2048, labelKey: 'paragraph' },
      { value: 4096, labelKey: 'long' },
      { value: 6144, labelKey: 'very_long' },
      { value: 8192, labelKey: 'maximum' },
    ],
    'deepseek-reasoner': [
      { value: 8192, labelKey: 'short_sentence' },
      { value: 16384, labelKey: 'paragraph' },
      { value: 32768, labelKey: 'long' },
      { value: 49152, labelKey: 'very_long' },
      { value: 65536, labelKey: 'maximum' },
    ],
  };
  const getTokenLimits = (modelName) => TOKEN_LIMITS_BY_MODEL[modelName] || TOKEN_LIMITS_BY_MODEL['deepseek-chat'];
  const getTokenTiers = (modelName) => TOKEN_TIERS_BY_MODEL[modelName] || TOKEN_TIERS_BY_MODEL['deepseek-chat'];
  const clampValue = (value, min, max, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
  };
  const normalizeTokenTierValue = (modelName, rawValue) => {
    const tokenLimits = getTokenLimits(modelName);
    const tiers = getTokenTiers(modelName);
    const clamped = clampValue(rawValue, tokenLimits.min, tokenLimits.max, tokenLimits.defaultValue);
    return tiers.reduce((nearest, tier) => (
      Math.abs(tier.value - clamped) < Math.abs(nearest.value - clamped) ? tier : nearest
    ), tiers[0]).value;
  };
  const selectedTokenLimits = getTokenLimits(advancedChatConfig?.model || 'deepseek-chat');
  const selectedTokenTiers = getTokenTiers(advancedChatConfig?.model || 'deepseek-chat');

  const contextWindowTierOptions = getContextWindowTierOptions({
    canUseAdvancedConfig: canUseAdvancedChatConfig,
    isProUser,
  });
  const selectedContextWindowTier = normalizeContextWindowTier(advancedChatConfig?.context_window_tier, {
    canUseAdvancedConfig: canUseAdvancedChatConfig,
    isProUser,
  });
  const updateConfig = (key, value, min, max, fallback) => {
    const parsed = Number(value);
    const nextValue = Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
    setAdvancedChatConfig((prev) => ({ ...prev, [key]: nextValue }));
  };
  const handleModelChange = (nextModel) => {
    const nextTokenLimits = getTokenLimits(nextModel);
    setAdvancedChatConfig((prev) => ({
      ...prev,
      model: nextModel,
      max_tokens: normalizeTokenTierValue(nextModel, nextTokenLimits.defaultValue),
    }));
  };
  const InfoHint = ({ hintKey }) => {
    const text = t(hintKey);
    const isOpen = activeHintKey === hintKey;
    return (
      <span style={{ marginLeft: 6, display: 'inline-flex', alignItems: 'center', position: 'relative' }}>
        <button
          type="button"
          onClick={() => setActiveHintKey((prev) => (prev === hintKey ? null : hintKey))}
          title={text}
          aria-label={text}
          style={{
            width: isMobile ? 24 : 18,
            height: isMobile ? 24 : 18,
            border: 'none',
            background: 'transparent',
            color: '#6b7280',
            padding: 0,
            borderRadius: '50%',
            cursor: 'help',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <i className="bi bi-info-circle" style={{ fontSize: isMobile ? '0.95rem' : '0.85rem' }}></i>
        </button>
        {isOpen && (
          <div
            role="note"
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              zIndex: 20,
              minWidth: isMobile ? 220 : 260,
              maxWidth: isMobile ? 280 : 340,
              background: '#111827',
              color: '#f9fafb',
              borderRadius: 8,
              padding: '0.45rem 0.55rem',
              fontSize: '0.72rem',
              lineHeight: 1.35,
              boxShadow: '0 6px 18px rgba(0, 0, 0, 0.25)',
              textAlign: 'left',
            }}
          >
            {text}
          </div>
        )}
      </span>
    );
  };
  // Fix: Toggle menu for chat history dropdown, prevent event bubbling
  const toggleMenu = (chatId, e) => {
    e.stopPropagation();
    setMenuOpenId(menuOpenId === chatId ? null : chatId);
  };
  // Determine entry mode based on which entity is currently selected
  // Priority: Scene > Character > None (mutually exclusive states)
  const isSceneMode = !!selectedScene;
  const isCharacterMode = !isSceneMode && !!selectedCharacter;
  const sidebarMotion = '0.35s cubic-bezier(.4,0,.2,1)';
  // Sidebar animation style for both mobile and desktop
  const sidebarStyle = isMobile
    ? {
        position: 'fixed',
        top: 0,
        right: 0,
        width: '90vw',
        maxWidth: '19rem', // Reduced max width for mobile
        height: '100dvh',
        zIndex: 1000,
        background: 'rgba(255, 255, 255, 0.98)',
        boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
        transform: characterSidebarVisible ? 'translateX(0)' : 'translateX(100%)',
        transition: `transform ${sidebarMotion}, opacity ${sidebarMotion}`,
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        pointerEvents: characterSidebarVisible ? 'auto' : 'none',
        opacity: characterSidebarVisible ? 1 : 0,
        borderRadius: 0,
      }
    : {
        position: 'relative',
        width: '19rem', // Reduced width for desktop
      height: '100dvh',
        transform: characterSidebarVisible ? 'translateX(0)' : 'translateX(19rem)',
        marginLeft: characterSidebarVisible ? '0' : '-19rem', // Pull back the reserved space
        transition: `transform ${sidebarMotion}, margin-left ${sidebarMotion}, opacity ${sidebarMotion}`,
        boxShadow: '2px 0 8px rgba(0,0,0,0.05)',
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        pointerEvents: characterSidebarVisible ? 'auto' : 'none',
        opacity: characterSidebarVisible ? 1 : 0,
        flexShrink: 0,
        background: 'rgba(255, 255, 255, 0.98)',
        borderRadius: 0,
      };

  return (
    <>
      {/* Overlay for mobile CharacterSidebar */}
      {isMobile && characterSidebarVisible && (
        <div
          onClick={() => onToggleCharacterSidebar()}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100dvh',
            background: 'rgba(0,0,0,0.3)',
            zIndex: 999,
            cursor: 'pointer',
            touchAction: 'manipulation',
          }}
        />
      )}
      <div style={sidebarStyle}>
        <aside style={{ width: '100%', minHeight: 0, maxHeight: '100%', background: 'transparent', borderRadius: 0, margin: 0, boxShadow: 'none', display: 'flex', flexDirection: 'column', padding: '1.2rem 1.2rem 0.96rem 1.2rem', boxSizing: 'border-box', height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
          {/* CharacterSidebar Header: collapse toggle left, share + report right */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: '2.5rem',
            marginBottom: '0.75rem',
            flexShrink: 0,
          }}>
            <button
              type="button"
              onClick={() => onToggleCharacterSidebar()}
              aria-label={t('topbar.hide_character_sidebar')}
              title={t('topbar.hide_character_sidebar')}
              style={{
                border: 'none',
                background: 'transparent',
                padding: '0.2rem',
                margin: 0,
                color: '#232323',
                fontSize: '1.5rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
                borderRadius: 8,
                transition: 'background 0.16s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,208,245,0.55)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <i className="bi bi-chevron-right" style={{ pointerEvents: 'none' }}></i>
            </button>
            {(selectedCharacter || selectedScene) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => { if (onShareChatLink) onShareChatLink(toast); }}
                  aria-label="分享当前聊天链接"
                  title="分享当前聊天链接"
                  style={{
                    border: 'none',
                    background: 'none',
                    padding: 0,
                    color: '#2563eb',
                    cursor: 'pointer',
                    fontSize: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1,
                  }}
                  onMouseEnter={() => setShareIconFocused(true)}
                  onMouseLeave={() => setShareIconFocused(false)}
                  onFocus={() => setShareIconFocused(true)}
                  onBlur={() => setShareIconFocused(false)}
                >
                  <i className={`bi ${shareIconFocused ? 'bi-share-fill' : 'bi-share'}`} style={{ pointerEvents: 'none' }}></i>
                </button>
                <button
                  type="button"
                  onClick={() => setShowProblemReport(true)}
                  title={t('topbar.report_problem')}
                  aria-label={t('topbar.report_problem')}
                  style={{
                    border: 'none',
                    background: 'none',
                    padding: 0,
                    color: '#dc3545',
                    cursor: 'pointer',
                    fontSize: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1,
                  }}
                  onMouseEnter={() => setReportIconFocused(true)}
                  onMouseLeave={() => setReportIconFocused(false)}
                  onFocus={() => setReportIconFocused(true)}
                  onBlur={() => setReportIconFocused(false)}
                >
                  <i className={`bi ${reportIconFocused ? 'bi-flag-fill' : 'bi-flag'}`} style={{ pointerEvents: 'none' }}></i>
                </button>
              </div>
            )}
          </div>
          {/* Main Entity InfoCard */}
          <div style={{
            background: '#fff',
            borderRadius: '1.2rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            marginBottom: 18,
            padding: '1.2rem',
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

          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'chat' ? 'btn-dark' : 'btn-outline-secondary'}`}
              onClick={() => setActiveTab('chat')}
              style={{ flex: 1, borderRadius: 10 }}
            >
              {t('chat.tab_chat')}
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeTab === 'advanced' ? 'btn-dark' : 'btn-outline-secondary'}`}
              onClick={() => setActiveTab('advanced')}
              style={{ flex: 1, borderRadius: 10 }}
            >
              {t('chat.tab_advanced')}
            </button>
          </div>

          {activeTab === 'chat' && (
            <>
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
                  src={(selectedCharacter.avatar_picture || selectedCharacter.picture)
                    ? `${window.API_BASE_URL.replace(/\/$/, '')}/${String(selectedCharacter.avatar_picture || selectedCharacter.picture).replace(/^\//, '')}`
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
              if (setPersonaModalShow) {
                setPersonaModalShow();
              }
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

          <div
            style={{
              background: '#fff',
              borderRadius: '0.9rem',
              padding: '0.8rem',
              marginBottom: 14,
              border: '1.2px solid #e5e7eb',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.01em' }}>
              {t('chat.wallpaper')}
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              style={{ width: '100%', borderRadius: 10, marginBottom: showWallpaperPicker ? 10 : 0 }}
              onClick={() => setShowWallpaperPicker((prev) => !prev)}
            >
              <i className="bi bi-image me-2"></i>
              {showWallpaperPicker ? t('chat.wallpaper_hide') : t('chat.wallpaper_choose')}
            </button>

            {showWallpaperPicker && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                {(wallpaperOptions || []).map((wallpaper) => {
                  const selected = selectedWallpaperId === wallpaper.id;
                  return (
                    <button
                      key={wallpaper.id}
                      type="button"
                      onClick={() => onSelectWallpaper?.(wallpaper.id)}
                      style={{
                        border: selected ? '2px solid #18191a' : '1px solid #d1d5db',
                        borderRadius: 10,
                        background: '#fff',
                        padding: 6,
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <div
                        style={{
                          width: '100%',
                          height: 52,
                          borderRadius: 8,
                          background: wallpaper.url ? `url(${wallpaper.url}) center/cover no-repeat` : 'linear-gradient(135deg,#f8fafc,#e5e7eb)',
                          border: '1px solid rgba(0,0,0,0.06)',
                          marginBottom: 6,
                        }}
                      />
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#111827' }}>
                        {wallpaper.labelKey ? t(wallpaper.labelKey) : wallpaper.name}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

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
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h6 style={{ fontWeight: 700, margin: 0, fontSize: '1.02rem', color: '#18191a' }}>
              {t('chat.memory_management')}
            </h6>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.76rem', color: '#6b7280' }}>
                {(Array.isArray(pinnedMemories) ? pinnedMemories.length : 0)}/{maxPinnedMemories}
              </span>
              <SecondaryButton
                type="button"
                isMobile={isMobile}
                onClick={() => setShowMemoryManagement((prev) => !prev)}
              >
                {showMemoryManagement ? t('chat.hide') : t('chat.show')}
              </SecondaryButton>
            </div>
          </div>
          {showMemoryManagement && (
            <div style={{ maxHeight: 176, overflowY: 'auto', borderRadius: 12, background: '#f8fafc', padding: 8, border: '1px solid #e5e7eb' }}>
              {!Array.isArray(pinnedMemories) || pinnedMemories.length === 0 ? (
                <div style={{ fontSize: '0.82rem', color: '#6b7280', padding: '0.35rem 0.5rem', lineHeight: 1.4 }}>
                  {t('chat.memory_empty_hint')}
                </div>
              ) : (
                pinnedMemories.map((memory) => (
                  <div
                    key={memory.message_id}
                    style={{
                      background: '#fff',
                      borderRadius: 10,
                      border: '1px solid #e5e7eb',
                      padding: '0.46rem 0.6rem',
                      marginBottom: 6,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 600 }}>
                        {memory.role === 'user' ? t('chat.you') : (selectedCharacter?.name || t('chat.memory_assistant_label'))}
                      </span>
                      <button
                        type="button"
                        onClick={() => onUnpinMemory?.(memory.message_id)}
                        className="btn btn-sm btn-link p-0"
                        style={{ fontSize: '0.72rem', color: '#b91c1c', textDecoration: 'none' }}
                      >
                        <i className="bi bi-pin-angle me-1"></i>
                        {t('chat.unpin_memory')}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => onJumpToPinnedMemory?.(memory.message_id)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        padding: 0,
                        fontSize: '0.8rem',
                        color: '#1f2937',
                        textAlign: 'left',
                        width: '100%',
                        lineHeight: 1.35,
                      }}
                      title={memory.content}
                    >
                      {memory.preview}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

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
                  .filter(chat => {
                    if (isSceneMode) {
                      // In scene mode: show chats matching the scene_id
                      return String(chat.scene_id) === String(selectedScene?.id);
                    } else if (isCharacterMode) {
                      // In character mode: show chats matching character_id AND without scene_id
                      return String(chat.character_id) === String(characterId) && !chat.scene_id;
                    }
                    return false;
                  })
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
            </>
          )}

        {activeTab === 'advanced' && (
          <div style={{ marginBottom: 16 }}>
            <div style={{
              background: '#f5f6fa',
              borderRadius: '0.9rem',
              padding: '0.9rem',
              border: '1px solid rgba(24, 25, 26, 0.08)',
            }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#444', marginBottom: 10 }}>
                {t('chat.advanced_title')}
              </div>

              <label style={{ fontSize: '0.76rem', color: '#666', display: 'block', marginBottom: 4 }}>
                {t('chat.advanced_model')}
                <InfoHint hintKey="character_form.advanced_help.model" />
              </label>
              <select
                className="form-select form-select-sm"
                value={advancedChatConfig?.model || 'deepseek-chat'}
                onChange={(e) => handleModelChange(e.target.value)}
                disabled={!canUseAdvancedChatConfig}
                style={{ marginBottom: 10, borderRadius: 8 }}
              >
                <option value="deepseek-chat">deepseek-chat</option>
                <option value="deepseek-reasoner">deepseek-reasoner</option>
              </select>

              <label style={{ fontSize: '0.76rem', color: '#666', display: 'block', marginBottom: 4 }}>
                {t('chat.advanced_temperature')}: {advancedChatConfig?.temperature ?? 1.3}
                <InfoHint hintKey="character_form.advanced_help.temperature" />
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={advancedChatConfig?.temperature ?? 1.3}
                onChange={(e) => updateConfig('temperature', e.target.value, 0, 2, 1.3)}
                disabled={!canUseAdvancedChatConfig}
                style={{ width: '100%', marginBottom: 10 }}
              />

              <label style={{ fontSize: '0.76rem', color: '#666', display: 'block', marginBottom: 4 }}>
                {t('chat.advanced_top_p')}: {advancedChatConfig?.top_p ?? 0.9}
                <InfoHint hintKey="character_form.advanced_help.top_p" />
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={advancedChatConfig?.top_p ?? 0.9}
                onChange={(e) => updateConfig('top_p', e.target.value, 0, 1, 0.9)}
                disabled={!canUseAdvancedChatConfig}
                style={{ width: '100%', marginBottom: 10 }}
              />

              <label style={{ fontSize: '0.76rem', color: '#666', display: 'block', marginBottom: 4 }}>
                {t('chat.advanced_max_tokens')}: {advancedChatConfig?.max_tokens ?? selectedTokenLimits.defaultValue}
                <InfoHint hintKey="character_form.advanced_help.max_tokens" />
              </label>
              <select
                className="form-select form-select-sm"
                value={normalizeTokenTierValue(advancedChatConfig?.model || 'deepseek-chat', advancedChatConfig?.max_tokens ?? selectedTokenLimits.defaultValue)}
                onChange={(e) => setAdvancedChatConfig((prev) => ({ ...prev, max_tokens: Number(e.target.value) }))}
                disabled={!canUseAdvancedChatConfig}
                style={{ marginBottom: 10, borderRadius: 8 }}
              >
                {selectedTokenTiers.map((tier) => (
                  <option key={tier.value} value={tier.value}>
                    {t(`character_form.advanced_token_tiers.${tier.labelKey}`)} ({tier.value})
                  </option>
                ))}
              </select>

              <label style={{ fontSize: '0.76rem', color: '#666', display: 'block', marginBottom: 4 }}>
                {t('chat.advanced_context_window')}
              </label>
              <select
                className="form-select form-select-sm"
                value={selectedContextWindowTier}
                onChange={(e) => {
                  const normalizedTier = normalizeContextWindowTier(e.target.value, {
                    canUseAdvancedConfig: canUseAdvancedChatConfig,
                    isProUser,
                  });
                  setAdvancedChatConfig((prev) => ({ ...prev, context_window_tier: normalizedTier }));
                }}
                disabled={!canUseAdvancedChatConfig}
                style={{ marginBottom: 8, borderRadius: 8 }}
              >
                {contextWindowTierOptions.map((tier) => (
                  <option key={tier.key} value={tier.key}>
                    {`${tier.tokens / 1000}k tokens`}
                  </option>
                ))}
              </select>

              <div style={{ fontSize: '0.72rem', color: '#888', lineHeight: 1.4, marginBottom: 10 }}>
                {t('chat.advanced_context_window_notice')}
              </div>

              <label style={{ fontSize: '0.76rem', color: '#666', display: 'block', marginBottom: 4 }}>
                {t('chat.advanced_presence_penalty')}: {advancedChatConfig?.presence_penalty ?? 0}
                <InfoHint hintKey="character_form.advanced_help.presence_penalty" />
              </label>
              <input
                type="range"
                min="-2"
                max="2"
                step="0.1"
                value={advancedChatConfig?.presence_penalty ?? 0}
                onChange={(e) => updateConfig('presence_penalty', e.target.value, -2, 2, 0)}
                disabled={!canUseAdvancedChatConfig}
                className="form-range"
                style={{ width: '100%', marginBottom: 10 }}
              />

              <label style={{ fontSize: '0.76rem', color: '#666', display: 'block', marginBottom: 4 }}>
                {t('chat.advanced_frequency_penalty')}: {advancedChatConfig?.frequency_penalty ?? 0}
                <InfoHint hintKey="character_form.advanced_help.frequency_penalty" />
              </label>
              <input
                type="range"
                min="-2"
                max="2"
                step="0.1"
                value={advancedChatConfig?.frequency_penalty ?? 0}
                onChange={(e) => updateConfig('frequency_penalty', e.target.value, -2, 2, 0)}
                disabled={!canUseAdvancedChatConfig}
                className="form-range"
                style={{ width: '100%', marginBottom: 8 }}
              />

              <div style={{ fontSize: '0.72rem', color: '#888', lineHeight: 1.4 }}>
                {t('chat.advanced_hint')}
              </div>
              {!canUseAdvancedChatConfig && (
                <div style={{ marginTop: 8, fontSize: '0.76rem', color: '#b45309', lineHeight: 1.4 }}>
                  {t('chat.advanced_locked_notice')}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={onResetAdvancedChatConfig}
                  disabled={!selectedCharacter || !canUseAdvancedChatConfig}
                  style={{ borderRadius: 8 }}
                >
                  {t('chat.advanced_reset')}
                </button>
              </div>
            </div>
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
