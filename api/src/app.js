import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import authRoutes from "./routes/auth.routes.js";
import { notFound, errorHandler } from "./middleware/error.js";
import vaultRoutes from "./routes/vault.routes.js";
import bankRoutes from "./routes/bank.routes.js";
import demoRoutes from "./routes/demo.routes.js";
import apiRoutes from "./routes/api.routes.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL?.split(",") || "*" }));
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (req, res) => res.json({ ok: true }));
app.get("/", (req, res) =>
  res.json({ service: "VAULT API", status: "running" }),
);
app.use("/auth", authRoutes);
app.use("/vault", vaultRoutes);
app.use("/bank", bankRoutes);
app.use("/demo", demoRoutes);
app.use("/api", apiRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
