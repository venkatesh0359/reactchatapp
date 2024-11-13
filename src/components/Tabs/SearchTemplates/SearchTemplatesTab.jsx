import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  Tooltip,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  DialogActions,
  Chip,
  Checkbox,
  ListItemText,
  Alert,
} from '@mui/material';
import { 
  MdAdd, 
  MdSearch, 
  MdRemoveRedEye,
  MdEdit, 
  MdDelete, 
  MdClose 
} from 'react-icons/md';
import { supabase } from '../../../config/supabase';

const SearchTemplatesTab = () => {
  const [templates, setTemplates] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showPromptDialog, setShowPromptDialog] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    templateName: '',
    rolesAssigned: [],
    promptContent: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      setError('');

      const { data, error: supabaseError } = await supabase
        .from('llm_search_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (supabaseError) throw supabaseError;

      setTemplates(data || []);
    } catch (err) {
      console.error('Error fetching templates:', err);
      setError('Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  };

  const handleShowPrompt = (promptContent) => {
    setSelectedPrompt(promptContent);
    setShowPromptDialog(true);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const filteredTemplates = templates.filter(template =>
    template.template_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.roles_assigned.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.created_by.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDeleteClick = (template) => {
    setTemplateToDelete(template);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      setIsLoading(true);
      
      const { error } = await supabase
        .from('llm_search_templates')
        .delete()
        .eq('id', templateToDelete.id);

      if (error) throw error;

      setTemplates(templates.filter(template => template.id !== templateToDelete.id));
      setDeleteConfirmOpen(false);
      setTemplateToDelete(null);
    } catch (err) {
      console.error('Error deleting template:', err);
      setError('Failed to delete template');
    } finally {
      setIsLoading(false);
    }
  };

  const getUserIdFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('userId');
  };

  const handleEditClick = (template) => {
    setIsEditing(true);
    setEditingTemplate(template);
    setFormData({
      templateName: template.template_name,
      rolesAssigned: template.roles_assigned.split(', '),
      promptContent: template.prompt_content
    });
    setCreateModalOpen(true);
  };

  const handleCreateOrUpdateTemplate = async () => {
    try {
      setIsSubmitting(true);
      setFormError('');
      const userId = getUserIdFromUrl();
      
      console.log('Save/Update button clicked');
      console.log('Form Data:', formData);
      console.log('Is Editing:', isEditing);
      
      if (!userId) {
        throw new Error('User ID not found');
      }

      if (isEditing) {
        const { data, error } = await supabase
          .from('llm_search_templates')
          .update({
            template_name: formData.templateName,
            roles_assigned: formData.rolesAssigned.join(', '),
            prompt_content: formData.promptContent,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingTemplate.id)
          .select();

        if (error) {
          if (error.code === '23505') {
            setFormError('A template with this name already exists. Please choose a different name.');
            return;
          }
          throw error;
        }
      } else {
        const { data, error } = await supabase
          .from('llm_search_templates')
          .insert([{
            template_name: formData.templateName,
            roles_assigned: formData.rolesAssigned.join(', '),
            prompt_content: formData.promptContent,
            created_by: userId,
            updated_at: null
          }])
          .select();

        if (error) {
          if (error.code === '23505') {
            setFormError('A template with this name already exists. Please choose a different name.');
            return;
          }
          throw error;
        }
      }

      await fetchTemplates();
      setCreateModalOpen(false);
      setFormData({ templateName: '', rolesAssigned: [], promptContent: '' });
      setIsEditing(false);
      setEditingTemplate(null);
      setFormError('');
    } catch (err) {
      console.error('Error saving template:', err);
      setFormError(`Failed to ${isEditing ? 'update' : 'create'} template. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Search Templates
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Search existing templates or create new template
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              startIcon={<MdAdd />}
              onClick={() => setCreateModalOpen(true)}
              sx={{
                bgcolor: '#000',
                '&:hover': { bgcolor: '#333' }
              }}
            >
              Create New Template
            </Button>
          </Box>

          <TextField
            fullWidth
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <MdSearch />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                height: '56px',
                '&.Mui-focused fieldset': {
                  borderColor: '#000',
                },
              },
            }}
          />

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Template Name</TableCell>
                  <TableCell>Roles Assigned</TableCell>
                  <TableCell>Prompt Content</TableCell>
                  <TableCell>Created At</TableCell>
                  <TableCell>Created By</TableCell>
                  <TableCell>Updated At</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredTemplates
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((template) => (
                    <TableRow key={template.id}>
                      <TableCell>{template.template_name}</TableCell>
                      <TableCell>{template.roles_assigned}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography noWrap sx={{ maxWidth: 150 }}>
                            {template.prompt_content.substring(0, 30)}...
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => handleShowPrompt(template.prompt_content)}
                            sx={{ color: 'primary.main' }}
                          >
                            <MdRemoveRedEye fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                      <TableCell>
                        {template.created_at ? new Date(template.created_at).toLocaleString() : 'Not Available'}
                      </TableCell>
                      <TableCell>{template.created_by}</TableCell>
                      <TableCell>
                        {template.updated_at && template.updated_at !== null 
                          ? new Date(template.updated_at).toLocaleString()
                          : 'Not Updated'}
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                          <Tooltip title="Edit">
                            <IconButton 
                              size="small"
                              onClick={() => handleEditClick(template)}
                            >
                              <MdEdit />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton 
                              size="small" 
                              sx={{ color: 'error.main' }}
                              onClick={() => handleDeleteClick(template)}
                            >
                              <MdDelete />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={filteredTemplates.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25]}
          />
        </Box>
      </Paper>

      <Dialog
        open={showPromptDialog}
        onClose={() => setShowPromptDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Template Prompt Content
          <IconButton
            onClick={() => setShowPromptDialog(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <MdClose />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Typography
            sx={{
              whiteSpace: 'pre-wrap',
              p: 2,
              fontFamily: 'monospace',
              fontSize: '0.9rem',
              lineHeight: 1.5
            }}
          >
            {selectedPrompt}
          </Typography>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete Template</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{templateToDelete?.template_name}"? 
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button 
            onClick={() => setDeleteConfirmOpen(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={isLoading}
          >
            Delete
          </Button>
        </Box>
      </Dialog>

      <Dialog 
        open={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setIsEditing(false);
          setEditingTemplate(null);
          setFormData({ templateName: '', rolesAssigned: [], promptContent: '' });
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{isEditing ? 'Edit Template' : 'Template Editor'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
            {formError && (
              <Alert severity="error" sx={{ width: '100%' }}>
                {formError}
              </Alert>
            )}
            
            <TextField
              label="Template Name"
              fullWidth
              required
              error={Boolean(formError)}
              value={formData.templateName}
              onChange={(e) => {
                setFormError('');
                setFormData(prev => ({ 
                  ...prev, 
                  templateName: e.target.value 
                }));
              }}
            />

            <FormControl fullWidth required>
              <InputLabel>Assigned Roles</InputLabel>
              <Select
                multiple
                value={formData.rolesAssigned}
                onChange={(e) => {
                  console.log('Roles changed:', e.target.value);
                  setFormData(prev => ({ 
                    ...prev, 
                    rolesAssigned: e.target.value 
                  }));
                }}
                label="Assigned Roles"
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip key={value} label={value} />
                    ))}
                  </Box>
                )}
              >
                {['Admin', 'Art Team', 'Internal Rep', 'External Rep'].map((role) => (
                  <MenuItem key={role} value={role}>
                    <Checkbox checked={formData.rolesAssigned.indexOf(role) > -1} />
                    <ListItemText primary={role} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Prompt Content"
              fullWidth
              required
              multiline
              minRows={4}
              maxRows={15}
              value={formData.promptContent}
              onChange={(e) => {
                console.log('Prompt content changed:', e.target.value);
                setFormData(prev => ({ 
                  ...prev, 
                  promptContent: e.target.value 
                }));
              }}
              sx={{
                '& .MuiInputBase-root': {
                  maxHeight: '500px',
                  overflowY: 'auto'
                }
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            onClick={() => {
              setCreateModalOpen(false);
              setIsEditing(false);
              setEditingTemplate(null);
              setFormData({ templateName: '', rolesAssigned: [], promptContent: '' });
            }}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateOrUpdateTemplate}
            disabled={isSubmitting || !formData.templateName || !formData.rolesAssigned.length || !formData.promptContent}
            sx={{
              bgcolor: '#000',
              '&:hover': { bgcolor: '#333' }
            }}
          >
            {isSubmitting ? 'Saving...' : isEditing ? 'Update' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SearchTemplatesTab; 