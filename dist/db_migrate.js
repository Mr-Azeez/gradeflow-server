"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = __importDefault(require("./db"));
async function run() {
    try {
        console.log("Running migration...");
        await db_1.default.query(`
      UPDATE semesters
      SET name = (level || 'L - ' || (CASE WHEN semester_number = 1 THEN 'First Semester' ELSE 'Second Semester' END));
    `);
        console.log("Migration finished.");
        console.log("Running verification query...");
        const res = await db_1.default.query(`
      SELECT id, level, semester_number, name
      FROM semesters;
    `);
        console.log("MIGRATION_VERIFICATION_RESULTS:");
        console.log(JSON.stringify(res.rows, null, 2));
    }
    catch (err) {
        console.error("Error executing migration/verification:", err);
    }
    finally {
        await db_1.default.end();
    }
}
run();
