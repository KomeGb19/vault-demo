import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    councilId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Council",
      required: true,
      index: true,
    },
    newAccount: {
      bank: { type: String, required: true, trim: true },
      number: { type: String, required: true, trim: true },
      name: { type: String, trim: true, default: "" },
    },
    requestedBy: { type: String, default: "Staff" },
    requestedAt: { type: Date, required: true }, // demo time, not real time
    requiredApprovals: { type: Number, required: true },
    eligibleAt: { type: Date, required: true },
    approvals: [{ type: mongoose.Schema.Types.ObjectId }],
    vetoes: [{ type: mongoose.Schema.Types.ObjectId }],
    status: {
      type: String,
      enum: ["BLOCKED", "APPROVED", "REJECTED"],
      default: "BLOCKED",
    },
    reason: { type: String, default: "NEED_APPROVALS" },
    appliedAt: Date,
  },
  { timestamps: true },
);

export default mongoose.model("HomeChangeRequest", schema);
