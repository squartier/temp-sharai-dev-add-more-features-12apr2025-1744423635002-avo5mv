/*
  # Fix workflow logs RLS policies

  1. Changes
    - Drop existing policies if they exist
    - Recreate policies with proper checks
    - Ensure workflow owners can manage their logs
    
  2. Security
    - Maintain RLS enabled
    - Add proper ownership checks
*/

-- First drop existing policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can insert logs for their workflows" ON workflow_logs;
  DROP POLICY IF EXISTS "Users can read logs for their workflows" ON workflow_logs;
  DROP POLICY IF EXISTS "Users can view their workflow logs" ON workflow_logs;
  DROP POLICY IF EXISTS "Users can insert logs for workflows" ON workflow_logs;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Make sure RLS is enabled
ALTER TABLE workflow_logs ENABLE ROW LEVEL SECURITY;

-- Create new policies with proper checks
CREATE POLICY "Users can manage workflow logs"
ON workflow_logs
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workflows
    WHERE workflows.id = workflow_logs.workflow_id
    AND workflows.created_by = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM workflows
    WHERE workflows.id = workflow_logs.workflow_id
    AND workflows.created_by = auth.uid()
  )
);