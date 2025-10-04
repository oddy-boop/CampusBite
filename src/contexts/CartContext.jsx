import React, { createContext, useContext, useReducer, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CartContext = createContext();

const CART_STORAGE_KEY = '@campusbite_cart';

// Cart reducer to manage cart state
const cartReducer = (state, action) => {
  switch (action.type) {
    case 'SET_CART':
      return {
        ...state,
        items: action.payload,
      };
    
    case 'ADD_ITEM':
      const existingItemIndex = state.items.findIndex(
        item => item.id === action.payload.id && item.vendorId === action.payload.vendorId
      );
      
      if (existingItemIndex >= 0) {
        const updatedItems = [...state.items];
        updatedItems[existingItemIndex].quantity += action.payload.quantity || 1;
        return {
          ...state,
          items: updatedItems,
        };
      } else {
        return {
          ...state,
          items: [...state.items, { ...action.payload, quantity: action.payload.quantity || 1 }],
        };
      }
    
    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter(item => 
          !(item.id === action.payload.id && item.vendorId === action.payload.vendorId)
        ),
      };
    
    case 'UPDATE_QUANTITY':
      return {
        ...state,
        items: state.items.map(item =>
          item.id === action.payload.id && item.vendorId === action.payload.vendorId
            ? { ...item, quantity: action.payload.quantity }
            : item
        ).filter(item => item.quantity > 0),
      };
    
    case 'CLEAR_CART':
      return {
        ...state,
        items: [],
      };
    
    case 'SET_VENDOR':
      return {
        ...state,
        currentVendor: action.payload,
      };
    
    default:
      return state;
  }
};

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(cartReducer, {
    items: [],
    currentVendor: null,
  });

  // Load cart from AsyncStorage on mount
  useEffect(() => {
    const loadCart = async () => {
      try {
        const savedCart = await AsyncStorage.getItem(CART_STORAGE_KEY);
        if (savedCart) {
          const cartData = JSON.parse(savedCart);
          dispatch({ type: 'SET_CART', payload: cartData.items });
          if (cartData.currentVendor) {
            dispatch({ type: 'SET_VENDOR', payload: cartData.currentVendor });
          }
        }
      } catch (error) {
        console.error('Failed to load cart from storage:', error);
      }
    };
    
    loadCart();
  }, []);

  // Save cart to AsyncStorage whenever it changes
  useEffect(() => {
    const saveCart = async () => {
      try {
        const cartData = {
          items: state.items,
          currentVendor: state.currentVendor,
        };
        await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartData));
      } catch (error) {
        console.error('Failed to save cart to storage:', error);
      }
    };
    
    saveCart();
  }, [state.items, state.currentVendor]);

  const addItem = (item) => {
    // If switching vendors, clear cart and confirm with user
    if (state.currentVendor && state.currentVendor.id !== item.vendorId && state.items.length > 0) {
      // In a real app, you'd show a confirmation dialog here
      dispatch({ type: 'CLEAR_CART' });
    }
    
    dispatch({ type: 'ADD_ITEM', payload: item });
    
    // Set current vendor if not set
    if (!state.currentVendor || state.currentVendor.id !== item.vendorId) {
      dispatch({ type: 'SET_VENDOR', payload: { id: item.vendorId, name: item.vendorName } });
    }
  };

  const removeItem = (itemId, vendorId) => {
    dispatch({ type: 'REMOVE_ITEM', payload: { id: itemId, vendorId } });
    
    // Clear vendor if cart becomes empty
    const remainingItems = state.items.filter(item => 
      !(item.id === itemId && item.vendorId === vendorId)
    );
    if (remainingItems.length === 0) {
      dispatch({ type: 'SET_VENDOR', payload: null });
    }
  };

  const updateQuantity = (itemId, vendorId, quantity) => {
    if (quantity <= 0) {
      removeItem(itemId, vendorId);
    } else {
      dispatch({ type: 'UPDATE_QUANTITY', payload: { id: itemId, vendorId, quantity } });
    }
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
    dispatch({ type: 'SET_VENDOR', payload: null });
  };

  const getTotalPrice = () => {
    return state.items.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getTotalItems = () => {
    return state.items.reduce((total, item) => total + item.quantity, 0);
  };

  const formatPrice = (price) => {
    return `₵${price.toFixed(2)}`;
  };

  const value = {
    items: state.items,
    currentVendor: state.currentVendor,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    getTotalPrice,
    getTotalItems,
    formatPrice,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}