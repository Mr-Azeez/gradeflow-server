"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = __importDefault(require("../db"));
const router = (0, express_1.Router)();
// Register
router.post("/register", async (req, res) => {
    const { name, email, password, matric_number, level, department } = req.body;
    try {
        const userExists = await db_1.default.query("SELECT id FROM users WHERE email = $1", [email]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ message: "Email already registered" });
        }
        const password_hash = await bcrypt_1.default.hash(password, 10);
        const result = await db_1.default.query(`INSERT INTO users (name, email, password_hash, matric_number, level, department)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, avatar_url`, [name, email, password_hash, matric_number, level, department]);
        const user = result.rows[0];
        const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET, {
            expiresIn: "7d",
        });
        res.status(201).json({ token, user });
    }
    catch (err) {
        res.status(500).json({ message: "Server error", error: err });
    }
});
// Login
router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await db_1.default.query("SELECT * FROM users WHERE email = $1", [
            email,
        ]);
        if (result.rows.length === 0) {
            return res.status(400).json({ message: "Invalid credentials" });
        }
        const user = result.rows[0];
        const validPassword = await bcrypt_1.default.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(400).json({ message: "Invalid credentials" });
        }
        const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET, {
            expiresIn: "7d",
        });
        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                avatar_url: user.avatar_url,
            },
        });
    }
    catch (err) {
        res.status(500).json({ message: "Server error", error: err });
    }
});
exports.default = router;
