import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { testApi } from '../lib/api';
import { workflowSchema } from '../lib/types';
import { supabase } from '../lib/supabase';
import { X, Plus, Save, Trash2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { z } from 'zod';

interface Variable {
  name: string;
  value: string;
}

type WorkflowFormData = z.infer<typeof workflowSchema>;

interface WorkflowFormProps {
  workflow?: WorkflowFormData & { id: string };
  onClose: () => void;
  onSave: () => void;
}

type FormValues = WorkflowFormData & {
  id?: string;
  worker_id?: string;
  api_auth_token?: string;
  variables?: Variable[];
};

export function WorkflowForm({ workflow, onClose, onSave }: WorkflowFormProps) {
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'api' | 'variables'>('general');
  const [variables, setVariables] = useState<Variable[]>([{ name: 'request', value: 'request' }]);
  const [showAddVariable, setShowAddVariable] = useState(false);
  const [newVariable, setNewVariable] = useState<Variable>({ name: '', value: '' });
  const [testingApi, setTestingApi] = useState(false);
  const [apiAuthToken, setApiAuthToken] = useState('');
  const [workerId, setWorkerId] = useState('');
  const [apiUrl, setApiUrl] = useState('https://api.mindstudio.ai/developer/v2/workers/run');
  const [supportsDocuments, setSupportsDocuments] = useState<boolean>(false);
  const [supportsImages, setSupportsImages] = useState<boolean>(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(workflowSchema),
    defaultValues: {
      status: 'active',
      api_url: 'https://api.mindstudio.ai/developer/v2/workers/run',
      stages: [],
      assignment_rules: {},
      approval_levels: 1,
      supports_documents: false,
    },
  });

  const { 
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset 
  } = form;

  useEffect(() => {
    if (workflow) {
      console.log('Workflow data received:', workflow);
      
      reset({
        ...workflow,
        display_name: workflow.display_name || ''
      });
      
      setApiUrl(workflow.api_url || 'https://api.mindstudio.ai/developer/v2/workers/run');
      
      const hasDocumentSupport = workflow.supports_documents === true;
      const hasImageSupport = workflow.supports_images === true;
      
      console.log('Setting support flags:', {
        documents: hasDocumentSupport,
        images: hasImageSupport
      });
      
      setSupportsDocuments(hasDocumentSupport);
      setSupportsImages(hasImageSupport);
      
      setWorkerId(workflow.worker_id?.trim() || '');
      setApiAuthToken(workflow.api_auth_token?.trim() || '');
      
      if (workflow.variables && Array.isArray(workflow.variables)) {
        const formattedVars = workflow.variables.map(v => ({
          name: typeof v.name === 'string' ? v.name : '',
          value: typeof v.value === 'string' ? v.value : ''
        }));
        setVariables(formattedVars.length > 0 ? formattedVars : [{ name: 'request', value: 'request' }]);
      }
    }
  }, [workflow, reset]);

  const onSubmit = async (data: WorkflowFormData) => {
    try {
      setSaving(true);

      const missingFields = [];
      if (!data.name?.trim()) missingFields.push('Workflow Name');
      if (!workerId?.trim()) missingFields.push('Worker ID');
      if (!apiAuthToken?.trim()) missingFields.push('Authorization');
      if (variables.length === 0) missingFields.push('At least one variable');

      if (missingFields.length > 0) {
        toast.error(`Missing required fields: ${missingFields.join(', ')}`);
        setSaving(false);
        return;
      }
      
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user?.id) {
        throw new Error('User not authenticated');
      }

      const workflowData = {
        ...data,
        api_url: apiUrl,
        worker_id: workerId.trim(),
        api_auth_token: apiAuthToken.trim().startsWith('Bearer ') ? apiAuthToken.trim() : `Bearer ${apiAuthToken.trim()}`,
        variables: variables.map(v => ({
          name: v.name.trim(),
          value: v.value.trim()
        })),
        api_config: {
          method: 'post',
          url: apiUrl,
          content_type: 'application/json'
        },
        created_by: user.user.id
      };

      const { error } = workflow
        ? await supabase
            .from('workflows')
            .update({
              name: workflowData.name,
              description: workflowData.description,
              display_name: workflowData.display_name,
              status: workflowData.status,
              api_url: workflowData.api_url,
              stages: workflowData.stages,
              assignment_rules: workflowData.assignment_rules,
              approval_levels: workflowData.approval_levels,
              worker_id: workflowData.worker_id,
              api_auth_token: workflowData.api_auth_token,
              api_config: workflowData.api_config,
              variables: workflowData.variables,
              created_by: workflowData.created_by,
              supports_documents: Boolean(supportsDocuments),
              supports_images: Boolean(supportsImages)
            })
            .eq('id', workflow.id)
        : await supabase
            .from('workflows')
            .insert([{
              name: workflowData.name,
              description: workflowData.description,
              display_name: workflowData.display_name,
              status: workflowData.status,
              api_url: workflowData.api_url,
              stages: workflowData.stages,
              assignment_rules: workflowData.assignment_rules,
              approval_levels: workflowData.approval_levels,
              worker_id: workflowData.worker_id,
              api_auth_token: workflowData.api_auth_token,
              api_config: workflowData.api_config,
              variables: workflowData.variables,
              created_by: workflowData.created_by,
              supports_documents: Boolean(supportsDocuments),
              supports_images: Boolean(supportsImages)
            }]);

      if (error) {
        console.error('Supabase error:', error);
        throw new Error(error.message);
      }
      
      toast.success(workflow ? 'Workflow updated' : 'Workflow created');
      onSave();
    } catch (error) {
      console.error('Error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save workflow');
    } finally {
      setSaving(false);
    }
  };

  const handleAddVariable = () => {
    if (newVariable.name && newVariable.value) {
      setVariables(prev => {
        const newVars = [...prev];
        newVars.push({
          name: newVariable.name.trim(),
          value: newVariable.value.trim()
        });
        return newVars;
      });
      setNewVariable({ name: '', value: '' });
      setShowAddVariable(false);
    }
  };

  const handleRemoveVariable = (index: number) => {
    if (index === 0) return;
    setVariables(prev => prev.filter((_, i) => i !== index));
  };

  const handleTestApi = async () => {
    if (!workerId) {
      toast.error('Worker ID is required');
      return;
    }

    if (!apiAuthToken) {
      toast.error('Authorization token is required');
      return;
    }

    try {
      setTestingApi(true);
      
      if (!workflow?.id) {
        toast.error('Workflow must be saved before testing');
        return;
      }

      await testApi({
        workerId,
        apiAuthToken: apiAuthToken.startsWith('Bearer ') ? apiAuthToken : `Bearer ${apiAuthToken}`,
        apiConfig: {
          method: 'post',
          url: apiUrl,
          content_type: 'application/json',
        },
        variables: {
          ...Object.fromEntries(variables.map(v => [v.name, v.value])),
          workflow: watch('name') || ''
        }
      });
      toast.success('API test successful');
    } catch (error) {
      console.error('API test error:', error);
      toast.error(error instanceof Error ? error.message : 'API test failed');
    } finally {
      setTestingApi(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-[#1F1F1F] rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">
              {workflow ? 'Edit Workflow' : 'Add Workflow'}
            </h2>
            <button
              onClick={onClose}
              className="text-[#757575] hover:text-[#E0E0E0] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex space-x-4 border-b border-[#2D2D2D]">
            <button
              onClick={() => setActiveTab('general')}
              className={`py-2 px-4 ${activeTab === 'general' ? 'text-white border-b-2 border-white' : 'text-[#757575]'}`}
            >
              General
            </button>
            <button
              onClick={() => setActiveTab('api')}
              className={`py-2 px-4 ${activeTab === 'api' ? 'text-white border-b-2 border-white' : 'text-[#757575]'}`}
            >
              API Configuration
            </button>
            <button
              onClick={() => setActiveTab('variables')}
              className={`py-2 px-4 ${activeTab === 'variables' ? 'text-white border-b-2 border-white' : 'text-[#757575]'}`}
            >
              Variables
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {activeTab === 'general' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Internal Name
                  </label>
                  <input
                    {...register('name')}
                    className="w-full px-4 py-2 bg-[#1A1B1E] text-white rounded-lg border border-[#2D2D2D] focus:outline-none focus:ring-2 focus:ring-[#f7ab38]"
                    placeholder="Enter internal workflow name"
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
                  )}
                  <p className="mt-1 text-sm text-[#757575]">This name is used internally and for API calls</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Display Name
                  </label>
                  <input
                    {...register('display_name')}
                    className="w-full px-4 py-2 bg-[#1A1B1E] text-white rounded-lg border border-[#2D2D2D] focus:outline-none focus:ring-2 focus:ring-[#f7ab38]"
                    placeholder="Enter display name (optional)"
                  />
                  {errors.display_name && (
                    <p className="mt-1 text-sm text-red-500">{errors.display_name.message}</p>
                  )}
                  <p className="mt-1 text-sm text-[#757575]">This name will be shown in the sidebar (falls back to internal name if not set)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Description
                  </label>
                  <textarea
                    {...register('description')}
                    rows={3}
                    className="w-full px-4 py-2 bg-[#1A1B1E] text-white rounded-lg border border-[#2D2D2D] focus:outline-none focus:ring-2 focus:ring-[#f7ab38]"
                    placeholder="Enter workflow description"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Worker ID
                  </label>
                  <input
                    required
                    type="text"
                    value={workerId}
                    onChange={(e) => setWorkerId(e.target.value)}
                    className="w-full px-4 py-2 bg-[#1A1B1E] text-white rounded-lg border border-[#2D2D2D] focus:outline-none focus:ring-2 focus:ring-[#f7ab38]"
                    placeholder="Enter worker ID"
                  />
                  {!workerId?.trim() && (
                    <p className="mt-1 text-sm text-red-500">Worker ID is required</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="documentUpload"
                        checked={supportsDocuments}
                        onChange={(e) => setSupportsDocuments(e.target.checked)}
                        className="rounded border-[#2D2D2D] bg-[#1A1B1E] text-[#f7ab38] focus:ring-[#f7ab38]"
                      />
                      <label htmlFor="documentUpload" className="text-white">
                        Support Document Uploads
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="imageUpload"
                        checked={supportsImages}
                        onChange={(e) => {
                          const newValue = e.target.checked;
                          console.log('Changing supports_images to:', newValue);
                          setSupportsImages(newValue);
                        }}
                        className="rounded border-[#2D2D2D] bg-[#1A1B1E] text-[#f7ab38] focus:ring-[#f7ab38]"
                      />
                      <label htmlFor="imageUpload" className="text-white">
                        Support Image Uploads
                      </label>
                    </div>
                  </div>
                  {(supportsDocuments || supportsImages) && (
                    <p className="text-sm text-[#757575]">
                      {supportsDocuments && supportsImages 
                        ? 'Documents (.pdf, .doc, .docx, .txt) and Images (.png, .jpg, .jpeg, .gif) are supported'
                        : supportsDocuments 
                          ? 'Documents (.pdf, .doc, .docx, .txt) are supported'
                          : 'Images (.png, .jpg, .jpeg, .gif) are supported'}
                    </p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'api' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Authorization
                  </label>
                  <input
                    required
                    type="text"
                    value={apiAuthToken}
                    onChange={(e) => setApiAuthToken(e.target.value)}
                    className="w-full px-4 py-2 bg-[#1A1B1E] text-white rounded-lg border border-[#2D2D2D] focus:outline-none focus:ring-2 focus:ring-[#f7ab38]"
                    placeholder="Bearer"
                  />
                  {!apiAuthToken?.trim() && (
                    <p className="mt-1 text-sm text-red-500">Authorization token is required</p>
                  )}
                  <p className="mt-1 text-sm text-[#757575]">Private key in header</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    API Endpoint
                  </label>
                  <select
                    {...register('api_url')}
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    className="w-full px-4 py-2 bg-[#1A1B1E] text-white rounded-lg border border-[#2D2D2D] focus:outline-none focus:ring-2 focus:ring-[#f7ab38]"
                  >
                    <option value="https://api.mindstudio.ai/developer/v2/workers/run">Workers API</option>
                    <option value="https://api.mindstudio.ai/developer/v2/apps/run">Apps API</option>
                  </select>
                  <p className="mt-1 text-sm text-[#757575]">Select the API endpoint for this workflow</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Content-Type
                  </label>
                  <input
                    type="text"
                    value="application/json"
                    readOnly
                    className="w-full px-4 py-2 bg-[#1A1B1E] text-white rounded-lg border border-[#2D2D2D]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    API Method
                  </label>
                  <input
                    type="text"
                    value="post"
                    readOnly
                    className="w-full px-4 py-2 bg-[#1A1B1E] text-white rounded-lg border border-[#2D2D2D]"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleTestApi}
                  disabled={testingApi}
                  className="px-4 py-2 bg-[#4CAF50] text-white rounded-lg hover:bg-opacity-90 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testingApi ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      <span>Testing...</span>
                    </>
                  ) : (
                    <span>Test API</span>
                  )}
                </button>
              </div>
            )}

            {activeTab === 'variables' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Body Parameters
                  </label>
                  <div className="space-y-3">
                    {variables.length === 0 && (
                      <p className="text-sm text-red-500">At least one variable is required</p>
                    )}
                    {variables.map((variable, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <div className="flex-1">
                          <label className="block text-sm text-[#757575] mb-1">{variable.name}</label>
                          <input
                            type="text"
                            value={variable.value}
                            readOnly={index === 0}
                            onChange={(e) => {
                              setVariables(prev => {
                                const newVars = [...prev];
                                newVars[index] = {
                                  ...newVars[index],
                                  value: e.target.value
                                };
                                return newVars;
                              });
                            }}
                            className="w-full px-4 py-2 bg-[#1A1B1E] text-white rounded-lg border border-[#2D2D2D]"
                          />
                        </div>
                        {index !== 0 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveVariable(index)}
                            className="mt-6 p-2 text-red-500 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddVariable(true)}
                    className="mt-4 px-4 py-2 text-white hover:bg-[#2D2D2D] rounded-lg transition-colors flex items-center space-x-2"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Add Variable</span>
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Body Preview
                  </label>
                  <pre className="w-full p-4 bg-[#1A1B1E] text-white rounded-lg border border-[#2D2D2D] font-mono text-sm">
{JSON.stringify({
  "workerId": workerId,
  "variables": Object.fromEntries(
    variables.map(v => [v.name, v.value])
  ),
  "workflow": watch('name') || ""
}, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-white hover:text-[#f7ab38] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-[#4CAF50] text-white rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50 flex items-center"
                onClick={() => {
                  if (!workerId?.trim() || !apiAuthToken?.trim() || variables.length === 0) {
                    toast.error('Please fill in all required fields');
                    return;
                  }
                }}
              >
                {saving ? (
                  <>
                    <span className="animate-spin mr-2">⌛</span>
                    Saving...
                  </>
                ) : (
                  <>
                    Save Workflow
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
      
      {showAddVariable && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-[#1F1F1F] rounded-lg w-full max-w-md p-6 space-y-4">
            <h3 className="text-xl font-bold text-white">Add Variable</h3>
            
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Variable Name
              </label>
              <input
                type="text"
                value={newVariable.name}
                onChange={(e) => setNewVariable({ ...newVariable, name: e.target.value })}
                className="w-full px-4 py-2 bg-[#1A1B1E] text-white rounded-lg border border-[#2D2D2D] focus:outline-none focus:ring-2 focus:ring-[#f7ab38]"
                placeholder="Enter variable name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Variable Value
              </label>
              <input
                type="text"
                value={newVariable.value}
                onChange={(e) => setNewVariable({ ...newVariable, value: e.target.value })}
                className="w-full px-4 py-2 bg-[#1A1B1E] text-white rounded-lg border border-[#2D2D2D] focus:outline-none focus:ring-2 focus:ring-[#f7ab38]"
                placeholder="Enter variable value"
              />
            </div>
            
            <div className="flex justify-end space-x-4 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowAddVariable(false);
                  setNewVariable({ name: '', value: '' });
                }}
                className="px-4 py-2 text-white hover:text-[#f7ab38] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddVariable}
                disabled={!newVariable.name || !newVariable.value}
                className="px-4 py-2 bg-[#4CAF50] text-white rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50"
              >
                Add Variable
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}