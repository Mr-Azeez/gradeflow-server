"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentSemesterForUser = exports.VALID_SEMESTER_NUMBERS = exports.VALID_SEMESTER_LEVELS = void 0;
const db_1 = __importDefault(require("../db"));
exports.VALID_SEMESTER_LEVELS = [100, 200, 300, 400, 500, 600];
exports.VALID_SEMESTER_NUMBERS = [1, 2];
const getCurrentSemesterForUser = async (userId) => {
    const result = await db_1.default.query(`SELECT *
     FROM semesters
     WHERE user_id = $1
     ORDER BY level DESC, semester_number DESC
     LIMIT 1`, [userId]);
    return result.rows[0] ?? null;
};
exports.getCurrentSemesterForUser = getCurrentSemesterForUser;
