"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tableHasColumn = void 0;
const db_1 = __importDefault(require("../db"));
const tableHasColumn = async (tableName, columnName) => {
    const result = await db_1.default.query(`SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1
       AND column_name = $2
     LIMIT 1`, [tableName, columnName]);
    return result.rows.length > 0;
};
exports.tableHasColumn = tableHasColumn;
