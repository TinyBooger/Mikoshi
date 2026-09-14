import React, { useCallback, useEffect, useRef, useState } from 'react';
import { copyTextToClipboard } from '../utils/clipboard';
import MermaidDiagram from './MermaidDiagram';

/**
 * Flatten a rendered React children tree back to plain text.
 *
 * rehype-highlight swaps the source text for a tree of `<span>` tokens, so the
 * original code has to be reassembled to be copied verbatim.
 */
const extractText = (node) => {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (typeof node === 'object' && node.props) return extractText(node.props.children);
  return '';
};

// Matches the `language-xxx` class react-markdown leaves on the code element.
const LANGUAGE_RE = /language-([\w+#.-]+)/;
// Math is resolved by rehype-katex before this component ever sees it.
const MATH_CLASS_RE = /language-math|math-(?:display|inline)/;

/**
 * Rendered in place of `<pre>` for fenced code blocks.
 *
 * Adds a language label and a per-block copy button (the message-level copy in
 * MessageBubble copies the whole reply, which is rarely what you want for code).
 * Wired up via the `components` map in ChatPage's renderMessageContent.
 */
const CodeBlock = ({ node, children, ...props }) => {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef(null);

  // Clear the pending "copied" reset if the message unmounts first.
  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  const codeChild = Array.isArray(children) ? children[0] : children;
  const className = typeof codeChild?.props?.className === 'string' ? codeChild.props.className : '';
  // rehype-highlight replaces the source text with a tree of `<span>` tokens,
  // so the plain source has to be reassembled.
  const code = extractText(children);

  const handleCopy = useCallback(async () => {
    const copiedOk = await copyTextToClipboard(code);
    if (!copiedOk) return;
    setCopied(true);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopied(false), 1500);
  }, [code]);

  // Defensive: rehype-katex replaces the whole `<pre>` for display math, so a
  // `<pre>` should only ever hold code. If the rehype order ever changes, render
  // math untouched rather than attaching code-block chrome to an equation.
  if (MATH_CLASS_RE.test(className)) {
    return <pre {...props}>{children}</pre>;
  }

  const language = LANGUAGE_RE.exec(className)?.[1] || '';

  const codeBlock = (
    <div className="code-block">
      <div className="code-block-header">
        <span className="code-block-language">{language}</span>
        <button
          type="button"
          className="code-block-copy"
          onClick={handleCopy}
          aria-label={copied ? '已复制代码' : '复制代码'}
          title={copied ? '已复制' : '复制代码'}
        >
          <i className={copied ? 'bi bi-check-lg' : 'bi bi-clipboard'} aria-hidden="true"></i>
        </button>
      </div>
      <pre {...props}>{children}</pre>
    </div>
  );

  // ```mermaid fences become real diagrams. rehype-highlight leaves the source
  // as plain text because `mermaid` isn't a registered grammar, so `code` is the
  // raw diagram definition. MermaidDiagram hands `codeBlock` back whenever the
  // diagram can't be drawn, so the source is never lost.
  if (language === 'mermaid') {
    return <MermaidDiagram code={code.trim()} fallback={codeBlock} />;
  }

  return codeBlock;
};

export default CodeBlock;
