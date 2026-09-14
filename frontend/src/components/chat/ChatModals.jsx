import React from 'react';
import CharacterModal from '../CharacterModal';
import PersonaModal from '../PersonaModal';
import SceneCharacterSelectModal from '../SceneCharacterSelectModal';
import ConfirmModal from '../ConfirmModal';

/**
 * Modal layer of the chat page: scene/character picker shown before a chat is
 * initialized, the character + persona pickers, and the two confirm dialogs
 * (delete conversation, advanced-character warning).
 *
 * Extracted verbatim from ChatPage. The inline `onSelect` / `onCancel`
 * handler bodies moved with the JSX unchanged, so the component takes the
 * small set of primitives (setters, refs, navigate) they close over.
 */
export default function ChatModals({
  initModal,
  initLoading,
  selectedScene,
  selectedCharacter,
  setSelectedCharacter,
  startChatFromSceneSelection,
  initialized,
  navigate,
  setInitModal,
  isMobile,
  characterModal,
  setCharacterModal,
  setCharacterId,
  personaModal,
  setPersonaModal,
  setSelectedPersona,
  sessionToken,
  refreshUserData,
  userData,
  confirmModal,
  setConfirmModal,
  handleDeleteConfirmed,
  advancedChatConfirm,
  handleAdvancedChatConfirm,
  handleAdvancedChatExit,
}) {
  return (
    <>
      <SceneCharacterSelectModal
        show={initModal}
        loading={initLoading}
        selectedScene={selectedScene}
        onSelectCharacter={() => setCharacterModal({ show: true })}
        selectedCharacter={selectedCharacter}
        setSelectedCharacter={setSelectedCharacter}
        onStartChat={async () => {
          await startChatFromSceneSelection();
        }}
        onCancel={() => {
          if (!initialized.current) {
            navigate(-1);
          } else {
            setInitModal(false);
          }
        }}
        isMobile={isMobile}
      />
      <CharacterModal
        show={characterModal.show}
        onClose={() => setCharacterModal({ show: false })}
        onSelect={character => {
          setSelectedCharacter(character);
          setCharacterId(character?.id || null);
          setCharacterModal({ show: false });
        }}
      />
      <PersonaModal
        show={personaModal.show}
        onClose={() => setPersonaModal({ show: false })}
        onSelect={persona => {
          setSelectedPersona(persona);
          setPersonaModal({ show: false });
        }}
        sessionToken={sessionToken}
        refreshUserData={refreshUserData}
        userData={userData}
      />
      <ConfirmModal
        show={confirmModal.show}
        title="删除会话"
        message="您确定要删除此会话吗？"
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setConfirmModal({ show: false, chatId: null })}
      />
      <ConfirmModal
        show={advancedChatConfirm}
        title="进阶角色提醒"
        message="该角色是进阶角色，点数消耗量大，推荐Pro用户使用"
        confirmText="继续对话"
        cancelText="退出"
        onConfirm={handleAdvancedChatConfirm}
        onCancel={handleAdvancedChatExit}
      />
    </>
  );
}
