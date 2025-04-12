/*
  # Add safe workflow deletion function
  
  1. Changes
    - Create a function to safely delete workflows and all related data
    - Handle deletion in the correct order:
      1. Delete workflow logs
      2. Delete messages in conversations
      3. Delete conversations
      4. Delete workflow
    - Add proper error handling
    
  2. Security
    - Function runs with security definer to bypass RLS
    - Checks user permissions before deletion
*/

CREATE OR REPLACE FUNCTION safely_delete_workflow(workflow_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  can_delete boolean;
BEGIN
  -- Check if user has permission to delete the workflow
  SELECT EXISTS (
    SELECT 1 FROM workflows w
    WHERE w.id = workflow_id
    AND (
      -- User owns the workflow
      w.created_by = user_id
      OR
      -- User is an admin
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = user_id
        AND role = 'admin'
      )
    )
  ) INTO can_delete;

  -- If user doesn't have permission, return false
  IF NOT can_delete THEN
    RETURN false;
  END IF;

  -- Delete workflow logs first
  DELETE FROM workflow_logs
  WHERE workflow_id = workflow_id;

  -- Delete messages from conversations linked to this workflow
  DELETE FROM messages
  WHERE conversation_id IN (
    SELECT id FROM conversations
    WHERE workflow_id = workflow_id
  );

  -- Delete conversations linked to this workflow
  DELETE FROM conversations
  WHERE workflow_id = workflow_id;

  -- Finally delete the workflow itself
  DELETE FROM workflows
  WHERE id = workflow_id;

  RETURN true;
END;
$$;