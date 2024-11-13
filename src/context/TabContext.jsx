import React, { createContext, useContext, useState } from 'react';

const TabContext = createContext();

export const TabProvider = ({ children }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedIndexData, setSelectedIndexData] = useState(null);

  const handleTabChange = (newTab, data = null) => {
    setActiveTab(newTab);
    setSelectedIndexData(data);
  };

  return (
    <TabContext.Provider value={{ 
      activeTab, 
      selectedIndexData,
      handleTabChange,
      setSelectedIndexData 
    }}>
      {children}
    </TabContext.Provider>
  );
};

export const useTabContext = () => useContext(TabContext);