/**
 * Shared layout dimensions — single source of truth for the fixed sidebars.
 *
 * The left navigation sidebar (`Layout.jsx`) and the right character sidebar
 * (`CharacterSidebar.jsx`) both render as `position: fixed` overlays while
 * reserving matching space in the flex flow via spacers/offsets. Keeping these
 * widths here ensures the overlay width, the reserved spacer width, and any
 * content-centering math (e.g. `ChatPage.jsx`'s content rail) can never drift
 * apart.
 */
export const NAV_WIDTH = '15rem';
export const SIDEBAR_WIDTH = '19rem';
export const SIDEBAR_BORDER_WIDTH = '1.2px';
export const CHAT_CONTENT_PADDING = '1.2rem';
