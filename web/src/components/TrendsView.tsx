import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { MapContainer, TileLayer, CircleMarker, Tooltip as MapTooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { Trends } from '../api';

/** Charts paint outside the DOM cascade, so theme colours are read explicitly. */
function useColors(theme: string) {
  return useMemo(() => {
    const css = getComputedStyle(document.documentElement);
    const v = (n: string) => css.getPropertyValue(n).trim();
    return {
      accent: v('--accent'),
      warn: v('--g-edge-shared'),
      seed: v('--g-node-seed'),
      line: v('--line'),
      dim: v('--dim'),
      text: v('--text'),
      panel: v('--panel'),
    };
  }, [theme]);
}

const TILES = {
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
};

export default function TrendsView({
  trends,
  theme,
  onCite,
}: {
  trends: Trends;
  theme: string;
  onCite: (id: string) => void;
}) {
  const c = useColors(theme);
  const { series, hotspots, movement, top_area, total, filters } = trends;

  const scope = [filters.crime_type, filters.area || filters.district, filters.from?.slice(0, 4)]
    .filter(Boolean)
    .join(' · ');

  const peak = Math.max(...series.map((s) => s.count), 1);
  const maxArea = Math.max(...hotspots.map((h) => h.count), 1);

  // Centre the map on the busiest area, else on Karnataka.
  const centre: [number, number] =
    top_area?.lat && top_area?.lon ? [top_area.lat, top_area.lon] : [13.0, 77.58];

  return (
    <div className="trends">
      <div className="graph-head">
        <div>
          <h2>Crime trend &amp; hotspots</h2>
          <p className="dim">
            {scope || 'all records'} · {total} cases
          </p>
        </div>
        {movement && (
          <span className={`move ${movement.direction}`}>
            {movement.direction === 'rising' ? '▲' : movement.direction === 'falling' ? '▼' : '▬'}{' '}
            {movement.change_pct > 0 ? '+' : ''}
            {movement.change_pct}%
          </span>
        )}
      </div>

      {movement && movement.direction !== 'flat' && (
        <div className="leads">
          <span className="tag">TREND</span>
          <span>
            Averaging <strong>{movement.recent_avg}</strong> cases/month over {movement.recent_window}, against{' '}
            <strong>{movement.prior_avg}</strong> over {movement.prior_window} — {movement.direction}.
            {top_area && (
              <>
                {' '}
                <strong>{top_area.area}</strong> accounts for {Math.round(top_area.share * 100)}% of them.
              </>
            )}
          </span>
        </div>
      )}

      <div className="chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
            <CartesianGrid stroke={c.line} vertical={false} />
            <XAxis
              dataKey="key"
              tick={{ fill: c.dim, fontSize: 10 }}
              tickFormatter={(k: string) => k.slice(2).replace('-', '/')}
              interval="preserveStartEnd"
              minTickGap={18}
              stroke={c.line}
            />
            <YAxis tick={{ fill: c.dim, fontSize: 10 }} allowDecimals={false} stroke={c.line} />
            <Tooltip
              cursor={{ fill: 'transparent' }}
              contentStyle={{
                background: c.panel,
                border: `1px solid ${c.line}`,
                borderRadius: 8,
                fontSize: 12,
                color: c.text,
              }}
              formatter={(v) => `${v} cases`}
            />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {series.map((s) => (
                // the peak month is the one an officer will ask about — make it findable
                <Cell key={s.key} fill={s.count === peak ? c.seed : c.accent} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="map">
        <MapContainer center={centre} zoom={10} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
          <TileLayer
            key={theme}
            url={theme === 'dark' ? TILES.dark : TILES.light}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          {hotspots
            .filter((h) => h.lat != null && h.lon != null)
            .map((h) => (
              <CircleMarker
                key={h.area}
                center={[h.lat as number, h.lon as number]}
                radius={8 + (h.count / maxArea) * 26}
                pathOptions={{
                  color: h.count === maxArea ? c.seed : c.accent,
                  fillColor: h.count === maxArea ? c.seed : c.accent,
                  fillOpacity: 0.35,
                  weight: 1.5,
                }}
              >
                <MapTooltip>
                  <strong>{h.area}</strong> — {h.count} cases ({Math.round(h.share * 100)}%)
                </MapTooltip>
              </CircleMarker>
            ))}
        </MapContainer>
      </div>

      {top_area && (
        <div className="graph-foot">
          <div className="inspect">
            <strong>{top_area.area}</strong> — {top_area.count} cases. Source records:
            <div className="cites">
              {top_area.fir_ids.slice(0, 12).map((id) => (
                <button key={id} className="cite" onClick={() => onCite(id)}>
                  {id}
                </button>
              ))}
              {top_area.fir_ids.length > 12 && (
                <span className="dim"> +{top_area.fir_ids.length - 12} more</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
