import { HIGHLIGHT_ALIASES, HIGHLIGHT_LANGUAGES } from './highlightLanguages';

/**
 * highlight.js attaches a grammar's aliases to the exported function itself
 * (`javascript.aliases = ['js', 'jsx', 'mjs', 'cjs']`) and `registerLanguage`
 * picks them up automatically, so `js` / `py` / `ts` / `yml` / `sh` are all real
 * fence names even though they appear nowhere in highlightLanguages.js.
 * highlight.js's typings only declare the call signature, hence reading the
 * property off the grammar rather than off a typed shape.
 */
const aliasesOf = (grammar) => {
  const aliases = grammar?.aliases;
  return Array.isArray(aliases) ? aliases : [];
};

// Every fence name the renderer actually understands, derived from the
// registered grammars instead of hand-written so it cannot drift out of sync
// with what the highlighter and CodeBlock really support. `mermaid` is
// deliberately absent: CodeBlock renders every fence as a plain code block, so
// listing it here would advertise a diagram renderer that does not exist.
const FENCE_LANGUAGES = [...new Set([
  ...Object.keys(HIGHLIGHT_LANGUAGES),
  ...Object.values(HIGHLIGHT_LANGUAGES).flatMap(aliasesOf),
  ...Object.values(HIGHLIGHT_ALIASES).flat(),
])].sort().join(', ');

// Three backticks, kept in a constant so the guide below can use a template
// literal without every fence needing an escape.
const FENCE = '```';

/**
 * Output-formatting section of the system prompt.
 *
 * Mirrors what the pipeline in chatPageConstants.js + ChatBubble.css actually
 * renders, so the model is told about real capabilities and real limits (no raw
 * HTML, no mermaid/diagram fences, math instead of paired dollar signs) rather
 * than generic Markdown lore.
 */
export const MARKDOWN_GUIDE = `[输出格式]
回复使用 Markdown 语法，渲染器支持：

- 段落之间用空行分隔。段落内的单个换行不会换行，会被当作空格；需要强制换行时在上一行末尾加两个空格。
- 强调：**粗体**、*斜体*、~~删除线~~。
- 标题：# 到 ######。聊天里标题字号被刻意调小，只适合给长回复分节，不要滥用。
- 列表：无序用 "- "，有序用 "1. "，缩进 2~4 个空格可以嵌套；任务列表用 "- [ ]" 和 "- [x]"。
- 引用：行首加 "> "。分割线：单独一行写 "---"。
- 行内代码：用单个反引号包裹，例如 \`code\`。
- 代码块：用三个反引号包裹并在开头注明语言，例如 ${FENCE}python。可高亮的语言：${FENCE_LANGUAGES}
- 表格：GFM 管道表格，必须有表头分隔行；用 :---、:---:、---: 控制左、中、右对齐。
- 链接：[文字](https://example.com)。站内相对路径在应用内跳转，外部链接的新标签页打开。
- 图片：![说明](https://example.com/a.png)。
- 数学公式：行内写 $E = mc^2$，独立成行用 $$...$$，内容为 LaTeX。货币金额建议转义成 \\$100 或避免成对出现，否则可能被当成公式。
- 脚注：正文写 [^1]，文末写 "[^1]: 说明"。
- 裸网址会自动变成链接。
- 不支持原生 HTML，<div> 这类标签会原样显示为文字。
- 不支持 mermaid，也不支持任何图表语法：${FENCE}mermaid 及类似的代码块不会渲染成图，只会原样显示为普通代码块文字。需要展示结构时请改用列表、表格或纯文本示意。

格式只为可读性服务：对话、动作和心理描写请用自然段落，只有在列举、代码、表格、公式确实必要时才使用结构化语法。
[/输出格式]`;
