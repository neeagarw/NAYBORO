/** Distance in km between two points (haversine). */
export function kmBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Nearest area within maxKm, or null. Runs on the device: coordinates never leave the phone. */
export function nearestArea<T extends { lat: number | null; lng: number | null }>(
  here: { lat: number; lng: number },
  areas: T[],
  maxKm = 40,
): T | null {
  let best: T | null = null;
  let bestKm = Infinity;
  for (const a of areas) {
    if (a.lat == null || a.lng == null) continue;
    const d = kmBetween(here, { lat: a.lat, lng: a.lng });
    if (d < bestKm) {
      best = a;
      bestKm = d;
    }
  }
  return bestKm <= maxKm ? best : null;
}

/** Shrink a photo to a square-ish JPEG (max 640px) before upload. */
export async function shrinkImage(file: File, max = 640): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not read photo"))), "image/jpeg", 0.85),
  );
}
