import { useState, useCallback, useRef, useEffect } from 'react';
import Map, {
  Source,
  Layer,
  Marker,
  Popup,
  NavigationControl,
  ScaleControl,
} from 'react-map-gl/mapbox';
import type { LayerProps, MapRef } from 'react-map-gl/mapbox';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Mountain, mountains as allMountains } from '@/data/mountains';

const MARKER_COLOR = '#3b82f6'; // blue-500

// Pre-compute rank (1 = highest) for every mountain
const RANK_MAP: Record<number, number> = Object.fromEntries(
  [...allMountains].sort((a, b) => b.height - a.height).map((m, i) => [m.id, i + 1])
);

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// Hover tooltips are a desktop affordance only — on touch devices a tap would
// otherwise trigger the hover popup before opening the detail panel.
const CAN_HOVER = typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// Map padding keeps the focused area clear of the UI: the left panel on desktop,
// the top bar + bottom sheet on mobile.
function mapPadding(hasSelection: boolean) {
  const mobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
  if (mobile) {
    return {
      top: 84,
      right: 16,
      left: 16,
      bottom: hasSelection ? Math.round(window.innerHeight * 0.5) : 196,
    };
  }
  return { top: 12, right: 12, bottom: 12, left: hasSelection ? 636 : 308 };
}


const skyLayer: LayerProps = {
  id: 'sky',
  type: 'sky',
  paint: {
    'sky-type': 'atmosphere',
    'sky-atmosphere-sun': [0.0, 90.0],
    'sky-atmosphere-sun-intensity': 15,
  },
};

interface Props {
  mountains: Mountain[];
  selected: Mountain | null;
  onSelect: (m: Mountain | null) => void;
}

export default function MountainMapInner({ mountains, selected, onSelect }: Props) {
  const [hovered, setHovered] = useState<Mountain | null>(null);
  const is3D = true;

  const getMap = () => mapRef.current?.getMap();

  const handleMountainClick = useCallback((mountain: Mountain) => {
    setHovered(null); // clear any tap-triggered hover state before opening detail
    onSelect(selected?.id === mountain.id ? null : mountain);
  }, [selected, onSelect]);

  // Fly to mountain whenever selected changes (from list, marker, or anywhere)
  useEffect(() => {
    const map = getMap();
    if (!map) return;

    if (selected) {
      map.flyTo({
        center: [selected.lng, selected.lat],
        zoom: 12,
        pitch: is3D ? 70 : 0,
        bearing: -10,
        duration: 1400,
        essential: true,
        padding: mapPadding(true),
      });
    } else {
      map.flyTo({
        center: [-8.0, 53.5],
        zoom: 6.5,
        pitch: is3D ? 55 : 0,
        bearing: is3D ? -15 : 0,
        duration: 1200,
        padding: mapPadding(false),
      });
    }
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-apply padding when the viewport changes (e.g. phone rotation, resize)
  useEffect(() => {
    const map = getMap();
    if (!map) return;
    const onResize = () => map.setPadding(mapPadding(!!selected));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  const mapRef = useRef<MapRef>(null);

  const setupCmdDragRotation = useCallback(() => {
    const map: mapboxgl.Map | undefined = mapRef.current?.getMap();
    if (!map) return;

    // Prefetch a sharper parent tile (closer to target zoom) so the brief
    // placeholder shown while panning looks crisp instead of blurry "loading".
    (map as unknown as { setPrefetchZoomDelta?: (n: number) => void }).setPrefetchZoomDelta?.(2);

    const canvas = map.getCanvas();
    let rotating = false;
    let lastX = 0;

    const onMouseDown = (e: MouseEvent) => {
      if (e.metaKey) {
        rotating = true;
        lastX = e.clientX;
        map.dragPan.disable();
        canvas.style.cursor = 'grabbing';
        e.stopPropagation();
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!rotating) return;
      if (!e.metaKey) {
        rotating = false;
        map.dragPan.enable();
        canvas.style.cursor = '';
        return;
      }
      const delta = e.clientX - lastX;
      lastX = e.clientX;
      map.setBearing(map.getBearing() + delta * 0.4);
    };

    const onMouseUp = () => {
      if (rotating) {
        rotating = false;
        map.dragPan.enable();
        canvas.style.cursor = '';
      }
    };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <Map
        ref={mapRef}
        initialViewState={{ longitude: -8.0, latitude: 53.5, zoom: 6.5, pitch: is3D ? 55 : 0, bearing: is3D ? -15 : 0, padding: mapPadding(false) }}
        onLoad={setupCmdDragRotation}
        mapboxAccessToken={TOKEN}
        mapStyle="mapbox://styles/mapbox/outdoors-v12"
        terrain={is3D ? { source: 'mapbox-dem', exaggeration: 2.5 } : undefined}
        maxTileCacheSize={2000}
        fadeDuration={0}
        fog={{
          color: 'rgb(215, 227, 244)',
          'high-color': 'rgb(80, 130, 210)',
          'horizon-blend': 0.02,
          'space-color': 'rgb(15, 15, 35)',
          'star-intensity': 0.6,
        }}
        style={{ width: '100%', height: '100%' }}
        pitchWithRotate
        dragRotate={false}
      >
        {/* DEM terrain source */}
        <Source
          id="mapbox-dem"
          type="raster-dem"
          url="mapbox://mapbox.mapbox-terrain-dem-v1"
          tileSize={512}
          maxzoom={14}
        />

        {/* Atmosphere sky */}
        {is3D && <Layer {...skyLayer} />}

        <ScaleControl position="bottom-left" />

        {/* Mountain markers */}
        {mountains.map(mountain => {
          const isSelected = selected?.id === mountain.id;
          const isHovering = hovered?.id === mountain.id;
          const isActive = isSelected || isHovering;
          const size = 26;
          const rank = RANK_MAP[mountain.id];
          const fontSize = rank >= 10 ? size * 0.38 : size * 0.44;

          return (
            <Marker
              key={mountain.id}
              longitude={mountain.lng}
              latitude={mountain.lat}
              anchor="center"
              onClick={e => { e.originalEvent.stopPropagation(); handleMountainClick(mountain); }}
            >
              <div
                onMouseEnter={() => { if (CAN_HOVER) setHovered(mountain); }}
                onMouseLeave={() => setHovered(null)}
                style={{
                  width: isActive ? size * 1.3 : size,
                  height: isActive ? size * 1.3 : size,
                  borderRadius: '50%',
                  backgroundColor: MARKER_COLOR,
                  border: `${isSelected ? 3 : 2}px solid white`,
                  cursor: 'pointer',
                  boxShadow: isActive
                    ? `0 0 0 4px ${MARKER_COLOR}45, 0 4px 14px rgba(0,0,0,0.45)`
                    : '0 2px 6px rgba(0,0,0,0.3)',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize,
                  fontWeight: 700,
                  fontFamily: 'system-ui, sans-serif',
                  lineHeight: 1,
                  userSelect: 'none',
                }}
              >
                {rank}
              </div>
            </Marker>
          );
        })}

        {/* Hover popup (desktop only, when nothing is selected) */}
        {CAN_HOVER && hovered && !selected && (
          <Popup
            longitude={hovered.lng}
            latitude={hovered.lat}
            anchor="bottom"
            offset={20}
            closeButton={false}
            closeOnClick={false}
            className="dark-popup"
            style={{ zIndex: 10 }}
          >
            <div style={{ fontFamily: 'system-ui, sans-serif' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>{hovered.name}</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#fff', whiteSpace: 'nowrap' }}>{hovered.height.toLocaleString()}m</div>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 1 }}>Co. {hovered.county}</div>
            </div>
          </Popup>
        )}

        <NavigationControl position="bottom-right" visualizePitch />
      </Map>

    </div>
  );
}
