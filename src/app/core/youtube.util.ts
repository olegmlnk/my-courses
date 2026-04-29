export function toYouTubeEmbed(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    let id: string | null = null;
    if (u.hostname.includes('youtu.be')) {
      id = u.pathname.replace('/', '');
    } else if (u.hostname.includes('youtube.com')) {
      if (u.pathname.startsWith('/embed/')) return url;
      id = u.searchParams.get('v');
      if (!id && u.pathname.startsWith('/shorts/')) {
        id = u.pathname.split('/')[2] ?? null;
      }
    } else if (u.hostname.includes('vimeo.com')) {
      const path = u.pathname.replace('/', '');
      return `https://player.vimeo.com/video/${path}`;
    }
    return id ? `https://www.youtube.com/embed/${id}` : url;
  } catch {
    return url;
  }
}
