import React, { createContext, useContext, useState } from 'react';
import { useColorScheme } from 'react-native';

const ThemeContext = createContext();

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export function ThemeProvider({ children }) {
  const colorScheme = useColorScheme();
  const [isDark, setIsDark] = useState(colorScheme === 'dark');

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  const colors = {
    // CampusBite Brand Colors
    primary: '#FF8A00', // Orange
    secondary: '#00C853', // Green
    
    // Background colors
    background: isDark ? '#121212' : '#F5F5F5',
    surface: isDark ? '#1E1E1E' : '#FFFFFF',
    elevated: isDark ? '#262626' : '#FFFFFF',
    card: isDark ? '#1E1E1E' : '#FFFFFF',
    
    // Text colors
    text: isDark ? 'rgba(255, 255, 255, 0.87)' : '#333333',
    textSecondary: isDark ? 'rgba(255, 255, 255, 0.60)' : '#666666',
    textMuted: isDark ? 'rgba(255, 255, 255, 0.38)' : '#9E9E9E',
    
    // Brand colors (adjusted for dark mode)
    primaryMuted: isDark ? '#2A1F16' : '#FFF4E6',
    
    // UI colors
    border: isDark ? '#333333' : '#E9E9E9',
    borderLight: isDark ? '#2A2A2A' : '#EDEDED',
    separator: isDark ? '#2A2A2A' : '#E5E5E5',
    
    // Status colors
    success: '#00C853',
    warning: '#FFD60A',
    error: '#FF3B30',
    
    // Special colors
    cream: isDark ? '#2A2520' : '#F6F1EA',
    overlay: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.5)',
  };

  const value = {
    isDark,
    colors,
    toggleTheme,
    statusBarStyle: isDark ? 'light' : 'dark',
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}