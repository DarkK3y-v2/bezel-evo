// Clockwise object rotation around the unrotated frame center.
export function normalizeDegrees(degrees) {
  if (!Number.isFinite(degrees)) return 0;
  const angle = ((degrees % 360) + 360) % 360;
  return angle > 180 ? angle - 360 : angle || 0;
}

export function canRotate(theme, e) {
  return !!e && !e.isGroup && e.groupParent == null && !e.card && !e.cardMember
    && !(e.kind?.type === 'shape' && e.kind.videoWindow);
}

export const appliedRotation = (e) => canRotate(null, e) ? normalizeDegrees(e.rotation ?? 0) : 0;

export function rotatePoint(point, center, degrees) {
  const a = degrees * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const x = point.x - center.x, y = point.y - center.y;
  return { x: center.x + x * c - y * s, y: center.y + x * s + y * c };
}

export const centerOf = (f) => ({ x: f.x + f.width / 2, y: f.y + f.height / 2 });
export const toLocal = (frame, degrees, point) => rotatePoint(point, centerOf(frame), -degrees);

export function rotatedCorners(frame, degrees) {
  const { x, y, width, height } = frame;
  return [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }]
    .map(p => rotatePoint(p, centerOf(frame), degrees));
}

export function rotatedBounds(frame, degrees) {
  if (!normalizeDegrees(degrees)) return { ...frame };
  const points = rotatedCorners(frame, degrees);
  const x = Math.min(...points.map(p => p.x)), y = Math.min(...points.map(p => p.y));
  return { x, y, width: Math.max(...points.map(p => p.x)) - x, height: Math.max(...points.map(p => p.y)) - y };
}

export function containsRotated(frame, degrees, x, y) {
  const p = toLocal(frame, degrees, { x, y });
  return p.x >= frame.x && p.x <= frame.x + frame.width && p.y >= frame.y && p.y <= frame.y + frame.height;
}

export const snapAngle = (degrees, step = 15) => normalizeDegrees(Math.round(degrees / step) * step);
