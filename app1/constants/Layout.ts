// app1/constants/Layout.ts
import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const Layout = {
  window: { width, height },
  
  // iOS spacing system
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 20,
    xl: 32,
    xxl: 48
  },
  
  // iOS corner radius
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    card: 12,
    sheet: 20,
    button: 14
  },
  
  // iOS shadow
  shadow: {
    small: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 2
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4
    },
    large: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 8
    }
  }
};

export default Layout;
