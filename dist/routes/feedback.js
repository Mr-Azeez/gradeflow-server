"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../db"));
const auth_1 = __importDefault(require("../middleware/auth"));
const mailer_1 = require("../utils/mailer");
const router = (0, express_1.Router)();
// Submit feedback
router.post("/", auth_1.default, async (req, res) => {
    const { message, page_context } = req.body;
    if (!message || typeof message !== "string" || !message.trim()) {
        return res.status(400).json({ message: "Feedback message is required" });
    }
    if (message.trim().length > 2000) {
        return res.status(400).json({ message: "Feedback message is too long" });
    }
    try {
        const result = await db_1.default.query(`INSERT INTO feedback (user_id, message, page_context)
       VALUES ($1, $2, $3) RETURNING *`, [req.userId, message.trim(), page_context ?? null]);
        (0, mailer_1.sendFeedbackNotification)({
            message: message.trim(),
            pageContext: page_context ?? null,
            userId: req.userId,
        });
        res.status(201).json(result.rows[0]);
    }
    catch (err) {
        res.status(500).json({ message: "Server error", error: err });
    }
});
exports.default = router;
