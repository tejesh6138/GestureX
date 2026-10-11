/**
 * AI Gesture Runner 3D - Math Utilities
 */

export const MathUtils = {
  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  },

  lerp(start, end, alpha) {
    return start + (end - start) * alpha;
  },

  damp(current, target, lambda, dt) {
    return MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
  },

  randomRange(min, max) {
    return min + Math.random() * (max - min);
  },

  randomChoice(array) {
    if (!array || array.length === 0) return null;
    return array[Math.floor(Math.random() * array.length)];
  },

  distance2D(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  },

  distance3D(x1, y1, z1, x2, y2, z2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dz = z2 - z1;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  },

  formatNumber(num) {
    return Math.floor(num).toLocaleString('en-US');
  },

  formatDistance(meters) {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${Math.floor(meters)} m`;
  },

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
};
