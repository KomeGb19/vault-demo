import "dotenv/config";
import mongoose from "mongoose";
import app from "./app.js";

const PORT = process.env.PORT || 4000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => console.log(`API running on :${PORT}`));
  })
  .catch((err) => {
    console.error("Mongo connection failed:", err.message);
    process.exit(1);
  });
