/*
  # Add display_name to workflows table
  
  1. Changes
    - Add display_name column to workflows table
    - Make it nullable (fallback to name when not set)
    - Add helpful comment
    
  2. Security
    - Maintain existing RLS policies
*/

-- Add display_name column
ALTER TABLE workflows 
ADD COLUMN IF NOT EXISTS display_name text;

-- Add helpful comment
COMMENT ON COLUMN workflows.display_name IS 'Optional display name shown in the sidebar (falls back to name if not set)';