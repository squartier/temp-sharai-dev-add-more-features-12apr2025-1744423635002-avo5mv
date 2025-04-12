/*
  # Add API URL field to workflows table
  
  1. Changes
    - Add api_url column to workflows table
    - Add check constraint for valid API URLs
    - Update existing workflows to use default URL
    
  2. Security
    - Maintain existing RLS policies
*/

-- Add api_url column with default value
ALTER TABLE workflows 
ADD COLUMN IF NOT EXISTS api_url text 
DEFAULT 'https://api.mindstudio.ai/developer/v2/workers/run';

-- Add check constraint for valid API URLs
ALTER TABLE workflows
ADD CONSTRAINT valid_api_url CHECK (
  api_url IN (
    'https://api.mindstudio.ai/developer/v2/workers/run',
    'https://api.mindstudio.ai/developer/v2/apps/run'
  )
);

-- Update existing workflows to use default URL if null
UPDATE workflows 
SET api_url = 'https://api.mindstudio.ai/developer/v2/workers/run'
WHERE api_url IS NULL;