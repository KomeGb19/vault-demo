import mongoose from "mongoose";

const historySchema = new mongoose.Schema(
  {
    event: { type: String, required: true },
    by: mongoose.Schema.Types.ObjectId,
    byName: String,
    channel: { type: String, default: "api" },
    detail: String,
    at: { type: Date, required: true }, // demo-clock time
    realAt: { type: Date, default: Date.now }, // real time
  },
  { _id: false },
);

const payoutSchema = new mongoose.Schema(
  {
    councilId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Council",
      required: true,
      index: true,
    },
    toAccount: {
      bank: { type: String, required: true, trim: true },
      number: { type: String, required: true, trim: true },
      name: { type: String, trim: true, default: "" },
    },
    amount: { type: Number, default: 0 },
    accountType: { type: String, enum: ["HOME", "NEW"], required: true },
    status: {
      type: String,
      enum: ["BLOCKED", "APPROVED", "REJECTED"],
      required: true,
    },
    reason: { type: String, required: true },
    requiredApprovals: { type: Number, required: true },
    delayHours: { type: Number, required: true },
    eligibleAt: { type: Date, required: true },
    approvals: [{ type: mongoose.Schema.Types.ObjectId }],
    rejections: [{ type: mongoose.Schema.Types.ObjectId }],
    history: [historySchema],
  },
  { timestamps: true },
);

export default mongoose.model("Payout", payoutSchema);
