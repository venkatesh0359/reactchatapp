import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Typography,
  Box,
  CircularProgress,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Link,
} from '@mui/material';
import { MdClose, MdDelete, MdSearch } from 'react-icons/md';

import { supabase } from '../../config/supabase';

const FileInfoModal = ({ open, onClose, indexData, files, isLoading }) => {
  const [filterText, setFilterText] = useState('');
  const [orderBy, setOrderBy] = useState('file_name');
  const [order, setOrder] = useState('asc');
  const [fileMetadata, setFileMetadata] = useState({});

  useEffect(() => {
    const fetchFileMetadata = async () => {
      if (!indexData?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('llm_index_docs')
          .select('file_name, created_at, sync_with_croma_DB_Docs')
          .eq('index_id', indexData.id);

        if (error) throw error;
        
        const metadataMap = {};
        data.forEach(item => {
          metadataMap[item.file_name] = {
            created_at: item.created_at,
            sync_with_croma_DB_Docs: item.sync_with_croma_DB_Docs
          };
        });
        
        setFileMetadata(metadataMap);
      } catch (err) {
        console.error('Error fetching file metadata:', err);
      }
    };

    if (open) {
      fetchFileMetadata();
    }
  }, [indexData?.id, open]);

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredAndSortedFiles = useMemo(() => {
    return files
      ?.filter((file) => 
        file.name?.toLowerCase().includes(filterText.toLowerCase())
      )
      .sort((a, b) => {
        const isAsc = order === 'asc';
        
        // Handle created_at sorting
        if (orderBy === 'created_at') {
          if (!a.created_at || !b.created_at) return 0;
          return isAsc
            ? new Date(a.created_at) - new Date(b.created_at)
            : new Date(b.created_at) - new Date(a.created_at);
        }
        
        // Handle name sorting with null checks
        const aValue = a[orderBy] || '';
        const bValue = b[orderBy] || '';
        return isAsc
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      });
  }, [files, filterText, order, orderBy]);

  if (!indexData) return null;

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
          minHeight: '40vh',
          overflowX: 'hidden',
        }
      }}
    >
      <DialogTitle 
        sx={{ 
          p: 3,
          background: 'linear-gradient(145deg, #f6f8fc 0%, #ffffff 100%)',
          borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
        }}
      >
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <Box>
            <Typography 
              variant="h6" 
              component="div"
              sx={{ fontWeight: 600, color: '#1a2027', mb: 0.5 }}
            >
              Files in Index: {indexData?.index_name}
            </Typography>
            <Typography 
              variant="subtitle2"
              sx={{ color: 'text.secondary' }}
            >
              Index ID: {indexData?.id}
            </Typography>
          </Box>
          <IconButton
            onClick={onClose}
            sx={{
              color: 'text.secondary',
              backgroundColor: 'rgba(0, 0, 0, 0.04)',
              '&:hover': { 
                backgroundColor: 'rgba(0, 0, 0, 0.08)',
                transform: 'scale(1.05)',
              }
            }}
          >
            <MdClose />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {/* Search Bar */}
        <Box sx={{ p: 2, borderBottom: '1px solid rgba(0, 0, 0, 0.08)' }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search by File Name..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            InputProps={{
              startAdornment: <MdSearch style={{ marginRight: 8 }} />,
            }}
            size="small"
          />
        </Box>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress size={28} sx={{ color: '#2196f3' }} />
          </Box>
        ) : filteredAndSortedFiles?.length === 0 ? (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            p: 3,
            color: 'text.secondary' 
          }}>
            <Typography>No files found</Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>
                    <TableSortLabel
                      active={orderBy === 'name'}
                      direction={orderBy === 'name' ? order : 'asc'}
                      onClick={() => handleRequestSort('name')}
                    >
                      File Name
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={orderBy === 'created_at'}
                      direction={orderBy === 'created_at' ? order : 'asc'}
                      onClick={() => handleRequestSort('created_at')}
                    >
                      Created At
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>Sync Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredAndSortedFiles?.map((file, index) => (
                  <TableRow 
                    key={index}
                    hover
                    sx={{
                      '&:last-child td': { borderBottom: 0 }
                    }}
                  >
                    <TableCell>
                      <Link 
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ 
                          textDecoration: 'none',
                          color: '#1976d2',
                          '&:hover': { textDecoration: 'underline' }
                        }}
                      >
                        {file.name}
                      </Link>
                    </TableCell>
                    <TableCell>{formatDate(fileMetadata[file.name]?.created_at)}</TableCell>
                    <TableCell>
                      <Typography
                        sx={{
                          color: fileMetadata[file.name]?.sync_with_croma_DB_Docs ? 'success.main' : 'error.main',
                          fontWeight: 500
                        }}
                      >
                        {fileMetadata[file.name]?.sync_with_croma_DB_Docs ? "Synced" : "Not Synced"}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        sx={{
                          color: '#d32f2f',
                          '&:hover': { backgroundColor: 'rgba(211, 47, 47, 0.04)' }
                        }}
                      >
                        <MdDelete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>

      <DialogActions 
        sx={{ 
          p: 2.5, 
          borderTop: '1px solid rgba(0, 0, 0, 0.08)',
          background: 'linear-gradient(145deg, #f6f8fc 0%, #ffffff 100%)',
        }}
      >
        <Button 
          onClick={onClose}
          variant="contained"
          sx={{ 
            textTransform: 'none',
            px: 3,
            py: 1,
            borderRadius: '8px',
            backgroundColor: '#000',
            '&:hover': {
              backgroundColor: '#333',
              transform: 'scale(1.02)',
            }
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FileInfoModal;