-- Clear test data from applications and enquiries tables
-- This removes all test submissions to keep the admin panel clean

DELETE FROM applications;
DELETE FROM enquiries;

-- Verify tables are empty
SELECT 'applications' AS table_name, COUNT(*) AS row_count FROM applications
UNION ALL
SELECT 'enquiries', COUNT(*) FROM enquiries;
