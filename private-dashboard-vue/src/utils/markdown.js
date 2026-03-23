import DOMPurify from "dompurify";
import MarkdownIt from "markdown-it";

const markdownRenderer = new MarkdownIt({
  html: false,
  breaks: true,
  linkify: true,
  typographer: true,
});

export function renderTaskNoteMarkdown(markdown) {
  const source = String(markdown || "").replace(/\r\n/g, "\n").trim();
  if (!source) {
    return "";
  }

  const rendered = markdownRenderer.render(source);
  return DOMPurify.sanitize(rendered, {
    USE_PROFILES: { html: true },
  });
}

export function renderContentPreviewMarkdown(markdown) {
  return renderTaskNoteMarkdown(markdown);
}
