// src/components/Tabs/CreateIndex/CreateIndexTab.jsx
import React, { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemIcon,
  ListItemText,
  OutlinedInput,
  Chip,
  IconButton,
  Paper,
  List,
  ListItem,
  CircularProgress,
} from '@mui/material';
import { MdDelete, MdUploadFile, MdDriveFolderUpload } from 'react-icons/md';
import { supabase } from '../../../config/supabase';
import { 
  BUCKET_NAME, 
  ROLES 
} from '../../../config/constants';

// AWS endpoint constants
const API_ENDPOINT = 'http://35.173.17.197:9001/create_kb';
const API_KEY = '8O5Z641FNUTOL4LT222NZ73F18IL1O43TPXW7EA8';

// Keep only relevant utility functions
const logWithTimestamp = (message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
};

const checkSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.from('llm_index').select('count').limit(1);
    const { data: session } = await supabase.auth.getSession();
    
    logWithTimestamp('Supabase connection check', {
      isConnected: !error,
      error: error?.message,
      clientStatus: {
        hasStorageClient: !!supabase.storage,
        hasAuthSession: !!session,
        baseUrl: supabase.storageUrl
      }
    });
    return !error;
  } catch (e) {
    logWithTimestamp('Supabase connection check failed', {
      error: e.message,
      stack: e.stack
    });
    return false;
  }
};

const rollbackStorage = async (filePaths) => {
  logWithTimestamp('Starting storage rollback', { filePaths });
  if (filePaths.length > 0) {
    const { error } = await supabase.storage
      .from('llm_docs')
      .remove(filePaths);
    
    if (error) {
      logWithTimestamp('Storage rollback failed', { error });
      throw new Error(`Storage rollback failed: ${error.message}`);
    }
  }
};

const CreateIndexTab = () => {
  const [indexName, setIndexName] = useState('');
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = React.useRef(null);

  // Move resetForm inside the component
  const resetForm = () => {
    setIndexName('');
    setSelectedRoles([]);
    setDocuments([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Add this useEffect to auto-dismiss the success message after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
      }, 15000); // 5 seconds

      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleRoleChange = (event) => {
    const value = event.target.value;
    setSelectedRoles(typeof value === 'string' ? value.split(',') : value);
  };

  const getSelectedRolesString = () => {
    return selectedRoles.join(', ');
  };

  const handleFiles = (files) => {
    const newDocs = Array.from(files).map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file: file,
      name: file.name
    }));
    setDocuments(prev => [...prev, ...newDocs]);
  };

  const handleFileSelect = (event) => {
    handleFiles(event.target.files);
    event.target.value = '';
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const { files } = e.dataTransfer;
    if (files && files.length) {
      handleFiles(files);
    }
  }, []);

  const handleRemoveDocument = (docId) => {
    setDocuments(documents.filter(doc => doc.id !== docId));
  };

  // Modify saveToDatabase function to use the correct column names
  const saveToDatabase = async (indexName, rolesAllowed, uploadedFiles) => {
    let indexId = null;
    let stage = 'initial';
    const uploadedFilePaths = uploadedFiles.map(f => f.path);

    try {
      // 1. Create index in Supabase
      stage = 'db_index';
      const { data: indexData, error: indexError } = await supabase
        .from('llm_index')
        .insert([{ 
          index_name: indexName,
          roles_allowed: rolesAllowed,
          sync_with_cromaDB: false // Using existing column name
        }])
        .select()
        .single();

      if (indexError) throw new Error(`Failed to create index: ${indexError.message}`);
      indexId = indexData.id;

      // 2. Insert documents into llm_index_docs
      stage = 'db_docs';
      const { error: docsError } = await supabase
        .from('llm_index_docs')
        .insert(uploadedFiles.map(({ name, url }) => ({
          index_id: indexId,
          file_url: url,
          file_name: name,
          sync_with_croma_DB_Docs: false // Using existing column name
        })));

      if (docsError) throw new Error(`Failed to save documents: ${docsError.message}`);

      // 3. Process with API endpoint
      stage = 'api';
      try {
        const apiResponse = await axios.post(
          API_ENDPOINT,
          {
            urls: uploadedFiles.map(f => f.url),
            indexname: indexName
          },
          {
            headers: {
              'Authorization': API_KEY,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!apiResponse.data || apiResponse.status !== 200) {
          throw new Error(`API processing failed: ${apiResponse.data?.message || 'Unknown error'}`);
        }

        // Update sync status to SYNCED after successful API call
        const { error: updateError } = await supabase
          .from('llm_index')
          .update({ 
            sync_with_cromaDB: true,
            updated_at: null
          })
          .eq('id', indexId);

        // Also update the docs sync status
        const { error: docsUpdateError } = await supabase
          .from('llm_index_docs')
          .update({ sync_with_croma_DB_Docs: true })
          .eq('index_id', indexId);

        if (updateError || docsUpdateError) {
          logWithTimestamp('Failed to update sync status', { 
            indexError: updateError, 
            docsError: docsUpdateError 
          });
        }

      } catch (apiError) {
        // On API failure, keep the records but marked as unsynced
        logWithTimestamp('API processing failed, keeping as unsynced', { error: apiError });
        return { 
          success: false, 
          status: 'unsynced',
          message: 'Files uploaded but processing failed. You can retry processing later.',
          indexId 
        };
      }

      return { success: true, status: 'synced' };

    } catch (error) {
      logWithTimestamp(`Error during ${stage}`, { error });

      // Handle different failure scenarios
      switch (stage) {
        case 'db_index':
          // If DB index creation fails, rollback storage
          await rollbackStorage(uploadedFilePaths);
          break;

        case 'db_docs':
          // If DB docs insertion fails, rollback storage and delete index
          await rollbackStorage(uploadedFilePaths);
          if (indexId) {
            await supabase.from('llm_index').delete().eq('id', indexId);
          }
          break;

        case 'api':
          // API failures are handled above - we keep the files and records
          break;
      }

      throw error;
    }
  };

  // Modify handleSubmit to handle the new return values
  const handleSubmit = async () => {
    const startTime = Date.now();
    logWithTimestamp('Starting index creation process', {
      indexName,
      selectedRoles,
      documentCount: documents.length
    });

    try {
      // Validate form inputs
      if (!indexName.trim()) {
        setError('Index name is required');
        return;
      }

      if (selectedRoles.length === 0) {
        setError('Please select at least one role');
        return;
      }

      if (documents.length === 0) {
        setError('Please upload at least one document');
        return;
      }

      setIsLoading(true);
      setError('');

      // Check Supabase connection first
      const isConnected = await checkSupabaseConnection();
      logWithTimestamp('Pre-upload checks', {
        supabaseConnected: isConnected,
        documentsCount: documents.length,
        documentsInfo: documents.map(doc => ({
          name: doc.file.name,
          size: doc.file.size,
          type: doc.file.type,
          lastModified: new Date(doc.file.lastModified).toISOString()
        }))
      });

      // Upload files to Supabase storage
      const uploadedFiles = [];
      for (const doc of documents) {
        logWithTimestamp(`Processing upload for: ${doc.file.name}`, {
          fileSize: `${(doc.file.size / 1024).toFixed(2)} KB`,
          fileType: doc.file.type,
          lastModified: new Date(doc.file.lastModified).toISOString()
        });

        console.log(`\nUploading file: ${doc.file.name}`);
        console.log('File details:', {
          name: doc.file.name,
          size: `${(doc.file.size / 1024).toFixed(2)} KB`,
          type: doc.file.type
        });

        const filePath = `${indexName}/${doc.file.name}`;
        console.log('Target path:', filePath);
        
        try {
          // First, try to upload the file
          console.log('Initiating upload to Supabase...');
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('llm_docs')
            .upload(filePath, doc.file, {
              cacheControl: '3600',
              upsert: true
            });

          if (uploadError) {
            console.error('Upload error details:', {
              message: uploadError.message,
              statusCode: uploadError.statusCode,
              error: uploadError.error,
              path: filePath
            });
            throw new Error(`File upload failed: ${uploadError.message}`);
          }

          console.log('File uploaded successfully:', uploadData);
          console.log('Generating signed URL...');

          // Get signed URL for the uploaded file
          const { data: urlData, error: urlError } = await supabase.storage
            .from('llm_docs')
            .createSignedUrl(filePath, 31536000);

          if (urlError) {
            console.error('Signed URL error:', {
              message: urlError.message,
              statusCode: urlError.statusCode,
              error: urlError.error,
              path: filePath
            });
            throw new Error(`Failed to generate signed URL: ${urlError.message}`);
          }

          console.log('Signed URL generated successfully');
          console.log('URL details:', {
            path: filePath,
            expiresIn: '1 year',
            urlLength: urlData.signedUrl.length
          });

          uploadedFiles.push({
            name: doc.file.name,
            url: urlData.signedUrl,
            path: filePath,
            size: doc.file.size,
            type: doc.file.type
          });

        } catch (uploadError) {
          console.error('Error context:', {
            fileName: doc.file.name,
            filePath: filePath,
            errorType: uploadError.name,
            errorMessage: uploadError.message,
            errorStack: uploadError.stack
          });
          
          // Check for specific error types
          if (uploadError.message.includes('storage/object-not-found')) {
            throw new Error(`Bucket or path not found for file ${doc.file.name}. Please check storage configuration.`);
          } else if (uploadError.message.includes('permission denied')) {
            throw new Error(`Permission denied while uploading ${doc.file.name}. Please check bucket policies.`);
          } else {
            throw new Error(`File upload failed for ${doc.file.name}: ${uploadError.message}`);
          }
        }
      }

      console.log('\n=== Upload Summary ===');
      console.log('Total files processed:', uploadedFiles.length);
      console.log('All files uploaded successfully');

      console.log('\n=== Starting Database Save ===');
      const result = await saveToDatabase(indexName, getSelectedRolesString(), uploadedFiles);
      
      if (result.success) {
        setSuccessMessage('Index created and processed successfully!');
        resetForm(); // Now this will work
      } else if (result.status === 'unsynced') {
        setSuccessMessage(result.message);
        resetForm(); // Now this will work
      }

      logWithTimestamp('Index creation completed successfully', {
        duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`
      });

      console.log('\n=== Process Complete ===');
      
    } catch (error) {
      logWithTimestamp('Index creation failed', {
        errorType: error.name,
        message: error.message,
        stack: error.stack,
        duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`
      });
      setError(error.message || 'Index creation failed. All changes have been rolled back.');
      setSuccessMessage(''); // Clear any existing success message
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Create a new index in the system
        </Typography>
      </Box>

      {error && (
        <Alert 
          severity="error" 
          onClose={() => setError('')} 
          sx={{ 
            mb: 2,
            '& .MuiAlert-icon': {
              color: '#ff3333'
            },
            '& .MuiAlert-message': {
              color: '#ff3333'
            },
            '& .MuiAlert-action .MuiIconButton-root': {
              color: '#ff3333'
            }
          }}
        >
          {error}
        </Alert>
      )}

      {successMessage && (
        <Alert 
          severity="success" 
          onClose={() => setSuccessMessage('')}  // Allow manual dismissal
          sx={{ 
            mb: 2,
            backgroundColor: '#f5f5f5',
            '& .MuiAlert-icon': {
              color: '#000'
            },
            '& .MuiAlert-message': {
              color: '#000'
            },
            '& .MuiAlert-action .MuiIconButton-root': {
              color: '#000',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)'
              }
            },
            border: '1px solid #000',
            borderRadius: 1
          }}
        >
          {successMessage}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <TextField
            fullWidth
            label="Index Name"
            value={indexName}
            onChange={(e) => setIndexName(e.target.value)}
            placeholder="Enter index name"
            variant="outlined"
            disabled={isLoading}
          />

          <FormControl fullWidth>
            <InputLabel id="roles-select-label">Select Roles</InputLabel>
            <Select
              labelId="roles-select-label"
              multiple
              value={selectedRoles}
              onChange={handleRoleChange}
              input={<OutlinedInput label="Select Roles" />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => (
                    <Chip 
                      key={value} 
                      label={value} 
                      sx={{ 
                        backgroundColor: '#000',
                        color: 'white',
                        '& .MuiChip-deleteIcon': {
                          color: 'white',
                          '&:hover': {
                            color: '#ccc'
                          }
                        }
                      }}
                    />
                  ))}
                </Box>
              )}
              sx={{
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(0, 0, 0, 0.23)',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(0, 0, 0, 0.87)',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#000',
                }
              }}
              MenuProps={{
                PaperProps: {
                  style: {
                    maxHeight: 224,
                  },
                },
              }}
            >
              {ROLES.map((role) => (
                <MenuItem key={role} value={role}>
                  <ListItemIcon>
                    <Checkbox
                      checked={selectedRoles.indexOf(role) > -1}
                      sx={{
                        color: '#000',
                        '&.Mui-checked': {
                          color: '#000',
                        },
                      }}
                    />
                  </ListItemIcon>
                  <ListItemText primary={role} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              mb: 2 
            }}>
              <Typography variant="subtitle1">Documents</Typography>
              <Button
                variant="outlined"
                startIcon={<MdUploadFile />}
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                sx={{ 
                  borderColor: '#000',
                  color: '#000',
                  '&:hover': {
                    borderColor: '#000',
                    backgroundColor: 'rgba(0, 0, 0, 0.04)'
                  }
                }}
              >
                Upload Document
              </Button>
            </Box>

            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileSelect}
              multiple
              disabled={isLoading}
            />

            <Box
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              sx={{
                border: '2px dashed',
                borderColor: isDragging ? '#000' : '#ccc',
                borderRadius: 1,
                bgcolor: isDragging ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                transition: 'all 0.2s ease',
                minHeight: documents.length === 0 ? '200px' : 'auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: documents.length === 0 ? 'center' : 'flex-start',
                p: 2,
              }}
            >
              {documents.length === 0 ? (
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center',
                  color: 'text.secondary'
                }}>
                  <MdDriveFolderUpload size={48} style={{ marginBottom: '8px' }} />
                  <Typography variant="body1" sx={{ mb: 1 }}>
                    Drag and drop your documents here
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    or use the upload button above
                  </Typography>
                </Box>
              ) : (
                <List sx={{ width: '100%' }}>
                  {documents.map((doc) => (
                    <ListItem
                      key={doc.id}
                      secondaryAction={
                        <IconButton 
                          edge="end" 
                          onClick={() => handleRemoveDocument(doc.id)}
                          disabled={isLoading}
                          sx={{ color: '#666' }}
                        >
                          <MdDelete />
                        </IconButton>
                      }
                      sx={{
                        borderBottom: '1px solid #f0f0f0',
                        '&:last-child': {
                          borderBottom: 'none'
                        }
                      }}
                    >
                      <ListItemText 
                        primary={doc.name}
                        secondary={`Size: ${(doc.file.size / 1024).toFixed(2)} KB`}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          </Box>

          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={isLoading || !indexName || selectedRoles.length === 0 || documents.length === 0}
            sx={{
              alignSelf: 'flex-start',
              px: 4,
              py: 1,
              bgcolor: '#000',
              '&:hover': {
                bgcolor: '#333'
              }
            }}
          >
            {isLoading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={20} color="inherit" />
                <span>Creating Index...</span>
              </Box>
            ) : (
              'Create Index'
            )}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default CreateIndexTab;