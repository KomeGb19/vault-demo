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
