import { Router, Response } from "express";
import pool from "../db";
import authMiddleware, { AuthRequest } from "../middleware/auth";
import { sendFeedbackNotification } from "../utils/mailer";

const router = Router();

// Submit feedback
router.post("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { message, page_context } = req.body;

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ message: "Feedback message is required" });
  }

  if (message.trim().length > 2000) {
    return res.status(400).json({ message: "Feedback message is too long" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO feedback (user_id, message, page_context)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.userId, message.trim(), page_context ?? null],
    );

    sendFeedbackNotification({
      message: message.trim(),
      pageContext: page_context ?? null,
      userId: req.userId!,
    });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err });
  }
});

export default router;
