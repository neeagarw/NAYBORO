// Dates in the metro's own time zone (from metros.timezone), never the server's or a hard-coded one.

export function fmtIn(iso: string, tz: string, o: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleString("en-US", { timeZone: tz, ...o });
}

/** Offset of `tz` from UTC at a given moment, in minutes. */
function offsetMinutes(at: Date, tz: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(at).map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return (asUtc - at.getTime()) / 60000;
}

/** "2026-12-12T19:00" typed for the metro → the real instant (ISO, UTC). Handles daylight saving. */
export function localToUtcIso(local: string, tz: string) {
  const [d, t] = local.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [hh, mm] = (t ?? "00:00").split(":").map(Number);
  const guess = Date.UTC(y, m - 1, day, hh, mm);
  let ts = guess - offsetMinutes(new Date(guess), tz) * 60000;
  ts = guess - offsetMinutes(new Date(ts), tz) * 60000;   // second pass fixes DST edges
  return new Date(ts).toISOString();
}

/** Saturday 00:00 → Monday 00:00 of the current weekend, in the metro's time zone. */
export function isThisWeekend(iso: string, tz: string) {
  const local = (x: Date) => new Date(x.toLocaleString("en-US", { timeZone: tz }));
  const now = local(new Date());
  const d = local(new Date(iso));
  const sat = new Date(now);
  sat.setHours(0, 0, 0, 0);
  sat.setDate(now.getDate() + (now.getDay() === 0 ? -1 : 6 - now.getDay()));
  const mon = new Date(sat);
  mon.setDate(sat.getDate() + 2);
  return d >= sat && d < mon;
}
