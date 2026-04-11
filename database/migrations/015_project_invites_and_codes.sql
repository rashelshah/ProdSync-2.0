-- Migration: Add private invite tokens and project codes

ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS invite_token TEXT,
ADD COLUMN IF NOT EXISTS project_code TEXT,
ADD COLUMN IF NOT EXISTS invite_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- Backfill existing projects: generate unique invite_token and project_code for each
DO $$
DECLARE
  proj RECORD;
  new_code TEXT;
  code_exists BOOLEAN;
  attempt INT;
BEGIN
  FOR proj IN SELECT id FROM public.projects WHERE invite_token IS NULL OR project_code IS NULL LOOP
    -- Generate invite_token if missing
    IF proj.invite_token IS NULL THEN
      UPDATE public.projects SET invite_token = gen_random_uuid()::text WHERE id = proj.id;
    END IF;

    -- Generate unique project_code with retry
    IF proj.project_code IS NULL THEN
      attempt := 0;
      LOOP
        new_code := UPPER(SUBSTRING(MD5(proj.id::text || RANDOM()::text || attempt::text), 1, 8));
        SELECT EXISTS(SELECT 1 FROM public.projects WHERE project_code = new_code) INTO code_exists;
        EXIT WHEN NOT code_exists;
        attempt := attempt + 1;
        EXIT WHEN attempt > 10;
      END LOOP;
      UPDATE public.projects SET project_code = new_code WHERE id = proj.id;
    END IF;
  END LOOP;
END $$;

-- Add UNIQUE constraints (after backfill to avoid conflicts)
ALTER TABLE public.projects
DROP CONSTRAINT IF EXISTS projects_invite_token_key;
ALTER TABLE public.projects
ADD CONSTRAINT projects_invite_token_key UNIQUE (invite_token);

ALTER TABLE public.projects
DROP CONSTRAINT IF EXISTS projects_project_code_key;
ALTER TABLE public.projects
ADD CONSTRAINT projects_project_code_key UNIQUE (project_code);

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_invite_token ON public.projects(invite_token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_project_code ON public.projects(project_code);

