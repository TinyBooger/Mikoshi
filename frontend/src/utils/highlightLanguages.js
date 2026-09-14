/**
 * Explicit highlight.js grammar set for the chat markdown pipeline.
 *
 * `rehype-highlight` defaults to lowlight's `common` bundle, which registers 37
 * grammars. The app has no code splitting, so every grammar ends up in the main
 * bundle and is downloaded by every visitor on every route — including the
 * login and browse pages, which never render markdown at all. This list prunes
 * `common` down to the languages a chat reply plausibly contains and adds the
 * two that were missing.
 *
 * Importing the grammars individually is what makes the set replaceable:
 * `highlight.js` exposes `./lib/languages/*` through its `exports` map, so each
 * grammar stays its own tree-shakeable module. Pulling in `lowlight/lib/common`
 * instead would silently re-add the whole set.
 *
 * Aliases come for free — when a grammar is registered, highlight.js registers
 * its own `aliases` list too (core.js `registerLanguage`), so ```js, ```py,
 * ```ts, ```yml, ```sh, ```html and friends already resolve. `HIGHLIGHT_ALIASES`
 * below only fills the gaps.
 *
 * Unregistered languages are not an error: rehype-highlight catches the
 * "Unknown language" throw, records a `missing-language` message on the file,
 * and renders the block as plain text inside the normal code-block chrome.
 */

// Shell / build tooling
import bash from 'highlight.js/lib/languages/bash';
import shell from 'highlight.js/lib/languages/shell';
import powershell from 'highlight.js/lib/languages/powershell';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import makefile from 'highlight.js/lib/languages/makefile';

// Systems / compiled
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import swift from 'highlight.js/lib/languages/swift';

// JVM / mobile / scripting
import java from 'highlight.js/lib/languages/java';
import kotlin from 'highlight.js/lib/languages/kotlin';
import ruby from 'highlight.js/lib/languages/ruby';
import php from 'highlight.js/lib/languages/php';
import perl from 'highlight.js/lib/languages/perl';
import lua from 'highlight.js/lib/languages/lua';
import r from 'highlight.js/lib/languages/r';

// Web
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import css from 'highlight.js/lib/languages/css';
import scss from 'highlight.js/lib/languages/scss';
import xml from 'highlight.js/lib/languages/xml';

// Data / config / prose
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import ini from 'highlight.js/lib/languages/ini';
import sql from 'highlight.js/lib/languages/sql';
import graphql from 'highlight.js/lib/languages/graphql';
import markdown from 'highlight.js/lib/languages/markdown';
import diff from 'highlight.js/lib/languages/diff';
import plaintext from 'highlight.js/lib/languages/plaintext';
import python from 'highlight.js/lib/languages/python';

/**
 * Passed to `rehype-highlight` as its `languages` option, which replaces the
 * `common` default rather than extending it.
 */
export const HIGHLIGHT_LANGUAGES = {
  bash,
  shell,
  powershell,
  dockerfile,
  makefile,

  c,
  cpp,
  csharp,
  go,
  rust,
  swift,

  java,
  kotlin,
  ruby,
  php,
  perl,
  lua,
  r,

  javascript,
  typescript,
  css,
  scss,
  xml,

  json,
  yaml,
  ini,
  sql,
  graphql,

  markdown,
  diff,
  plaintext,
  python,
};

/**
 * Extra fence names that no bundled grammar claims on its own.
 *
 * Deliberately short: everything a grammar announces in its own `aliases` is
 * already registered, and overriding one here would shadow the grammar's real
 * alias list for that language.
 */
export const HIGHLIGHT_ALIASES = {
  // `ini` already answers to `toml`; these are the other dotenv-ish fence names.
  ini: ['env', 'dotenv', 'properties', 'conf'],
  // Single-file components are XML with extras — the `xml` grammar gets the
  // tags, attributes and embedded script/style blocks right.
  xml: ['vue', 'svelte'],
  bash: ['zsh', 'ksh'],
  // Non-code blocks models like to fence (tool output, logs, plain dumps).
  plaintext: ['output', 'log', 'stdout', 'stderr', 'none'],
};
