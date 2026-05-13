import { Mountain } from '@/data/mountains';
import MountainPhoto from './MountainPhoto';
import SquircleBox from './SquircleBox';

interface Props {
  mountain: Mountain;
  rank: number;
  onClose: () => void;
}

function IconRow({ bg, color, icon, label, value }: {
  bg: string; color: string;
  icon: React.ReactNode;
  label: string; value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center ${bg} ${color}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] text-slate-400 uppercase tracking-wider leading-none mb-0.5">{label}</div>
        <div className="text-slate-700 truncate" style={{ fontWeight: 500, fontSize: 14 }}>{value}</div>
      </div>
    </div>
  );
}

export default function DetailPanel({ mountain, rank, onClose }: Props) {
  const mapsUrl = `https://www.google.com/maps?q=${mountain.lat},${mountain.lng}`;

  const stats = (
    <>
      {/* Description */}
      <div className="px-6 py-4 border-b border-slate-200/60">
        <p className="text-slate-600 text-sm leading-relaxed">{mountain.description}</p>
      </div>

      {/* Stats with icons */}
      <div className="px-5 py-4 space-y-3.5 border-b border-slate-200/60">
        <IconRow
          bg="bg-slate-500/10" color=""
          label="County" value={`Co. ${mountain.county}`}
          icon={<img src="/icons/county.svg" className="w-4 h-4" />}
        />
        <IconRow
          bg="bg-slate-500/10" color=""
          label="Mountain Range" value={mountain.range}
          icon={<img src="/icons/mountain.svg" className="w-4 h-4" />}
        />
        <IconRow
          bg="bg-slate-500/10" color=""
          label="Coordinates" value={`${mountain.lat.toFixed(4)}°N  ${Math.abs(mountain.lng).toFixed(4)}°W`}
          icon={<img src="/icons/coordiantes.svg" className="w-4 h-4" />}
        />
      </div>

      {/* Map link */}
      <div className="px-6 py-4">
        <SquircleBox as="a" r={14}
          href={mapsUrl} target="_blank" rel="noopener noreferrer"
          className="block w-full text-center py-2.5 bg-blue-500 hover:bg-blue-600 text-white transition-colors"
          style={{ fontWeight: 500, fontSize: 14 }}
        >
          Google Maps
        </SquircleBox>
      </div>
    </>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Full-bleed photo hero */}
      <SquircleBox topOnly r={28} className="relative h-56 w-full flex-shrink-0 overflow-hidden">
        <MountainPhoto mountain={mountain} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        <button onClick={onClose}
          className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/40 flex items-center justify-center hover:bg-black/70 transition-colors cursor-pointer">
          <img src="/icons/close.svg" className="w-3 h-3" style={{ filter: 'brightness(0) invert(1)' }} />
        </button>
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="inline-block bg-white/30 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full mb-1.5">
                #{rank} IN IRELAND
              </div>
              <h2 className="text-xl font-bold text-white leading-tight">{mountain.name}</h2>
              <p className="text-white/60 text-xs mt-0.5">{mountain.range}</p>
            </div>
            <div className="flex-shrink-0 flex items-baseline gap-1 pb-5">
              <span className="text-2xl font-bold text-white">{mountain.height.toLocaleString()}</span>
              <span className="text-xs text-white/70 mb-0.5">m</span>
            </div>
          </div>
        </div>
      </SquircleBox>
      {stats}
    </div>
  );
}
