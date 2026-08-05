import React from 'react';
import defaultPic from '../assets/images/default-picture.png';

/**
 * Welcome card shown at the top of a new chat.
 * Displays character/scene avatar, title, and welcome text.
 */
export default function ChatWelcomeCard({
  selectedCharacter,
  selectedScene,
}) {
  const charName = selectedCharacter?.name;
  const sceneName = selectedScene?.name;

  const title = sceneName ? (
    <>
      <span>正在场景 </span>
      <span style={{ color: '#8b5cf6', fontWeight: 800 }}>{sceneName}</span>
      <span> 中与 </span>
      <span style={{ color: '#6366f1', fontWeight: 800 }}>{charName || '角色'}</span>
      <span> 对话</span>
    </>
  ) : (
    <>
      <span>正在与 </span>
      <span style={{ color: '#6366f1', fontWeight: 800 }}>{charName || '角色'}</span>
      <span> 对话</span>
    </>
  );

  const welcomeText = sceneName
    ? '让故事自然展开，说点什么来推动这一幕吧。'
    : '让对话自然展开，说点什么来开启这段交流吧。';

  const welcomeImageRaw =
    selectedScene?.picture ||
    selectedCharacter?.avatar_picture ||
    selectedCharacter?.picture ||
    null;
  const welcomeImageSrc = welcomeImageRaw
    ? `${window.API_BASE_URL.replace(/\/$/, '')}/${String(welcomeImageRaw).replace(/^\//, '')}`
    : defaultPic;
  const welcomeImageAlt = sceneName || charName || 'Character';

  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.2rem' }}>
      <div
        style={{
          maxWidth: 720,
          width: '100%',
          textAlign: 'center',
          padding: '0.8rem 0.6rem 0.35rem',
        }}
      >
        <img
          src={welcomeImageSrc}
          alt={welcomeImageAlt}
          style={{
            width: 96,
            height: 96,
            objectFit: 'cover',
            borderRadius: '50%',
            border: '1px solid #c4b5fd',
            display: 'block',
            margin: '0 auto',
          }}
        />

        <div
          style={{
            fontSize: '1rem',
            fontWeight: 650,
            color: '#121212',
            marginTop: 18,
          }}
        >
          {title}
        </div>

        <div
          style={{
            marginTop: 14,
            color: '#4b5563',
            fontSize: '0.92rem',
            lineHeight: 1.42,
          }}
        >
          {welcomeText}
        </div>
      </div>
    </div>
  );
}
