/*
  # Fix workflow deletion function
  
  1. Changes
    - Drop existing function first
    - Recreate function with proper parameter handling
    - Add proper error handling and logging
    
  2. Security
    - Maintain SECURITY DEFINER setting
    - Keep existing permission checks
*/

-- First drop the existing function
DROP FUNCTION IF EXISTS safely_delete_workflow(uuid, uuid);

-- Create the fixed function
CREATE OR REPLACE FUNCTION safely_delete_workflow(p_workflow_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_owner boolean;
  is_admin boolean;
BEGIN
  -- Check if workflow exists
  IF NOT EXISTS (SELECT 1 FROM workflows WHERE id = p_workflow_id) THEN
    RAISE EXCEPTION 'Workflow not found';
  END IF;

  -- Check if user is owner
  SELECT EXISTS (
    SELECT 1 
    FROM workflows w 
    WHERE w.id = p_workflow_id 
    AND w.created_by = p_user_id
  ) INTO is_owner;

  -- Check if user is admin
  SELECT EXISTS (
    SELECT 1 
    FROM profiles p 
    WHERE p.id = p_user_id 
    AND p.role = 'admin'
  ) INTO is_admin;

  -- Only proceed if user is owner or admin
  IF NOT (is_owner OR is_admin) THEN
    RETURN false;
  END IF;

  -- Delete workflow logs
  DELETE FROM workflow_logs
  WHERE workflow_id = p_workflow_id;

  -- Delete messages from conversations
  DELETE FROM messages
  WHERE conversation_id IN (
    SELECT c.id 
    FROM conversations c
    WHERE c.workflow_id = p_workflow_id
  );

  -- Delete conversations
  DELETE FROM conversations
  WHERE workflow_id = p_workflow_id;

  -- Delete user workflow permissions
  DELETE FROM user_workflows
  WHERE workflow_id = p_workflow_id;

  -- Finally delete the workflow
  DELETE FROM workflows 
  WHERE id = p_workflow_id;

  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error and re-raise
    INSERT INTO workflow_logs (
      workflow_id,
      level,
      message,
      details
    ) VALUES (
      p_workflow_id,
      'error',
      'Failed to delete workflow',
      jsonb_build_object(
        'error', SQLERRM,
        'state', SQLSTATE
      )
    );
    RAISE;
END;
$$;