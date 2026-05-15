# Top 50 Mountains of Ireland

An interactive map and 3D terrain explorer for Ireland's top 50 mountains, ranked by elevation. Built with React, Mapbox GL, and Three.js.

![Top 50 Mountains of Ireland](public/favicon.png)

## What it does

- **Interactive 2D map** — all 50 peaks plotted on a Mapbox terrain map with numbered markers. Click any marker or list item to fly to that mountain and open its detail panel.
- **3D terrain view** — a fully rendered Three.js 3D model of Ireland built from real Mapbox elevation tiles (Terrain-RGB), textured with the Mapbox Outdoors map style. Orbit, zoom, and click peaks in 3D.
- **Detail panel** — shows a photo (sourced from Wikipedia, falling back to Mapbox satellite), description, county, mountain range, coordinates, and a Google Maps link for each peak.
- **Ranked list** — left panel lists all 50 mountains sorted by elevation with smooth scroll-to on selection.
- **Hover tooltips** — hovering a marker on either the 2D map or 3D view shows the mountain name, height, and county.

## Stack

| | |
|---|---|
| **Framework** | React 19 + TypeScript |
| **Build tool** | Vite |
| **Styling** | Tailwind CSS v4 |
| **2D Map** | Mapbox GL JS + react-map-gl |
| **3D Terrain** | Three.js + OrbitControls |
| **Elevation data** | Mapbox Terrain-RGB tiles |
| **Photos** | Wikipedia REST API + Mapbox Satellite fallback |

## Getting started

### Prerequisites

- Node.js 18+
- A [Mapbox access token](https://account.mapbox.com/)

### Setup

```bash
git clone https://github.com/sumit-narang/mountains.git
cd mountains
npm install
```

Create a `.env.local` file:

```bash
VITE_MAPBOX_TOKEN=your_mapbox_public_token_here
```

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Project structure

```
src/
├── App.tsx                  # Root layout, panel state, view toggle
├── components/
│   ├── MountainMap.tsx      # Mapbox 2D map wrapper
│   ├── MountainMapInner.tsx # Map markers, popups, fly-to logic
│   ├── TerrainView.tsx      # Three.js 3D terrain renderer
│   ├── DetailPanel.tsx      # Sliding detail card
│   ├── MountainPhoto.tsx    # Wikipedia/satellite photo loader
│   └── SquircleBox.tsx      # Reusable squircle clip-path component
├── data/
│   └── mountains.ts         # All 50 mountains with coordinates and descriptions
public/
├── icons/                   # SVG icons (county, mountain, coordinates, close)
└── favicon.png
scripts/
└── fetch-profiles.ts        # One-off script to fetch elevation profiles via OpenTopoData
```

## Data

All 50 mountains are hardcoded in `src/data/mountains.ts` with:
- Name, height (metres), county, mountain range, province
- Latitude/longitude coordinates
- Short description
- Topographic prominence

## Deployment

Deployed on Vercel. Set `VITE_MAPBOX_TOKEN` as an environment variable in your Vercel project settings before deploying.

```bash
npm run build   # outputs to dist/
```
