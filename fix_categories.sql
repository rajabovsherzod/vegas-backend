-- Barcha mavjud kategoriyalarni active qilish
UPDATE categories 
SET is_active = true, is_deleted = false 
WHERE is_active IS NULL OR is_deleted IS NULL;
