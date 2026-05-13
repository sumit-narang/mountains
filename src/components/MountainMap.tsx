import { lazy, Suspense } from 'react';
import { Mountain } from '@/data/mountains';

const MountainMapInner = lazy(() => import('./MountainMapInner'));

interface Props {
  mountains: Mountain[];
  selected: Mountain | null;
  onSelect: (m: Mountain | null) => void;
}

export default function MountainMap(props: Props) {
  return (
    <div className="w-full h-full relative">
      <Suspense fallback={
        <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400 text-sm">
          Loading map...
        </div>
      }>
        <MountainMapInner {...props} />
      </Suspense>
    </div>
  );
}
