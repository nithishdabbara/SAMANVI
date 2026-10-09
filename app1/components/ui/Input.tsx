import React from 'react';
import { View, TextInput, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Colors';

export const InputField = ({ label, icon, ...props }: any) => (
  <View style={styles.container}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.inputWrapper}>
      {icon && <View style={styles.icon}>{icon}</View>}
      <TextInput style={styles.input} placeholderTextColor={Colors.textSecondary} {...props} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceSecondary, borderRadius: 16, height: 56, paddingHorizontal: 16 },
  icon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: Colors.textPrimary, height: '100%' }
});
