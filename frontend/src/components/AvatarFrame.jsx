import React from 'react';

/**
 * AvatarFrame - Renders a clean avatar frame for badges
 * Props:
 *  - badge: badge key (e.g., "bronze_creator", "silver_creator", "gold_creator")
 *  - size: size in pixels (default 50)
 *  - children: the avatar image to wrap
 */
export default function AvatarFrame({ badge, size = 50, children }) {
  const frameStyle = badge ? getBadgeFrameStyle(badge, size) : null;

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Avatar container */}
      <div
        style={{
          width: badge ? `${size * 0.85}px` : `${size}px`,
          height: badge ? `${size * 0.85}px` : `${size}px`,
          borderRadius: '50%',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 2,
        }}
      >
        {children}
      </div>

      {/* Simple ring frame - only render if badge exists */}
      {badge && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: '50%',
            ...frameStyle,
            zIndex: 1,
          }}
        />
      )}
    </div>
  );
}

/**
 * Get clean frame styling for different badge types with modern metallic shading
 */
function getBadgeFrameStyle(badge, size) {
  const frameStyles = {
    bronze_creator: {
      background: `
        radial-gradient(circle at 30% 30%, 
          rgba(244, 164, 96, 0.9) 0%, 
          transparent 50%
        ),
        radial-gradient(circle at 70% 70%, 
          rgba(139, 90, 43, 0.6) 0%, 
          transparent 50%
        ),
        linear-gradient(135deg, 
          #B8692F 0%, 
          #CD7F32 20%, 
          #F4A460 40%, 
          #FFD4A3 50%, 
          #E8B04D 60%, 
          #CD7F32 80%, 
          #A0612B 100%
        )
      `,
      boxShadow: `
        inset 0 3px 6px rgba(255, 220, 180, 0.5),
        inset 0 -3px 6px rgba(80, 50, 20, 0.5),
        0 3px 12px rgba(205, 127, 50, 0.5),
        0 0 20px rgba(205, 127, 50, 0.3)
      `,
    },
    silver_creator: {
      background: `
        radial-gradient(circle at 30% 30%, 
          rgba(255, 255, 255, 0.8) 0%, 
          transparent 50%
        ),
        radial-gradient(circle at 70% 70%, 
          rgba(120, 120, 120, 0.5) 0%, 
          transparent 50%
        ),
        linear-gradient(135deg, 
          #9A9A9A 0%, 
          #C0C0C0 20%, 
          #E8E8E8 40%, 
          #FFFFFF 50%, 
          #E0E0E0 60%, 
          #B8B8B8 80%, 
          #A0A0A0 100%
        )
      `,
      boxShadow: `
        inset 0 3px 6px rgba(255, 255, 255, 0.7),
        inset 0 -3px 6px rgba(50, 50, 50, 0.4),
        0 3px 12px rgba(192, 192, 192, 0.6),
        0 0 20px rgba(192, 192, 192, 0.4)
      `,
    },
    gold_creator: {
      background: `
        radial-gradient(circle at 30% 30%, 
          rgba(255, 250, 205, 1) 0%, 
          transparent 50%
        ),
        radial-gradient(circle at 70% 70%, 
          rgba(180, 140, 0, 0.7) 0%, 
          transparent 50%
        ),
        linear-gradient(135deg, 
          #D4AF37 0%, 
          #FFD700 20%, 
          #FFED4E 40%, 
          #FFFEF0 50%, 
          #FFE55C 60%, 
          #FFD700 80%, 
          #C9A900 100%
        )
      `,
      boxShadow: `
        inset 0 3px 6px rgba(255, 255, 220, 0.8),
        inset 0 -3px 6px rgba(150, 100, 0, 0.5),
        0 3px 12px rgba(255, 215, 0, 0.7),
        0 0 25px rgba(255, 215, 0, 0.5)
      `,
    },
    pioneer: {
      background: `
        radial-gradient(circle at 30% 30%, 
          rgba(255, 200, 200, 0.8) 0%, 
          transparent 50%
        ),
        radial-gradient(circle at 70% 70%, 
          rgba(180, 50, 50, 0.6) 0%, 
          transparent 50%
        ),
        linear-gradient(135deg, 
          #D84545 0%, 
          #FF6B6B 20%, 
          #FF9999 40%, 
          #FFCCCC 50%, 
          #FF9999 60%, 
          #FF6B6B 80%, 
          #E05555 100%
        )
      `,
      boxShadow: `
        inset 0 3px 6px rgba(255, 200, 200, 0.6),
        inset 0 -3px 6px rgba(100, 30, 30, 0.5),
        0 3px 12px rgba(255, 107, 107, 0.5),
        0 0 20px rgba(255, 107, 107, 0.3)
      `,
    },
  };

  return frameStyles[badge] || frameStyles.bronze_creator;
}