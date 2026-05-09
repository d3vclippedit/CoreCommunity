// Convert @handle and c/slug patterns in HTML content to anchor links.
// Applied when rendering post bodies and comments.

export function renderMentions(html: string): string {
  // c/slug → community link (must run before @handle to avoid false positives)
  const withCommunity = html.replace(
    /\bc\/([a-z0-9_-]{2,32})\b/g,
    '<a href="/c/$1" class="mention mention-community">c/$1</a>',
  );

  // @handle → user profile link
  const withUser = withCommunity.replace(
    /@([a-z0-9_]{3,20})\b/gi,
    '<a href="/u/$1" class="mention mention-user">@$1</a>',
  );

  return withUser;
}
