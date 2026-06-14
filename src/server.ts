import "dotenv/config";
import express from "express";
import cors    from "cors";
import path    from "path";
import { fileURLToPath } from "url";
import apiRouter from "./routes/api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app       = express();
const PORT      = Number(process.env.PORT ?? 3001);

app.use(cors({ origin: process.env.NODE_ENV === "production" ? false : "*" }));
app.use(express.json({ limit: "1mb" }));
app.use("/api", apiRouter);

if (process.env.NODE_ENV === "production") {
  const build = path.join(__dirname, "../frontend/dist");
  app.use(express.static(build));
  app.get("*", (_req, res) => res.sendFile(path.join(build, "index.html")));
}

app.listen(PORT, () => {
  console.log(`\n🟢 xPay — AI Payment Agent`);
  console.log(`   Network : ${process.env.HEDERA_NETWORK ?? "testnet"}`);
  console.log(`   API     : http://localhost:${PORT}/api\n`);
});
