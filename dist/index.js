"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_1 = __importDefault(require("./routes/auth"));
const semester_1 = __importDefault(require("./routes/semester"));
const courses_1 = __importDefault(require("./routes/courses"));
const analytics_1 = __importDefault(require("./routes/analytics"));
const users_1 = __importDefault(require("./routes/users"));
const auth_2 = __importDefault(require("./middleware/auth"));
dotenv_1.default.config();
const app = (0, express_1.default)();
// Middleware
app.use((0, cors_1.default)());
// Force UTF-8 for JSON responses
app.use((_req, res, next) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    next();
});
app.use(express_1.default.json());
app.use("/api/auth", auth_1.default);
app.use("/api/semesters", semester_1.default);
app.use("/api/courses", courses_1.default);
app.use("/api/analytics", analytics_1.default);
app.use("/api/users", auth_2.default, users_1.default);
// Test route
app.get("/", (req, res) => {
    res.json({ message: "Grade Flow API running" });
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
