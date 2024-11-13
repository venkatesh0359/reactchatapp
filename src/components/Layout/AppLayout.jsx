import React from 'react';
import { Box } from '@mui/material';
import Sidebar from '../Sidebar/Sidebar';
import MainContent from './MainContent';

const AppLayout = () => {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <MainContent />
    </Box>
  );
}

export default AppLayout;