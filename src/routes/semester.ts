import { Router, Response } from "express";
import pool from "../db";
import authMiddleware, { AuthRequest } from "../middleware/auth";
import {
  VALID_SEMESTER_LEVELS,
  VALID_SEMESTER_NUMBERS,
} from "../utils/semester";

const router = Router();

const parseSemesterInt = (value: unknown) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
};

const hasValidSemesterSelection = (level: unknown, semesterNumber: unknown) => {
  const parsedLevel = parseSemesterInt(level);
  const parsedSemesterNumber = parseSemesterInt(semesterNumber);

  return (
    parsedLevel !== null &&
    parsedSemesterNumber !== null &&
    VALID_SEMESTER_LEVELS.includes(
      parsedLevel as (typeof VALID_SEMESTER_LEVELS)[number],
    ) &&
    VALID_SEMESTER_NUMBERS.includes(
      parsedSemesterNumber as (typeof VALID_SEMESTER_NUMBERS)[number],
    )
  );
};

// Get all semesters for logged in user
router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT * FROM semesters WHERE user_id = $1 ORDER BY level ASC, semester_number ASC",
      [req.userId],
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err });
  }
});

// Create semester
router.post("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { name, academic_year, level, semester_number, is_current } = req.body;

  if (!hasValidSemesterSelection(level, semester_number)) {
    return res.status(400).json({ message: "Invalid level or semester number" });
  }

  try {
    // If new semester is current, unset others
    if (is_current) {
      await pool.query(
        "UPDATE semesters SET is_current = FALSE WHERE user_id = $1",
        [req.userId],
      );
    }

    const result = await pool.query(
      `INSERT INTO semesters (user_id, name, academic_year, level, semester_number, is_current)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        req.userId,
        name,
        academic_year,
        parseSemesterInt(level),
        parseSemesterInt(semester_number),
        is_current || false,
      ],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err });
  }
});

// Update semester
router.put("/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, academic_year, level, semester_number, is_current } = req.body;
  const parsedLevel = parseSemesterInt(level);
  const parsedSemesterNumber = parseSemesterInt(semester_number);

  if (!hasValidSemesterSelection(level, semester_number)) {
    return res.status(400).json({ message: "Invalid level or semester number" });
  }

  try {
    if (is_current) {
      await pool.query(
        "UPDATE semesters SET is_current = FALSE WHERE user_id = $1",
        [req.userId],
      );
    }

    const result = await pool.query(
      `UPDATE semesters SET name = $1, academic_year = $2, level = $3, semester_number = $4, is_current = $5
       WHERE id = $6 AND user_id = $7 RETURNING *`,
      [
        name,
        academic_year,
        parsedLevel,
        parsedSemesterNumber,
        is_current || false,
        id,
        req.userId,
      ],
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err });
  }
});

// Update semester target GPA
router.patch("/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { target_gpa } = req.body;

  if (typeof target_gpa !== "number" || !Number.isFinite(target_gpa)) {
    return res.status(400).json({
      message: "target_gpa must be a number between 1.00 and 5.00",
    });
  }

  if (target_gpa < 1 || target_gpa > 5) {
    return res.status(400).json({
      message: "target_gpa must be a number between 1.00 and 5.00",
    });
  }

  try {
    const result = await pool.query(
      `UPDATE semesters
       SET target_gpa = $1
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [target_gpa, id, req.userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Semester not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err });
  }
});

// Delete semester
router.delete(
  "/:id",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    try {
      await pool.query("DELETE FROM semesters WHERE id = $1 AND user_id = $2", [
        id,
        req.userId,
      ]);
      res.json({ message: "Semester deleted" });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err });
    }
  },
);

export default router;
