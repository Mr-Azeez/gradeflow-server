ALTER TABLE semesters ADD COLUMN IF NOT EXISTS level INTEGER;
ALTER TABLE semesters ADD COLUMN IF NOT EXISTS semester_number INTEGER;

UPDATE semesters
SET name = (level || 'L - ' || (CASE WHEN semester_number = 1 THEN 'First Semester' ELSE 'Second Semester' END));
