import { Router, Response } from "express";
import pool from "../db";
import authMiddleware, { AuthRequest } from "../middleware/auth";

const router = Router();

// Grade calculation helpers
const scoreToGrade = (score: number): string => {
  if (score >= 70) return "A";
  if (score >= 60) return "B";
  if (score >= 50) return "C";
  if (score >= 45) return "D";
  if (score >= 40) return "E";
  return "F";
};

const gradeToPoint = (grade: string): number => {
  const scale: Record<string, number> = {
    A: 5.0,
    B: 4.0,
    C: 3.0,
    D: 2.0,
    E: 1.0,
    F: 0.0,
  };
  return scale[grade] ?? 0;
};

const getGradeFields = (score: unknown) => {
  const hasScore = score !== undefined && score !== null && score !== "";
  const numericScore = hasScore ? parseFloat(String(score)) : null;
  const grade = numericScore !== null ? scoreToGrade(numericScore) : null;
  const grade_point = grade ? gradeToPoint(grade) : null;

  return { numericScore, grade, grade_point };
};

const formatCourseCode = (code: string) => {
  if (!code) return "";
  return code.toUpperCase().replace(/\s+/g, "");
};

const formatCourseTitle = (title: string) => {
  if (!title) return "";
  return title
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const isSemesterOwnedByUser = async (semesterId: unknown, userId: string) => {
  const semesterResult = await pool.query(
    "SELECT id FROM semesters WHERE id = $1 AND user_id = $2",
    [semesterId, userId],
  );

  return semesterResult.rows.length > 0;
};

// Get all courses for a semester
router.get(
  "/:semesterId",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    const { semesterId } = req.params;
    try {
      const result = await pool.query(
        "SELECT * FROM courses WHERE semester_id = $1 AND user_id = $2 ORDER BY created_at ASC",
        [semesterId, req.userId],
      );
      
      const formattedRows = result.rows.map(row => ({
        ...row,
        course_code: formatCourseCode(row.course_code),
        course_title: formatCourseTitle(row.course_title)
      }));
      
      res.json(formattedRows);
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err });
    }
  },
);

// Add course
router.post("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { semester_id, course_code, course_title, credit_units, score } =
    req.body;
  try {
    const semesterIsValid = await isSemesterOwnedByUser(semester_id, req.userId!);

    if (!semesterIsValid) {
      return res.status(400).json({ message: "Invalid semester" });
    }

    const { numericScore, grade, grade_point } = getGradeFields(score);

    const result = await pool.query(
      `INSERT INTO courses (user_id, semester_id, course_code, course_title, credit_units, score, grade, grade_point)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        req.userId,
        semester_id,
        formatCourseCode(course_code),
        formatCourseTitle(course_title),
        credit_units,
        numericScore,
        grade,
        grade_point,
      ],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err });
  }
});

// Add multiple courses
router.post("/bulk", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { semester_id, courses } = req.body;

  if (!semester_id || !Array.isArray(courses) || courses.length === 0) {
    return res.status(400).json({ message: "No courses provided" });
  }

  try {
    const semesterIsValid = await isSemesterOwnedByUser(semester_id, req.userId!);

    if (!semesterIsValid) {
      return res.status(400).json({ message: "Invalid semester" });
    }

    const insertedCourses = [];

    for (const course of courses) {
      const { course_code, course_title, credit_units, score } = course;

      if (!course_code || !course_title || (credit_units !== 0 && !credit_units)) {
        return res.status(400).json({ message: "Invalid course data" });
      }

      const { numericScore, grade, grade_point } = getGradeFields(score);
      const result = await pool.query(
        `INSERT INTO courses (user_id, semester_id, course_code, course_title, credit_units, score, grade, grade_point)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          req.userId,
          semester_id,
          formatCourseCode(course_code),
          formatCourseTitle(course_title),
          parseInt(credit_units),
          numericScore,
          grade,
          grade_point,
        ],
      );
      insertedCourses.push(result.rows[0]);
    }

    res.status(201).json(insertedCourses);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err });
  }
});

// Update course
router.put("/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { course_code, course_title, credit_units, score } = req.body;
  try {
    const { numericScore, grade, grade_point } = getGradeFields(score);

    const result = await pool.query(
      `UPDATE courses SET course_code=$1, course_title=$2, credit_units=$3, score=$4, grade=$5, grade_point=$6
       WHERE id=$7 AND user_id=$8 RETURNING *`,
      [
        formatCourseCode(course_code),
        formatCourseTitle(course_title),
        credit_units,
        numericScore,
        grade,
        grade_point,
        id,
        req.userId,
      ],
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err });
  }
});

// Delete course
router.delete(
  "/:id",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    try {
      await pool.query("DELETE FROM courses WHERE id = $1 AND user_id = $2", [
        id,
        req.userId,
      ]);
      res.json({ message: "Course deleted" });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err });
    }
  },
);

export default router;
