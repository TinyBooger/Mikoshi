import React, { forwardRef } from 'react';
import { SHARE_CARD_MIN_HEIGHT, SHARE_CARD_WIDTH, getShareBackground } from './shareTemplates';
import fallbackCharacterAvatar from '../../assets/images/default-picture.png';
import brandLogo from '../../assets/images/logo.png';

/**
 * The character poster that gets rasterised into a PNG.
 *
 * Sibling of `ShareCard`, not a variant of it: a character card has no message
 * list, so it shares the export geometry, the palette source and the rasteriser,
 * but none of the transcript layout. It replaces the old "copy chat link"
 * action — the QR code carries the same destination the clipboard used to.
 *
 * Three templates, picked from `preset` and from whether there is artwork at
 * all — never from measuring the picture:
 *
 * - `poster` -> dark and immersive. The artwork bleeds under a scrim and the
 *   copy rides on it. For anime characters and attractive artwork.
 * - `sheet`  -> light and editorial. The artwork is framed whole at the full
 *   content width, its height following its own ratio, with the metadata as a
 *   compact information block underneath. For artwork worth displaying for its
 *   own sake.
 * - `avatar` -> the fallback for entities that only have an avatar: the same
 *   light surface, opened by an avatar row instead of a stage.
 *
 * The two artwork templates are separate compositions rather than one layout
 * with a flag. They disagree about nearly everything that matters — where the
 * copy sits, whether there is a scrim, whether the artwork is a backdrop or the
 * subject — so nothing is shared except the pieces that must not drift: the
 * identity, the tags, the information block and the watermark.
 *
 * Every number below is a card pixel. `SHARE_CARD_WIDTH` is 1080 and the card is
 * never reflowed, so a composed template can be laid out exactly instead of
 * responsively. That also suits the exporter, which measures the *element* boxes
 * to reproduce `object-fit` (see `fitBlobToBox`).
 *
 * The raw URL is deliberately not printed: the QR code and the trailing
 * watermark carry the destination, and a wall of `localhost:3000/character/12`
 * adds nothing a reader can act on.
 *
 * Deliberately state-free: it is rendered once at 1080px in an off-screen node
 * and handed to html2canvas. Nothing here may depend on hover, focus or time.
 */

const FONT_STACK =
  '"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif';

const LOGO_SIZE = 44;

/** The three looks on offer. `poster` bleeds the artwork; `sheet` stages it. */
export const CHARACTER_CARD_PRESETS = [
  { id: 'poster', label: '铺满背景' },
  { id: 'sheet', label: '完整图片' },
];

/** The chat's own palettes, so the card cannot drift from the conversation. */
const ARTWORK = getShareBackground('character-art');
const PLAIN = getShareBackground('plain');

/**
 * Poster ink. `character-art`'s own scrim is deliberately not reused: it is
 * tuned for a full column of bubbles and reaches 94% black by its last quarter,
 * which swallows the lower half of a character. This one stays clear until the
 * copy starts and settles at 78%, so the artwork still reads behind the title.
 */
const POSTER = {
  background: '#100d1c',
  scrim:
    'linear-gradient(180deg, rgba(9, 6, 18, 0) 0%, rgba(9, 6, 18, 0.16) 30%, rgba(9, 6, 18, 0.5) 62%, rgba(9, 6, 18, 0.78) 100%)',
  text: '#ffffff',
  label: 'rgba(255, 255, 255, 0.72)',
  muted: 'rgba(255, 255, 255, 0.84)',
  accent: '#ffffff',
  divider: 'rgba(255, 255, 255, 0.18)',
  chip: 'rgba(255, 255, 255, 0.16)',
  panel: 'rgba(10, 7, 20, 0.34)',
  panelBorder: 'rgba(255, 255, 255, 0.16)',
  watermark: ARTWORK.watermarkColor,
  shadow: '0 2px 16px rgba(0, 0, 0, 0.45)',
  qrShadow: '0 12px 28px rgba(0, 0, 0, 0.3)',
};

/** Editorial ink: the plain surface, plus the gallery frame's own tone. */
const SHEET = {
  background: PLAIN.css || '#ffffff',
  mat: PLAIN.bubbleUser || '#f5f6fa',
  frame: 'rgba(35, 28, 56, 0.16)',
  text: PLAIN.textColor,
  label: PLAIN.mutedColor,
  muted: PLAIN.mutedColor,
  accent: PLAIN.accent,
  divider: PLAIN.dividerColor,
  chip: 'rgba(115, 107, 146, 0.1)',
  watermark: PLAIN.watermarkColor,
  qrShadow: '0 10px 26px rgba(35, 28, 56, 0.14)',
};

/** The information block's type, shared by the two light templates. */
const LIGHT_INFO = {
  columnGap: 30,
  blockGap: 12,
  labelSize: 21,
  nameSize: 32,
  statValue: 30,
  statLabel: 23,
  statGap: 30,
  qrSize: 148,
  qrPadding: 20,
  qrRadius: 24,
  qrCaption: 19,
};

/** The QR is a secondary action in the poster template, so it shrinks. */
const POSTER_INFO = {
  ...LIGHT_INFO,
  padding: '24px 30px',
  radius: 26,
  qrSize: 132,
  qrPadding: 18,
  qrRadius: 22,
};

/**
 * The three compositions, in card pixels.
 *
 * Held in one table so a template reads top to bottom without branching through
 * JSX, and so retuning a look is a data change. `minArtwork` is the poster's
 * promise that the scrim never reaches the title: the copy group is allowed to
 * ride low on the artwork, but it is not the only thing holding the card up.
 *
 * `sheet.maxHeight` is not a design decision, it is a guard rail: the frame
 * normally takes its height straight from the artwork's ratio, and this only
 * catches an image so tall that the exported PNG would approach the rasteriser's
 * canvas ceiling. It is set far above any ordinary portrait, so in practice the
 * picture is never touched.
 */
const TEMPLATES = {
  poster: {
    kind: 'poster',
    ink: POSTER,
    padding: '72px 72px 52px',
    identity: {
      nameSize: 68,
      nameGap: 18,
      taglineSize: 27,
      taglineLineHeight: 1.55,
      taglineMax: 820,
    },
    tags: { gap: 26, size: 24 },
    heroGap: 44,
    info: POSTER_INFO,
    brandGap: 34,
    minArtwork: 120,
  },
  sheet: {
    kind: 'gallery',
    ink: SHEET,
    padding: '60px 64px 48px',
    stage: { radius: 24, border: 3, gap: 40, maxHeight: 1800 },
    identity: {
      nameSize: 52,
      nameGap: 12,
      taglineSize: 26,
      taglineLineHeight: 1.5,
      taglineMax: 900,
    },
    tags: { gap: 20, size: 24 },
    heroGap: 44,
    info: { ...LIGHT_INFO, divider: true, paddingTop: 26 },
    brandGap: 30,
  },
  avatar: {
    kind: 'avatar',
    ink: SHEET,
    padding: '64px 64px 48px',
    avatar: { size: 132, radius: 34, gap: 26, nameSize: 50, taglineSize: 25, taglineMax: 640 },
    tags: { gap: 26, size: 24 },
    heroGap: 44,
    // Divider, like `sheet`: `SHEET` carries no panel ink, and the light
    // templates deliberately have no filled card around the information.
    info: { ...LIGHT_INFO, divider: true, paddingTop: 26 },
    brandGap: 34,
  },
};

/**
 * Swap a failed image over to a bundled fallback, once.
 *
 * Same contract as `ShareCard`: an `<img>` with no `alt` paints nothing when its
 * request fails, so the export would otherwise carry an invisible hole.
 */
function handleImageFallback(fallback) {
  return (event) => {
    const img = event.currentTarget;
    if (img.dataset.shareFallbackUsed === '1' || !fallback) return;
    img.dataset.shareFallbackUsed = '1';
    img.src = fallback;
  };
}

/**
 * The shared page: export geometry, padding and type.
 *
 * `overflow: hidden` is load-bearing in the poster template, where the artwork
 * is absolutely positioned and deliberately bleeds past the padding.
 */
function cardStyle(template) {
  return {
    position: 'relative',
    boxSizing: 'border-box',
    width: SHARE_CARD_WIDTH,
    minHeight: SHARE_CARD_MIN_HEIGHT,
    padding: template.padding,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: FONT_STACK,
    overflow: 'hidden',
    background: template.ink.background,
  };
}

/**
 * One portrait slot.
 *
 * Every image the exporter has to inline goes through here, so the two
 * attributes it requires cannot be forgotten: `data-share-image` opts the
 * element into the resolve-to-data-URL pass, and `data-share-fallback` gives it
 * bundled, same-origin art when the network copy cannot be fetched.
 */
function ArtworkImage({ src, style }) {
  return (
    <img
      data-share-image="1"
      data-share-fallback={fallbackCharacterAvatar}
      src={src}
      alt=""
      onError={handleImageFallback(fallbackCharacterAvatar)}
      style={style}
    />
  );
}

function StatItem({ value, label, ink, info }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
      <span style={{ fontSize: info.statValue, fontWeight: 800, color: ink.text }}>{value}</span>
      <span style={{ fontSize: info.statLabel, color: ink.muted }}>{label}</span>
    </span>
  );
}

/** Name over tagline — the one piece of copy that must survive any composition. */
function CharacterIdentity({ payload, template }) {
  const identity = template.identity;
  return (
    <>
      <div
        style={{
          fontSize: identity.nameSize,
          fontWeight: 800,
          color: template.ink.text,
          lineHeight: 1.14,
          letterSpacing: 1,
          textShadow: template.ink.shadow,
          wordBreak: 'break-word',
        }}
      >
        {payload.name}
      </div>
      {payload.tagline ? (
        <div
          style={{
            marginTop: identity.nameGap,
            fontSize: identity.taglineSize,
            lineHeight: identity.taglineLineHeight,
            color: template.ink.muted,
            maxWidth: identity.taglineMax,
            textShadow: template.ink.shadow,
          }}
        >
          {payload.tagline}
        </div>
      ) : null}
    </>
  );
}

function CharacterTags({ tags, template }) {
  if (!tags.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: template.tags.gap }}>
      {tags.map((tag) => (
        <span
          key={tag}
          style={{
            padding: '9px 22px',
            borderRadius: 999,
            fontSize: template.tags.size,
            fontWeight: 600,
            color: template.ink.accent,
            background: template.ink.chip,
            border: `1px solid ${template.ink.divider}`,
          }}
        >
          #{tag}
        </span>
      ))}
    </div>
  );
}

/**
 * Creator, social proof and the QR code, in one row.
 *
 * `divider` picks the sheet's treatment — a hairline rule over poster
 * typography, with no filled card around it — instead of the poster's
 * translucent panel, which exists to buy the copy local contrast against the
 * artwork it stands on. The QR is the only white element in either: it has to
 * stay high-contrast to scan.
 */
function CharacterInfoBlock({ payload, qrDataUrl, template }) {
  const info = template.info;
  const ink = template.ink;
  // A zero is dropped rather than printed: ChatPage's lighter character object
  // has no counters at all, and "点赞 0" would be a stat nobody has.
  const stats = [
    payload.likes > 0 ? { value: payload.likes, label: '点赞' } : null,
    payload.views > 0 ? { value: payload.views, label: '浏览' } : null,
  ].filter(Boolean);
  if (!payload.creatorName && !stats.length && !qrDataUrl) return null;

  const chrome = info.divider
    ? { borderTop: `1px solid ${ink.divider}`, paddingTop: info.paddingTop }
    : {
        padding: info.padding,
        borderRadius: info.radius,
        background: ink.panel,
        border: `1px solid ${ink.panelBorder}`,
      };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: info.columnGap,
        ...chrome,
      }}
    >
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: info.blockGap }}>
        {payload.creatorName ? (
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: info.labelSize, letterSpacing: 0.5, color: ink.label, marginBottom: 5 }}>
              创作者
            </div>
            <div style={{ fontSize: info.nameSize, fontWeight: 800, color: ink.text, wordBreak: 'break-word' }}>
              {payload.creatorName}
            </div>
          </div>
        ) : null}
        {stats.length > 0 ? (
          <div style={{ display: 'flex', gap: info.statGap, flexWrap: 'wrap' }}>
            {stats.map((stat) => (
              <StatItem key={stat.label} value={stat.value} label={stat.label} ink={ink} info={info} />
            ))}
          </div>
        ) : null}
      </div>

      {qrDataUrl ? (
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              background: '#ffffff',
              padding: info.qrPadding,
              borderRadius: info.qrRadius,
              boxShadow: ink.qrShadow,
            }}
          >
            {/* `data-share-image` is mandatory: the exporter rewrites it to a
                data URL before capture (it already is one, which the exporter
                detects and skips). The tile around it is the quiet zone a
                scanner needs, because `react-qr-code` paints the module grid
                edge to edge. */}
            <img
              data-share-image="1"
              src={qrDataUrl}
              alt=""
              style={{ width: info.qrSize, height: info.qrSize, display: 'block' }}
            />
          </div>
          <span style={{ fontSize: info.qrCaption, fontWeight: 600, color: ink.muted }}>扫码与TA聊天</span>
        </div>
      ) : null}
    </div>
  );
}

/** Brand signature — identical treatment to the message card. */
function CharacterWatermark({ template }) {
  return (
    <div
      style={{
        marginTop: template.brandGap,
        paddingTop: 26,
        borderTop: `1px solid ${template.ink.divider}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <span style={{ fontSize: 27, fontWeight: 700, letterSpacing: 1.5, color: template.ink.watermark }}>
        语伴岛 · Yubandao
      </span>
      <img
        data-share-image="1"
        src={brandLogo}
        alt="语伴岛"
        style={{ height: LOGO_SIZE, width: 'auto', display: 'block', flexShrink: 0 }}
      />
    </div>
  );
}

/**
 * `poster` — a character poster.
 *
 * The artwork is a backdrop, not a picture: full bleed, cropped to the card by
 * `fitBlobToBox` before capture. The crop is plain `object-fit: cover` — centred,
 * no anchor bias, exactly what the browser would show — and a scrim only starts
 * to bite where the copy begins. The copy is bottom-weighted on purpose: the
 * artwork owns everything above it.
 */
const PosterCard = forwardRef(function PosterCard({ payload, qrDataUrl, template }, ref) {
  const tags = Array.isArray(payload.tags) ? payload.tags : [];
  return (
    <div ref={ref} style={cardStyle(template)}>
      <ArtworkImage
        src={payload.portrait}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center',
        }}
      />
      <div style={{ position: 'absolute', inset: 0, background: template.ink.scrim }} />

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: 1 }}>
        {/* The floor under the copy group: the scrim is tall, the artwork is not
            allowed to be a sliver. */}
        <div style={{ flex: 1, minHeight: template.minArtwork }} />

        <CharacterIdentity payload={payload} template={template} />
        <CharacterTags tags={tags} template={template} />
        <div style={{ height: template.heroGap }} />
        <CharacterInfoBlock payload={payload} qrDataUrl={qrDataUrl} template={template} />
        <CharacterWatermark template={template} />
      </div>
    </div>
  );
});

/**
 * `sheet` — a framed picture with an information section under it.
 *
 * The artwork is the hero and it is presented whole: the frame spans the full
 * content width, exactly like the copy beneath it, and its height follows the
 * picture's own ratio instead of a number chosen for it. So a landscape bakes
 * short and a 立绘 bakes tall, and neither is cropped, stretched or boxed into a
 * shape the artwork did not ask for. Nothing is layered behind it.
 *
 * `maxHeight` is a guard rail rather than a layout decision — see `TEMPLATES`.
 *
 * `object-fit: contain` only ever bites when that guard rail clamps a very tall
 * image: the frame's ratio then stops matching the picture's, and the letterbox
 * keeps it whole. Otherwise the box already has the image's ratio and contain is
 * a no-op. It is safe either way only because the exporter pre-applies it to the
 * image bytes (`fitBlobToBox`); html2canvas itself would paint the artwork
 * stretched to the frame.
 */
const GalleryCard = forwardRef(function GalleryCard({ payload, qrDataUrl, template }, ref) {
  const stage = template.stage;
  const tags = Array.isArray(payload.tags) ? payload.tags : [];

  return (
    <div ref={ref} style={cardStyle(template)}>
      {/* A frame, not a mat: the border is drawn inside the content box, so its
          outer edge lines up with the name and the information block below.
          `flexShrink: 0` because the frame is the one element that must never be
          squashed to make the card fit — it is the thing that sets the height. */}
      <div
        style={{
          boxSizing: 'border-box',
          flexShrink: 0,
          width: '100%',
          borderRadius: stage.radius,
          border: `${stage.border}px solid ${template.ink.frame}`,
          background: template.ink.mat,
          overflow: 'hidden',
        }}
      >
        <ArtworkImage
          src={payload.portrait}
          style={{
            display: 'block',
            width: '100%',
            height: 'auto',
            maxHeight: stage.maxHeight,
            objectFit: 'contain',
            objectPosition: 'center',
          }}
        />
      </div>

      <div style={{ height: stage.gap }} />
      <CharacterIdentity payload={payload} template={template} />
      <CharacterTags tags={tags} template={template} />
      <div style={{ height: template.heroGap }} />
      <CharacterInfoBlock payload={payload} qrDataUrl={qrDataUrl} template={template} />
      <div style={{ flex: 1, minHeight: 0 }} />
      <CharacterWatermark template={template} />
    </div>
  );
});

/**
 * `avatar` — the fallback for an entity with no portrait.
 *
 * Same light surface as `sheet` with no stage to show, so the avatar opens the
 * card instead and the rest of the page keeps the editorial tone.
 */
const AvatarCard = forwardRef(function AvatarCard({ payload, qrDataUrl, template }, ref) {
  const tags = Array.isArray(payload.tags) ? payload.tags : [];
  const avatar = template.avatar;
  return (
    <div ref={ref} style={cardStyle(template)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: avatar.gap }}>
        <img
          data-share-image="1"
          data-share-fallback={fallbackCharacterAvatar}
          src={payload.avatar || fallbackCharacterAvatar}
          alt=""
          onError={handleImageFallback(fallbackCharacterAvatar)}
          style={{
            width: avatar.size,
            height: avatar.size,
            borderRadius: avatar.radius,
            flexShrink: 0,
            boxSizing: 'border-box',
            objectFit: 'cover',
            border: `2px solid ${template.ink.divider}`,
            boxShadow: '0 14px 34px rgba(28, 18, 56, 0.24)',
          }}
        />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: avatar.nameSize,
              fontWeight: 800,
              color: template.ink.text,
              lineHeight: 1.18,
              letterSpacing: 1,
              wordBreak: 'break-word',
            }}
          >
            {payload.name}
          </div>
          {payload.tagline ? (
            <div
              style={{
                marginTop: 12,
                fontSize: avatar.taglineSize,
                lineHeight: 1.5,
                color: template.ink.muted,
                maxWidth: avatar.taglineMax,
              }}
            >
              {payload.tagline}
            </div>
          ) : null}
        </div>
      </div>

      <CharacterTags tags={tags} template={template} />
      <div style={{ flex: 1, minHeight: 56 }} />
      <CharacterInfoBlock payload={payload} qrDataUrl={qrDataUrl} template={template} />
      <CharacterWatermark template={template} />
    </div>
  );
});

/**
 * Pick a template and render it.
 */
const CharacterShareCard = forwardRef(function CharacterShareCard(
  { payload, qrDataUrl, preset = 'poster' },
  ref,
) {
  // Without artwork there is no picture to bleed and none to frame, so both
  // presets collapse to the avatar card.
  if (!payload.portrait) {
    return <AvatarCard ref={ref} payload={payload} qrDataUrl={qrDataUrl} template={TEMPLATES.avatar} />;
  }
  if (preset === 'sheet') {
    return <GalleryCard ref={ref} payload={payload} qrDataUrl={qrDataUrl} template={TEMPLATES.sheet} />;
  }
  return <PosterCard ref={ref} payload={payload} qrDataUrl={qrDataUrl} template={TEMPLATES.poster} />;
});

export default CharacterShareCard;
