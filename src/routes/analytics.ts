import { Router, Response } from "express";
import pool from "../db";
import authMiddleware, { AuthRequest } from "../middleware/auth";
import { getCurrentSemesterForUser } from "../utils/semester";

const router = Router();

// Calculate GPA for a list of courses
const calculateGPA = (courses: any[]): number => {
  const gradedCourses = courses.filter(
    (c: any) => c.grade_point != null && c.grade_point !== "",
  );
  const totalPoints = gradedCourses.reduce(
    (sum: number, c: any) =>
      sum + parseFloat(c.grade_point) * parseInt(c.credit_units),
    0,
  );
  const totalUnits = gradedCourses.reduce(
    (sum: number, c: any) => sum + parseInt(c.credit_units),
    0,
  );
  return totalUnits === 0
    ? 0
    : parseFloat((totalPoints / totalUnits).toFixed(2));
};

const roundToTwo = (value: number): number => parseFloat(value.toFixed(2));

/** Maps a CGPA to its classification label. */
const getClassificationLabel = (cgpa: number): string => {
  if (cgpa >= 4.5) return "First Class";
  if (cgpa >= 3.5) return "Second Class Upper";
  if (cgpa >= 2.4) return "Second Class Lower";
  if (cgpa >= 1.5) return "Third Class";
  return "Pass";
};

const getClassificationRank = (label: string): number => {
  if (label === "First Class") return 4;
  if (label === "Second Class Upper") return 3;
  if (label === "Second Class Lower") return 2;
  if (label === "Third Class") return 1;
  return 0;
};

// Get full analytics for logged in user
router.get("/", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    // Get all semesters
    const semestersResult = await pool.query(
      "SELECT * FROM semesters WHERE user_id = $1 ORDER BY level ASC, semester_number ASC",
      [req.userId],
    );
    const semesters = semestersResult.rows;

    // Get all courses
    const coursesResult = await pool.query(
      "SELECT * FROM courses WHERE user_id = $1",
      [req.userId],
    );
    const allCourses = coursesResult.rows;
    const currentSemester = await getCurrentSemesterForUser(req.userId!);
    const currentSemesterId = currentSemester?.id ?? null;

    // GPA per semester
    const semesterGPAs = semesters.map((sem: any) => {
      const semCourses = allCourses.filter(
        (c: any) => c.semester_id === sem.id,
      );
      const gradedCourses = semCourses.filter(
        (c: any) => c.grade_point != null && c.grade_point !== "",
      );
      return {
        semester_id: sem.id,
        semester_name: sem.name,
        academic_year: sem.academic_year,
        level: sem.level,
        semester_number: sem.semester_number,
        gpa: calculateGPA(semCourses),
        total_units: semCourses.reduce(
          (sum: number, c: any) => sum + parseInt(c.credit_units),
          0,
        ),
        courses_count: semCourses.length,
        graded_courses_count: gradedCourses.length,
      };
    });

    // CGPA = all courses combined
    const cgpa = calculateGPA(allCourses);
    const currentSemesterGPA = currentSemester
      ? semesterGPAs.find((semester) => semester.semester_id === currentSemester.id) ||
        null
      : null;
    const currentSemesterGradedCourses = currentSemesterGPA?.graded_courses_count ?? 0;
    const completedSemestersCount = currentSemesterId
      ? Math.max(semesterGPAs.length - 1, 0)
      : semesterGPAs.length;

    // Total credit units earned (exclude F grades)
    const totalUnitsEarned = allCourses
      .filter((c: any) => c.grade && c.grade !== "F")
      .reduce((sum: number, c: any) => sum + parseInt(c.credit_units), 0);

    // Best and worst semester
    const rankedSemesters = [...semesterGPAs]
      .filter((s) => s.graded_courses_count > 0)
      .sort((a, b) => b.gpa - a.gpa);
    const bestSemester = rankedSemesters[0] || null;
    const worstSemester = rankedSemesters[rankedSemesters.length - 1] || null;

    res.json({
      cgpa,
      total_units_earned: totalUnitsEarned,
      total_courses: allCourses.length,
      completed_semesters_count: completedSemestersCount,
      semester_gpas: semesterGPAs,
      current_semester: currentSemester
        ? {
            id: currentSemester.id,
            name: currentSemester.name,
            level: currentSemester.level,
            semester_number: currentSemester.semester_number,
            academic_year: currentSemester.academic_year,
            target_gpa: currentSemester.target_gpa ?? null,
            gpa: currentSemesterGPA?.gpa ?? 0,
            courses_count: currentSemesterGPA?.courses_count ?? 0,
            graded_courses_count: currentSemesterGradedCourses,
            total_units: currentSemesterGPA?.total_units ?? 0,
          }
        : null,
      best_semester: bestSemester,
      worst_semester: worstSemester,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err });
  }
});

// What-if calculator (legacy — kept for backward compatibility)
router.post(
  "/whatif",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      // Get all existing courses
      const coursesResult = await pool.query(
        "SELECT * FROM courses WHERE user_id = $1",
        [req.userId],
      );
      const existingCourses = coursesResult.rows;

      // Hypothetical courses from request body
      const { hypothetical_courses } = req.body;
      // Format: [{ credit_units: 3, grade_point: 5.0 }, ...]

      if (!Array.isArray(hypothetical_courses)) {
        return res.status(400).json({
          message: "hypothetical_courses must be an array",
        });
      }

      for (const [index, course] of hypothetical_courses.entries()) {
        const creditUnits = course?.credit_units;
        const gradePoint = course?.grade_point;
        const creditUnitsValid =
          typeof creditUnits === "number" &&
          Number.isFinite(creditUnits) &&
          creditUnits >= 0;
        const gradePointValid =
          typeof gradePoint === "number" &&
          Number.isFinite(gradePoint) &&
          gradePoint >= 0 &&
          gradePoint <= 5;

        if (!creditUnitsValid || !gradePointValid) {
          return res.status(400).json({
            message: `Invalid hypothetical course at index ${index}`,
          });
        }
      }

      const allCourses = [...existingCourses, ...hypothetical_courses];
      const projectedCGPA = calculateGPA(allCourses);
      const currentCGPA = calculateGPA(existingCourses);

      res.json({
        current_cgpa: currentCGPA,
        projected_cgpa: projectedCGPA,
        difference: parseFloat((projectedCGPA - currentCGPA).toFixed(2)),
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err });
    }
  },
);

// ─── What-If v2: List all semesters for selector dropdowns ───────────────────
router.get(
  "/whatif/semesters",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const semestersResult = await pool.query(
        `SELECT id, name, level, semester_number, academic_year
         FROM semesters
         WHERE user_id = $1
         ORDER BY level ASC, semester_number ASC`,
        [req.userId],
      );

      const currentSemester = await getCurrentSemesterForUser(req.userId!);
      const currentSemesterId = currentSemester?.id ?? null;

      const semesters = semestersResult.rows.map((sem: any) => ({
        id: sem.id,
        label: `${sem.level} Level – Semester ${sem.semester_number}`,
        level: sem.level,
        semester_number: sem.semester_number,
        academic_year: sem.academic_year,
        is_current: sem.id === currentSemesterId,
      }));

      res.json({ semesters, currentSemesterId });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err });
    }
  },
);

// ─── What-If v2 Mode A: Simulate swapping one past course grade ──────────────
router.get(
  "/whatif/simulate-past",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    const courseId = String(req.query.courseId ?? "");
    const hypotheticalGP = parseFloat(String(req.query.hypotheticalGP ?? ""));

    if (!courseId) {
      return res.status(400).json({ message: "courseId is required" });
    }
    if (Number.isNaN(hypotheticalGP) || hypotheticalGP < 0 || hypotheticalGP > 5) {
      return res.status(400).json({ message: "Invalid hypotheticalGP (must be 0–5)" });
    }

    try {
      // Verify the course belongs to this user and fetch its details
      const courseResult = await pool.query(
        `SELECT c.id, c.course_code, c.course_title, c.credit_units, c.grade_point, c.grade, c.semester_id
         FROM courses c
         WHERE c.id = $1 AND c.user_id = $2`,
        [courseId, req.userId],
      );

      if (courseResult.rows.length === 0) {
        return res.status(404).json({ message: "Course not found" });
      }

      const targetCourse = courseResult.rows[0];
      const courseUnits = parseInt(targetCourse.credit_units);
      const originalGP = parseFloat(targetCourse.grade_point);

      // Get all graded courses across all semesters
      const allGradedResult = await pool.query(
        `SELECT id, credit_units, grade_point
         FROM courses
         WHERE user_id = $1
           AND grade IS NOT NULL
           AND grade <> ''
           AND grade_point IS NOT NULL`,
        [req.userId],
      );
      const allGraded = allGradedResult.rows;

      // Compute actual total quality points and total completed units
      const actualTotalPoints = allGraded.reduce(
        (sum: number, c: any) =>
          sum + parseFloat(c.grade_point) * parseInt(c.credit_units),
        0,
      );
      const totalCompletedUnits = allGraded.reduce(
        (sum: number, c: any) => sum + parseInt(c.credit_units),
        0,
      );

      if (totalCompletedUnits === 0) {
        return res.status(400).json({ message: "No completed courses to simulate" });
      }

      const originalCGPA = roundToTwo(actualTotalPoints / totalCompletedUnits);

      // Substitute this course's original contribution with the hypothetical one
      const originalContribution = originalGP * courseUnits;
      const hypotheticalContribution = hypotheticalGP * courseUnits;
      const simulatedTotalPoints =
        actualTotalPoints - originalContribution + hypotheticalContribution;
      const simulatedCGPA = roundToTwo(simulatedTotalPoints / totalCompletedUnits);
      const difference = roundToTwo(simulatedCGPA - originalCGPA);

      res.json({
        originalCGPA,
        simulatedCGPA,
        difference,
        originalGP: roundToTwo(originalGP),
        originalGrade: targetCourse.grade,
        courseUnits,
        classification: getClassificationLabel(simulatedCGPA),
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err });
    }
  },
);

// ─── What-If v2 Mode B: Load current semester courses for projection ──────────
router.get(
  "/whatif/current-semester",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const currentSemester = await getCurrentSemesterForUser(req.userId!);

      if (!currentSemester) {
        return res.json({
          currentSemester: null,
          courses: [],
          previousTotalPoints: 0,
          completedUnits: 0,
          currentCGPA: 0,
        });
      }

      // All courses in the current semester (graded or not — student projects all of them)
      const currentCoursesResult = await pool.query(
        `SELECT id, course_code, course_title, credit_units, grade, grade_point
         FROM courses
         WHERE user_id = $1 AND semester_id = $2
         ORDER BY created_at ASC`,
        [req.userId, currentSemester.id],
      );

      // Graded courses from completed (non-current) semesters only
      const completedGradedResult = await pool.query(
        `SELECT credit_units, grade_point
         FROM courses
         WHERE user_id = $1
           AND semester_id <> $2
           AND grade IS NOT NULL
           AND grade <> ''
           AND grade_point IS NOT NULL`,
        [req.userId, currentSemester.id],
      );
      const completedGraded = completedGradedResult.rows;

      const previousTotalPoints = completedGraded.reduce(
        (sum: number, c: any) =>
          sum + parseFloat(c.grade_point) * parseInt(c.credit_units),
        0,
      );
      const completedUnits = completedGraded.reduce(
        (sum: number, c: any) => sum + parseInt(c.credit_units),
        0,
      );

      const currentCGPA =
        completedUnits === 0 ? 0 : roundToTwo(previousTotalPoints / completedUnits);

      res.json({
        currentSemester: {
          id: currentSemester.id,
          name: currentSemester.name,
          level: currentSemester.level,
          semester_number: currentSemester.semester_number,
          label: `${currentSemester.level} Level – Semester ${currentSemester.semester_number}`,
        },
        courses: currentCoursesResult.rows.map((c: any) => ({
          id: c.id,
          course_code: c.course_code,
          course_title: c.course_title,
          credit_units: parseInt(c.credit_units),
          grade: c.grade ?? null,
          grade_point: c.grade_point != null ? parseFloat(c.grade_point) : null,
        })),
        previousTotalPoints: roundToTwo(previousTotalPoints),
        completedUnits,
        currentCGPA,
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err });
    }
  },
);

// ─── What-If v2: Courses for a specific semester ──────────────────────────────
router.get(
  "/whatif/semester-courses/:semesterId",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    const { semesterId } = req.params;
    try {
      // Verify semester belongs to user
      const semResult = await pool.query(
        "SELECT id FROM semesters WHERE id = $1 AND user_id = $2",
        [semesterId, req.userId],
      );
      if (semResult.rows.length === 0) {
        return res.status(404).json({ message: "Semester not found" });
      }

      const coursesResult = await pool.query(
        `SELECT id, course_code, course_title, credit_units, grade, grade_point
         FROM courses
         WHERE semester_id = $1 AND user_id = $2
           AND grade IS NOT NULL AND grade <> '' AND grade_point IS NOT NULL
         ORDER BY created_at ASC`,
        [semesterId, req.userId],
      );

      res.json({
        courses: coursesResult.rows.map((c: any) => ({
          id: c.id,
          course_code: c.course_code,
          course_title: c.course_title,
          credit_units: parseInt(c.credit_units),
          grade: c.grade,
          grade_point: parseFloat(c.grade_point),
        })),
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err });
    }
  },
);

// Graduation target checker
router.get(
  "/graduation-target",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    const targetCGPA = parseFloat(String(req.query.targetCGPA));

    if (Number.isNaN(targetCGPA) || targetCGPA < 0 || targetCGPA > 5) {
      return res.status(400).json({ message: "Invalid targetCGPA" });
    }

    try {
      const latestSemester = await getCurrentSemesterForUser(req.userId!);

      const completedCoursesResult = latestSemester
        ? await pool.query(
            `SELECT * FROM courses
             WHERE user_id = $1
               AND semester_id <> $2
               AND grade IS NOT NULL
               AND grade <> ''
               AND grade_point IS NOT NULL`,
            [req.userId, latestSemester.id],
          )
        : await pool.query(
            `SELECT * FROM courses
             WHERE user_id = $1
               AND grade IS NOT NULL
               AND grade <> ''
               AND grade_point IS NOT NULL`,
            [req.userId],
          );
      const completedCourses = completedCoursesResult.rows;

      const finalSemesterCoursesResult = latestSemester
        ? await pool.query(
            `SELECT id, course_code, course_title, credit_units
             FROM courses
             WHERE user_id = $1
               AND semester_id = $2
               AND (grade IS NULL OR grade = '' OR grade_point IS NULL)
             ORDER BY created_at ASC`,
            [req.userId, latestSemester.id],
          )
        : { rows: [] };
      const finalSemesterCourses = finalSemesterCoursesResult.rows;

      const totalQualityPoints = completedCourses.reduce(
        (sum: number, course: any) =>
          sum + parseFloat(course.grade_point) * parseInt(course.credit_units),
        0,
      );
      const totalCreditUnits = completedCourses.reduce(
        (sum: number, course: any) => sum + parseInt(course.credit_units),
        0,
      );
      const finalSemesterCreditUnits = finalSemesterCourses.reduce(
        (sum: number, course: any) => sum + parseInt(course.credit_units),
        0,
      );

      const currentCGPA =
        totalCreditUnits === 0
          ? 0
          : roundToTwo(totalQualityPoints / totalCreditUnits);
      const totalGraduationUnits =
        totalCreditUnits + finalSemesterCreditUnits;
      const requiredQualityPoints =
        targetCGPA * totalGraduationUnits - totalQualityPoints;

      // rawRequired is the un-clamped GP needed; may be negative (target already secured)
      // or > 5 (mathematically impossible).
      const rawRequired: number | null =
        finalSemesterCreditUnits === 0
          ? targetCGPA <= currentCGPA
            ? 0
            : null // no final units and target not yet met → indeterminate
          : requiredQualityPoints / finalSemesterCreditUnits;

      // Minimum passing grade is E (GP = 1.0). F grades mean failure — never a valid target.
      const requiredAverageGP: number | null =
        rawRequired === null
          ? null
          : Math.max(1.0, rawRequired);

      const maxAchievableCGPA =
        totalGraduationUnits === 0
          ? 0
          : roundToTwo(
              (totalQualityPoints + finalSemesterCreditUnits * 5) /
                totalGraduationUnits,
            );

      // Minimum achievable CGPA: every ungraded course receives E (GP = 1.0).
      // This is the floor — the worst outcome a passing student can reach.
      const minAchievableCGPA =
        totalGraduationUnits === 0
          ? 0
          : roundToTwo(
              (totalQualityPoints + finalSemesterCreditUnits * 1.0) /
                totalGraduationUnits,
            );

      // Derive the classification guaranteed by minimum performance
      const guaranteedClassification = getClassificationLabel(minAchievableCGPA);
      const selectedClassification = getClassificationLabel(targetCGPA);

      const guaranteedRank = getClassificationRank(guaranteedClassification);
      const selectedRank = getClassificationRank(selectedClassification);

      // ── Four-state feasibility status ──────────────────────────────────────
      // NOT_ACHIEVABLE      — even all-A performance cannot reach the target
      // ALREADY_SECURED     — passing everything guarantees exactly the selected target class
      // ALREADY_SECURED_HIGHER — passing everything guarantees a *higher* class than selected
      // ACHIEVABLE          — student must actively aim for requiredAverageGP (≥ 1.0)
      type FeasibilityStatus =
        | "ACHIEVABLE"
        | "ALREADY_SECURED"
        | "ALREADY_SECURED_HIGHER"
        | "NOT_ACHIEVABLE";

      let status: FeasibilityStatus;

      if (selectedRank < guaranteedRank) {
        status = "ALREADY_SECURED_HIGHER";
      } else if (selectedRank === guaranteedRank) {
        status = "ALREADY_SECURED";
      } else if (maxAchievableCGPA < targetCGPA) {
        status = "NOT_ACHIEVABLE";
      } else {
        status = "ACHIEVABLE";
      }

      res.json({
        targetCGPA: roundToTwo(targetCGPA),
        currentCGPA,
        totalCreditUnits,
        finalSemesterCreditUnits,
        rawRequired: rawRequired !== null ? roundToTwo(rawRequired) : null,
        requiredAverageGP:
          status === "NOT_ACHIEVABLE"
            ? null
            : requiredAverageGP !== null
              ? roundToTwo(requiredAverageGP)
              : null,
        maxAchievableCGPA,
        minAchievableCGPA,
        status,
        guaranteedClassification,
        currentSemesterId: latestSemester?.id ?? null,
        finalSemesterCourses: finalSemesterCourses.map((course: any) => ({
          id: course.id,
          course_code: course.course_code,
          course_title: course.course_title,
          credit_units: parseInt(course.credit_units),
          // NOT_ACHIEVABLE → null (shown as "—"); otherwise floor at 1.0 (E minimum)
          requiredGradePoint:
            status === "NOT_ACHIEVABLE"
              ? null
              : requiredAverageGP !== null
                ? roundToTwo(Math.min(Math.max(requiredAverageGP, 1.0), 5))
                : null,
        })),
      });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err });
    }
  },
);

export default router;
