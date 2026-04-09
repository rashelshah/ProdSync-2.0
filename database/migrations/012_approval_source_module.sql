-- Migration 012: Add source_module to approvals table for global approval unification
-- This column tracks which module created the approval entry

ALTER TABLE public.approvals
  ADD COLUMN IF NOT EXISTS source_module text;

-- Backfill existing rows based on department / approvable_table hints
UPDATE public.approvals
  SET source_module = CASE
    WHEN approvable_table = 'camera_requests' THEN 'camera'
    WHEN approvable_table = 'expenses' AND department = 'art' THEN 'art'
    WHEN approvable_table = 'expenses' THEN 'expenses'
    WHEN department = 'transport' THEN 'transport'
    WHEN department = 'camera' THEN 'camera'
    WHEN department = 'art' THEN 'art'
    WHEN department = 'wardrobe' THEN 'wardrobe'
    ELSE department::text
  END
WHERE source_module IS NULL;

-- Index for filtering by module in the approval center
CREATE INDEX IF NOT EXISTS idx_approvals_source_module
  ON public.approvals (project_id, source_module)
  WHERE source_module IS NOT NULL;
