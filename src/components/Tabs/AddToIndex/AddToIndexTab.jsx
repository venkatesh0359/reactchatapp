// src/components/Tabs/AddToIndex/AddToIndexTab.jsx
import React, { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Paper,
  Typography,
  Alert,
  Autocomplete,
  TextField,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
} from '@mui/material';
import { MdDelete, MdUploadFile, MdDriveFolderUpload } from 'react-icons/md';
import { useTabContext } from '../../../context/TabContext';
import { supabase } from '../../../config/supabase';
import { 
  RUNPOD_ENDPOINT, 
  RUNPOD_API_KEY, 
  BUCKET_NAME
} from '../../../config/constants';

const AWS_ENDPOINT = 'http://35.173.17.197:9001/add_docs/';
console.log('AWS_ENDPOINT:', AWS_ENDPOINT);
const AWS_AUTH_TOKEN = '805Z641FNUTOL4LT222NZ73F18IL1O43TPXW7EA8';
const AWS_LIST_INDEX_ENDPOINT = 'http://35.173.17.197:9001/list-index/';
console.log('AWS_LIST_INDEX_ENDPOINT:', AWS_LIST_INDEX_ENDPOINT);

const AddToIndexTab = () => {
  const { selectedIndexData } = useTabContext();
  const [existingIndices, setExistingIndices] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  const fileInputRef = React.useRef(null);

  // Fetch existing indices on component mount
  useEffect(() => {
    fetchIndices();
  }, []);

  // Effect to handle pre-population
  useEffect(() => {
    console.log('selectedIndexData:', selectedIndexData);
    if (selectedIndexData) {
      console.log('Setting selected index:', selectedIndexData);
      setSelectedIndex(selectedIndexData);
    }
  }, [selectedIndexData]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage('');
      }, 15000); // 15 seconds

      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const fetchIndices = async () => {
    try {
      setIsLoading(true);
      
      // 1. Fetch Supabase indices
      const { data: supabaseIndices, error: supabaseError } = await supabase
        .from('llm_index')
        .select('id, index_name');

      if (supabaseError) throw supabaseError;

      // 2. Fetch AWS indices
      const awsResponse = await axios.get(AWS_LIST_INDEX_ENDPOINT, {
        headers: {
          'Authorization': AWS_AUTH_TOKEN
        }
      });

      setExistingIndices(supabaseIndices.map(idx => ({
        id: idx.id,
        index_name: idx.index_name
      })));

    } catch (error) {
      console.error('Error fetching indices:', error);
      setError('Failed to load existing indices');
    } finally {
      setIsLoading(false);
    }
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

  const saveToDatabase = async (indexId, indexName, uploadedFiles) => {
    try {
      // 1. Check if index exists in AWS by calling the list-index endpoint
      const awsIndexResponse = await axios.get(AWS_LIST_INDEX_ENDPOINT, {
        headers: {
          'Authorization': AWS_AUTH_TOKEN
        }
      });
      
      console.log('AWS List Index Response:', awsIndexResponse.data);
      
      // Extract the index list from the response
      const { status, indexlist } = awsIndexResponse.data;
      
      // Validate the response
      if (status !== "OK" || !Array.isArray(indexlist)) {
        throw new Error('Invalid response from AWS index list');
      }
      
      // Check if the index exists in the AWS response
      if (!indexlist.includes(indexName)) {
        throw new Error('Index not found in AWS. Please create the index first.');
      }

      // 2. If index doesn't exist in AWS, alert and stop
      if (!indexlist.includes(indexName)) {
        throw new Error('Index not found in AWS. Please create the index first.');
      }

      // 3. Get or create index in Supabase
      let finalIndexId = indexId;
      if (!finalIndexId) {
        const { data: existingIndex, error: getError } = await supabase
          .from('llm_index')
          .select('id, sync_with_cromaDB')
          .eq('index_name', indexName)
          .single();

        if (getError && getError.code !== 'PGRST116') throw getError;

        if (existingIndex) {
          // Check sync_with_cromaDB status
          if (!existingIndex.sync_with_cromaDB) {
            throw new Error('Index is not synchronized with AWS. Please sync the index first.');
          }
          finalIndexId = existingIndex.id;
        } else {
          throw new Error('Index not found in database.');
        }
      }

      // 4. Insert documents into llm_index_docs
      const docsToInsert = uploadedFiles.map(({ name, url }) => ({
        index_id: finalIndexId,
        file_url: url,
        file_name: name,
        sync_with_croma_DB_Docs: false
      }));

      const { data: docsData, error: docsError } = await supabase
        .from('llm_index_docs')
        .insert(docsToInsert)
        .select();

      if (docsError) throw docsError;

      // 5. Upload to AWS index with enhanced logging
      for (const file of uploadedFiles) {
        try {
          console.log('Sending request to AWS add_docs endpoint:', {
            url: file.url,
            indexname: indexName
          });

          const response = await axios.post(
            AWS_ENDPOINT,
            {
              url: file.url,
              indexname: indexName
            },
            {
              headers: {
                'Authorization': AWS_AUTH_TOKEN,
                'Content-Type': 'application/json'
              }
            }
          );

          console.log('AWS add_docs Response:', {
            status: response.status,
            data: response.data,
            file: file.name
          });

          if (response.status === 200) {
            console.log(`Successfully added ${file.name} to AWS index`);
            // Update sync status
            await supabase
              .from('llm_index_docs')
              .update({ sync_with_croma_DB_Docs: true })
              .match({ 
                index_id: finalIndexId,
                file_name: file.name 
              });
          } else {
            console.error('Unexpected response from AWS:', response);
            throw new Error(`Failed to sync ${file.name} with AWS: Unexpected response`);
          }
        } catch (error) {
          console.error('Error from AWS add_docs endpoint:', {
            error: error.response?.data || error.message,
            status: error.response?.status,
            file: file.name
          });
          throw new Error(`Failed to upload ${file.name} to AWS: ${error.message}`);
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error in saveToDatabase:', error);
      throw error;
    }
  };

  const handleSubmit = async () => {
    console.log('Starting handleSubmit with documents:', documents);
    const uploadedFiles = [];
    const storageFiles = []; // Track files uploaded to storage
    
    setIsLoading(true);
    setError('');
    setSuccessMessage(''); // Clear any existing success message

    try {
      // Step 1: Upload to Supabase Storage
      for (const doc of documents) {
        const folderPath = selectedIndex.index_name;
        const filePath = `${folderPath}/${doc.file.name}`;
        console.log('Uploading to Supabase Storage:', filePath);

        // Upload file to storage
        const { data, error } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(filePath, doc.file, {
            cacheControl: '31536000',
            upsert: true,
          });
        console.log('Supabase storage upload response:', { data, error });

        if (error) throw error;

        // Track the file path for potential rollback
        storageFiles.push(filePath);

        // Get signed URL
        const { data: urlData, error: urlError } = await supabase.storage
          .from(BUCKET_NAME)
          .createSignedUrl(filePath, 31536000);

        if (urlError) {
          // Rollback storage uploads if getting signed URL fails
          await rollbackStorageUploads(storageFiles);
          throw urlError;
        }

        uploadedFiles.push({
          name: doc.file.name,
          url: urlData.signedUrl,
          path: filePath
        });
      }

      // Save to database and attempt AWS upload
      try {
        await saveToDatabase(selectedIndex.id, selectedIndex.index_name, uploadedFiles);
        setSuccessMessage('Documents added successfully!');
        setDocuments([]); // Clear the file list
      } catch (error) {
        if (error.message.includes('failed to sync')) {
          setError(error.message);
        } else {
          await rollbackStorageUploads(storageFiles);
          setError('Failed to add documents. All changes have been rolled back.');
        }
      }
    } catch (error) {
      console.error('Detailed error in handleSubmit:', error.response || error);
      setError('Failed to add documents. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Rollback helper function
  const rollbackStorageUploads = async (filePaths) => {
    console.log('Rolling back storage uploads:', filePaths);
    
    const rollbackErrors = [];
    for (const path of filePaths) {
      try {
        const { error } = await supabase.storage
          .from(BUCKET_NAME)
          .remove([path]);
        
        if (error) {
          rollbackErrors.push(`Failed to delete ${path}: ${error.message}`);
        }
      } catch (error) {
        rollbackErrors.push(`Failed to delete ${path}: ${error.message}`);
      }
    }

    if (rollbackErrors.length > 0) {
      console.error('Errors during rollback:', rollbackErrors);
      // You might want to notify an admin or log these somewhere
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Add to Existing Index
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Select an index and add new documents to it
        </Typography>
      </Box>

      {error && (
        <Alert 
          severity="error" 
          onClose={() => setError('')}
          sx={{ mb: 2 }}
        >
          {error}
        </Alert>
      )}

      {successMessage && (
        <Alert 
          severity="success" 
          onClose={() => setSuccessMessage('')}
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
          <Autocomplete
            options={existingIndices}
            getOptionLabel={(option) => {
              if (!option) return '';
              return option.index_name || '';
            }}
            value={selectedIndex}
            onChange={(event, newValue) => {
              console.log('New value selected:', newValue);
              setSelectedIndex(newValue);
              setError('');
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Search Index"
                placeholder="Start typing to search..."
                variant="outlined"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {isLoading ? <CircularProgress color="inherit" size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
            isOptionEqualToValue={(option, value) => {
              if (!option || !value) return false;
              return option.index_name === value.index_name;
            }}
            disabled={isLoading}
            sx={{
              '& .MuiOutlinedInput-root': {
                '&.Mui-focused fieldset': {
                  borderColor: '#000',
                },
              },
            }}
          />

          <Box>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              mb: 2 
            }}>
              <Typography variant="subtitle1">Upload Documents</Typography>
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
            disabled={isLoading || !selectedIndex || documents.length === 0}
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
                <span>Adding to Index...</span>
              </Box>
            ) : (
              'Add to Index'
            )}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default AddToIndexTab;