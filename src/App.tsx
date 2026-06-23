import { useState, useMemo, Suspense, useRef, useEffect, useLayoutEffect } from 'react';
import { mountains, Mountain } from '@/data/mountains';
import MountainMap from '@/components/MountainMap';
import DetailPanel from '@/components/DetailPanel';
import SquircleBox from '@/components/SquircleBox';
import { lazy } from 'react';

const TerrainView = lazy(() => import('@/components/TerrainView'));

type View = 'map' | '3d';
const VIEWS: View[] = ['map', '3d'];


export default function App() {
  const [view, setView] = useState<View>('map');
  const [terrain3DMounted, setTerrain3DMounted] = useState(false);
  const [selected, setSelected] = useState<Mountain | null>(null);
  const [listScrolled, setListScrolled] = useState(false);

  const sorted = useMemo(() => [...mountains].sort((a, b) => b.height - a.height), []);
  const selectedRank = selected ? sorted.findIndex(m => m.id === selected.id) + 1 : 0;

  const listItemRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  useEffect(() => {
    if (selected) {
      listItemRefs.current.get(selected.id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selected]);

  // Sliding white indicator for the Map / 3D tabs (gym-cancel pill design)
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  useLayoutEffect(() => {
    const btn = tabRefs.current[view];
    if (btn) setIndicator({ left: btn.offsetLeft, width: btn.offsetWidth });
  }, [view]);
  useEffect(() => {
    const onResize = () => {
      const btn = tabRefs.current[view];
      if (btn) setIndicator({ left: btn.offsetLeft, width: btn.offsetWidth });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [view]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="relative h-screen overflow-hidden">

      {/* ── Full-screen map layer (both mounted, crossfade via opacity) ── */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 transition-opacity duration-500"
          style={{ opacity: view === 'map' ? 1 : 0, pointerEvents: view === 'map' ? 'auto' : 'none' }}>
          <MountainMap mountains={mountains} selected={selected} onSelect={setSelected} />
        </div>
        {terrain3DMounted && (
          <div className="absolute inset-0 transition-opacity duration-500"
            style={{ opacity: view === '3d' ? 1 : 0, pointerEvents: view === '3d' ? 'auto' : 'none' }}>
            <Suspense fallback={null}>
              <TerrainView mountains={mountains} selected={selected} onSelect={setSelected} />
            </Suspense>
          </div>
        )}
      </div>

      {/* ── Floating left panel ── */}
      <SquircleBox r={28} className="absolute top-3 left-3 bottom-3 w-72 flex flex-col bg-white/75 backdrop-blur-xl shadow-2xl border border-white/60 z-10">

        {/* Header */}
        <div className="flex-shrink-0 px-5 pt-5 pb-4">
          <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-snug">
            Top 50 Mountains of Ireland
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Sorted by elevation
          </p>
          {/* Map / 3D sub-toggle — gym-cancel pill design */}
          <div className="mt-3 relative inline-flex items-center rounded-full p-1" style={{ background: 'rgba(0,0,0,0.05)' }}>
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
              const label = v === 'map' ? 'Map' : '3D';
              const handleClick = () => { setView(v); if (v === '3d') setTerrain3DMounted(true); };
              return (
                <button
                  key={v}
                  ref={el => { tabRefs.current[v] = el; }}
                  onClick={handleClick}
                  className={`relative z-10 px-5 py-1.5 text-xs font-medium rounded-full cursor-pointer transition-colors duration-[280ms] ${isActive ? 'text-black' : 'text-black/30 hover:text-black/70'}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className={`h-px transition-colors duration-200 ${listScrolled ? 'bg-slate-900/10' : 'bg-transparent'}`} />

        {/* Mountain list */}
        <div className="flex-1 overflow-y-auto scrollbar-subtle" onScroll={e => setListScrolled((e.currentTarget.scrollTop > 0))}>
          {sorted.map((m, i) => {
            const isSelected = selected?.id === m.id;
            return (
              <button
                key={m.id}
                ref={el => { if (el) listItemRefs.current.set(m.id, el); else listItemRefs.current.delete(m.id); }}
                onClick={() => setSelected(isSelected ? null : m)}
                className={`w-full flex items-center gap-3 px-4 py-3 border-b transition-colors text-left cursor-pointer ${
                  isSelected
                    ? 'border-slate-900/20'
                    : 'border-slate-200/40 hover:bg-slate-900/8'
                }`}
                style={isSelected ? { backgroundColor: '#2563eb' } : undefined}
              >
                <div
                  className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full text-[11px] font-bold"
                  style={isSelected ? { backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff' } : { backgroundColor: 'rgb(100 116 139)', color: '#fff' }}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${isSelected ? 'text-white' : 'text-slate-800'}`}>{m.name}</p>
                  <p className={`text-xs truncate ${isSelected ? 'text-white/50' : 'text-slate-400'}`}>{m.height}m · {m.range}</p>
                </div>
              </button>
            );
          })}
        </div>
      </SquircleBox>

      {/* ── Floating detail card ── */}
      {selected && (
        <SquircleBox r={28}
          className="absolute top-3 w-80 bg-white/75 backdrop-blur-xl shadow-2xl border border-white/60 z-10"
          style={{ left: 'calc(0.75rem + 18rem + 0.5rem)', animation: 'slideIn 0.18s ease', maxHeight: 'calc(100vh - 1.5rem)' }}
        >
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 1.5rem)' }}>
            <DetailPanel mountain={selected} rank={selectedRank} onClose={() => setSelected(null)} />
          </div>
        </SquircleBox>
      )}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(-24px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
