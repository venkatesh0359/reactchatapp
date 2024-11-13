// src/components/Tabs/ShowIndices/ShowIndicesTab.jsx
import React, { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TablePagination,
  TextField,
  Button,
  IconButton,
  Typography,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import { MdDelete, MdSearch, MdError, MdRefresh, MdSync } from 'react-icons/md';
import { useTabContext } from '../../../context/TabContext';
import FileInfoModal from '../../Modals/FileInfoModal';
import { supabase } from '../../../config/supabase';

const ShowIndicesTab = () => {
  const { handleTabChange } = useTabContext();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [orderBy, setOrderBy] = useState('created_at');
  const [order, setOrder] = useState('desc');
  const [filterText, setFilterText] = useState('');
  const [isFileInfoOpen, setIsFileInfoOpen] = useState(false);
  const [selectedIndexFiles, setSelectedIndexFiles] = useState([]);
  const [selectedIndexForFiles, setSelectedIndexForFiles] = useState(null);
  const [indices, setIndices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [indexFiles, setIndexFiles] = useState({});
  const [syncStatus, setSyncStatus] = useState({});
  const [syncingIndices, setSyncingIndices] = useState({});

  // Fetch indices data
  useEffect(() => {
    const fetchIndicesAndFiles = async () => {
      try {
        setLoading(true);
        
        // Fetch indices with sync status
        const { data: indicesData, error: indicesError } = await supabase
          .from('llm_index')
          .select('*, sync_with_cromaDB');

        if (indicesError) throw indicesError;

        console.log('[Supabase] Indices Data:', indicesData);

        // If no indices found, set empty arrays
        if (!indicesData || indicesData.length === 0) {
          console.log('[Supabase] No indices found');
          setError('No indices found in the database.');
          setIndices([]);
          setIndexFiles({});
          return;
        }

        // Fetch files for each index
        const filesPromises = indicesData.map(index =>
          supabase
            .from('llm_index_docs')
            .select('*')
            .eq('index_id', index.id)
        );

        const filesResults = await Promise.all(filesPromises);
        
        // Create a map of index_id to files
        const filesMap = {};
        filesResults.forEach((result, index) => {
          if (result.error) {
            console.warn(`[Files] Error fetching files for index ${indicesData[index].index_name}:`, result.error);
          } else {
            filesMap[indicesData[index].id] = result.data;
          }
        });

        // Create sync status map
        const syncMap = {};
        
        // Check each index and its documents
        for (const index of indicesData) {
          if (!index.sync_with_cromaDB) {
            syncMap[index.id] = "Not Synced";
            continue;
          }

          // Check documents sync status
          const { data: docs, error: docsError } = await supabase
            .from('llm_index_docs')
            .select('sync_with_croma_DB_Docs')
            .eq('index_id', index.id);

          if (docsError) {
            console.error(`Error checking docs for index ${index.id}:`, docsError);
            syncMap[index.id] = "Not Synced";
            continue;
          }

          // If any doc is not synced, mark as not synced
          const allSynced = docs.every(doc => doc.sync_with_croma_DB_Docs);
          syncMap[index.id] = allSynced ? "Synced" : "Not Synced";
        }

        setSyncStatus(syncMap);
        setIndices(indicesData);
        setIndexFiles(filesMap);

      } catch (err) {
        console.error('[Error] Fetch operation failed:', err);
        setError(`Error: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchIndicesAndFiles();
  }, []);

  console.log('Current indices state:', indices);

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleAddToIndex = (indexData) => {
    console.log('Data being passed:', indexData);
    handleTabChange(2, {
      id: indexData.id,
      index_name: indexData.index_name,
      roles_allowed: indexData.roles_allowed,
      name: indexData.index_name
    });
  };

  const handleDeleteIndex = (indexData) => {
    handleTabChange(3, indexData);
  };

  const handleFileInfo = async (row) => {
    setSelectedIndexForFiles(row);
    try {
      const { data, error } = await supabase
        .from('llm_index_docs')
        .select('*')
        .eq('index_id', row.id);

      if (error) throw error;
      
      // Transform the data to match your UI requirements
      const formattedFiles = data.map(doc => ({
        name: doc.file_name,
        url: doc.file_url
      }));

      setSelectedIndexFiles(formattedFiles);
      setIsFileInfoOpen(true);
    } catch (err) {
      console.error('Error fetching files:', err);
      // Optionally show an error message to the user
    }
  };
  

  const formatDate = (dateString, isUpdatedAt = false, createdAt = null) => {
    // Check for null or undefined
    if (!dateString) {
      return 'Not Updated';
    }
    
    try {
      // For updated_at, check time difference with created_at
      if (isUpdatedAt && createdAt) {
        const timeDiff = Math.abs(new Date(dateString) - new Date(createdAt)) / 1000; // difference in seconds
        if (timeDiff < 60) {
          return 'Not Updated';
        }
      }

      return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'Invalid date';
    }
  };

  const getIndexFiles = (indexId) => {
    // This is mock data - replace with actual API call
    return [
      { 
        name: 'document1.pdf', 
        url: 'https://example.com/files/document1.pdf' 
      },
      { 
        name: 'report2023.pdf', 
        url: 'https://example.com/files/report2023.pdf' 
      },
      { 
        name: 'data_analysis.pdf', 
        url: 'https://example.com/files/data_analysis.pdf' 
      },
    ];
  };




  const filteredAndSortedData = useMemo(() => {
    return indices
      .filter((row) => {
        const searchTerm = filterText.toLowerCase();
        
        // Check index ID and name
        const basicMatch = 
          row.id.toString().toLowerCase().includes(searchTerm) ||
          row.index_name.toLowerCase().includes(searchTerm);
        
        // Check associated file names
        const filesMatch = indexFiles[row.id]?.some(file => 
          file.file_name.toLowerCase().includes(searchTerm)
        );

        return basicMatch || filesMatch;
      })
      .sort((a, b) => {
        const isAsc = order === 'asc';
        if (orderBy === 'created_at' || orderBy === 'updated_at') {
          return isAsc
            ? new Date(a[orderBy]) - new Date(b[orderBy])
            : new Date(b[orderBy]) - new Date(a[orderBy]);
        }
        return isAsc
          ? (a[orderBy] || '').localeCompare(b[orderBy] || '')
          : (b[orderBy] || '').localeCompare(a[orderBy] || '');
      });
  }, [indices, filterText, order, orderBy, indexFiles]);

  const handleRetrySync = async (indexId) => {
    setSyncingIndices(prev => ({ ...prev, [indexId]: true }));
    
    // Simulated sync delay - replace with actual sync logic later
    setTimeout(() => {
      setSyncingIndices(prev => ({ ...prev, [indexId]: false }));
      // For now, just update the sync status to demonstrate UI
      setSyncStatus(prev => ({ ...prev, [indexId]: "Synced" }));
    }, 2000);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h6">Indices Overview</Typography>

      {/* Add error banner at the top if exists, but don't block content */}
      {error && (
        <Paper 
          elevation={2}
          sx={{ 
            p: 2,
            bgcolor: 'background.paper',
            borderRadius: 1,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            border: '1px solid',
            borderColor: 'warning.light',
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 4,
              bgcolor: 'warning.main',
              borderRadius: '4px 0 0 4px'
            }
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <MdError 
              size={20} 
              color="#ED6C02"
            />
            <Typography 
              variant="body2" 
              sx={{ 
                color: 'text.primary',
                fontWeight: 500
              }}
            >
              {error}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<MdRefresh />}
            onClick={() => window.location.reload()}
            color="warning"
            sx={{
              ml: 2,
              minWidth: 'auto',
              whiteSpace: 'nowrap'
            }}
          >
            Refresh
          </Button>
        </Paper>
      )}

      {/* Show loading state if loading */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        /* Show table even if there's an error */
        <Paper sx={{ 
          width: '100%', 
          overflow: 'hidden',
          '& .MuiTableContainer-root': {
            maxWidth: '100%',
            overflowX: 'auto'
          }
        }}>
          {/* Search Bar */}
          <Box sx={{ p: 2, borderBottom: '1px solid rgba(0, 0, 0, 0.12)' }}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Search by Index ID, Name, or File Name..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              InputProps={{
                startAdornment: <MdSearch style={{ marginRight: 8 }} />,
              }}
              size="small"
            />
          </Box>

          <TableContainer>
            <Table stickyHeader sx={{ minWidth: 1200 }}>
              <TableHead>
                <TableRow>
                  <TableCell width="12%">
                    <TableSortLabel
                      active={orderBy === 'id'}
                      direction={orderBy === 'id' ? order : 'asc'}
                      onClick={() => handleRequestSort('id')}
                    >
                      Index ID
                    </TableSortLabel>
                  </TableCell>
                  <TableCell width="20%">
                    <TableSortLabel
                      active={orderBy === 'index_name'}
                      direction={orderBy === 'index_name' ? order : 'asc'}
                      onClick={() => handleRequestSort('index_name')}
                    >
                      Index Name
                    </TableSortLabel>
                  </TableCell>
                  <TableCell width="15%">
                    <TableSortLabel
                      active={orderBy === 'roles_allowed'}
                      direction={orderBy === 'roles_allowed' ? order : 'asc'}
                      onClick={() => handleRequestSort('roles_allowed')}
                    >
                      Roles Allowed
                    </TableSortLabel>
                  </TableCell>
                  <TableCell width="15%">
                    <TableSortLabel
                      active={orderBy === 'created_at'}
                      direction={orderBy === 'created_at' ? order : 'asc'}
                      onClick={() => handleRequestSort('created_at')}
                    >
                      Created At
                    </TableSortLabel>
                  </TableCell>
                  <TableCell width="15%">
                    <TableSortLabel
                      active={orderBy === 'updated_at'}
                      direction={orderBy === 'updated_at' ? order : 'asc'}
                      onClick={() => handleRequestSort('updated_at')}
                    >
                      Updated At
                    </TableSortLabel>
                  </TableCell>
                  <TableCell width="12%">
                    Sync Status
                  </TableCell>
                  <TableCell width="23%">
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredAndSortedData
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{row.id}</TableCell>
                      <TableCell>{row.index_name}</TableCell>
                      <TableCell>{row.roles_allowed}</TableCell>
                      <TableCell>{formatDate(row.created_at)}</TableCell>
                      <TableCell>{formatDate(row.updated_at, true, row.created_at)}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography
                            color={syncStatus[row.id] === "Synced" ? "success.main" : "error.main"}
                            sx={{ fontWeight: 500 }}
                          >
                            {syncStatus[row.id] || "Unknown"}
                          </Typography>
                          
                          {syncStatus[row.id] === "Not Synced" && (
                            <IconButton
                              size="small"
                              onClick={() => handleRetrySync(row.id)}
                              disabled={syncingIndices[row.id]}
                              sx={{
                                animation: syncingIndices[row.id] ? 'spin 1s linear infinite' : 'none',
                                '@keyframes spin': {
                                  '0%': {
                                    transform: 'rotate(0deg)',
                                  },
                                  '100%': {
                                    transform: 'rotate(360deg)',
                                  },
                                },
                              }}
                            >
                              <MdSync fontSize="medium" />
                            </IconButton>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ 
                          display: 'flex', 
                          gap: 1, 
                          justifyContent: 'flex-start',
                          minWidth: 'max-content',
                        }}>
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => handleFileInfo(row)}
                            sx={{
                              borderColor: '#000',
                              color: '#000',
                              '&:hover': {
                                borderColor: '#000',
                                bgcolor: 'rgba(0, 0, 0, 0.04)',
                              },
                              minWidth: 'max-content'
                            }}
                          >
                            File Info
                          </Button>


                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => handleAddToIndex(row)}
                            sx={{
                              borderColor: '#000',
                              color: '#000',
                              '&:hover': {
                                borderColor: '#000',
                                bgcolor: 'rgba(0, 0, 0, 0.04)',
                              },
                              minWidth: 'max-content'
                            }}
                          >
                            Add to Index
                          </Button>

                          <Tooltip title="Delete Index" placement="top">
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteIndex(row)}
                              sx={{
                                color: '#d32f2f',
                                '&:hover': {
                                  bgcolor: 'rgba(211, 47, 47, 0.04)',
                                }
                              }}
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
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={filteredAndSortedData.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(event, newPage) => setPage(newPage)}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(parseInt(event.target.value, 10));
              setPage(0);
            }}
          />
        </Paper>
      )}

      <FileInfoModal
        open={isFileInfoOpen}
        onClose={() => setIsFileInfoOpen(false)}
        indexData={selectedIndexForFiles}
        files={selectedIndexFiles}
      />


      



    </Box>
  );
};

export default ShowIndicesTab;