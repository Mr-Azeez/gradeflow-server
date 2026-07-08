import { Router, Response } from "express";
import multer from "multer";
import pool from "../db";
import { AuthRequest } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { tableHasColumn } from "../utils/schema";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only JPEG, PNG, or WebP images are allowed"));
    }
    cb(null, true);
  },
});

const getAvatarStoragePath = (avatarUrl: string) => {
  try {
    const parsed = new URL(avatarUrl);
    const prefix = "/storage/v1/object/public/avatars/";
    const path = parsed.pathname.startsWith(prefix)
      ? parsed.pathname.slice(prefix.length)
      : null;
    return path ? decodeURIComponent(path) : null;
  } catch {
    return null;
  }
};

// GET /api/users/me — fetch current user profile + semesters with target_gpa
router.get("/me", async (req: AuthRequest, res: Response) => {
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ message: "No user found" });
  }

  try {
    const userResult = await pool.query(
      "SELECT id, name, matric_number, level, department, avatar_url FROM users WHERE id = $1",
      [userId],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const semestersHaveTargetGpa = await tableHasColumn(
      "semesters",
      "target_gpa",
    );

    const semestersResult = await pool.query(
      `SELECT id, name, level, semester_number, academic_year, is_current, ${
        semestersHaveTargetGpa
          ? "target_gpa"
          : "NULL::numeric AS target_gpa"
      }
       FROM semesters
       WHERE user_id = $1
       ORDER BY level ASC, semester_number ASC`,
      [userId],
    );

    const semestersWithGPAResult = await pool.query(
      `SELECT
         s.id,
         s.name,
         s.level,
         s.semester_number,
         s.academic_year,
         s.is_current,
         ${semestersHaveTargetGpa ? "s.target_gpa" : "NULL::numeric AS target_gpa"},
         CASE
           WHEN SUM(CASE WHEN c.grade_point IS NOT NULL THEN c.credit_units ELSE 0 END) = 0
             THEN NULL
           ELSE ROUND(
             SUM(CASE WHEN c.grade_point IS NOT NULL THEN c.grade_point * c.credit_units ELSE 0 END)::numeric
             / NULLIF(SUM(CASE WHEN c.grade_point IS NOT NULL THEN c.credit_units ELSE 0 END), 0),
             2
           )
         END AS actual_gpa
       FROM semesters s
       LEFT JOIN courses c
         ON c.semester_id = s.id
        AND c.user_id = $2
       WHERE s.user_id = $1
       GROUP BY s.id, s.name, s.level, s.semester_number, s.academic_year, s.is_current${semestersHaveTargetGpa ? ", s.target_gpa" : ""}
       ORDER BY s.level ASC, s.semester_number ASC`,
      [userId, userId],
    );

    const semestersWithGPA = semestersWithGPAResult.rows.map((sem: any) => ({
      ...sem,
      actual_gpa: sem.actual_gpa == null ? null : Number(sem.actual_gpa),
    }));

    res.json({
      user: userResult.rows[0],
      semesters: semestersWithGPA,
    });
  } catch (err) {
    console.error("GET /api/users/me failed:", err);
    res.status(500).json({ message: "Server error", error: err });
  }
});

// POST /api/users/me/avatar — upload or replace profile picture
router.post(
  "/me/avatar",
  upload.single("avatar"),
  async (req: AuthRequest, res: Response) => {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ message: "No user found" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    try {
      const existingAvatarResult = await pool.query(
        "SELECT avatar_url FROM users WHERE id = $1",
        [userId],
      );
      const existingAvatarUrl = existingAvatarResult.rows[0]?.avatar_url ?? null;

      const fileExt = req.file.originalname.split(".").pop() || "png";
      const filePath = `${userId}/avatar.${fileExt}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("avatars")
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: true,
        });

      if (uploadError) {
        return res
          .status(500)
          .json({ message: "Upload failed", error: uploadError.message });
      }

      const { data: publicUrlData } = supabaseAdmin.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const avatarUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

      const previousPath = existingAvatarUrl
        ? getAvatarStoragePath(existingAvatarUrl)
        : null;
      if (previousPath && previousPath !== filePath) {
        await supabaseAdmin.storage.from("avatars").remove([previousPath]);
      }

      await pool.query("UPDATE users SET avatar_url = $1 WHERE id = $2", [
        avatarUrl,
        userId,
      ]);

      res.json({ avatar_url: avatarUrl });
    } catch (err) {
      res.status(500).json({ message: "Server error", error: err });
    }
  },
);

// DELETE /api/users/me/avatar — remove profile picture
router.delete("/me/avatar", async (req: AuthRequest, res: Response) => {
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ message: "No user found" });
  }

  try {
    const existingAvatarResult = await pool.query(
      "SELECT avatar_url FROM users WHERE id = $1",
      [userId],
    );
    const existingAvatarUrl = existingAvatarResult.rows[0]?.avatar_url ?? null;
    const storagePath = existingAvatarUrl
      ? getAvatarStoragePath(existingAvatarUrl)
      : null;

    if (storagePath) {
      await supabaseAdmin.storage.from("avatars").remove([storagePath]);
    }

    await pool.query("UPDATE users SET avatar_url = NULL WHERE id = $1", [
      userId,
    ]);
    res.json({ message: "Avatar removed" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err });
  }
});

// PATCH /api/users/me — update name, matric_number, department
router.patch("/me", async (req: AuthRequest, res: Response) => {
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ message: "No user found" });
  }

  const { name, matric_number, department } = req.body;

  if (!name || typeof name !== "string" || name.trim() === "") {
    return res.status(400).json({ message: "Name is required" });
  }

  try {
    const result = await pool.query(
      `UPDATE users
       SET name = $1, matric_number = $2, department = $3
       WHERE id = $4
       RETURNING id, name, matric_number, department, avatar_url`,
      [name.trim(), matric_number ?? null, department ?? null, userId],
    );

    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err });
  }
});

export default router;
