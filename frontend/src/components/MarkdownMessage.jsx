import React from 'react';
import ReactMarkdown from 'react-markdown';
import '../styles/ChatBubble.css';
import {
  REMARK_PLUGINS,
  REHYPE_PLUGINS,
  MARKDOWN_COMPONENTS,
} from '../utils/chatPageConstants';

/**
 * The single markdown renderer for message bodies.
 *
 * Extracted from `ChatPage`'s `renderMessageContent` so the chat and the share
 * card cannot drift: the card has to show a message the way the chat showed it,
 * and two copies of a ten-line pipeline would eventually disagree about a
 * plugin, an option or the user-message hard-break rule. Plugin identities still
 * come from `utils/chatPageConstants.js`, so they stay stable across renders
 * and the `React.memo` on `MessageBubble` keeps working during streaming.
 *
 * `ChatBubble.css` is imported here rather than relied on as a side effect of
 * `ChatPage` being in the bundle — the styles are part of what this component
 * renders, so it carries them itself.
 *
 * `className` appends to `.chat-markdown`, which is what lets the share card
 * layer surface fixes on top without forking the chat's typography.
 */
const MarkdownMessage = ({ content, role, className }) => {
  if (!content) return null;
  // User messages are typed input where literal newlines matter, so convert
  // single newlines into Markdown hard breaks (two trailing spaces). Character
  // messages are left as-is to preserve their existing formatting.
  const text = role === 'user' ? content.replace(/([^\n])\n(?!\n)/g, '$1  \n') : content;
  return (
    <div className={className ? `chat-markdown ${className}` : 'chat-markdown'}>
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        components={MARKDOWN_COMPONENTS}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownMessage;
