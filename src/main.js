const sampleMarkdown = `# Markdown Reader

像读 GitHub README 一样阅读本机 Markdown 文件。

- 支持拖拽或选择 \`.md\` / \`.csv\` / \`.xlsx\` / \`.xls\` 文件
- Markdown 支持表格、任务列表、代码块、图片、相对链接和目录
- 表格文件支持 CSV、TSV、Excel 工作簿和多工作表切换
- 选择文件夹时，会优先打开 README，并解析同目录图片

## Markdown 表格

| 功能 | 状态 |
| --- | --- |
| Markdown 渲染 | Ready |
| CSV / Excel 预览 | Ready |
| 本地文件读取 | Ready |
| 暗色模式 | Ready |

## 任务列表

- [x] 打开单个 Markdown 文件
- [x] 拖拽文件或文件夹
- [ ] 继续打磨你喜欢的阅读细节

## 代码

\`\`\`js
const readme = "hello markdown";
console.log(readme);
\`\`\`
`;

const bootstrap = window.__MARKDOWN_READER_BOOTSTRAP__ || null;
const nativeHost = Boolean(window.__MARKDOWN_READER_NATIVE__);

function base64ToBytes(value) {
  try {
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return new Uint8Array();
  }
}

function bytesToText(bytes) {
  return new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/, "");
}

function decodeBase64Utf8(value) {
  return bytesToText(base64ToBytes(value));
}

function fileNameFromPath(path) {
  return String(path || "")
    .replaceAll("\\", "/")
    .split("/")
    .filter(Boolean)
    .pop();
}

function fileExtension(path) {
  const match = String(path || "").match(/\.([^.\/\\]+)$/);
  return match ? match[1].toLowerCase() : "";
}

function splitMiddleFileName(name) {
  const label = String(name || "");
  const chars = Array.from(label);
  if (chars.length <= 10) return { start: label, end: "" };

  const extensionMatch = label.match(/(\.[^.\/\\]{1,12})$/);
  if (extensionMatch) {
    const extension = extensionMatch[1];
    const base = label.slice(0, -extension.length);
    const baseChars = Array.from(base);
    const extensionChars = Array.from(extension);

    if (baseChars.length <= 8) {
      return { start: base, end: extension };
    }

    const suffixBaseLength = Math.min(
      Math.max(6, 14 - extensionChars.length),
      Math.max(1, baseChars.length - 4),
    );

    return {
      start: baseChars.slice(0, -suffixBaseLength).join(""),
      end: `${baseChars.slice(-suffixBaseLength).join("")}${extension}`,
    };
  }

  const suffixLength = Math.min(14, chars.length - 4);
  return {
    start: chars.slice(0, -suffixLength).join(""),
    end: chars.slice(-suffixLength).join(""),
  };
}

function setMiddleEllipsisLabel(element, name) {
  const label = String(name || "");
  const parts = splitMiddleFileName(label);
  element.replaceChildren();
  element.classList.add("middle-ellipsis");
  element.setAttribute("aria-label", label);

  const start = document.createElement("span");
  start.className = "middle-ellipsis-start";
  start.textContent = parts.start;
  element.append(start);

  if (parts.end) {
    const end = document.createElement("span");
    end.className = "middle-ellipsis-end";
    end.textContent = parts.end;
    element.append(end);
  }
}

function getReadableKind(path) {
  const extension = fileExtension(path);
  if (["md", "markdown", "mdown", "mkdn", "txt"].includes(extension)) return "markdown";
  if (["csv", "tsv", "xls", "xlsx"].includes(extension)) return "spreadsheet";
  return "unsupported";
}

const initialName = bootstrap?.name || fileNameFromPath(bootstrap?.path) || (nativeHost ? "未打开文件" : "欢迎.md");
const initialPath = bootstrap?.path || initialName;
const initialKind = bootstrap ? getReadableKind(initialPath) : "markdown";
const initialBytes = bootstrap?.base64 ? base64ToBytes(bootstrap.base64) : null;
const initialContent =
  initialKind === "markdown" && bootstrap?.base64
    ? bytesToText(initialBytes)
    : nativeHost
      ? ""
      : sampleMarkdown;
const initialSize =
  typeof bootstrap?.size === "number"
    ? bootstrap.size
    : nativeHost
      ? 0
      : new Blob([initialContent]).size;
const initialModified = bootstrap?.modified
  ? new Date(Number(bootstrap.modified) * 1000)
  : null;

const state = {
  content: initialKind === "markdown" ? initialContent : "",
  fileKind: initialKind === "spreadsheet" ? "spreadsheet" : "markdown",
  fileBytes: initialKind === "spreadsheet" ? initialBytes : null,
  documentSequence: 0,
  currentFile: {
    name: initialName,
    size: initialSize,
    modified: initialModified,
    path: bootstrap?.path || (nativeHost ? "" : initialPath),
  },
  documents: new Map(),
  assets: new Map(),
  sheets: [],
  activeSheetName: "",
  outline: [],
  activeHeadingId: "",
  theme: "light",
  outlineOpen: true,
  sidebarWidth: 280,
  outlineWidth: 300,
  previewZoom: 1,
  objectUrls: [],
};

const elements = {
  app: document.getElementById("app"),
  fileInput: document.getElementById("fileInput"),
  folderInput: document.getElementById("folderInput"),
  leftResizer: document.getElementById("leftResizer"),
  rightResizer: document.getElementById("rightResizer"),
  openFileButton: document.getElementById("openFileButton"),
  openFolderButton: document.getElementById("openFolderButton"),
  fileKindBadge: document.getElementById("fileKindBadge"),
  fileName: document.getElementById("fileName"),
  fileSize: document.getElementById("fileSize"),
  lineStatLabel: document.getElementById("lineStatLabel"),
  lineCount: document.getElementById("lineCount"),
  wordStatLabel: document.getElementById("wordStatLabel"),
  wordCount: document.getElementById("wordCount"),
  modifiedDate: document.getElementById("modifiedDate"),
  documentListPanel: document.getElementById("documentListPanel"),
  documentList: document.getElementById("documentList"),
  themeButton: document.getElementById("themeButton"),
  outlineButton: document.getElementById("outlineButton"),
  readerZone: document.getElementById("readerZone"),
  readerTitle: document.getElementById("readerTitle"),
  notice: document.getElementById("notice"),
  sheetTabs: document.getElementById("sheetTabs"),
  preview: document.getElementById("preview"),
  previewCanvas: document.getElementById("previewCanvas"),
  previewContent: document.getElementById("previewContent"),
  outline: document.getElementById("outline"),
  outlineList: document.getElementById("outlineList"),
  dragOverlay: document.getElementById("dragOverlay"),
  copyAllButton: document.getElementById("copyAllButton"),
  zoomPercent: document.getElementById("zoomPercent"),
  zoomResetButton: document.getElementById("zoomResetButton"),
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function countWords(content) {
  const englishWords = content.match(/[A-Za-z0-9_]+(?:[-'][A-Za-z0-9_]+)*/g) || [];
  const cjkChars = content.match(/[\u4e00-\u9fff]/g) || [];
  return englishWords.length + cjkChars.length;
}

function isMarkdownPath(path) {
  return getReadableKind(path) === "markdown";
}

function isSpreadsheetPath(path) {
  return getReadableKind(path) === "spreadsheet";
}

function isReadablePath(path) {
  return getReadableKind(path) !== "unsupported";
}

function isImagePath(path) {
  return /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(path);
}

function normalizePath(path) {
  const parts = [];
  const value = String(path).replaceAll("\\", "/");
  const isAbsolute = value.startsWith("/");
  value
    .split("/")
    .forEach((part) => {
      if (!part || part === ".") return;
      if (part === "..") {
        parts.pop();
        return;
      }
      parts.push(part);
    });
  return `${isAbsolute ? "/" : ""}${parts.join("/")}`;
}

function dirname(path) {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf("/");
  return index === -1 ? "" : normalized.slice(0, index);
}

function joinPath(base, path) {
  if (/^(https?:|mailto:|tel:|#|data:|blob:)/i.test(path)) return path;
  return normalizePath(`${base ? `${base}/` : ""}${path}`);
}

function pathToFileUrl(path) {
  const normalized = normalizePath(path);
  if (!normalized.startsWith("/")) return path;
  const encoded = normalized
    .split("/")
    .map((segment, index) => (index === 0 ? "" : encodeURIComponent(segment)))
    .join("/");
  return `file://${encoded}`;
}

function slugify(text, seen) {
  const base =
    text
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-") || "section";
  const count = seen.get(base) || 0;
  seen.set(base, count + 1);
  return count ? `${base}-${count}` : base;
}

function resolveAsset(src) {
  if (/^(https?:|mailto:|tel:|#|data:|blob:)/i.test(src)) return src;
  const base = dirname(state.currentFile.path);
  const joined = joinPath(base, src);
  const byPath = state.assets.get(joined);
  if (byPath) return byPath;

  const byName = state.assets.get(normalizePath(src).split("/").pop());
  if (byName) return byName;

  if (state.currentFile.path.startsWith("/")) {
    return pathToFileUrl(joined);
  }

  return src;
}

function resolveDocumentHref(href) {
  if (/^(https?:|mailto:|tel:|#|data:|blob:)/i.test(href)) {
    return { href, path: "" };
  }

  const [pathPart, hashPart = ""] = href.split("#");
  const base = dirname(state.currentFile.path);
  const joined = joinPath(base, pathPart);
  if (state.documents.has(joined)) {
    return { href: "#", path: joined, hash: hashPart };
  }
  if (state.currentFile.path.startsWith("/") && pathPart) {
    const hash = hashPart ? `#${encodeURIComponent(hashPart)}` : "";
    return { href: `${pathToFileUrl(joined)}${hash}`, path: "" };
  }
  return { href, path: "" };
}

function normalizeDeepResearchToken(kind, payload) {
  if (kind === "entity") {
    try {
      const parsed = JSON.parse(payload);
      if (Array.isArray(parsed)) return parsed[1] || parsed[0] || "";
    } catch {
      const match = payload.match(/"([^"]+)"\s*,\s*"([^"]+)"/);
      if (match) return match[2];
    }
  }

  if (kind === "cite" || kind === "navlist") return "";
  return payload || "";
}

function cleanDeepResearchMarkup(text) {
  return String(text || "")
    .replace(/\uE200([a-zA-Z]+)\uE202([^\uE201]*)\uE201/g, (_, kind, payload) => {
      return normalizeDeepResearchToken(kind, payload);
    })
    .replace(/[\uE200-\uE2FF]/g, "");
}

function renderInline(text) {
  const placeholders = [];
  let value = escapeHtml(cleanDeepResearchMarkup(text));

  value = value.replace(/`([^`]+)`/g, (_, code) => {
    const id = placeholders.push(`<code>${code}</code>`) - 1;
    return `\u0000${id}\u0000`;
  });

  value = value.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_, alt, rawSrc) => {
    const src = resolveAsset(rawSrc);
    return `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}" loading="lazy">`;
  });

  value = value.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_, label, rawHref) => {
    const resolved = resolveDocumentHref(rawHref);
    const labelHtml = renderInline(label);
    if (resolved.path) {
      const hash = resolved.hash ? ` data-hash="${escapeAttribute(resolved.hash)}"` : "";
      return `<a href="#" data-md-path="${escapeAttribute(resolved.path)}"${hash}>${labelHtml}</a>`;
    }
    const isExternal = /^https?:\/\//i.test(resolved.href);
    const target = isExternal ? ' target="_blank" rel="noreferrer noopener"' : "";
    return `<a href="${escapeAttribute(resolved.href)}"${target}>${labelHtml}</a>`;
  });

  value = value
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>");

  placeholders.forEach((html, index) => {
    value = value.replaceAll(`\u0000${index}\u0000`, html);
  });

  return value;
}

function renderCodeBlock(code, language) {
  const label = language ? `<div class="code-label">${escapeHtml(language)}</div>` : "";
  return `${label}<pre><code class="language-${escapeAttribute(language || "text")}">${escapeHtml(code.replace(/\n$/, ""))}</code></pre>`;
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderTable(lines, start) {
  const headers = splitTableRow(lines[start]);
  let index = start + 2;
  const rows = [];

  while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
    rows.push(splitTableRow(lines[index]));
    index += 1;
  }

  const thead = `<thead><tr>${headers.map((cell) => `<th>${renderInline(cell)}</th>`).join("")}</tr></thead>`;
  const tbody = rows
    .map((row) => `<tr>${headers.map((_, cellIndex) => `<td>${renderInline(row[cellIndex] || "")}</td>`).join("")}</tr>`)
    .join("");
  return {
    html: `<table>${thead}<tbody>${tbody}</tbody></table>`,
    next: index,
  };
}

function renderList(lines, start) {
  const ordered = /^\s*\d+\.\s+/.test(lines[start]);
  const tag = ordered ? "ol" : "ul";
  const items = [];
  let index = start;

  while (index < lines.length) {
    const line = lines[index];
    const pattern = ordered ? /^\s*\d+\.\s+(.*)$/ : /^\s*[-*+]\s+(.*)$/;
    const match = line.match(pattern);
    if (!match) break;

    let body = match[1];
    const task = body.match(/^\[([ xX])\]\s+(.*)$/);
    if (task) {
      const checked = task[1].toLowerCase() === "x" ? " checked" : "";
      body = `<input type="checkbox" disabled${checked}> ${renderInline(task[2])}`;
      items.push(`<li class="task-list-item">${body}</li>`);
    } else {
      items.push(`<li>${renderInline(body)}</li>`);
    }
    index += 1;
  }

  return {
    html: `<${tag}>${items.join("")}</${tag}>`,
    next: index,
  };
}

function renderBlockquote(lines, start) {
  const parts = [];
  let index = start;

  while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
    parts.push(lines[index].replace(/^\s*>\s?/, ""));
    index += 1;
  }

  return {
    html: `<blockquote>${renderMarkdown(parts.join("\n"), false).html}</blockquote>`,
    next: index,
  };
}

function renderMarkdown(source, collectOutline = true) {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const outline = [];
  const seenSlugs = new Map();
  const html = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(/^```(\S*)\s*$/);
    if (fence) {
      const language = fence[1] || "";
      const codeLines = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      index += index < lines.length ? 1 : 0;
      html.push(renderCodeBlock(codeLines.join("\n"), language));
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*$/);
    if (heading) {
      const level = heading[1].length;
      const text = cleanDeepResearchMarkup(heading[2]).trim();
      const id = slugify(text, seenSlugs);
      if (collectOutline) outline.push({ id, text, level });
      html.push(`<h${level} id="${escapeAttribute(id)}">${renderInline(text)}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      html.push("<hr>");
      index += 1;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const blockquote = renderBlockquote(lines, index);
      html.push(blockquote.html);
      index = blockquote.next;
      continue;
    }

    if (index + 1 < lines.length && lines[index].includes("|") && isTableSeparator(lines[index + 1])) {
      const table = renderTable(lines, index);
      html.push(table.html);
      index = table.next;
      continue;
    }

    if (/^\s*(?:[-*+]|\d+\.)\s+/.test(line)) {
      const list = renderList(lines, index);
      html.push(list.html);
      index = list.next;
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,6})\s+/.test(lines[index]) &&
      !/^```/.test(lines[index]) &&
      !/^\s*(?:[-*+]|\d+\.)\s+/.test(lines[index]) &&
      !/^\s*>\s?/.test(lines[index]) &&
      !(index + 1 < lines.length && lines[index].includes("|") && isTableSeparator(lines[index + 1]))
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    html.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
  }

  return { html: html.join("\n"), outline };
}

function bytesToArrayBuffer(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function parseDelimitedRows(text, delimiter) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && character === delimiter) {
      row.push(field);
      field = "";
      continue;
    }

    if (!inQuotes && (character === "\n" || character === "\r")) {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      if (character === "\r" && nextCharacter === "\n") index += 1;
      continue;
    }

    field += character;
  }

  if (field || row.length || text.endsWith(delimiter)) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function modifiedDateFromValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function createDocumentEntry({ file, path, name, size, modified, content, bytes }) {
  const resolvedPath = normalizePath(path || file?.webkitRelativePath || file?.relativePath || file?.name || name || "");
  const resolvedName = name || file?.name || fileNameFromPath(resolvedPath) || "未命名文件";
  const kind = getReadableKind(resolvedPath || resolvedName);

  return {
    file,
    path: resolvedPath || resolvedName,
    name: resolvedName,
    size: typeof size === "number" ? size : file?.size || 0,
    modified: modifiedDateFromValue(modified) || (file?.lastModified ? new Date(file.lastModified) : null),
    kind,
    content: content || "",
    bytes: bytes || null,
    openedAt: Date.now(),
  };
}

function createDocumentEntryFromPayload(payload) {
  const path = payload?.path || payload?.name || "未命名文件";
  const bytes = payload?.base64 ? base64ToBytes(payload.base64) : new Uint8Array();
  const kind = getReadableKind(path);

  return createDocumentEntry({
    path,
    name: payload?.name || fileNameFromPath(path),
    size: typeof payload?.size === "number" ? payload.size : bytes.byteLength,
    modified: payload?.modified,
    content: kind === "markdown" ? bytesToText(bytes) : "",
    bytes: kind === "spreadsheet" ? bytes : null,
  });
}

function nextDocumentOrder() {
  const order = state.documentSequence;
  state.documentSequence += 1;
  return order;
}

function mergeDocumentEntry(existing, documentEntry) {
  const openedAt = existing?.openedAt || documentEntry.openedAt || Date.now();
  const openedOrder = Number.isFinite(existing?.openedOrder)
    ? existing.openedOrder
    : Number.isFinite(documentEntry.openedOrder)
      ? documentEntry.openedOrder
      : nextDocumentOrder();

  return {
    ...existing,
    ...documentEntry,
    openedAt,
    openedOrder,
  };
}

function rememberDocument(documentEntry) {
  const existing = state.documents.get(documentEntry.path);
  state.documents.set(documentEntry.path, mergeDocumentEntry(existing, documentEntry));
}

function documentDisplayName(doc) {
  return doc?.name || fileNameFromPath(doc?.path) || "未命名文件";
}

function sortedDocuments() {
  return [...state.documents.values()].sort((a, b) => {
    if ((a.openedAt || 0) !== (b.openedAt || 0)) return (a.openedAt || 0) - (b.openedAt || 0);
    if ((a.openedOrder || 0) !== (b.openedOrder || 0)) return (a.openedOrder || 0) - (b.openedOrder || 0);
    return a.path.localeCompare(b.path);
  });
}

function resetReader() {
  const content = nativeHost ? "" : sampleMarkdown;
  state.fileKind = "markdown";
  state.content = content;
  state.fileBytes = null;
  state.sheets = [];
  state.activeSheetName = "";
  state.activeHeadingId = "";
  state.currentFile = {
    name: nativeHost ? "未打开文件" : "欢迎.md",
    size: nativeHost ? 0 : new Blob([content]).size,
    modified: null,
    path: nativeHost ? "" : "欢迎.md",
  };
  showNotice("");
  render();
}

function activateDocument(documentEntry, hash = "") {
  if (!documentEntry || documentEntry.kind === "unsupported") {
    showNotice("请选择 Markdown、CSV 或 Excel 文件。");
    return;
  }

  const existing = state.documents.get(documentEntry.path);
  const doc = mergeDocumentEntry(existing, documentEntry);

  state.fileKind = doc.kind;
  state.content = doc.kind === "markdown" ? doc.content || "" : "";
  state.fileBytes = doc.kind === "spreadsheet" ? doc.bytes : null;
  state.sheets = [];
  state.activeSheetName = "";
  state.activeHeadingId = "";
  state.currentFile = {
    name: doc.name,
    size: doc.size,
    modified: doc.modified,
    path: doc.path,
  };

  rememberDocument(doc);
  showNotice("");
  render();

  if (hash) {
    requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ block: "start" }));
  }
}

function removeDocument(path) {
  const normalizedPath = normalizePath(path);
  const removedActiveDocument = normalizedPath === normalizePath(state.currentFile.path);
  state.documents.delete(normalizedPath);

  if (!removedActiveDocument) {
    updateDocumentList();
    return;
  }

  const nextDocument = sortedDocuments()[0];
  if (nextDocument) {
    activateDocument(nextDocument);
    return;
  }

  resetReader();
}

function isBlankCell(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

function normalizeSheetRows(rows) {
  const normalized = rows.map((row) => {
    const values = Array.isArray(row) ? row : [];
    let end = values.length;
    while (end > 0 && isBlankCell(values[end - 1])) end -= 1;
    return values.slice(0, end).map((value) => (value === null || value === undefined ? "" : value));
  });

  while (normalized.length > 0 && normalized[normalized.length - 1].every(isBlankCell)) {
    normalized.pop();
  }

  return normalized.length ? normalized : [[]];
}

function createSheet(name, rows) {
  const normalizedRows = normalizeSheetRows(rows);
  const columnCount = normalizedRows.reduce((max, row) => Math.max(max, row.length), 0);
  const nonEmptyCells = normalizedRows.reduce(
    (count, row) => count + row.filter((cell) => !isBlankCell(cell)).length,
    0,
  );

  return {
    name: name || "Sheet1",
    rows: normalizedRows,
    rowCount: normalizedRows.length,
    columnCount,
    nonEmptyCells,
  };
}

function parseSpreadsheetFile(bytes, path) {
  const extension = fileExtension(path);

  if (extension === "csv" || extension === "tsv") {
    const delimiter = extension === "tsv" ? "\t" : ",";
    const rows = parseDelimitedRows(bytesToText(bytes), delimiter);
    return [createSheet(fileNameFromPath(path) || "Sheet1", rows)];
  }

  if (!window.XLSX) {
    throw new Error("Excel 解析库没有加载成功。");
  }

  const workbook = window.XLSX.read(bytesToArrayBuffer(bytes), {
    type: "array",
    cellDates: true,
    cellFormula: false,
    dateNF: "yyyy-mm-dd",
  });

  return workbook.SheetNames.map((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const rows = window.XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    });
    return createSheet(sheetName, rows);
  });
}

function columnName(index) {
  let value = index + 1;
  let name = "";

  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }

  return name;
}

function getActiveSheet() {
  if (!state.sheets.length) return null;
  return (
    state.sheets.find((sheet) => sheet.name === state.activeSheetName) ||
    state.sheets[0]
  );
}

const spreadsheetSizing = {
  minColumnWidth: 64,
  maxColumnWidth: 960,
  defaultColumnWidth: 140,
  minRowHeight: 24,
  maxRowHeight: 420,
  defaultRowHeight: 32,
};

function ensureSheetSizing(sheet) {
  if (!sheet.columnWidths) sheet.columnWidths = {};
  if (!sheet.rowHeights) sheet.rowHeights = {};
}

function estimateCellTextWidth(value) {
  const chars = Array.from(String(value || ""));
  const weightedLength = chars.reduce((total, character) => {
    return total + (/[\u4e00-\u9fff]/.test(character) ? 1.8 : 1);
  }, 0);
  return weightedLength * 8 + 28;
}

function estimateColumnWidth(sheet, columnIndex, displayRowCount) {
  const sampleRows = Math.min(displayRowCount, 160);
  let width = estimateCellTextWidth(columnName(columnIndex));

  for (let rowIndex = 0; rowIndex < sampleRows; rowIndex += 1) {
    width = Math.max(width, estimateCellTextWidth(sheet.rows[rowIndex]?.[columnIndex]));
  }

  return Math.round(clamp(width, spreadsheetSizing.defaultColumnWidth, 360));
}

function getSheetColumnWidth(sheet, columnIndex, displayRowCount) {
  ensureSheetSizing(sheet);
  const savedWidth = Number(sheet.columnWidths[columnIndex]);
  if (Number.isFinite(savedWidth)) {
    return Math.round(clamp(savedWidth, spreadsheetSizing.minColumnWidth, spreadsheetSizing.maxColumnWidth));
  }
  return estimateColumnWidth(sheet, columnIndex, displayRowCount);
}

function getSheetRowHeight(sheet, rowIndex) {
  ensureSheetSizing(sheet);
  const savedHeight = Number(sheet.rowHeights[rowIndex]);
  if (Number.isFinite(savedHeight)) {
    return Math.round(clamp(savedHeight, spreadsheetSizing.minRowHeight, spreadsheetSizing.maxRowHeight));
  }
  return spreadsheetSizing.defaultRowHeight;
}

function updateSheetTabs() {
  elements.sheetTabs.innerHTML = "";
  elements.sheetTabs.hidden = state.fileKind !== "spreadsheet" || state.sheets.length <= 1;
  if (elements.sheetTabs.hidden) return;

  state.sheets.forEach((sheet) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = sheet.name;
    button.title = sheet.name;
    if (sheet.name === state.activeSheetName) button.classList.add("is-active");
    button.addEventListener("click", () => {
      state.activeSheetName = sheet.name;
      render();
    });
    elements.sheetTabs.append(button);
  });
}

function renderSpreadsheetPreview() {
  const sheet = getActiveSheet();
  if (!sheet) {
    setPreviewHtml(`<div class="empty-sheet">没有可显示的工作表。</div>`);
    return;
  }

  const maxRows = 2000;
  const maxColumns = 160;
  const displayRowCount = Math.min(sheet.rowCount, maxRows);
  const displayColumnCount = Math.min(Math.max(sheet.columnCount, 1), maxColumns);
  const isTruncated = sheet.rowCount > maxRows || sheet.columnCount > maxColumns;
  ensureSheetSizing(sheet);
  const columnWidths = Array.from({ length: displayColumnCount }, (_, index) => {
    return getSheetColumnWidth(sheet, index, displayRowCount);
  });
  const tableWidth = 58 + columnWidths.reduce((total, width) => total + width, 0);

  const colgroup = [
    `<col class="row-index-column" />`,
    ...columnWidths.map((width, index) => {
      return `<col data-column-width="${index}" style="width: ${width}px;" />`;
    }),
  ].join("");

  const header = Array.from({ length: displayColumnCount }, (_, index) => {
    return `
      <th class="column-header" data-column-index="${index}">
        <span>${columnName(index)}</span>
        <span class="column-resize-handle" data-column-resize="${index}" aria-hidden="true"></span>
      </th>
    `;
  }).join("");

  const body = sheet.rows
    .slice(0, displayRowCount)
    .map((row, rowIndex) => {
      const rowHeight = getSheetRowHeight(sheet, rowIndex);
      const cells = Array.from({ length: displayColumnCount }, (_, columnIndex) => {
        const value = row[columnIndex] ?? "";
        const text = String(value);
        return `<td title="${escapeAttribute(text)}">${escapeHtml(text)}</td>`;
      }).join("");
      return `
        <tr data-row-index="${rowIndex}" style="height: ${rowHeight}px;">
          <th class="row-number" data-row-index="${rowIndex}">
            <span>${rowIndex + 1}</span>
            <span class="row-resize-handle" data-row-resize="${rowIndex}" aria-hidden="true"></span>
          </th>
          ${cells}
        </tr>
      `;
    })
    .join("");

  const truncatedMessage = isTruncated
    ? `<p class="sheet-warning">当前预览显示前 ${displayRowCount.toLocaleString()} 行、${displayColumnCount.toLocaleString()} 列。</p>`
    : "";

  setPreviewHtml(`
    <section class="sheet-view">
      <div class="sheet-summary">
        <div>
          <h1>${escapeHtml(sheet.name)}</h1>
          <p>${sheet.rowCount.toLocaleString()} 行 · ${sheet.columnCount.toLocaleString()} 列 · ${sheet.nonEmptyCells.toLocaleString()} 个非空单元格</p>
        </div>
        ${truncatedMessage}
      </div>
      <div class="sheet-scroller">
        <table class="data-grid" style="width: ${tableWidth}px;">
          <colgroup>${colgroup}</colgroup>
          <thead>
            <tr><th class="corner-cell"></th>${header}</tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </section>
  `);
}

function showNotice(message) {
  elements.notice.textContent = message;
  elements.notice.hidden = !message;
}

let copyAllResetTimer = 0;

function updateCopyAllButton() {
  const canCopyTextFile = state.fileKind === "markdown" && Boolean(state.currentFile.path || state.content);
  elements.copyAllButton.hidden = !canCopyTextFile;
  if (!canCopyTextFile) {
    window.clearTimeout(copyAllResetTimer);
    elements.copyAllButton.textContent = "复制全文";
  }
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the local textarea copy path for file:// WebViews.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.append(textarea);
  textarea.focus();
  textarea.select();

  try {
    return document.execCommand("copy");
  } finally {
    textarea.remove();
  }
}

async function copyEntireTextFile() {
  if (state.fileKind !== "markdown") return;

  const copied = await copyTextToClipboard(state.content || "");
  window.clearTimeout(copyAllResetTimer);
  elements.copyAllButton.textContent = copied ? "已复制" : "复制失败";
  copyAllResetTimer = window.setTimeout(() => {
    elements.copyAllButton.textContent = "复制全文";
  }, 1400);
}

function setPreviewHtml(html) {
  elements.previewContent.innerHTML = html;
}

function clearObjectUrls() {
  state.objectUrls.forEach((url) => URL.revokeObjectURL(url));
  state.objectUrls = [];
}

function updateMeta() {
  const file = state.currentFile;
  const activeSheet = getActiveSheet();
  const extension = fileExtension(file.path || file.name);
  elements.fileKindBadge.textContent = ["csv", "tsv", "xls", "xlsx"].includes(extension)
    ? extension.toUpperCase()
    : "MD";
  setMiddleEllipsisLabel(elements.fileName, file.name);
  elements.fileName.title = file.name;
  elements.readerTitle.textContent = file.name;
  elements.readerTitle.title = file.path || file.name;
  elements.fileSize.textContent = formatBytes(file.size);

  if (state.fileKind === "spreadsheet") {
    elements.lineStatLabel.textContent = "行数";
    elements.wordStatLabel.textContent = "单元格";
    elements.lineCount.textContent = activeSheet ? activeSheet.rowCount.toLocaleString() : "0";
    elements.wordCount.textContent = activeSheet ? activeSheet.nonEmptyCells.toLocaleString() : "0";
  } else {
    elements.lineStatLabel.textContent = "行数";
    elements.wordStatLabel.textContent = "字词";
    elements.lineCount.textContent = state.content ? state.content.split(/\r\n|\r|\n/).length : "0";
    elements.wordCount.textContent = String(countWords(state.content));
  }

  elements.modifiedDate.textContent = file.modified ? file.modified.toLocaleDateString() : "示例";
}

function setActiveHeading(headingId, scrollOutline = false) {
  state.activeHeadingId = headingId || "";

  elements.outlineList
    .querySelectorAll("[data-heading-id]")
    .forEach((button) => {
      const isActive = button.dataset.headingId === state.activeHeadingId;
      button.classList.toggle("is-active", isActive);
      if (isActive) {
        button.setAttribute("aria-current", "true");
      } else {
        button.removeAttribute("aria-current");
      }
    });

  if (scrollOutline && state.activeHeadingId) {
    [...elements.outlineList.querySelectorAll("[data-heading-id]")]
      .find((button) => button.dataset.headingId === state.activeHeadingId)
      ?.scrollIntoView({ block: "nearest" });
  }
}

function headingIdForPreviewTarget(target) {
  if (state.fileKind !== "markdown" || !state.outline.length) return "";
  const clickedElement = target.closest?.("h1,h2,h3,h4,h5,h6,p,li,pre,blockquote,table,hr,ul,ol,dl");
  if (!clickedElement || !elements.previewContent.contains(clickedElement)) return "";

  const directHeading = clickedElement.closest("h1,h2,h3,h4,h5,h6");
  if (directHeading?.id) return directHeading.id;

  let activeHeading = "";
  const headings = [...elements.previewContent.querySelectorAll("h1,h2,h3,h4,h5,h6")];

  for (const heading of headings) {
    const position = heading.compareDocumentPosition(clickedElement);
    if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
      activeHeading = heading.id;
      continue;
    }
    break;
  }

  return activeHeading;
}

function updateOutline() {
  elements.outlineList.innerHTML = "";

  if (state.fileKind === "spreadsheet") {
    if (!state.sheets.length) {
      const item = document.createElement("li");
      item.className = "empty-outline";
      item.textContent = "无工作表";
      elements.outlineList.append(item);
      return;
    }

    state.sheets.forEach((sheet) => {
      const item = document.createElement("li");
      item.style.setProperty("--level", "1");
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = sheet.name;
      button.title = sheet.name;
      if (sheet.name === state.activeSheetName) button.classList.add("is-active");
      button.addEventListener("click", () => {
        state.activeSheetName = sheet.name;
        render();
      });
      item.append(button);
      elements.outlineList.append(item);
    });
    return;
  }

  if (!state.outline.length) {
    const item = document.createElement("li");
    item.className = "empty-outline";
    item.textContent = "无标题";
    elements.outlineList.append(item);
    return;
  }

  state.outline.forEach((heading) => {
    const item = document.createElement("li");
    item.style.setProperty("--level", heading.level);
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = heading.text;
    button.title = heading.text;
    button.dataset.headingId = heading.id;
    if (heading.id === state.activeHeadingId) {
      button.classList.add("is-active");
      button.setAttribute("aria-current", "true");
    }
    button.addEventListener("click", () => {
      setActiveHeading(heading.id);
      document.getElementById(heading.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    item.append(button);
    elements.outlineList.append(item);
  });
}

function updateDocumentList() {
  elements.documentList.innerHTML = "";
  const docs = sortedDocuments();
  elements.documentListPanel.hidden = docs.length === 0;

  docs.forEach((doc) => {
    const displayName = documentDisplayName(doc);
    const item = document.createElement("div");
    item.className = "document-list-item";
    if (doc.path === state.currentFile.path) item.classList.add("is-active");

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "document-open-button";
    setMiddleEllipsisLabel(openButton, displayName);
    openButton.title = displayName;
    openButton.dataset.documentPath = doc.path;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "document-remove-button";
    removeButton.textContent = "×";
    removeButton.title = `从打开过移除 ${displayName}`;
    removeButton.setAttribute("aria-label", removeButton.title);
    removeButton.dataset.removeDocumentPath = doc.path;

    item.append(openButton, removeButton);
    elements.documentList.append(item);
  });
}

let previewCanvasUpdateFrame = 0;

function updatePreviewCanvasSize() {
  if (!elements.preview || !elements.previewCanvas || !elements.previewContent) return;

  const styles = getComputedStyle(elements.preview);
  const horizontalPadding =
    (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0);
  const contentWidth = Math.max(260, elements.preview.clientWidth - horizontalPadding);
  const zoom = state.previewZoom || 1;
  const layoutWidth =
    state.fileKind === "markdown" && zoom < 1
      ? Math.round(contentWidth / zoom)
      : contentWidth;

  elements.previewContent.style.width = `${Math.floor(layoutWidth)}px`;

  const baseWidth = Math.max(
    layoutWidth,
    elements.previewContent.scrollWidth,
    elements.previewContent.offsetWidth,
  );
  const baseHeight = Math.max(
    1,
    elements.previewContent.scrollHeight,
    elements.previewContent.offsetHeight,
  );

  elements.previewCanvas.style.width = `${Math.ceil(baseWidth * zoom)}px`;
  elements.previewCanvas.style.height = `${Math.ceil(baseHeight * zoom)}px`;
}

function schedulePreviewCanvasSizeUpdate() {
  if (previewCanvasUpdateFrame) cancelAnimationFrame(previewCanvasUpdateFrame);
  previewCanvasUpdateFrame = requestAnimationFrame(() => {
    previewCanvasUpdateFrame = 0;
    updatePreviewCanvasSize();
  });
}

function applyPreviewZoom() {
  elements.app.style.setProperty("--preview-zoom", state.previewZoom.toFixed(2));
  elements.zoomPercent.textContent = `${Math.round(state.previewZoom * 100)}%`;
  schedulePreviewCanvasSizeUpdate();
}

function setPreviewZoom(nextZoom) {
  state.previewZoom = clamp(nextZoom, 0.6, 2.4);
  applyPreviewZoom();
}

function resetPreviewZoom() {
  setPreviewZoom(1);
}

function setColumnWidth(side, width) {
  const sidebarWidth = state.sidebarWidth || 280;
  const outlineWidth = state.outlineWidth || 300;
  const availableWidth = window.innerWidth || 1280;
  const centerMinimum = 380;

  if (side === "left") {
    const maxWidth = Math.max(190, Math.min(520, availableWidth - outlineWidth - centerMinimum));
    state.sidebarWidth = clamp(width, 190, maxWidth);
    elements.app.style.setProperty("--sidebar-width", `${Math.round(state.sidebarWidth)}px`);
    schedulePreviewCanvasSizeUpdate();
    return;
  }

  const maxWidth = Math.max(170, Math.min(520, availableWidth - sidebarWidth - centerMinimum));
  state.outlineWidth = clamp(width, 170, maxWidth);
  elements.app.style.setProperty("--outline-width", `${Math.round(state.outlineWidth)}px`);
  schedulePreviewCanvasSizeUpdate();
}

function setupColumnResizer(handle, side) {
  if (!handle) return;
  let isResizing = false;

  const beginResize = (event, moveEventName, endEventName, cancelEventName = endEventName) => {
    if (isResizing) return;
    if (event.button !== 0) return;

    event.preventDefault();
    isResizing = true;
    const targetPanel = side === "left" ? document.querySelector(".sidebar") : elements.outline;
    const startWidth = targetPanel?.getBoundingClientRect().width || (side === "left" ? state.sidebarWidth : state.outlineWidth);
    const startX = event.clientX;

    elements.app.classList.add("is-resizing-columns");
    if (event.pointerId !== undefined) handle.setPointerCapture?.(event.pointerId);

    const move = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      setColumnWidth(side, side === "left" ? startWidth + deltaX : startWidth - deltaX);
    };

    const stop = () => {
      isResizing = false;
      elements.app.classList.remove("is-resizing-columns");
      window.removeEventListener(moveEventName, move);
      window.removeEventListener(endEventName, stop);
      window.removeEventListener(cancelEventName, stop);
    };

    window.addEventListener(moveEventName, move);
    window.addEventListener(endEventName, stop, { once: true });
    window.addEventListener(cancelEventName, stop, { once: true });
  };

  handle.addEventListener("pointerdown", (event) => beginResize(event, "pointermove", "pointerup", "pointercancel"));
  handle.addEventListener("mousedown", (event) => beginResize(event, "mousemove", "mouseup"));
}

function setupSpreadsheetResizers() {
  elements.previewContent.addEventListener("pointerdown", (event) => {
    const columnHandle = event.target.closest("[data-column-resize]");
    const rowHandle = event.target.closest("[data-row-resize]");
    if (!columnHandle && !rowHandle) return;
    if (event.button !== 0) return;

    const sheet = getActiveSheet();
    if (!sheet) return;

    event.preventDefault();
    event.stopPropagation();
    ensureSheetSizing(sheet);

    const zoom = state.previewZoom || 1;
    const startX = event.clientX;
    const startY = event.clientY;

    const columnIndex = columnHandle ? Number(columnHandle.dataset.columnResize) : null;
    const rowIndex = rowHandle ? Number(rowHandle.dataset.rowResize) : null;
    const columnCell = columnHandle?.closest("th");
    const row = rowHandle?.closest("tr");
    const startWidth = columnCell
      ? columnCell.getBoundingClientRect().width / zoom
      : 0;
    const startHeight = row
      ? row.getBoundingClientRect().height / zoom
      : 0;
    const table = elements.previewContent.querySelector(".data-grid");
    const startTableWidth = table
      ? table.getBoundingClientRect().width / zoom
      : 0;

    elements.app.classList.add("is-resizing-sheet");
    event.target.setPointerCapture?.(event.pointerId);

    const move = (moveEvent) => {
      if (Number.isFinite(columnIndex)) {
        const nextWidth = Math.round(clamp(
          startWidth + (moveEvent.clientX - startX) / zoom,
          spreadsheetSizing.minColumnWidth,
          spreadsheetSizing.maxColumnWidth,
        ));
        sheet.columnWidths[columnIndex] = nextWidth;
        elements.previewContent
          .querySelector(`col[data-column-width="${columnIndex}"]`)
          ?.style.setProperty("width", `${nextWidth}px`);
        table?.style.setProperty("width", `${Math.round(startTableWidth + nextWidth - startWidth)}px`);
      }

      if (Number.isFinite(rowIndex)) {
        const nextHeight = Math.round(clamp(
          startHeight + (moveEvent.clientY - startY) / zoom,
          spreadsheetSizing.minRowHeight,
          spreadsheetSizing.maxRowHeight,
        ));
        sheet.rowHeights[rowIndex] = nextHeight;
        row?.style.setProperty("height", `${nextHeight}px`);
      }

      schedulePreviewCanvasSizeUpdate();
    };

    const stop = () => {
      elements.app.classList.remove("is-resizing-sheet");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      schedulePreviewCanvasSizeUpdate();
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
    window.addEventListener("pointercancel", stop, { once: true });
  });
}

function updateOutlineVisibility() {
  elements.outline.hidden = !state.outlineOpen;
  elements.rightResizer.hidden = !state.outlineOpen;
  elements.app.classList.toggle("outline-collapsed", !state.outlineOpen);
  schedulePreviewCanvasSizeUpdate();
}

function render() {
  elements.preview.classList.toggle("spreadsheet-preview", state.fileKind === "spreadsheet");
  elements.preview.classList.toggle("markdown-body", state.fileKind !== "spreadsheet");

  if (state.fileKind === "spreadsheet") {
    try {
      if (!state.sheets.length && state.fileBytes) {
        state.sheets = parseSpreadsheetFile(state.fileBytes, state.currentFile.path);
        state.activeSheetName = state.sheets[0]?.name || "";
      }
      state.outline = [];
      state.activeHeadingId = "";
      renderSpreadsheetPreview();
    } catch (error) {
      state.sheets = [];
      state.activeSheetName = "";
      state.activeHeadingId = "";
      setPreviewHtml(`<div class="empty-sheet">无法读取这个表格文件：${escapeHtml(error.message || "未知错误")}</div>`);
      showNotice("表格解析失败。");
    }
  } else {
    if (nativeHost && !state.currentFile.path && !state.content.trim()) {
      state.outline = [];
      state.activeHeadingId = "";
      setPreviewHtml(`<div class="empty-sheet">打开一个 Markdown、CSV 或 Excel 文件开始阅读。</div>`);
    } else {
      const result = renderMarkdown(state.content);
      state.outline = result.outline;
      if (!state.outline.some((heading) => heading.id === state.activeHeadingId)) {
        state.activeHeadingId = state.outline[0]?.id || "";
      }
      setPreviewHtml(result.html);
    }
  }

  updateSheetTabs();
  updateMeta();
  updateOutline();
  updateDocumentList();
  updateCopyAllButton();
  schedulePreviewCanvasSizeUpdate();
}

async function readFile(file, path = file.name) {
  const readableKind = getReadableKind(path || file?.name);
  if (!file || readableKind === "unsupported") {
    showNotice("请选择 Markdown、CSV 或 Excel 文件。");
    return;
  }

  try {
    let content = "";
    let bytes = null;

    if (readableKind === "markdown") {
      content = await file.text();
    } else {
      bytes = new Uint8Array(await file.arrayBuffer());
    }

    activateDocument(createDocumentEntry({
      file,
      path: normalizePath(path || file.name),
      name: file.name,
      size: file.size,
      modified: file.lastModified ? new Date(file.lastModified) : null,
      content,
      bytes,
    }));
  } catch {
    showNotice("读取文件失败，请确认文件可访问。");
  }
}

async function loadDocument(path, hash = "") {
  const doc = state.documents.get(normalizePath(path));
  if (!doc) return;

  if (doc.file && !doc.content && !doc.bytes) {
    await readFile(doc.file, doc.path);
    if (hash) {
      requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ block: "start" }));
    }
    return;
  }

  activateDocument(doc, hash);
}

function selectPreferredDocument(files) {
  const docs = files.filter((file) => isReadablePath(file.path));
  if (!docs.length) return null;
  return (
    docs.find((file) => /(^|\/)readme\.md$/i.test(file.path)) ||
    docs.find((file) => /\.md$/i.test(file.path)) ||
    docs.find((file) => /\.(xlsx|xls)$/i.test(file.path)) ||
    docs.find((file) => /\.(csv|tsv)$/i.test(file.path)) ||
    docs[0]
  );
}

async function ingestFiles(fileList) {
  const files = [...fileList]
    .filter((file) => file && file.name)
    .map((file) => ({
      file,
      path: normalizePath(file.webkitRelativePath || file.relativePath || file.name),
    }));

  const readableFiles = files.filter((entry) => isReadablePath(entry.path));
  if (!readableFiles.length) {
    showNotice("没有找到 Markdown、CSV 或 Excel 文件。");
    return;
  }

  readableFiles.forEach((entry) => {
    rememberDocument(createDocumentEntry({
      file: entry.file,
      path: entry.path,
    }));
  });

  files
    .filter((entry) => isImagePath(entry.path))
    .forEach((entry) => {
      const url = URL.createObjectURL(entry.file);
      state.objectUrls.push(url);
      state.assets.set(entry.path, url);
      state.assets.set(entry.path.split("/").pop(), url);
    });

  const preferred = selectPreferredDocument(files);
  await readFile(preferred.file, preferred.path);
}

function readDirectoryEntry(entry) {
  return new Promise((resolve) => {
    if (entry.isFile) {
      entry.file((file) => {
        file.relativePath = normalizePath(entry.fullPath.replace(/^\//, ""));
        resolve([file]);
      });
      return;
    }

    if (entry.isDirectory) {
      const reader = entry.createReader();
      const allEntries = [];
      const readBatch = () => {
        reader.readEntries(async (entries) => {
          if (!entries.length) {
            const nested = await Promise.all(allEntries.map(readDirectoryEntry));
            resolve(nested.flat());
            return;
          }
          allEntries.push(...entries);
          readBatch();
        });
      };
      readBatch();
      return;
    }

    resolve([]);
  });
}

async function getDroppedFiles(dataTransfer) {
  const items = [...(dataTransfer.items || [])];
  const entries = items.map((item) => item.webkitGetAsEntry?.()).filter(Boolean);
  if (entries.length) {
    const files = await Promise.all(entries.map(readDirectoryEntry));
    return files.flat();
  }
  return [...dataTransfer.files];
}

elements.openFileButton.addEventListener("click", () => elements.fileInput.click());
elements.openFolderButton.addEventListener("click", () => elements.folderInput.click());

elements.fileInput.addEventListener("change", () => {
  ingestFiles(elements.fileInput.files);
  elements.fileInput.value = "";
});

elements.folderInput.addEventListener("change", () => {
  ingestFiles(elements.folderInput.files);
  elements.folderInput.value = "";
});

elements.themeButton.addEventListener("click", () => {
  state.theme = state.theme === "light" ? "dark" : "light";
  elements.app.classList.toggle("theme-dark", state.theme === "dark");
  elements.app.classList.toggle("theme-light", state.theme === "light");
  elements.themeButton.setAttribute(
    "aria-label",
    state.theme === "light" ? "切换到暗色模式" : "切换到亮色模式",
  );
  elements.themeButton.title = state.theme === "light" ? "暗色模式" : "亮色模式";
});

elements.outlineButton.addEventListener("click", () => {
  state.outlineOpen = !state.outlineOpen;
  updateOutlineVisibility();
  elements.outlineButton.setAttribute("aria-label", state.outlineOpen ? "隐藏目录" : "显示目录");
  elements.outlineButton.title = state.outlineOpen ? "隐藏目录" : "显示目录";
});

elements.copyAllButton.addEventListener("click", copyEntireTextFile);
elements.zoomResetButton.addEventListener("click", resetPreviewZoom);

setupColumnResizer(elements.leftResizer, "left");
setupColumnResizer(elements.rightResizer, "right");
setupSpreadsheetResizers();
applyPreviewZoom();
updateOutlineVisibility();

window.addEventListener("resize", schedulePreviewCanvasSizeUpdate);
elements.previewContent.addEventListener("load", schedulePreviewCanvasSizeUpdate, true);

elements.readerZone.addEventListener(
  "wheel",
  (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * 0.002);
    setPreviewZoom(state.previewZoom * factor);
  },
  { passive: false },
);

let gestureStartZoom = state.previewZoom;

elements.readerZone.addEventListener(
  "gesturestart",
  (event) => {
    event.preventDefault();
    gestureStartZoom = state.previewZoom;
  },
  { passive: false },
);

elements.readerZone.addEventListener(
  "gesturechange",
  (event) => {
    event.preventDefault();
    setPreviewZoom(gestureStartZoom * event.scale);
  },
  { passive: false },
);

window.addEventListener("keydown", (event) => {
  if (!event.metaKey && !event.ctrlKey) return;

  if (event.key === "0") {
    event.preventDefault();
    resetPreviewZoom();
    return;
  }

  if (event.key === "+" || event.key === "=") {
    event.preventDefault();
    setPreviewZoom(state.previewZoom + 0.1);
    return;
  }

  if (event.key === "-" || event.key === "_") {
    event.preventDefault();
    setPreviewZoom(state.previewZoom - 0.1);
  }
});

elements.readerZone.addEventListener("dragenter", (event) => {
  event.preventDefault();
  elements.readerZone.classList.add("is-dragging");
  elements.dragOverlay.hidden = false;
});

elements.readerZone.addEventListener("dragover", (event) => {
  event.preventDefault();
});

elements.readerZone.addEventListener("dragleave", (event) => {
  if (event.currentTarget === event.target) {
    elements.readerZone.classList.remove("is-dragging");
    elements.dragOverlay.hidden = true;
  }
});

elements.readerZone.addEventListener("drop", async (event) => {
  event.preventDefault();
  elements.readerZone.classList.remove("is-dragging");
  elements.dragOverlay.hidden = true;
  const files = await getDroppedFiles(event.dataTransfer);
  ingestFiles(files);
});

elements.preview.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-md-path]");
  if (!link) return;
  event.preventDefault();
  loadDocument(link.dataset.mdPath, link.dataset.hash || "");
});

elements.previewContent.addEventListener("click", (event) => {
  const headingId = headingIdForPreviewTarget(event.target);
  if (headingId) setActiveHeading(headingId, true);
});

elements.documentList.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-remove-document-path]");
  if (removeButton) {
    event.preventDefault();
    event.stopPropagation();
    removeDocument(removeButton.dataset.removeDocumentPath);
    return;
  }

  const openButton = event.target.closest("[data-document-path]");
  if (openButton) {
    event.preventDefault();
    loadDocument(openButton.dataset.documentPath);
  }
});

window.markdownReaderOpenFile = (payload) => {
  try {
    activateDocument(createDocumentEntryFromPayload(payload));
  } catch {
    showNotice("读取文件失败，请确认文件可访问。");
  }
};

if (bootstrap?.base64) {
  rememberDocument(createDocumentEntryFromPayload(bootstrap));
}

render();
