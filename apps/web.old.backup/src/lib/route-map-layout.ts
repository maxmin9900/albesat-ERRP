export interface MapPoint {
  x: number;
  y: number;
}

const VIEW_W = 400;
const VIEW_H = 300;

/** Place stops along a smooth route curve in SVG viewBox coordinates. */
export function layoutStopsOnRoute(count: number): MapPoint[] {
  if (count <= 0) return [];
  if (count === 1) return [{ x: 200, y: 150 }];

  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    const x = 40 + t * 320;
    const y = 220 - t * 160 + Math.sin(t * Math.PI) * 20;
    return { x, y };
  });
}

export function buildRoutePath(points: MapPoint[]): string {
  if (points.length < 2) return "";
  const [first, ...rest] = points;
  let d = `M ${first.x} ${first.y}`;
  for (let i = 0; i < rest.length; i++) {
    const prev = i === 0 ? first : rest[i - 1];
    const curr = rest[i];
    const cpx = (prev.x + curr.x) / 2;
    const cpy = prev.y - 40;
    d += ` Q ${cpx} ${cpy} ${curr.x} ${curr.y}`;
  }
  return d;
}

export function buildLegPath(from: MapPoint, to: MapPoint): string {
  const cpx = (from.x + to.x) / 2;
  const cpy = from.y - 50;
  return `M ${from.x} ${from.y} Q ${cpx} ${cpy} ${to.x} ${to.y}`;
}

/** Driver / depot start point (bottom-left of map). */
export function driverStartPoint(): MapPoint {
  return { x: 48, y: 248 };
}

export { VIEW_W, VIEW_H };
