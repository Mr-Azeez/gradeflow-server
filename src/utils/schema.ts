import pool from "../db";

export const tableHasColumn = async (
  tableName: string,
  columnName: string,
) => {
  const result = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1
       AND column_name = $2
     LIMIT 1`,
    [tableName, columnName],
  );

  return result.rows.length > 0;
};
