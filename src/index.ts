import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRouter from "./routes/auth";
import semestersRouter from "./routes/semester";
import courseRouter from "./routes/courses";
import analyticsRouter from "./routes/analytics";
import usersRouter from "./routes/users";
import authMiddleware from "./middleware/auth";

dotenv.config();

const app = express();

// Middleware
app.use(cors());
// Force UTF-8 for JSON responses
app.use((_req, res, next) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  next();
});
app.use(express.json());
app.use("/api/auth", authRouter);
app.use("/api/semesters", semestersRouter);
app.use("/api/courses", courseRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/users", authMiddleware, usersRouter);

// Test route
app.get("/", (req, res) => {
  res.json({ message: "Grade Flow API running" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
