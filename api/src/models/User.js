import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    balance: { type: Number, default: 1_000_000 }, 
  },
  { timestamps: true },
);

export default mongoose.model("User", userSchema);
