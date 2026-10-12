import { memo } from 'react';
import type { ColorValue } from 'react-native';
import Svg, { Circle, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';

/**
 * Ícones de traço (estilo Feather, MIT) desenhados com react-native-svg.
 * `@expo/vector-icons` não está instalado no workspace, então mantemos um conjunto próprio.
 * Formato compacto: p:path · c:cx cy r · l:x1 y1 x2 y2 · pl:polyline · pg:polygon · r:x y w h rx
 */
const ICONS = {
  home: ['p:M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'pl:9 22 9 12 15 12 15 22'],
  dumbbell: ['p:M6.5 6.5v11', 'p:M17.5 6.5v11', 'p:M3 9v6', 'p:M21 9v6', 'p:M6.5 12h11', 'p:M3 12h3.5', 'p:M17.5 12H21'],
  'trending-up': ['pl:23 6 13.5 15.5 8.5 10.5 1 18', 'pl:17 6 23 6 23 12'],
  'trending-down': ['pl:23 18 13.5 8.5 8.5 13.5 1 6', 'pl:17 18 23 18 23 12'],
  calendar: ['r:3 4 18 18 2', 'l:16 2 16 6', 'l:8 2 8 6', 'l:3 10 21 10'],
  user: ['p:M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'c:12 7 4'],
  users: ['p:M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'c:9 7 4', 'p:M23 21v-2a4 4 0 0 0-3-3.87', 'p:M16 3.13a4 4 0 0 1 0 7.75'],
  'user-plus': ['p:M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'c:8.5 7 4', 'l:20 8 20 14', 'l:23 11 17 11'],
  grid: ['r:3 3 7 7 1', 'r:14 3 7 7 1', 'r:14 14 7 7 1', 'r:3 14 7 7 1'],
  bell: ['p:M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9', 'p:M13.73 21a2 2 0 0 1-3.46 0'],
  message: [
    'p:M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z',
  ],
  'message-square': ['p:M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  send: ['l:22 2 11 13', 'pg:22 2 15 22 11 13 2 9 22 2'],
  plus: ['l:12 5 12 19', 'l:5 12 19 12'],
  minus: ['l:5 12 19 12'],
  x: ['l:18 6 6 18', 'l:6 6 18 18'],
  check: ['pl:20 6 9 17 4 12'],
  'check-circle': ['p:M22 11.08V12a10 10 0 1 1-5.93-9.14', 'pl:22 4 12 14.01 9 11.01'],
  'chevron-right': ['pl:9 18 15 12 9 6'],
  'chevron-left': ['pl:15 18 9 12 15 6'],
  'chevron-down': ['pl:6 9 12 15 18 9'],
  'chevron-up': ['pl:18 15 12 9 6 15'],
  'arrow-left': ['l:19 12 5 12', 'pl:12 19 5 12 12 5'],
  'arrow-right': ['l:5 12 19 12', 'pl:12 5 19 12 12 19'],
  'arrow-up': ['l:12 19 12 5', 'pl:5 12 12 5 19 12'],
  'arrow-down': ['l:12 5 12 19', 'pl:19 12 12 19 5 12'],
  search: ['c:11 11 8', 'l:21 21 16.65 16.65'],
  filter: ['pg:22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3'],
  play: ['pg:6 3 20 12 6 21 6 3'],
  pause: ['r:6 4 4 16 1', 'r:14 4 4 16 1'],
  stop: ['r:6 6 12 12 2'],
  mic: ['p:M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z', 'p:M19 10v2a7 7 0 0 1-14 0v-2', 'l:12 19 12 23', 'l:8 23 16 23'],
  image: ['r:3 3 18 18 2', 'c:8.5 8.5 1.5', 'pl:21 15 16 10 5 21'],
  video: ['pg:23 7 16 12 23 17 23 7', 'r:1 5 15 14 2'],
  paperclip: ['p:M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48'],
  file: ['p:M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z', 'pl:13 2 13 9 20 9'],
  camera: ['p:M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z', 'c:12 13 4'],
  clock: ['c:12 12 10', 'pl:12 6 12 12 16 14'],
  award: ['c:12 8 7', 'pl:8.21 13.89 7 23 12 20 17 23 15.79 13.88'],
  target: ['c:12 12 10', 'c:12 12 6', 'c:12 12 2'],
  edit: ['p:M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z'],
  trash: ['pl:3 6 5 6 21 6', 'p:M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'],
  copy: ['r:9 9 13 13 2', 'p:M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'],
  share: ['c:18 5 3', 'c:6 12 3', 'c:18 19 3', 'l:8.59 13.51 15.42 17.49', 'l:15.41 6.51 8.59 10.49'],
  logout: ['p:M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'pl:16 17 21 12 16 7', 'l:21 12 9 12'],
  lock: ['r:3 11 18 11 2', 'p:M7 11V7a5 5 0 0 1 10 0v4'],
  mail: ['p:M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z', 'pl:22 6 12 13 2 6'],
  phone: ['r:5 2 14 20 2', 'l:12 18 12.01 18'],
  star: ['pg:12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2'],
  zap: ['pg:13 2 3 14 12 14 11 22 21 10 12 10 13 2'],
  sparkles: ['p:M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z', 'p:M19 3v4', 'p:M17 5h4', 'p:M5 17v4', 'p:M3 19h4'],
  refresh: ['pl:23 4 23 10 17 10', 'pl:1 20 1 14 7 14', 'p:M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15'],
  more: ['c:12 12 1', 'c:19 12 1', 'c:5 12 1'],
  eye: ['p:M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', 'c:12 12 3'],
  'eye-off': [
    'p:M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24',
    'l:1 1 23 23',
  ],
  download: ['p:M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'pl:7 10 12 15 17 10', 'l:12 15 12 3'],
  'external-link': ['p:M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6', 'pl:15 3 21 3 21 9', 'l:10 14 21 3'],
  help: ['c:12 12 10', 'p:M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3', 'l:12 17 12.01 17'],
  info: ['c:12 12 10', 'l:12 16 12 12', 'l:12 8 12.01 8'],
  alert: ['p:M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z', 'l:12 9 12 13', 'l:12 17 12.01 17'],
  'skip-forward': ['pg:5 4 15 12 5 20 5 4', 'l:19 5 19 19'],
  activity: ['pl:22 12 18 12 15 21 9 3 6 12 2 12'],
  'bar-chart': ['l:18 20 18 10', 'l:12 20 12 4', 'l:6 20 6 14'],
  list: ['l:8 6 21 6', 'l:8 12 21 12', 'l:8 18 21 18', 'l:3 6 3.01 6', 'l:3 12 3.01 12', 'l:3 18 3.01 18'],
  shield: ['p:M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
  card: ['r:1 4 22 16 2', 'l:1 10 23 10'],
  link: ['p:M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71', 'p:M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'],
  'map-pin': ['p:M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z', 'c:12 10 3'],
  bookmark: ['p:M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z'],
  flame: [
    'p:M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z',
  ],
  qr: ['r:3 3 7 7 1', 'r:14 3 7 7 1', 'r:3 14 7 7 1', 'p:M14 14h3v3h-3z', 'p:M20 14v.01', 'p:M14 20h.01', 'p:M17 20h4', 'p:M20 17v3'],
  clipboard: ['p:M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2', 'r:8 2 8 4 1'],
  scale: ['r:3 3 18 18 4', 'p:M8 8.5a5 5 0 0 1 8 0', 'l:12 9 13.5 11.5'],
  ruler: ['p:M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0z', 'l:14.5 12.5 16.5 10.5', 'l:11.5 9.5 13.5 7.5', 'l:8.5 6.5 10.5 4.5', 'l:17.5 15.5 19.5 13.5'],
  repeat: ['pl:17 1 21 5 17 9', 'p:M3 11V9a4 4 0 0 1 4-4h14', 'pl:7 23 3 19 7 15', 'p:M21 13v2a4 4 0 0 1-4 4H3'],
  sun: ['c:12 12 5', 'l:12 1 12 3', 'l:12 21 12 23', 'l:4.22 4.22 5.64 5.64', 'l:18.36 18.36 19.78 19.78', 'l:1 12 3 12', 'l:21 12 23 12'],
  settings: ['c:12 12 3', 'p:M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12'],
  inbox: ['pl:22 12 16 12 14 15 10 15 8 12 2 12', 'p:M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z'],
  globe: ['c:12 12 10', 'l:2 12 22 12', 'p:M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'],
} as const;

export type IconName = keyof typeof ICONS;

const FILLED = new Set<IconName>(['play', 'star']);

interface Props {
  name: IconName;
  size?: number;
  color?: ColorValue;
  strokeWidth?: number;
  filled?: boolean;
}

function nums(s: string) {
  return s.trim().split(/[\s,]+/).map(Number);
}

export const Icon = memo(function Icon({ name, size = 22, color = '#fff', strokeWidth = 2, filled }: Props) {
  const parts = ICONS[name] as readonly string[];
  const fill = filled ?? FILLED.has(name) ? (color as string) : 'none';
  const common = { stroke: color as string, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {parts.map((part, i) => {
        const idx = part.indexOf(':');
        const kind = part.slice(0, idx);
        const data = part.slice(idx + 1);
        switch (kind) {
          case 'p':
            return <Path key={i} d={data} {...common} />;
          case 'c': {
            const [cx, cy, r] = nums(data);
            return <Circle key={i} cx={cx} cy={cy} r={r} {...common} />;
          }
          case 'l': {
            const [x1, y1, x2, y2] = nums(data);
            return <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} {...common} />;
          }
          case 'pl':
            return <Polyline key={i} points={data} {...common} />;
          case 'pg':
            return <Polygon key={i} points={data} {...common} fill={fill} />;
          case 'r': {
            const [x, y, w, h, rx] = nums(data);
            return <Rect key={i} x={x} y={y} width={w} height={h} rx={rx} {...common} />;
          }
          default:
            return null;
        }
      })}
    </Svg>
  );
});
