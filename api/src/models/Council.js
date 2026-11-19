import mongoose from "mongoose";

const accountSchema = new mongoose.Schema(
  {
    bank: { type: String, required: true, trim: true },
    number: { type: String, required: true, trim: true },
    name: { type: String, trim: true, default: "" },
    lockedAt: Date,
  },
  { _id: false },
);

const councilSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    members: {
      type: [{ name: { type: String, required: true, trim: true } }],
      validate: [(m) => m.length === 5, "A council needs exactly 5 members"],
    },
    homeAccount: accountSchema,
    tradeCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export default mongoose.model("Council", councilSchema);
