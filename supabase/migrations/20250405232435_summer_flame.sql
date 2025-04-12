/*
  # Fix workflow deletion cascade

  1. Changes
    - Drop existing function
    - Create new function that properly handles cascade deletion
    - Add proper error handling
    - Maintain permission checks
    
  2. Security
    - Keep SECURITY DEFINER
    - Maintain permission checks for owners and admins
*/

CREATE OR REPLACE FUNCTION safely_delete_workflow(workflow_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_owner boolean;
  is_admin boolean;
BEGIN
  -- Check if workflow exists
  IF NOT EXISTS (SELECT 1 FROM workflows WHERE id = workflow_id) THEN
    RAISE EXCEPTION 'Workflow not found';
  END IF;

  -- Check if user is owner
  SELECT EXISTS (
    SELECT 1 
    FROM workflows w 
    WHERE w.id = workflow_id 
    AND w.created_by = user_id
  ) INTO is_owner;

  -- Check if user is admin
  SELECT EXISTS (
    SELECT 1 
    FROM profiles p 
    WHERE p.id = user_id 
    AND p.role = 'admin'
  ) INTO is_admin;

  -- Only proceed if user is owner or admin
  IF NOT (is_owner OR is_admin) THEN
    RETURN false;
  END IF;

  -- Delete workflow logs
  DELETE FROM workflow_logs
  WHERE workflow_logs.workflow_id = workflow_id;

  -- Delete messages from conversations
  DELETE FROM messages
  WHERE messages.conversation_id IN (
    SELECT id 
    FROM conversations 
    WHERE conversations.workflow_id = workflow_id
  );

  -- Delete conversations
  DELETE FROM conversations
  WHERE conversations.workflow_id = workflow_id;

  -- Delete user workflow permissions
  DELETE FROM user_workflows
  WHERE user_workflows.workflow_id = workflow_id;

  -- Finally delete the workflow
  DELETE FROM workflows 
  WHERE workflows.id = workflow_id;

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
      workflow_id,
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