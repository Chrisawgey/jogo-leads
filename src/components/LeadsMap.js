import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { useEffect } from 'react';
import { LEAD_STATUSES, getLeadStatus } from '../lib/leads';

const US_CENTER = [39.8283, -98.5795];
// Same free OpenStreetMap tiles the dashboard map uses — no API key needed
const TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const hasCoords = (lead) =>
  typeof lead.latitude === 'number' && typeof lead.longitude === 'number';

// Pans to the selected lead whenever the selection changes
function FlyTo({ latitude, longitude }) {
  const map = useMap();
  useEffect(() => {
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      map.flyTo([latitude, longitude], Math.max(map.getZoom(), 8), { duration: 0.8 });
    }
  }, [latitude, longitude, map]);
  return null;
}

function ClickToPick({ onPick }) {
  useMapEvents({
    click: (e) => onPick(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

export default function LeadsMap({ leads = [], selectedId, onSelect }) {
  const mappable = leads.filter(hasCoords);
  const selected = mappable.find(l => l.id === selectedId);

  return (
    // `isolate` keeps Leaflet's high z-index panes/overlays from rising above page modals
    <div className="h-full w-full relative isolate">
      <MapContainer
        center={US_CENTER}
        zoom={4}
        scrollWheelZoom={true}
        className="h-full w-full rounded-xl z-0"
        style={{ height: '100%', width: '100%', background: '#f1f5f9' }}
      >
        <TileLayer attribution={TILE_ATTRIBUTION} url={TILES} />
        <FlyTo latitude={selected?.latitude} longitude={selected?.longitude} />
        {mappable.map((lead) => {
          const status = getLeadStatus(lead.status);
          const isSelected = lead.id === selectedId;
          return (
            <CircleMarker
              key={lead.id}
              center={[lead.latitude, lead.longitude]}
              radius={isSelected ? 11 : 8}
              pathOptions={{
                color: isSelected ? '#0f172a' : '#ffffff',
                weight: isSelected ? 3 : 2,
                fillColor: status.color,
                fillOpacity: 0.9,
              }}
              eventHandlers={{ click: () => onSelect?.(lead.id) }}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                <div className="text-xs">
                  <div className="font-semibold">{lead.crewName}</div>
                  <div>{[lead.city, lead.state].filter(Boolean).join(', ')}</div>
                  <div style={{ color: status.color, fontWeight: 600 }}>{status.label}</div>
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>

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
          {leads.length - mappable.length} lead{leads.length - mappable.length === 1 ? '' : 's'} without a pin
        </div>
      )}
    </div>
  );
}

// Small map used inside the lead form: click anywhere to drop / move the pin
export function LocationPicker({ latitude, longitude, onPick }) {
  const pinned = typeof latitude === 'number' && typeof longitude === 'number';

  return (
    <MapContainer
      center={pinned ? [latitude, longitude] : US_CENTER}
      zoom={pinned ? 10 : 4}
      scrollWheelZoom={true}
      className="h-full w-full rounded-lg z-0"
      style={{ height: '100%', width: '100%', background: '#f1f5f9', cursor: 'crosshair' }}
    >
      <TileLayer attribution={TILE_ATTRIBUTION} url={TILES} />
      <ClickToPick onPick={onPick} />
      {pinned && (
        <>
          <FlyTo latitude={latitude} longitude={longitude} />
          <CircleMarker
            center={[latitude, longitude]}
            radius={9}
            pathOptions={{ color: '#0f172a', weight: 2, fillColor: '#22c55e', fillOpacity: 0.9 }}
          />
        </>
      )}
    </MapContainer>
  );
}
