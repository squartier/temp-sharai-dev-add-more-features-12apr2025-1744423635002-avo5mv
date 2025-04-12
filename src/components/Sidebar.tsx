import { useState, useEffect } from 'react';
import { ChevronDown, Search, MessageSquare, Trash2, Check } from 'lucide-react';
import { supabase, isSupabaseInitialized } from '../lib/supabase';
import type { WorkflowConfig, Workflow } from '../lib/types';
import toast from 'react-hot-toast';

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  workflow_id: string;
}

interface SidebarProps {
  onNewChat: () => void;
  selectedChat: string | null;
  selectedWorkflow: WorkflowConfig | null;
  onSelectWorkflow: (workflow: WorkflowConfig) => void;
  onSelectChat: (id: string) => void;
}

export function Sidebar({ onNewChat, selectedChat, selectedWorkflow, onSelectWorkflow, onSelectChat }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isWorkflowDropdownOpen, setIsWorkflowDropdownOpen] = useState(false);
  const [workflows, setWorkflows] = useState<WorkflowConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const LIMIT = 15;
  
  useEffect(() => {
    fetchWorkflows();
  }, []);

  useEffect(() => {
    if (selectedWorkflow) {
      fetchConversations();
    }
  }, [selectedWorkflow, searchQuery]);

  const fetchConversations = async (loadMore = false) => {
    try {
      if (!selectedWorkflow) return;
      if (!isSupabaseInitialized()) {
        toast.error('Database connection not initialized');
        return;
      }

      const currentPage = loadMore ? page + 1 : 0;
      
      const query = supabase
        .from('conversations')
        .select('*')
        .eq('workflow_id', selectedWorkflow.id)
        .order('created_at', { ascending: false })
        .range(currentPage * LIMIT, (currentPage + 1) * LIMIT - 1);

      if (searchQuery) {
        query.ilike('title', `%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching conversations:', error);
        toast.error('Failed to load conversations');
        return;
      }

      if (loadMore) {
        setConversations(prev => [...prev, ...(data || [])]);
        setHasMore(data.length === LIMIT);
      } else {
        setConversations(data || []);
        setHasMore(data.length === LIMIT);
      }
      
      setPage(currentPage);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast.error('Failed to load conversations');
    }
  };

  async function fetchWorkflows() {
    try {
      if (!isSupabaseInitialized()) {
        toast.error('Database connection not initialized');
        return;
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error('Error fetching user:', userError);
        toast.error('Failed to authenticate user');
        return;
      }

      if (!user) {
        console.error('No user found');
        toast.error('User not authenticated');
        return;
      }

      const { data, error } = await supabase
        .from('workflows')
        .select('id, name, display_name, worker_id, api_auth_token, supports_documents, supports_images, api_url')
        .eq('status', 'active')
        .order('order', { ascending: true });

      if (error) {
        console.error('Error fetching workflows:', error);
        toast.error('Failed to load workflows');
        return;
      }

      setWorkflows(data || []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to fetch workflows');
    } finally {
      setLoading(false);
    }
  }
  
  const handleLoadMore = async () => {
    setLoadingMore(true);
    await fetchConversations(true);
    setLoadingMore(false);
  };

  const handleWorkflowSelect = (workflow: WorkflowConfig) => {
    onSelectWorkflow(workflow);
    setIsWorkflowDropdownOpen(false);
  };

  return (
    <div className="w-80 bg-[#121212] border-r border-[#2D2D2D] flex flex-col h-full">
      <div className="p-4 space-y-4">
        {/* Workflow Selector */}
        <div className="relative">
          <button
            className="w-full bg-[#1F1F1F] text-white px-4 py-2 rounded-md flex items-center justify-between hover:bg-[#2D2D2D] transition-colors"
            onClick={() => setIsWorkflowDropdownOpen(!isWorkflowDropdownOpen)}
          >
            <span>{selectedWorkflow ? (selectedWorkflow.display_name || selectedWorkflow.name) : 'Select Workflow'}</span>
            <ChevronDown className="h-5 w-5" />
          </button>
          
          {/* Workflow Dropdown */}
          {isWorkflowDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#1F1F1F] rounded-md shadow-lg border border-[#2D2D2D] py-1 z-10">
              {workflows.map((workflow) => (
                <button
                  key={workflow.id}
                  onClick={() => handleWorkflowSelect(workflow)}
                  className="w-full px-4 py-2 text-left flex items-center justify-between hover:bg-[#2D2D2D] transition-colors"
                >
                  <span className="text-white">
                    {workflow.display_name || workflow.name}
                  </span>
                  {selectedWorkflow?.id === workflow.id && (
                    <Check className="h-4 w-4 text-emerald-500" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* New Chat Button */}
        <button
          onClick={() => {
            onNewChat();
            const inputElement = document.querySelector<HTMLInputElement>('input[type="text"][placeholder="Type your message..."]');
            if (inputElement) {
              inputElement.focus();
            }
          }}
          className="w-full bg-emerald-600 text-white py-2 rounded-md hover:bg-emerald-700 transition-colors"
        >
          New Chat
        </button>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1F1F1F] text-white pl-10 pr-4 py-2 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f7ab38]"
          />
        </div>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-1 p-2">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => onSelectChat(conversation.id)}
              className={`w-full text-left p-3 rounded-md transition-colors ${
                selectedChat === conversation.id
                  ? 'bg-[#1F1F1F]'
                  : 'hover:bg-[#1F1F1F]/50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <MessageSquare className="h-5 w-5 text-gray-400 mt-1" />
                  <div>
                    <p className="text-sm text-white line-clamp-3">{conversation.title}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(conversation.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (confirm('Are you sure you want to delete this conversation?')) {
                      const { error } = await supabase
                        .from('conversations')
                        .delete()
                        .eq('id', conversation.id);
                      
                      if (error) {
                        toast.error('Failed to delete conversation');
                      } else {
                        toast.success('Conversation deleted');
                        if (selectedChat === conversation.id) {
                          onSelectChat(null);
                        }
                        fetchConversations();
                      }
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </button>
          ))}
          {hasMore && (
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="w-full py-2 text-center text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            >
              {loadingMore ? 'Loading...' : 'Load More'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}