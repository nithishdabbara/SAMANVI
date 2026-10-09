import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../../constants/Colors';

export const PrimaryButton = ({ title, onPress, icon, disabled, style }: any) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.9} disabled={disabled} style={style}>
    <LinearGradient 
      colors={[Colors.primary, Colors.secondary]} 
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={[styles.primary, disabled && styles.disabled]}
    >
      {icon}
      <Text style={styles.primaryText}>{title}</Text>
    </LinearGradient>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  primary: {
    height: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 20, elevation: 8
  },
  disabled: { opacity: 0.6 },
  primaryText: { color: '#FFF', fontSize: 16, fontWeight: '600', marginLeft: 8 }
});
