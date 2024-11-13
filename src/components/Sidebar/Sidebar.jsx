import React from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Box,
  Avatar,
  Typography
} from '@mui/material';
import {
  MdViewList,
  MdAddCircle,
  MdCreateNewFolder,
  MdDelete
} from 'react-icons/md';
import { FaUserCircle } from 'react-icons/fa';
import { TbSettingsSearch } from "react-icons/tb";
import { useTabContext } from '../../context/TabContext';

const DRAWER_WIDTH = 240;

const tabs = [
  { icon: <MdViewList size={24} />, label: 'Show Indices' },
  { icon: <MdAddCircle size={24} />, label: 'Create Index' },
  { icon: <MdCreateNewFolder size={24} />, label: 'Add to Index' },
  { icon: <MdDelete size={24} />, label: 'Delete Index' },
  { icon: <TbSettingsSearch size={24} />, label: 'Search Templates' },
];

const Sidebar = () => {
  const { activeTab, handleTabChange } = useTabContext();

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          bgcolor: '#000',
          color: '#fff',
          borderRadius: 0,
        },
      }}
    >
      <List sx={{ flexGrow: 1, mt: 2 }}>
        {tabs.map((tab, index) => (
          <ListItem
            button
            key={index}
            onClick={() => handleTabChange(index)}
            sx={{
              mx: 1,
              borderRadius: 1,
              color: activeTab === index ? '#fff' : '#808080',
              bgcolor: activeTab === index ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                color: '#fff',
              },
            }}
          >
            <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
              {tab.icon}
            </ListItemIcon>
            <ListItemText primary={tab.label} />
          </ListItem>
        ))}
      </List>

      <Box sx={{
        p: 2,
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
      }}>
        <Avatar sx={{ bgcolor: 'grey.800', mr: 2 }}>
          <FaUserCircle />
        </Avatar>
        <Box>
          <Typography variant="subtitle2">Admin_Name</Typography>
          <Typography variant="caption" sx={{ color: 'grey.500' }}>
            Admin
          </Typography>
        </Box>
      </Box>
    </Drawer>
  );
};

export default Sidebar;
