import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import ShowIndicesTab from '../Tabs/ShowIndices/ShowIndicesTab';
import CreateIndexTab from '../Tabs/CreateIndex/CreateIndexTab';
import AddToIndexTab from '../Tabs/AddToIndex/AddToIndexTab';
import DeleteIndexTab from '../Tabs/DeleteIndex/DeleteIndexTab';
import SearchTemplatesTab from '../Tabs/SearchTemplates/SearchTemplatesTab';
import { useTabContext } from '../../context/TabContext';

const MainContent = () => {
  const { activeTab } = useTabContext();

  const getTabTitle = () => {
    const titles = ['Show Indices', 'Create Index', 'Add to Index', 'Delete Index', 'Search Templates'];
    return titles[activeTab];
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 0:
        return <ShowIndicesTab />;
      case 1:
        return <CreateIndexTab />;
      case 2:
        return <AddToIndexTab />;
      case 3:
        return <DeleteIndexTab />;
      case 4:
        return <SearchTemplatesTab />;
      default:
        return null;
    }
  };

  return (
    <Box
      component="main"
      sx={{
        flexGrow: 1,
        p: 3,
        bgcolor: '#f5f5f5', // Light grey background to make Paper stand out
        minHeight: '100vh',
      }}
    >
      <Typography
        variant="h4"
        gutterBottom
        sx={{
          fontWeight: 500,
          color: '#1a1a1a',
          mb: 3
        }}
      >
        {getTabTitle()}
      </Typography>

      <Paper
        elevation={2}
        sx={{
          p: 4,
          minHeight: 'calc(100vh - 130px)',
          bgcolor: '#fff',
          borderRadius: 2,
          boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.05)',
          border: '1px solid rgba(0, 0, 0, 0.05)',
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: 2,
            border: '1px solid rgba(255, 255, 255, 0.1)',
            pointerEvents: 'none'
          }
        }}
      >
        {renderTabContent()}
      </Paper>
    </Box>
  );
};

export default MainContent;