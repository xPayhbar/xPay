import "dotenv/config";
import express from "express";
import cors    from "cors";
import path    from "path";
import { fileURLToPath } from "url";
import apiRouter from "./routes/api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app       = express();
const PORT      = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use("/api", apiRouter);

const build = path.join(__dirname, "../frontend/dist");
app.use(express.static(build));
app.get("*", (_req, res) => {
  res.sendFile(path.join(build, "index.html"));
});

app.listen(PORT, () => {
  console.log(`\n🟢 xPay running on port ${PORT}\n`);
});
