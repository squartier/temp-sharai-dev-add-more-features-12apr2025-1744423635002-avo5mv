/*
  # Add RLS policies for workflow logs

  1. Changes
    - Add RLS policies to allow users to create and view logs for workflows they have access to
    - Users can create logs for workflows they:
      - Own
      - Are assigned to via user_workflows
      - Have admin access to
    - Users can view logs for workflows they have access to

  2. Security
    - Enable RLS on workflow_logs table (if not already enabled)
    - Add policies for INSERT and SELECT operations
    - Ensure policies respect workflow access permissions
*/

-- Enable RLS on workflow_logs table if not already enabled
ALTER TABLE workflow_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can manage workflow logs" ON workflow_logs;

-- Allow users to create logs for workflows they have access to
CREATE POLICY "Users can create workflow logs"
ON workflow_logs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM workflows
    WHERE workflows.id = workflow_logs.workflow_id
    AND (
      -- User owns the workflow
      workflows.created_by = auth.uid()
      OR
      -- User is assigned to the workflow
      EXISTS (
        SELECT 1 FROM user_workflows
        WHERE user_workflows.workflow_id = workflows.id
        AND user_workflows.user_id = auth.uid()
      )
      OR
      -- User is an admin
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
      )
    )
  )
);

-- Allow users to view logs for workflows they have access to
CREATE POLICY "Users can view workflow logs"
ON workflow_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workflows
    WHERE workflows.id = workflow_logs.workflow_id
    AND (
      -- User owns the workflow
      workflows.created_by = auth.uid()
      OR
      -- User is assigned to the workflow
      EXISTS (
        SELECT 1 FROM user_workflows
        WHERE user_workflows.workflow_id = workflows.id
        AND user_workflows.user_id = auth.uid()
      )
      OR
      -- User is an admin
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
      )
    )
  )
);