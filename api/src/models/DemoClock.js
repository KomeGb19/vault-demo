import mongoose from "mongoose";

const schema = new mongoose.Schema({
  key: { type: String, unique: true, default: "main" },
  offsetMs: { type: Number, default: 0 },
});

export default mongoose.model("DemoClock", schema);
