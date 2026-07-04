import pool from "../db";

export const VALID_SEMESTER_LEVELS = [100, 200, 300, 400, 500, 600] as const;
export const VALID_SEMESTER_NUMBERS = [1, 2] as const;

export const getCurrentSemesterForUser = async (userId: string) => {
  const result = await pool.query(
    `SELECT *
     FROM semesters
     WHERE user_id = $1
     ORDER BY level DESC, semester_number DESC
     LIMIT 1`,
    [userId],
  );

  return result.rows[0] ?? null;
};

