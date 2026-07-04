import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../db";

const router = Router();

// Register
router.post("/register", async (req: Request, res: Response) => {
  const { name, email, password, matric_number, level, department } = req.body;

  try {
    const userExists = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email],
    );
    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, matric_number, level, department)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, avatar_url`,
      [name, email, password_hash, matric_number, level, department],
    );

    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
      expiresIn: "7d",
    });

    res.status(201).json({ token, user });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err });
  }
});

// Login
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    if (result.rows.length === 0) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
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
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err });
  }
});

export default router;
