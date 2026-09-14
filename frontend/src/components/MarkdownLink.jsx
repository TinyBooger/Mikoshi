import React from 'react';
import { Link } from 'react-router';

/**
 * Classify a markdown link target.
 *
 * react-markdown's default `urlTransform` has already stripped unsafe protocols
 * (e.g. `javascript:`) down to an empty string by the time this runs, so the
 * remaining hrefs are safe to render directly.
 *
 * @param {string} href
 * @returns {'internal' | 'external' | 'anchor' | 'plain'}
 */
const getLinkTarget = (href) => {
  if (!href) return 'plain';
  // Non-navigational schemes — let the OS/browser handle them.
  if (/^(mailto:|tel:)/i.test(href)) return 'plain';
  // In-page anchors shouldn't be routed.
  if (href.startsWith('#')) return 'anchor';

  try {
    return new URL(href, window.location.origin).origin === window.location.origin
      ? 'internal'
      : 'external';
  } catch {
    return 'plain';
  }
};

/**
 * Rendered in place of `<a>` for markdown links.
 *
 * External links open in a new tab (with `rel="noopener noreferrer"` so the
 * target can't reach back through `window.opener`); same-origin links go
 * through the router so they don't trigger a full page reload.
 */
const MarkdownLink = ({ href = '', children, node, ...props }) => {
  const target = getLinkTarget(href);

  if (target === 'internal') {
    return <Link to={href} {...props}>{children}</Link>;
  }

  if (target === 'external') {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    );
  }

  return <a href={href} {...props}>{children}</a>;
};

export default MarkdownLink;
