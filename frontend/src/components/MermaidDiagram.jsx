import React, { useEffect, useState } from 'react';

/**
 * Lazy mermaid loader.
 *
 * mermaid is the heaviest dependency in the app and only matters when a message
 * actually contains a ```mermaid fence, so it must never be a static import.
 * The in-flight promise is cached so every diagram on the page shares one fetch
 * and one `initialize` call — mermaid's config is process-wide state.
 */
let mermaidPromise = null;

const loadMermaid = () => {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid')
      .then((module) => {
        const mermaid = module.default;
        mermaid.initialize({
          // React owns the DOM here; nothing should be auto-rendered.
          startOnLoad: false,
          theme: 'default',
          // Mermaid embeds the diagram text into the output, so keep the
          // sanitiser on. 'strict' runs the serialized SVG through DOMPurify
          // before handing it back to us.
          securityLevel: 'strict',
          // Mermaid writes this into the SVG's own `#id { font-family: ... }`
          // rule. Matching Bootstrap's stack keeps diagrams looking like the
          // rest of the app instead of mermaid's trebuchet/verdana default.
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          // Without this, mermaid draws a "Syntax error" diagram into
          // document.body before throwing AND skips its temp-element cleanup on
          // that path — leaving a stray node behind for every invalid diagram.
          // Models produce invalid diagrams constantly, so this matters.
          suppressErrorRendering: true,
          // Parse failures are expected and already handled below; mermaid's own
          // console logging for them is just noise.
          logLevel: 'fatal',
        });
        return mermaid;
      })
      .catch((error) => {
        // Don't memoize a failure: a later diagram should be able to retry
        // (e.g. after a transient network error).
        mermaidPromise = null;
        throw error;
      });
  }
  return mermaidPromise;
};

// mermaid creates a temp element with the id `d${id}` and uses `#${id}` as a CSS
// selector, so ids must be unique and selector-safe. React's `useId` output is
// neither, hence the counter.
let diagramSeq = 0;
const nextDiagramId = () => `mmd-${++diagramSeq}`;

// Streaming rewrites the fence on every token and each render is a full parse
// plus layout, so coalesce bursts into a single attempt.
const RENDER_DEBOUNCE_MS = 200;

/**
 * Renders a ```mermaid fence as an SVG diagram.
 *
 * Every failure — invalid syntax (the common case for model output), or a
 * mermaid chunk that never arrives — falls back to the plain code block passed
 * in by CodeBlock. The diagram is a nicety; the source is the guarantee.
 */
const MermaidDiagram = ({ code, fallback }) => {
  const [render, setRender] = useState({ status: 'pending', svg: '' });

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(async () => {
      // A fresh id per attempt rather than per component: a debounced re-render
      // can start while the previous attempt is still in flight, and two
      // concurrent renders sharing an id collide in mermaid's temp DOM node.
      const renderId = nextDiagramId();
      try {
        const mermaid = await loadMermaid();
        const { svg } = await mermaid.render(renderId, code);
        if (!cancelled) setRender({ status: 'ready', svg });
      } catch {
        if (!cancelled) setRender({ status: 'error', svg: '' });
      }
    }, RENDER_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [code]);

  if (render.status === 'error') return fallback;

  if (render.status === 'ready') {
    return (
      <div
        className="mermaid-diagram"
        // `securityLevel: 'strict'` means mermaid DOMPurify-sanitised this
        // markup before returning it.
        dangerouslySetInnerHTML={{ __html: render.svg }}
      />
    );
  }

  // Deliberately not reset to this state when `code` changes: keeping the last
  // result on screen while re-attempting stops the code block and the diagram
  // from flickering back and forth as tokens stream in.
  return (
    <div className="mermaid-diagram mermaid-diagram-pending" role="status" aria-busy="true">
      正在渲染图表…
    </div>
  );
};

export default MermaidDiagram;
