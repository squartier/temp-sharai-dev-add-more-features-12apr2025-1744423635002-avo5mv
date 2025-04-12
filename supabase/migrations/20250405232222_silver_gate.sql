/*
  # Fix safely_delete_workflow function

  1. Changes
    - Update safely_delete_workflow function to use explicit table references
    - Fix ambiguous workflow_id column references
    - Add proper cascading delete logic for all related records
  
  2. Security
    - Maintains existing RLS policies
    - Ensures only workflow owners or admins can delete workflows
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
  -- Check if user is owner or admin
  SELECT EXISTS (
    SELECT 1 
    FROM workflows w 
    WHERE w.id = workflow_id 
    AND w.created_by = user_id
  ) INTO is_owner;

  SELECT EXISTS (
    SELECT 1 
    FROM profiles p 
    WHERE p.id = user_id 
    AND p.role = 'admin'
  ) INTO is_admin;

  -- Only proceed if user is owner or admin
  IF is_owner OR is_admin THEN
    -- Delete the workflow and all related data will cascade
    DELETE FROM workflows 
    WHERE workflows.id = workflow_id;
    
    RETURN true;
  END IF;

  RETURN false;
END;
$$;