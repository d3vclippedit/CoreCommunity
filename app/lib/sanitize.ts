const ALLOWED: Set<string> = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "s",
  "del",
  "code",
  "pre",
  "ul",
  "ol",
  "li",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "h4",
  "a",
  "hr",
]);

export function sanitizeHtml(html: string): string {
  // Strip script/style blocks entirely
  let out = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");

  // Strip on* event attributes and javascript: hrefs
  out = out
    .replace(/\s+on\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\s+on\w+\s*=\s*'[^']*'/gi, "")
    .replace(/(href\s*=\s*["'])javascript:[^"']*/gi, "$1#");

  // Strip disallowed tags; leave allowed ones intact
  out = out.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g, (match, tag: string) =>
    ALLOWED.has(tag.toLowerCase()) ? match : "",
  );

  return out;
}
