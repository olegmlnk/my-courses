export function extractYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.replace('/', '');
      return id || null;
    }
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname.startsWith('/embed/')) return u.pathname.split('/')[2] ?? null;
      const v = u.searchParams.get('v');
      if (v) return v;
      if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2] ?? null;
    }
  } catch {}
  return null;
}

export function toYouTubeEmbed(url: string | null | undefined, opts: { jsapi?: boolean } = {}): string | null {
  if (!url) return null;
  const id = extractYouTubeId(url);
  if (id) {
    const params = new URLSearchParams();
    if (opts.jsapi) {
      params.set('enablejsapi', '1');
      params.set('origin', typeof window !== 'undefined' ? window.location.origin : '');
    }
    const qs = params.toString();
    return `https://www.youtube.com/embed/${id}${qs ? '?' + qs : ''}`;
  }
  try {
    const u = new URL(url);
    if (u.hostname.includes('vimeo.com')) {
      const path = u.pathname.replace('/', '');
      return `https://player.vimeo.com/video/${path}`;
    }
  } catch {}
  return url;
}

export function formatTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export function parseTimestamp(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(':').map(p => parseInt(p, 10));
  if (parts.some(p => isNaN(p) || p < 0)) return null;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}
