-- Adds 'unreadable' as a valid classification_status for inbox_items.
-- Used when a file (e.g. image-only PDF) cannot be read by text extraction
-- or Anthropic vision, so the user can assign it manually.
ALTER TABLE inbox_items DROP CONSTRAINT IF EXISTS inbox_items_classification_status_check;
ALTER TABLE inbox_items ADD CONSTRAINT inbox_items_classification_status_check
  CHECK (classification_status IN ('pending', 'classified', 'unassigned', 'failed', 'unreadable'));
