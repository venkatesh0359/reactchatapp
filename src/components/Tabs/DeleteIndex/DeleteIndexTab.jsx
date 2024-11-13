import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Box,
  Button,
  Typography,
  Alert,
  Paper,
  Autocomplete,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress
} from '@mui/material';
import { MdWarning } from 'react-icons/md';
import { useTabContext } from '../../../context/TabContext';
import { useSupabase } from '../../../context/SupabaseContext';

const logWithTimestamp = (message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
};

const DeleteIndexTab = () => {
  const supabase = useSupabase();
  const DELETE_ENDPOINT = 'http://35.173.17.197:9001/remove_index';
  const LIST_ENDPOINT = 'http://35.173.17.197:9001/list-index';
  const API_KEY = '8O5Z641FNUTOL4LT222NZ73F18IL1O43TPXW7EA8';
  
  console.log('Environment Variables:', {
    DELETE_ENDPOINT,
    LIST_ENDPOINT,
    API_KEY: API_KEY ? '***' : 'not set'
  });
  const { selectedIndexData, setSelectedIndexData } = useTabContext();
  const [existingIndices, setExistingIndices] = useState([]);
  const [selectedByName, setSelectedByName] = useState(null);
  const [error, setError] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const autocompleteRef = useRef(null);

  // Fetch indices on component mount
  useEffect(() => {
    fetchIndices();
  }, []);

  // Handle pre-selected index from context
  useEffect(() => {
    if (selectedIndexData) {
      setSelectedByName({
        id: selectedIndexData.index_name,
        index_name: selectedIndexData.index_name
      });
    }
    return () => setSelectedIndexData(null);
  }, [selectedIndexData, setSelectedIndexData]);

  const fetchIndices = async () => {
    try {
      setIsLoading(true);

      // 1. Fetch from API
      const apiResponse = await axios.get(
        LIST_ENDPOINT,
        {
          headers: {
            'Authorization': API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!apiResponse?.data?.indexlist) {
        throw new Error('Invalid response structure from API');
      }

      const apiIndices = apiResponse.data.indexlist;

      // 2. Update state with API indices
      const processedIndices = apiIndices.map(name => ({
        id: name,
        index_name: name
      }));
      
      setExistingIndices(processedIndices);
    } catch (error) {
      console.error('Error fetching indices:', error);
      setError('Failed to load existing indices');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNameSelection = (value) => {
    setSelectedByName(value);
    setError('');
  };

  const handleDelete = () => {
    if (!selectedByName) {
      setError('Please select an index to delete');
      return;
    }
    setIsConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedByName?.index_name) return;
    
    setIsLoading(true);
    setStatusMessage('Deleting index and associated data...');
    
    try {
      const indexName = selectedByName.index_name;
      logWithTimestamp('Starting deletion process for index:', indexName);

      // 1. Delete from API endpoint
      try {
        const apiResponse = await axios.post(
          DELETE_ENDPOINT,
          { indexname: indexName },
          {
            headers: {
              'Authorization': API_KEY,
              'Content-Type': 'application/json'
            }
          }
        );

        if (apiResponse.status !== 200) {
          throw new Error(`API deletion failed: ${apiResponse.status}`);
        }
        logWithTimestamp('Successfully deleted from API endpoint');

      } catch (apiError) {
        console.error('API deletion error:', apiError);
        throw new Error(`Failed to delete from API: ${apiError.message}`);
      }

      // 2. Get index record from Supabase (we need the ID)
      try {
        const { data: indexData, error: fetchError } = await supabase
          .from('llm_index')
          .select('id')
          .eq('index_name', indexName)
          .maybeSingle();

        if (fetchError) {
          throw new Error(`Failed to fetch index data: ${fetchError.message}`);
        }

        if (!indexData) {
          // If no record found, we can skip database deletion since it doesn't exist
          logWithTimestamp('No database record found for index, skipping database deletion');
        } else {
          // 3. Delete from llm_index (will cascade to llm_index_docs)
          const { error: deleteError } = await supabase
            .from('llm_index')
            .delete()
            .eq('id', indexData.id);

          if (deleteError) {
            throw new Error(`Failed to delete from database: ${deleteError.message}`);
          }
          logWithTimestamp('Successfully deleted from database (cascade delete completed)');
        }

        // Continue with storage cleanup...
      } catch (error) {
        console.error('Database operation failed:', error);
        throw new Error(`Database operation failed: ${error.message}`);
      }

      // 4. Delete storage folder and contents
      try {
        logWithTimestamp('Starting storage cleanup for index:', indexName);
        
        // First list all files in the index folder
        const { data: files, error: listError } = await supabase
          .storage
          .from('llm_docs')
          .list(indexName);

        if (listError) {
          throw new Error(`Failed to list storage files: ${listError.message}`);
        }

        logWithTimestamp('Found files in storage:', {
          folderPath: indexName,
          fileCount: files?.length || 0,
          files: files
        });

        if (files?.length > 0) {
          // Delete all files in the folder
          const filePaths = files.map(file => `${indexName}/${file.name}`);
          logWithTimestamp('Attempting to delete files:', filePaths);

          const { error: deleteFilesError } = await supabase
            .storage
            .from('llm_docs')
            .remove(filePaths);

          if (deleteFilesError) {
            throw new Error(`Failed to delete storage files: ${deleteFilesError.message}`);
          }
          logWithTimestamp('Successfully deleted files from storage');

          // After deleting files, attempt to delete the empty folder
          const { error: deleteFolderError } = await supabase
            .storage
            .from('llm_docs')
            .remove([`${indexName}/`]);

          if (deleteFolderError) {
            logWithTimestamp('Warning: Failed to delete empty folder:', deleteFolderError);
            // Don't throw error for folder deletion failure
          } else {
            logWithTimestamp('Successfully deleted empty folder');
          }
        } else {
          // If no files found, try to delete the folder directly
          const { error: deleteFolderError } = await supabase
            .storage
            .from('llm_docs')
            .remove([`${indexName}/`]);

          if (deleteFolderError) {
            logWithTimestamp('Warning: Failed to delete folder:', deleteFolderError);
          } else {
            logWithTimestamp('Successfully deleted folder');
          }
        }
      } catch (storageError) {
        console.error('Storage cleanup error:', storageError);
        
        // If it's a permissions error
        if (storageError.message.includes('permission')) {
          setError('Storage cleanup failed: Permission denied. Please check storage permissions.');
        } else {
          setError(`Storage cleanup failed: ${storageError.message}. Files may need manual deletion.`);
        }
        
        // Log the error details
        logWithTimestamp('Storage cleanup failed:', {
          error: storageError.message,
          indexName: indexName,
          errorType: storageError.name,
          statusCode: storageError.statusCode
        });
      }

      // Add this after the storage deletion attempt
      const verifyDeletion = async (indexName) => {
        try {
          // Verify storage deletion
          const { data: remainingFiles, error: verifyError } = await supabase
            .storage
            .from('llm_docs')
            .list(indexName);

          if (verifyError) {
            logWithTimestamp('Verification check failed:', verifyError);
            return;
          }

          if (remainingFiles && remainingFiles.length > 0) {
            logWithTimestamp('Warning: Some files may remain in storage:', {
              indexName,
              remainingFiles
            });
            setStatusMessage('Warning: Some files may remain in storage. Please check manually.');
          } else {
            logWithTimestamp('Verification complete: All files deleted successfully');
          }
        } catch (error) {
          logWithTimestamp('Verification check failed:', error);
        }
      };

      // Add this to your deletion process
      await verifyDeletion(indexName);

      // 5. Reset UI state
      setSelectedByName(null);
      if (autocompleteRef.current) {
        autocompleteRef.current.value = '';
      }
      
      // 6. Refresh indices list
      await fetchIndices();
      
      setStatusMessage('Index and all associated data deleted successfully!');
      logWithTimestamp('Deletion process completed successfully');

    } catch (error) {
      console.error('Deletion process failed:', error);
      setError(error.message || 'Failed to delete index');
    } finally {
      setIsLoading(false);
      setIsConfirmOpen(false);
      setTimeout(() => setStatusMessage(''), 3000);
    }
  };

  const confirmationDialog = (
    <Dialog
      open={isConfirmOpen}
      onClose={() => !isLoading && setIsConfirmOpen(false)}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1,
        color: '#d32f2f'
      }}>
        <MdWarning size={24} />
        Confirm Complete Deletion
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          This will permanently delete:
          <Box component="ul" sx={{ mt: 1, mb: 2 }}>
            <li>The index from the vector database</li>
            <li>All associated database records</li>
            <li>All stored documents and files</li>
          </Box>
          {selectedByName && (
            <Box sx={{ fontWeight: 'bold', mt: 2 }}>
              Index Name: {selectedByName.index_name}
            </Box>
          )}
          <Box sx={{ 
            mt: 2, 
            color: 'error.main', 
            fontWeight: 'bold' 
          }}>
            This action cannot be undone.
          </Box>
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button 
          onClick={() => setIsConfirmOpen(false)}
          disabled={isLoading}
          sx={{ color: 'text.secondary' }}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleConfirmDelete}
          variant="contained"
          color="error"
          disabled={isLoading}
          sx={{
            bgcolor: '#d32f2f',
            '&:hover': {
              bgcolor: '#b71c1c',
            }
          }}
        >
          {isLoading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={20} color="inherit" />
              <span>Deleting...</span>
            </Box>
          ) : (
            'Delete Everything'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Delete Index
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Search by index name to delete an index
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {statusMessage && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {statusMessage}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Autocomplete
            ref={autocompleteRef}
            options={existingIndices}
            getOptionLabel={(option) => option.index_name}
            value={selectedByName}
            onChange={(event, newValue) => handleNameSelection(newValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Search by Index Name"
                placeholder="Start typing to search..."
                variant="outlined"
              />
            )}
            isOptionEqualToValue={(option, value) => option.index_name === value.index_name}
            disabled={isLoading}
            sx={{
              '& .MuiOutlinedInput-root': {
                '&.Mui-focused fieldset': {
                  borderColor: '#000',
                },
              },
            }}
          />

          {selectedByName && (
            <Paper 
              variant="outlined" 
              sx={{ 
                p: 2, 
                bgcolor: 'rgba(0, 0, 0, 0.02)',
                border: '1px solid rgba(0, 0, 0, 0.1)'
              }}
            >
              <Typography variant="subtitle2" gutterBottom>
                Selected Index Details:
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Index Name: {selectedByName.index_name}
              </Typography>
            </Paper>
          )}

          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={isLoading || !selectedByName}
            sx={{
              alignSelf: 'flex-start',
              px: 4,
              py: 1,
              bgcolor: '#d32f2f',
              '&:hover': {
                bgcolor: '#b71c1c',
              },
              '&.Mui-disabled': {
                bgcolor: 'rgba(211, 47, 47, 0.5)',
              }
            }}
          >
            {isLoading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={20} color="inherit" />
                <span>Deleting...</span>
              </Box>
            ) : (
              'Delete Index'
            )}
          </Button>
        </Box>
      </Paper>

      {confirmationDialog}
    </Box>
  );
};

export default DeleteIndexTab;