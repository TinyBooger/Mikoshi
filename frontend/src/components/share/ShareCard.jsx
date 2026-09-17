import React, { forwardRef } from 'react';
import { SHARE_CARD_MIN_HEIGHT, SHARE_CARD_WIDTH } from './shareTemplates';
// Same-origin fallbacks. They are bundled by Vite, so they are guaranteed to
// load and therefore guarantee the card never shows an empty avatar slot.
import fallbackCharacterAvatar from '../../assets/images/default-picture.png';
import fallbackUserAvatar from '../../assets/images/default-avatar.png';
// Brand mark for the watermark. Transparent PNG, so it sits on any palette —
// unlike `/public/icon-*.png`, which has a white square baked in.
import brandLogo from '../../assets/images/logo.png';

/**
 * The social-share card that gets rasterised into a PNG.
 *
 * This component is intentionally *not* the chat UI: it shares no styles and no
 * DOM with `MessageBubble`. That keeps the exported image free of hover
 * controls, timestamps and input chrome, and means html2canvas only ever has to
 * understand a small, self-contained tree of plain boxes.
 *
 * It is rendered twice at runtime — once scaled down inside the dialog preview
 * and once at full size in an off-screen node that is handed to html2canvas —
 * so it must stay free of state and side effects.
 */

const FONT_STACK =
  '"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif';

const AVATAR_SIZE_HEADER = 132;
const AVATAR_SIZE_MESSAGE = 56;

/** Height of the full-portrait hero band that heads the card. */
const HERO_HEIGHT = 470;

/** Brand mark height in the watermark footer, matching the 27px wordmark. */
const LOGO_SIZE = 44;

/**
 * Swap a failed image over to a bundled fallback, once.
 *
 * An `<img>` with an empty `alt` paints *nothing* when its request fails, so a
 * missing image silently becomes an invisible hole rather than a placeholder.
 * The `dataset` flag stops a broken fallback from looping.
 */
function handleImageFallback(fallback) {
  return (event) => {
    const img = event.currentTarget;
    if (img.dataset.shareFallback === '1' || !fallback) return;
    img.dataset.shareFallback = '1';
    img.src = fallback;
  };
}

/**
 * An avatar that can never come up empty.
 *
 * Two things conspire to blank an avatar out, and both are handled here:
 *
 * 1. There is no avatar to show (no persona picture, a character without
 *    artwork) — `src || fallback` covers that.
 * 2. The URL exists but does not load — the `onError` swap below re-points the
 *    element at the bundled fallback.
 *
 * No `crossOrigin` attribute: a CORS-mode request would make the preview fail
 * outright on a server that does not send `Access-Control-Allow-Origin`. The
 * export resolves image bytes itself instead — see `inlineImagesAsDataUrls`
 * in `utils/shareImage.js`.
 */
function ShareAvatar({ src, fallback, size, radius, borderColor, shadow }) {
  return (
    <img
      data-share-image="1"
      src={src || fallback}
      alt=""
      onError={handleImageFallback(fallback)}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        flexShrink: 0,
        boxSizing: 'border-box',
        objectFit: 'cover',
        border: `2px solid ${borderColor}`,
        boxShadow: shadow || undefined,
      }}
    />
  );
}

function ShareMessageMinimal({ line, background }) {
  const isUser = line.role === 'user';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        alignItems: 'flex-start',
        gap: 18,
      }}
    >
      <ShareAvatar
        src={line.avatar}
        fallback={isUser ? fallbackUserAvatar : fallbackCharacterAvatar}
        size={AVATAR_SIZE_MESSAGE}
        radius="50%"
        borderColor={background.dividerColor}
      />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: isUser ? 'flex-end' : 'flex-start',
          gap: 12,
          minWidth: 0,
          maxWidth: 820,
        }}
      >
        <span style={{ fontSize: 25, fontWeight: 700, color: background.accent, letterSpacing: 0.5 }}>
          {line.author}
        </span>
        <span
          style={{
            fontSize: 31,
            lineHeight: 1.62,
            color: background.textColor,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {line.text}
        </span>
      </div>
    </div>
  );
}

function ShareMessageBubble({ line, background }) {
  const isUser = line.role === 'user';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        gap: 18,
        alignItems: 'flex-start',
      }}
    >
      <ShareAvatar
        src={line.avatar}
        fallback={isUser ? fallbackUserAvatar : fallbackCharacterAvatar}
        size={AVATAR_SIZE_MESSAGE}
        radius="50%"
        borderColor={background.dividerColor}
      />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: isUser ? 'flex-end' : 'flex-start',
          gap: 10,
          maxWidth: 780,
        }}
      >
        <span style={{ fontSize: 22, fontWeight: 600, color: background.mutedColor }}>
          {line.author}
        </span>
        <div
          style={{
            background: isUser ? background.bubbleUser : background.bubbleChar,
            color: isUser ? background.bubbleUserText : background.bubbleCharText,
            borderRadius: 28,
            padding: '26px 32px',
            fontSize: 30,
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            boxShadow: '0 12px 28px rgba(35, 22, 70, 0.16)',
          }}
        >
          {line.text}
        </div>
      </div>
    </div>
  );
}

/**
 * Header built around the character's full portrait (立绘).
 *
 * The artwork is cropped to a landscape band anchored at the top, because
 * portraits are usually face-first and a centred crop would cut the head off.
 * Name + subtitle sit on a scrim at the bottom: that guarantees contrast
 * against any artwork, so the header reads the same on every palette.
 */
function ShareHeaderPortrait({ payload }) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: HERO_HEIGHT,
        borderRadius: 40,
        overflow: 'hidden',
        flexShrink: 0,
        background: '#241c38',
        boxShadow: '0 18px 44px rgba(28, 18, 56, 0.26)',
      }}
    >
      <img
        data-share-image="1"
        src={payload.characterImage}
        alt=""
        onError={handleImageFallback(fallbackCharacterAvatar)}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'top center',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(10, 7, 20, 0) 34%, rgba(10, 7, 20, 0.5) 68%, rgba(10, 7, 20, 0.87) 100%)',
        }}
      />
      <div style={{ position: 'absolute', left: 40, right: 40, bottom: 34 }}>
        <div
          style={{
            fontSize: 52,
            fontWeight: 800,
            color: '#ffffff',
            lineHeight: 1.15,
            letterSpacing: 1,
            textShadow: '0 2px 14px rgba(0, 0, 0, 0.4)',
          }}
        >
          {payload.characterName}
        </div>
        {payload.subtitle ? (
          <div
            style={{
              marginTop: 12,
              fontSize: 25,
              lineHeight: 1.5,
              color: 'rgba(255, 255, 255, 0.88)',
              maxWidth: 780,
              textShadow: '0 1px 10px rgba(0, 0, 0, 0.4)',
            }}
          >
            {payload.subtitle}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Fallback header: avatar tile + name + subtitle, for entities with no portrait. */
function ShareHeaderCompact({ payload, background }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
      <ShareAvatar
        src={payload.characterAvatar}
        fallback={fallbackCharacterAvatar}
        size={AVATAR_SIZE_HEADER}
        radius={34}
        borderColor={background.dividerColor}
        shadow="0 14px 34px rgba(28, 18, 56, 0.24)"
      />
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 48,
            fontWeight: 800,
            color: background.textColor,
            lineHeight: 1.2,
            letterSpacing: 1,
          }}
        >
          {payload.characterName}
        </div>
        {payload.subtitle ? (
          <div
            style={{
              marginTop: 12,
              fontSize: 25,
              lineHeight: 1.5,
              color: background.mutedColor,
              maxWidth: 720,
            }}
          >
            {payload.subtitle}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const ShareCard = forwardRef(function ShareCard(
  { payload, template, background, backgroundImageUrl },
  ref,
) {
  const isImageBackground = background.kind === 'image';
  const MessageRenderer =
    template.id === 'bubble' ? ShareMessageBubble : ShareMessageMinimal;
  // The portrait header is skipped when the artwork already *is* the backdrop,
  // otherwise the same image would be painted twice on one card.
  const showPortrait = !!payload.characterImage && background.id !== 'character-art';

  return (
    <div
      ref={ref}
      style={{
        position: 'relative',
        width: SHARE_CARD_WIDTH,
        minHeight: SHARE_CARD_MIN_HEIGHT,
        boxSizing: 'border-box',
        padding: '76px 72px 58px',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: FONT_STACK,
        overflow: 'hidden',
        background: isImageBackground ? '#120f1f' : background.css,
      }}
    >
      {isImageBackground && backgroundImageUrl ? (
        <>
          <img
            data-share-image="1"
            src={backgroundImageUrl}
            alt=""
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
          <div style={{ position: 'absolute', inset: 0, background: background.overlay }} />
        </>
      ) : null}

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: 1 }}>
        {/* Header: the character's identity. A full portrait when there is one,
            otherwise the compact avatar row. */}
        {showPortrait ? (
          <ShareHeaderPortrait payload={payload} />
        ) : (
          <ShareHeaderCompact payload={payload} background={background} />
        )}

        <div style={{ height: 1, background: background.dividerColor, margin: '46px 0 42px' }} />

        {/* Conversation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 44 }}>
          {payload.lines.map((line) => (
            <MessageRenderer key={line.id} line={line} background={background} />
          ))}
        </div>

        <div style={{ flex: 1, minHeight: 48 }} />

        {/* Watermark */}
        <div
          style={{
            marginTop: 40,
            paddingTop: 28,
            borderTop: `1px solid ${background.dividerColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontSize: 27,
              fontWeight: 700,
              letterSpacing: 1.5,
              color: background.watermarkColor,
            }}
          >
            语伴岛 · Yubandao
          </span>
          {/* The logo carries no text and a fixed brand colour, so it needs no
              per-background tint. `data-share-image` is mandatory: the exporter
              rewrites it to a data URL before capture. */}
          <img
            data-share-image="1"
            src={brandLogo}
            alt="语伴岛"
            style={{
              height: LOGO_SIZE,
              width: 'auto',
              display: 'block',
              flexShrink: 0,
            }}
          />
        </div>
      </div>
    </div>
  );
});

export default ShareCard;
