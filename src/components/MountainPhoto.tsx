import { useEffect, useState } from 'react';
import { Mountain } from '@/data/mountains';

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

const satelliteFallback = (m: Mountain) =>
  `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${m.lng},${m.lat},12,0,0/640x260@2x?access_token=${TOKEN}`;

// Wikipedia sometimes indexes Irish mountains under slightly different titles.
// Try the plain name first; if the article returned is a disambiguation or
// unrelated topic, we'll just fall through to the satellite image.
async function fetchWikipediaThumb(name: string, signal: AbortSignal): Promise<string | null> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  const data = await res.json();
  const src: string | undefined = data.thumbnail?.source;
  if (!src) return null;
  // Request a larger version — Wikimedia URLs end in e.g. /320px-Name.jpg; bump to 800px
  return src.replace(/\/\d+px-/, '/800px-');
}

interface Props {
  mountain: Mountain;
}

export default function MountainPhoto({ mountain }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSrc(null);
    setReady(false);
    const controller = new AbortController();

    fetchWikipediaThumb(mountain.name, controller.signal)
      .then(url => {
        if (!controller.signal.aborted) setSrc(url ?? satelliteFallback(mountain));
      })
      .catch(() => {
        if (!controller.signal.aborted) setSrc(satelliteFallback(mountain));
      });

    return () => controller.abort();
  }, [mountain.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative w-full h-full bg-slate-100 overflow-hidden">
      {!ready && (
        <div className="absolute inset-0 bg-slate-100 animate-pulse" />
      )}
      {src && (
        <img
          key={src}
          src={src}
          alt={mountain.name}
          className={`w-full h-full object-cover transition-opacity duration-300 ${ready ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setReady(true)}
          onError={() => {
            // Wikipedia image failed — fall back to satellite
            if (src !== satelliteFallback(mountain)) setSrc(satelliteFallback(mountain));
          }}
        />
      )}
    </div>
  );
}
