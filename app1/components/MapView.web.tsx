import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const Marker = ({ children }: any) => <View>{children}</View>;
export const Callout = ({ children }: any) => <View>{children}</View>;

const MapView = ({ children, style }: any) => {
  return (
    <View style={[style, styles.container]}>
      <Text style={styles.text}>🗺️ Interactive Map is active on Mobile Devices.</Text>
      <Text style={styles.subtext}>Please run Samanvi on iOS/Android to view the live community map.</Text>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ECEEF1',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  text: {
    fontSize: 18,
    fontWeight: '800',
    color: '#191C1E',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtext: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default MapView;
