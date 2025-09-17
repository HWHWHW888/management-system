import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { User, Agent, FileAttachment } from '../types';
import { FileUpload } from './FileUpload';
import { withErrorHandler, WithErrorHandlerProps } from './withErrorHandler';
import { isReadOnlyRole } from '../utils/permissions';
import { apiClient } from '../utils/api/apiClient';
import { Plus, Edit, Mail, Phone, Paperclip, ChevronDown, ChevronUp, UserCheck, Save, Eye } from 'lucide-react';

interface AgentManagementProps extends WithErrorHandlerProps {
  user: User;
}

function AgentManagementComponent({ user, showError, clearError }: AgentManagementProps) {
  const isReadOnly = isReadOnlyRole(user.role);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [deletingAgent, setDeletingAgent] = useState<Agent | null>(null);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: ''
  });

  const loadAllData = useCallback(async () => {
    try {
      setLoading(true);
      clearError();
      
      console.log('🔄 Loading agent data from backend API...');
      
      // Load agents from backend API
      const agentsResponse = await apiClient.getAgents();
      if (!agentsResponse.success) {
        throw new Error(agentsResponse.error || 'Failed to fetch agents');
      }

      // Process agents - all agents are automatically customers
      const agentsData = Array.isArray(agentsResponse.data) ? agentsResponse.data : [];
      const processedAgents = agentsData.map((agent: any) => ({
        ...agent,
        isCustomer: true, // All agents are customers by default
        attachments: agent.attachments || [],
        createdAt: new Date(agent.created_at).toLocaleDateString()
      }));

      setAgents(processedAgents);
      
      console.log(`✅ Loaded ${processedAgents.length} agents from backend API`);
      
    } catch (error) {
      console.error('❌ Error loading agent data:', error);
      showError(`Failed to load agent data: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
    } finally {
      setLoading(false);
    }
  }, [clearError, showError]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Note: Direct agent saving removed - now using backend API endpoints

  // Note: Customer saving handled automatically when agents are created/updated

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      if (editingAgent) {
        // Update existing agent - only send required fields to backend
        const updateData = {
          name: formData.name,
          email: formData.email,
          phone: formData.phone || null,
          status: 'active'
        };
        
        const response = await apiClient.updateAgent(editingAgent.id, updateData);
        if (!response.success) {
          throw new Error(response.error || 'Failed to update agent');
        }
        
        // Refresh data to get updated agent
        await loadAllData();
      } else {
        // Add new agent - only send required fields to backend
        const agentData = {
          name: formData.name,
          email: formData.email,
          phone: formData.phone || null,
          commission_rate: 0,
          status: 'active'
        };
        
        // Create agent via API (backend automatically creates corresponding customer with agent_id)
        const agentResponse = await apiClient.createAgent(agentData);
        if (!agentResponse.success) {
          throw new Error(agentResponse.error || 'Failed to create agent');
        }
        
        // Refresh data to get the new agent and customer
        await loadAllData();
      }

      // Reset form and close dialog
      setFormData({ name: '', email: '', phone: '' });
      setEditingAgent(null);
      setIsDialogOpen(false);
      
    } catch (error) {
      showError(`Failed to save agent: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setFormData({
      name: agent.name,
      email: agent.email,
      phone: agent.phone
    });
    setIsDialogOpen(true);
  };

  // Note: Agent-to-customer creation is now handled automatically by the backend
  // when an agent is created, so no manual customer creation is needed

  const handleDeleteAgent = async () => {
    if (!deletingAgent) return;

    try {
      setSaving(true);
      clearError();
      
      console.log('🗑️ Deleting agent:', deletingAgent.name, deletingAgent.id);
      
      // Call backend API to delete agent
      const response = await apiClient.deleteAgent(deletingAgent.id);
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete agent');
      }
      
      console.log('✅ Agent deleted successfully');
      
      // Refresh data to get updated agent list
      await loadAllData();
      
      // Close dialog and reset state
      setDeletingAgent(null);
      
    } catch (error) {
      console.error('❌ Error deleting agent:', error);
      showError(`Failed to delete agent: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
    } finally {
      setSaving(false);
    }
  };


  const openNewAgentDialog = () => {
    setEditingAgent(null);
    setFormData({ name: '', email: '', phone: '' });
    setIsDialogOpen(true);
  };

  const toggleAgentExpansion = (agentId: string) => {
    setExpandedAgent(expandedAgent === agentId ? null : agentId);
  };

  const updateAgentAttachments = async (agentId: string, attachments: FileAttachment[]) => {
    // Note: Attachment management would need to be implemented via API
    console.log('Attachment update requested for agent:', agentId, attachments);
  };

  const isAdmin = user.role === 'admin';
  const isStaff = user.role === 'staff';

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Loading agent data from Supabase...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Staff View Banner */}
      {isStaff && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center">
            <Eye className="w-5 h-5 text-blue-600 mr-2" />
            <div>
              <p className="text-sm font-medium text-blue-800">
                Agent Information - View Only
              </p>
              <p className="text-xs text-blue-600">
                You have read-only access to agent information and contact details.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Agent Management</h2>
          <p className="text-gray-600">
            {isStaff 
              ? 'View agent information and contact details.' 
              : 'Manage agents who bring customers to the casino. All agents are automatically customers.'
            }
          </p>
        </div>
        {!isReadOnly && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNewAgentDialog} disabled={saving}>
                <Plus className="w-4 h-4 mr-2" />
                Add Agent
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingAgent ? 'Edit Agent' : 'Add New Agent'}
                </DialogTitle>
                <DialogDescription>
                  {editingAgent ? 'Update agent information' : 'Add a new agent to the system'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Agent full name"
                    required
                    disabled={saving}
                  />
                </div>
                
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="agent@email.com"
                    required
                    disabled={saving}
                  />
                </div>
                
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    placeholder="+1234567890"
                    required
                    disabled={saving}
                  />
                </div>

                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-xs text-green-700">
                    <strong>Note:</strong> All agents are automatically registered as customers and can participate in trips and gambling activities.
                  </p>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-sm font-medium text-blue-800">Profit Sharing</span>
                  </div>
                  <p className="text-xs text-blue-700">
                    Agent profit sharing percentages are configured per trip in the Projects section.
                  </p>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? (
                      <>
                        <Save className="w-4 h-4 mr-2 animate-spin" />
                        Saving to Supabase...
                      </>
                    ) : (
                      <>
                        {editingAgent ? 'Update' : 'Add'} Agent
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-6">
        {agents.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-gray-500">{isStaff ? 'No agents found in the system.' : 'No agents found. Add your first agent to get started.'}</p>
            </CardContent>
          </Card>
        ) : (
          agents.map((agent) => {
            const isExpanded = expandedAgent === agent.id;
            
            return (
              <Collapsible key={agent.id} open={isExpanded} onOpenChange={() => toggleAgentExpansion(agent.id)}>
                <Card className="overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="flex items-center space-x-2">
                            <span>{agent.name}</span>
                            <Badge variant={agent.status ? "default" : "default"}>
                              {agent.status ? 'Active' : 'Inactive'}
                            </Badge>

                            {agent.attachments && agent.attachments.length > 0 && (
                              <Badge variant="outline" className="flex items-center space-x-1">
                                <Paperclip className="w-3 h-3" />
                                <span>{agent.attachments.length}</span>
                              </Badge>
                            )}

                            {isStaff && (
                              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                                <Eye className="w-3 h-3 mr-1" />
                                View Only
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription>
                            Agent since {agent.createdAt}
                          </CardDescription>
                        </div>
                        <div className="flex items-center space-x-2">
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="flex items-center space-x-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">{agent.email}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">{agent.phone}</span>
                      </div>
                    </div>

                    {!isReadOnly && (
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(agent)} disabled={saving}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                        <AlertDialog open={deletingAgent?.id === agent.id} onOpenChange={(open) => !open && setDeletingAgent(null)}>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="destructive" 
                              size="sm" 
                              onClick={() => setDeletingAgent(agent)}
                              disabled={saving}
                              className="bg-red-600 hover:bg-red-700 text-white"
                            >
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Agent</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to permanently delete "{agent.name}"? This action cannot be undone and will remove all agent data from the system.
                                <br /><br />
                                <strong>Warning:</strong> This will also affect any trips this agent is associated with. Agents with existing trip associations cannot be deleted.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={handleDeleteAgent}
                                className="bg-red-600 text-white hover:bg-red-700"
                                disabled={saving}
                              >
                                {saving ? 'Deleting...' : 'Delete Agent'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}

                    <CollapsibleContent className="mt-6">
                      <Tabs defaultValue="info" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="info" className="flex items-center space-x-2">
                            <UserCheck className="w-4 h-4" />
                            <span>Agent Information</span>
                          </TabsTrigger>
                          <TabsTrigger value="files" className="flex items-center space-x-2">
                            <Paperclip className="w-4 h-4" />
                            <span>Files ({agent.attachments?.length || 0})</span>
                          </TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="info" className="space-y-4 mt-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Name</Label>
                                <p className="text-lg">{agent.name}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Email</Label>
                                <p>{agent.email}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Phone</Label>
                                <p>{agent.phone}</p>
                              </div>
                            </div>
                            
                            <div className="space-y-4">
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Status</Label>
                                <Badge variant={agent.status ? "default" : "default"}>
                                  {agent.status ? 'Active' : 'Inactive'}
                                </Badge>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Member Since</Label>
                                <p>{agent.createdAt}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-gray-500">Role</Label>
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                  <UserCheck className="w-3 h-3 mr-1" />
                                  Agent
                                </Badge>
                              </div>
                            </div>
                          </div>
                          
                          <div className="pt-4 border-t">
                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                              <div className="flex items-center space-x-2 mb-2">
                                <span className="text-sm font-medium text-blue-800">Profit Sharing Information</span>
                              </div>
                              <p className="text-sm text-blue-700">
                                This agent's profit sharing percentages are configured individually for each trip in the Projects section. 
                                As both an agent and customer, they can participate in trips and receive commissions based on their role in each trip.
                              </p>
                            </div>
                          </div>
                        </TabsContent>
                        
                        <TabsContent value="files" className="space-y-4 mt-6">
                          <div className="mb-4">
                            <Label className="text-sm font-medium text-gray-500">Document Management</Label>
                            <p className="text-sm text-gray-400">
                              {isAdmin 
                                ? 'Upload passport, photo, and other important documents for this agent.' 
                                : 'View uploaded documents for this agent.'
                              }
                            </p>
                          </div>
                          {isAdmin ? (
                            <FileUpload
                              attachments={agent.attachments || []}
                              onAttachmentsChange={(attachments) => updateAgentAttachments(agent.id, attachments)}
                              currentUser={user.username}
                              disabled={saving}
                            />
                          ) : (
                            <div className="space-y-2">
                              {agent.attachments && agent.attachments.length > 0 ? (
                                agent.attachments.map((file) => (
                                  <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
                                    <div className="flex items-center space-x-3">
                                      <Paperclip className="w-4 h-4 text-gray-400" />
                                      <div>
                                        <p className="text-sm font-medium">{file.name}</p>
                                        <p className="text-xs text-gray-500">
                                          {(file.size / 1024 / 1024).toFixed(2)} MB • Uploaded by {file.uploadedBy} on {new Date(file.uploadedAt).toLocaleDateString()}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <p className="text-sm text-gray-500 text-center py-8">No documents uploaded for this agent.</p>
                              )}
                            </div>
                          )}
                        </TabsContent>
                      </Tabs>
                    </CollapsibleContent>
                  </CardContent>
                </Card>
              </Collapsible>
            );
          })
        )}
      </div>
    </div>
  );
}

// Export with error handler wrapper
export const AgentManagement = withErrorHandler(AgentManagementComponent);