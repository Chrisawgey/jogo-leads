import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { useEffect, useRef } from 'react';
import { LEAD_STATUSES, getLeadStatus } from '../lib/leads';

// Lower 48, fitted to whatever size the map is — a fixed center/zoom only
// shows part of the country on a narrow phone screen
const US_BOUNDS = [[24.4, -125.0], [49.5, -66.9]];
// Same free OpenStreetMap tiles the dashboard map uses — no API key needed
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const MAP_OPTIONS = {
  bounds: US_BOUNDS,
  boundsOptions: { padding: [8, 8] },
  zoomSnap: 0.25,
  minZoom: 2,
  scrollWheelZoom: true,
  style: { height: '100%', width: '100%', background: '#e8eef3' },
};

const hasCoords = (lead) =>
  typeof lead.latitude === 'number' && typeof lead.longitude === 'number';

const isVisible = (map) => {
  const el = map.getContainer();
  return el.clientWidth > 0 && el.clientHeight > 0;
};

const isTouch = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

// Keeps the whole US in view as the container resizes (rotating a phone,
// switching the mobile List/Map tabs) until someone moves the map themselves
function FitUS({ resetKey, hold }) {
  const map = useMap();
  const moved = useRef(false);
  const holdRef = useRef(hold);
  holdRef.current = hold;

  useEffect(() => {
    const onDrag = () => { moved.current = true; };
    map.on('dragstart', onDrag);
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
      if (!isVisible(map)) return;
      if (!moved.current && !holdRef.current) map.fitBounds(US_BOUNDS, { padding: [8, 8] });
    });
    observer.observe(map.getContainer());
    return () => {
      observer.disconnect();
      map.off('dragstart', onDrag);
    };
  }, [map]);

  useEffect(() => {
    if (!resetKey) return;
    moved.current = false;
    if (!isVisible(map)) return;
    map.flyToBounds(US_BOUNDS, { padding: [8, 8], duration: 0.6 });
  }, [resetKey, map]);

  return null;
}

// Pans to the selected lead whenever the selection changes
function FlyTo({ latitude, longitude, minZoom = 8 }) {
  const map = useMap();
  useEffect(() => {
    // A hidden map (the other mobile tab) has no size, and Leaflet throws
    // on any animated move while it's 0×0
    if (!isVisible(map)) return;
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      map.flyTo([latitude, longitude], Math.max(map.getZoom(), minZoom), { duration: 0.8 });
    }
  }, [latitude, longitude, minZoom, map]);
  return null;
}

function ClickToPick({ onPick }) {
  useMapEvents({
    click: (e) => onPick(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

function ResetButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute top-3 left-14 z-[1000] h-[34px] px-3 rounded-md bg-white text-xs font-semibold text-slate-700 shadow-sm border border-slate-300 hover:bg-slate-50 active:bg-slate-100"
    >
      USA
    </button>
  );
}

export default function LeadsMap({ leads = [], selectedId, onSelect, resetKey, onReset }) {
  const mappable = leads.filter(hasCoords);
  const selected = mappable.find(l => l.id === selectedId);
  const touch = isTouch();

  return (
    // `isolate` keeps Leaflet's high z-index panes/overlays from rising above page modals
    <div className="h-full w-full relative isolate">
      <MapContainer {...MAP_OPTIONS} className="h-full w-full z-0">
        <TileLayer attribution={TILE_ATTRIBUTION} url={TILES} />
        <FitUS resetKey={resetKey} hold={Boolean(selected)} />
        <FlyTo latitude={selected?.latitude} longitude={selected?.longitude} />
        {mappable.map((lead) => {
          const status = getLeadStatus(lead.status);
          const isSelected = lead.id === selectedId;
          return (
            <CircleMarker
              key={lead.id}
              center={[lead.latitude, lead.longitude]}
              // Bigger dots on touch screens so they're easy to tap
              radius={(isSelected ? 11 : 8) + (touch ? 3 : 0)}
              pathOptions={{
                color: isSelected ? '#0f172a' : '#ffffff',
                weight: isSelected ? 3 : 2,
                fillColor: status.color,
                fillOpacity: 0.9,
              }}
              eventHandlers={{ click: () => onSelect?.(lead.id) }}
            >
              {!touch && (
                <Tooltip direction="top" offset={[0, -8]}>
                  <div className="text-xs">
                    <div className="font-semibold">{lead.crewName}</div>
                    <div>{[lead.city, lead.state].filter(Boolean).join(', ')}</div>
                    <div style={{ color: status.color, fontWeight: 600 }}>{status.label}</div>
                  </div>
                </Tooltip>
              )}
            </CircleMarker>
          );
        })}
      </MapContainer>

      <ResetButton onClick={onReset} />

      {/* Legend */}
      <div className="hidden sm:block absolute bottom-3 left-3 z-[1000] rounded-lg px-3 py-2 space-y-1 bg-white/95 shadow-sm border border-slate-200">
        {LEAD_STATUSES.map(s => (
          <div key={s.id} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            <span className="text-[11px] text-slate-600">{s.label}</span>
          </div>
        ))}
      </div>

      {leads.length > mappable.length && (
        <div className="absolute top-3 right-3 z-[1000] rounded-md px-2.5 py-1 text-[11px] font-medium text-slate-600 bg-white/95 shadow-sm border border-slate-200">
          {leads.length - mappable.length} without a pin
        </div>
      )}
    </div>
  );
}

// Small map used inside the lead form: tap anywhere to drop / move the pin
export function LocationPicker({ latitude, longitude, onPick }) {
  const pinned = typeof latitude === 'number' && typeof longitude === 'number';

  return (
    <MapContainer
      {...MAP_OPTIONS}
      {...(pinned ? { bounds: undefined, center: [latitude, longitude], zoom: 11 } : {})}
      className="h-full w-full z-0"
      style={{ ...MAP_OPTIONS.style, cursor: 'crosshair' }}
    >
      <TileLayer attribution={TILE_ATTRIBUTION} url={TILES} />
      <ClickToPick onPick={onPick} />
      {pinned && (
        <>
          <FlyTo latitude={latitude} longitude={longitude} minZoom={11} />
          <CircleMarker
            center={[latitude, longitude]}
            radius={10}
            pathOptions={{ color: '#0f172a', weight: 2, fillColor: '#22c55e', fillOpacity: 0.9 }}
          />
        </>
      )}
    </MapContainer>
  );
}
