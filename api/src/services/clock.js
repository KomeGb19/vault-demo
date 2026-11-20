import DemoClock from "../models/DemoClock.js";

const HOUR = 3600 * 1000;

export async function getOffset() {
  const c = await DemoClock.findOne({ key: "main" });
  return c?.offsetMs ?? 0;
}

export async function getNow() {
  return new Date(Date.now() + (await getOffset()));
}

export async function advance(hours) {
  await DemoClock.findOneAndUpdate(
    { key: "main" },
    { $inc: { offsetMs: hours * HOUR } },
    { upsert: true, setDefaultsOnInsert: true },
  );
}

export async function resetClock() {
  await DemoClock.findOneAndUpdate(
    { key: "main" },
    { $set: { offsetMs: 0 } },
    { upsert: true, setDefaultsOnInsert: true },
  );
}

export async function setLagosTime(hour, minute) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()); // YYYY-MM-DD
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  const target = new Date(`${today}T${hh}:${mm}:00+01:00`);
  await DemoClock.findOneAndUpdate(
    { key: "main" },
    { $set: { offsetMs: target.getTime() - Date.now() } },
    { upsert: true, setDefaultsOnInsert: true },
  );
}
