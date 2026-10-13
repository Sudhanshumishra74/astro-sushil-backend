import express from "express";
import path from "path";
import cors from "cors";
import cookieParser from "cookie-parser";
 import morgan from "morgan";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { errorHandler } from "./middlewares/error.middleware.js";
const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .replace(/^"|"$/g, "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.set("trust proxy", 1);
app.use(morgan('dev'))
app.use(helmet());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10000,
  }),
);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS not allowed"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  }),
);

app.use(express.static(path.join(process.cwd(), "public")));
app.use(cookieParser());

import routes from "./routes/index.js";

app.use("/api/v1", routes);
app.get("/health", (req, res) => {
  res.status(200).json({
    message: "Server is healthy"
  })
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});
app.use(errorHandler);
export default app ;
