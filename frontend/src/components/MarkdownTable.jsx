import React from 'react';

/**
 * Rendered in place of `<table>` for GFM tables.
 *
 * A table cannot shrink the way text can — its min-content width is the sum of
 * the widest cell in each column — so on a narrow (mobile) bubble it would stick
 * out of the message and give the whole thread a horizontal scrollbar. The
 * scroll container must be an *ancestor* of the table: an `overflow-x: auto` on
 * the table box itself is ignored once the table is force-sized past the bubble.
 *
 * `node` is consumed here so the mdast node is not spread onto the DOM element.
 * Wired up via the `components` map in MARKDOWN_COMPONENTS
 * (utils/chatPageConstants.js).
 */
const MarkdownTable = ({ node, children, ...props }) => (
  <div className="markdown-table-wrap">
    <table {...props}>{children}</table>
  </div>
);

export default MarkdownTable;
