import { useRef, useState, useEffect, useLayoutEffect } from 'react';

export type View = 'map' | '3d';
const VIEWS: View[] = ['map', '3d'];

interface Props {
  view: View;
  onChange: (v: View) => void;
}

/**
 * Self-contained Map / 3D pill toggle with a sliding white indicator.
 * Keeps its own indicator measurement state so it can be rendered in more
 * than one place (desktop panel + mobile top bar) without ref collisions.
 */
export default function ViewToggle({ view, onChange }: Props) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const measure = () => {
    const btn = tabRefs.current[view];
    if (btn) setIndicator({ left: btn.offsetLeft, width: btn.offsetWidth });
  };

  useLayoutEffect(measure, [view]);
  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }); // re-bind each render so `measure` closes over the latest `view`

  return (
    <div className="relative inline-flex items-center rounded-full p-1" style={{ background: 'rgba(0,0,0,0.05)' }}>
      <div
        className="absolute bg-white rounded-full shadow-sm"
        style={{
          left: indicator.left,
          width: indicator.width,
          top: 4,
          bottom: 4,
          transition: 'left 280ms cubic-bezier(0.32,0.72,0,1), width 280ms cubic-bezier(0.32,0.72,0,1)',
        }}
      />
      {VIEWS.map(v => {
        const isActive = view === v;
        return (
          <button
            key={v}
            ref={el => { tabRefs.current[v] = el; }}
            onClick={() => onChange(v)}
            className={`relative z-10 px-5 py-1.5 text-xs font-medium rounded-full cursor-pointer transition-colors duration-[280ms] ${isActive ? 'text-black' : 'text-black/30 hover:text-black/70'}`}
          >
            {v === 'map' ? 'Map' : '3D'}
          </button>
        );
      })}
    </div>
  );
}
