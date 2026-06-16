export interface SparkPoint { date: string; value: number }

interface EventMarker {
  /** Data (YYYY-MM-DD ou YYYY-MM) que corresponde a um dos data points */
  date:  string;
  label: string;
  color: string;
}

interface Props {
  /** Série temporal de pontos (date YYYY-MM-DD, value). Mantida em ordem cronológica. */
  data:    SparkPoint[];
  color?:  string;
  height?: number;
  fill?:   boolean;
  events?: EventMarker[];
}

export default function Sparkline({ data, color = "#0066CC", height = 28, fill = true, events = [] }: Props) {
  if (data.length < 2) return null;

  const values = data.map(d => d.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  const xy = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = ((max - d.value) / range) * 100;
    return [x, y] as const;
  });
  const linePath = "M " + xy.map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" L ");
  const areaPath = linePath + ` L 100,100 L 0,100 Z`;

  const last = xy[xy.length - 1];

  // Match events para data points — aceita YYYY-MM ou YYYY-MM-DD
  const markers: { x: number; y: number; ev: EventMarker; pointDate: string }[] = [];
  for (const ev of events) {
    const evMonth = ev.date.slice(0, 7); // YYYY-MM
    const idx = data.findIndex(d => d.date.slice(0, 7) === evMonth);
    if (idx >= 0) {
      markers.push({ x: xy[idx][0], y: xy[idx][1], ev, pointDate: data[idx].date });
    }
  }

  return (
    <svg
      className="w-full"
      height={height}
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
      aria-hidden
    >
      {fill && <path d={areaPath} fill={color} fillOpacity={0.12} />}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* Marcadores de eventos contextuais */}
      {markers.map((m, i) => (
        <g key={i}>
          <line
            x1={m.x} x2={m.x} y1={0} y2={100}
            stroke={m.ev.color}
            strokeWidth={1}
            strokeDasharray="2,2"
            opacity={0.5}
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx={m.x} cy={m.y} r={3}
            fill={m.ev.color}
            stroke="white"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          >
            <title>{m.ev.label} ({m.pointDate})</title>
          </circle>
        </g>
      ))}
      {/* Ponto no fim */}
      <circle
        cx={last[0]} cy={last[1]} r={2.6}
        fill={color}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
