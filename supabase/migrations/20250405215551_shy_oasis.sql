/*
  # Fix workflow logs RLS policies

  1. Changes
    - Drop existing policies
    - Create new comprehensive policy that allows:
      - Workflow owners to manage logs
      - Users with workflow access to view logs
    
  2. Security
    - Maintain RLS enabled
    - Ensure proper access control
*/

-- Drop existing policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can manage workflow logs" ON workflow_logs;
  DROP POLICY IF EXISTS "Users can insert logs for their workflows" ON workflow_logs;
  DROP POLICY IF EXISTS "Users can read logs for their workflows" ON workflow_logs;
  DROP POLICY IF EXISTS "Users can view their workflow logs" ON workflow_logs;
  DROP POLICY IF EXISTS "Users can insert logs for workflows" ON workflow_logs;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Make sure RLS is enabled
ALTER TABLE workflow_logs ENABLE ROW LEVEL SECURITY;

-- Create comprehensive policy for workflow logs
CREATE POLICY "Users can manage workflow logs"
ON workflow_logs
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workflows
    WHERE workflows.id = workflow_logs.workflow_id
    AND (
      -- User owns the workflow
      workflows.created_by = auth.uid()
      OR
      -- User has been granted access to the workflow
      EXISTS (
        SELECT 1 FROM user_workflows
        WHERE user_workflows.workflow_id = workflows.id
        AND user_workflows.user_id = auth.uid()
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM workflows
    WHERE workflows.id = workflow_logs.workflow_id
    AND (
      -- User owns the workflow
      workflows.created_by = auth.uid()
      OR
      -- User has been granted access to the workflow
      EXISTS (
        SELECT 1 FROM user_workflows
        WHERE user_workflows.workflow_id = workflows.id
        AND user_workflows.user_id = auth.uid()
      )
    )
  )
);