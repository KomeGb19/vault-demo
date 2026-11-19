import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    councilId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Council",
      index: true,
    },
    destination: { bank: String, number: String },
    amount: Number,
    verdict: String,
    status: String,
    reason: String,
    ms: Number,
  },
  { timestamps: true },
);

export default mongoose.model("CheckLog", schema);
