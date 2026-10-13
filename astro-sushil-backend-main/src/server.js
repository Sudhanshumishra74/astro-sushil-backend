import dotenv from "dotenv";
import app from "./app.js";
import connectDB from "./config/db.js";
dotenv.config();
if (process.env.ENABLE_WORKERS === "true") {
  await import("./workers/notification.worker.js");
  await import("./workers/process-report-pdf.worker.js");
}
//import "./workers/notification.worker.js";
//import "./workers/process-report-pdf.worker.js";
const PORT = process.env.PORT || 8000;
connectDB()
  .then(() => {
    console.log("mongoose connected successfully ");
    app.listen(PORT, () => {
      console.log(`⚙️ Server is running at port : ${PORT}`);
    });
  })
  .catch((err) => {
    console.log("MONGO db connection failed !!! ", err);
    process.exit(1);
  });
