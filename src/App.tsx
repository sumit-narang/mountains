import { useState, useMemo, Suspense, useRef, useEffect, lazy } from 'react';
import { mountains, Mountain } from '@/data/mountains';
import MountainMap from '@/components/MountainMap';
import DetailPanel from '@/components/DetailPanel';
import SquircleBox from '@/components/SquircleBox';
import ViewToggle, { View } from '@/components/ViewToggle';

const TerrainView = lazy(() => import('@/components/TerrainView'));

function useIsMobile() {
  const query = '(max-width: 767px)';
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(query).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

export default function App() {
  const [view, setView] = useState<View>('map');
  const [terrain3DMounted, setTerrain3DMounted] = useState(false);
  const [selected, setSelected] = useState<Mountain | null>(null);
  const [listScrolled, setListScrolled] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const isMobile = useIsMobile();

  const sorted = useMemo(() => [...mountains].sort((a, b) => b.height - a.height), []);
  const selectedRank = selected ? sorted.findIndex(m => m.id === selected.id) + 1 : 0;

  const listItemRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  useEffect(() => {
    if (selected) {
      listItemRefs.current.get(selected.id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selected]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const changeView = (v: View) => { setView(v); if (v === '3d') setTerrain3DMounted(true); };

  const selectMountain = (m: Mountain | null) => {
    setSelected(m);
    if (m) setSheetExpanded(false); // collapse the mobile list sheet when a peak opens
  };

  // ── Shared ranked list (rendered inside the desktop panel or the mobile sheet) ──
  const mountainList = (
    <div className="flex-1 overflow-y-auto scrollbar-subtle" onScroll={e => setListScrolled(e.currentTarget.scrollTop > 0)}>
      {sorted.map((m, i) => {
        const isSelected = selected?.id === m.id;
        return (
          <button
            key={m.id}
            ref={el => { if (el) listItemRefs.current.set(m.id, el); else listItemRefs.current.delete(m.id); }}
            onClick={() => selectMountain(isSelected ? null : m)}
            className={`w-full flex items-center gap-3 px-4 py-3 border-b transition-colors text-left cursor-pointer ${
              isSelected ? 'border-slate-900/20' : 'border-slate-200/40 hover:bg-slate-900/8'
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
              <p className={`text-[15px] font-semibold truncate ${isSelected ? 'text-white' : 'text-slate-800'}`}>{m.name}</p>
              <p className={`text-[13px] truncate ${isSelected ? 'text-white/50' : 'text-slate-400'}`}>{m.height}m · {m.range}</p>
            </div>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="relative h-screen overflow-hidden">

      {/* ── Full-screen map layer (both mounted, crossfade via opacity) ── */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 transition-opacity duration-500"
          style={{ opacity: view === 'map' ? 1 : 0, pointerEvents: view === 'map' ? 'auto' : 'none' }}>
          <MountainMap mountains={mountains} selected={selected} onSelect={selectMountain} />
        </div>
        {terrain3DMounted && (
          <div className="absolute inset-0 transition-opacity duration-500"
            style={{ opacity: view === '3d' ? 1 : 0, pointerEvents: view === '3d' ? 'auto' : 'none' }}>
            <Suspense fallback={null}>
              <TerrainView mountains={mountains} selected={selected} onSelect={selectMountain} />
            </Suspense>
          </div>
        )}
      </div>

      {!isMobile ? (
        /* ═══════════ DESKTOP: floating left panel ═══════════ */
        <SquircleBox r={28} className="absolute top-3 left-3 bottom-3 w-72 flex flex-col bg-white/75 backdrop-blur-xl shadow-2xl border border-white/60 z-10">
          <div className="flex-shrink-0 px-5 pt-5 pb-4">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-snug">Top 50 Mountains of Ireland</h1>
            <p className="text-xs text-slate-400 mt-0.5">Sorted by elevation</p>
            <div className="mt-3">
              <ViewToggle view={view} onChange={changeView} />
            </div>
          </div>
          <div className={`h-px transition-colors duration-200 ${listScrolled ? 'bg-slate-900/10' : 'bg-transparent'}`} />
          {mountainList}
        </SquircleBox>
      ) : (
        /* ═══════════ MOBILE: top bar + bottom-sheet list ═══════════ */
        <>
          {/* Compact floating top bar */}
          <div className="absolute top-3 left-3 right-3 z-20">
            <div className="flex items-center justify-between gap-3 rounded-[20px] bg-white/80 backdrop-blur-xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-white/60 pl-4 pr-2 py-2">
              <h1 className="min-w-0 truncate text-sm font-bold text-slate-900 tracking-tight">Top 50 Mountains of Ireland</h1>
              <div className="flex-shrink-0">
                <ViewToggle view={view} onChange={changeView} />
              </div>
            </div>
          </div>

          {/* Bottom-sheet ranked list — hidden entirely while a peak's detail is open */}
          {!selected && (
          <div
            className="fixed inset-x-0 bottom-0 z-20 transition-transform duration-300"
            style={{
              height: '72vh',
              transform: sheetExpanded ? 'translateY(0)' : 'translateY(calc(72vh - 168px))',
              willChange: 'transform',
            }}
          >
            <div className="h-full flex flex-col rounded-t-[28px] bg-white/85 backdrop-blur-xl shadow-2xl border border-white/60 border-b-0 overflow-hidden">
              {/* Drag/expand handle */}
              <button
                onClick={() => setSheetExpanded(v => !v)}
                className="flex-shrink-0 w-full flex flex-col items-center pt-2.5 pb-1.5 cursor-pointer"
                aria-label={sheetExpanded ? 'Collapse list' : 'Expand list'}
              >
                <span className="w-10 h-1 rounded-full bg-slate-400/50" />
                <span className="mt-1.5 text-[12px] font-medium text-slate-400">
                  {sheetExpanded ? 'Tap to collapse' : 'Tap to expand'}
                </span>
              </button>
              <div className="h-px bg-slate-900/5" />
              {mountainList}
            </div>
          </div>
          )}
        </>
      )}

      {/* ── Detail panel ── */}
      {selected && (
        isMobile ? (
          /* MOBILE: full-width bottom sheet */
          <div className="fixed inset-x-0 bottom-0 z-30" style={{ animation: 'sheetUp 0.22s cubic-bezier(.22,1,.36,1)' }}>
            <div className="rounded-t-[28px] bg-white/85 backdrop-blur-xl shadow-2xl border border-white/60 border-b-0 overflow-hidden">
              <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: '85vh' }}>
                <DetailPanel mountain={selected} rank={selectedRank} onClose={() => setSelected(null)} />
              </div>
            </div>
          </div>
        ) : (
          /* DESKTOP: side card next to the panel */
          <SquircleBox r={28}
            className="absolute top-3 w-80 bg-white/75 backdrop-blur-xl shadow-2xl border border-white/60 z-10"
            style={{ left: 'calc(0.75rem + 18rem + 0.5rem)', animation: 'slideIn 0.18s ease', maxHeight: 'calc(100vh - 1.5rem)' }}
          >
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 1.5rem)' }}>
              <DetailPanel mountain={selected} rank={selectedRank} onClose={() => setSelected(null)} />
            </div>
          </SquircleBox>
        )
      )}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(-24px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes sheetUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
