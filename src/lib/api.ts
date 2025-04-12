import { supabase } from './supabase';
import toast from 'react-hot-toast';
import { logError, logWorkflowError } from './error-handling';

export class ApiError extends Error {
  status?: number;
  details?: unknown;

  constructor(message: string, status?: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

interface ApiConfig {
  method: string;
  url: string;
  content_type: string;
}

interface ApiResponse {
  success: boolean;
  data: any;
}

interface TestApiParams {
  workerId: string;
  apiAuthToken: string;
  apiConfig: ApiConfig;
  variables: Record<string, string>;
  workflowId?: string;
}

export async function testApi({ workerId, apiAuthToken, apiConfig, variables, workflowId }: TestApiParams) {
  console.log('API: Making request with:', {
    workerId,
    variables,
    workflowId
  });

  if (!workerId || workerId === 'your-worker-id') {
    throw new ApiError('Worker ID is not configured', 400);
  }

  if (!apiAuthToken || apiAuthToken === 'your-auth-token') {
    throw new ApiError('API authentication token is not configured', 400);
  }

  try {
    const response = await fetch(apiConfig.url, {
      method: apiConfig.method,
      headers: {
        'Content-Type': apiConfig.content_type,
        'Authorization': apiAuthToken.startsWith('Bearer ') ? apiAuthToken : `Bearer ${apiAuthToken}`,
      },
      body: JSON.stringify({
        workerId,
        variables
      })
    });

    console.log('API: Response received:', {
      status: response.status,
      ok: response.ok
    });

    const data = await response.json();
    const responseText = data.result || data.responseText || data.response || data.message || 'No response received';

    // If this is an API test and we have a workflow ID, log the test results
    if (workflowId) {
      const { error: logError } = await supabase
        .from('workflow_logs')
        .insert({
          workflow_id: workflowId,
          level: response.ok ? 'info' : 'error',
          message: response.ok ? 'API test completed successfully' : `API request failed: ${response.statusText}`,
          details: {
            workerId,
            url: apiConfig.url,
            method: apiConfig.method,
            status: response.status,
            response: data,
          },
          created_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (logError) {
        console.error('Failed to log workflow test:', logError);
      }
    }

    if (!response.ok) {
      throw new ApiError(
        data.message || `API request failed: ${response.statusText}`,
        response.status,
        data
      );
    }

    return {
      success: true,
      data: {
        response: responseText
      }
    };
  } catch (error) {
    // Only log errors for actual workflow executions, not API tests
    if (!workflowId) {
      console.error('API Error Details:', {
        error,
        stack: error instanceof Error ? error.stack : undefined,
        context: {
          workerId,
          url: apiConfig.url,
          method: apiConfig.method,
          variables
        }
      });

      logError({ 
        context: { 
          workerId, 
          url: apiConfig.url,
          method: apiConfig.method,
          variables,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }, 
        error 
      });
      
      await logWorkflowError(supabase, workflowId!, error, {
        workflow_id: workflowId!,
        level: 'error',
        message: error instanceof Error 
          ? error.message 
          : 'Failed to connect to MindStudio API',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          request: {
            workerId,
            url: apiConfig.url,
            method: apiConfig.method,
            variables
          },
          response: error instanceof ApiError ? error.details : undefined,
          context: { workerId, url: apiConfig.url, method: apiConfig.method }
        }
      });
    }
    
    throw error;
  }
}