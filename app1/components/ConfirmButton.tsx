import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../constants/Config';

interface ConfirmButtonProps {
  problemId: string;
  initialCount: number;
}

export default function ConfirmButton({ problemId, initialCount }: ConfirmButtonProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if user has already confirmed this problem locally
    (async () => {
      try {
        const value = await SecureStore.getItemAsync(`confirmed_${problemId}`);
        if (value === 'true') {
          setConfirmed(true);
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, [problemId]);

  // Sync initial count if it changes from parent
  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  const handleConfirm = async () => {
    if (confirmed || loading) return;

    // Fire medium haptic feedback
    if (Platform.OS !== 'web') {
      try {
        const Haptics = require('expo-haptics');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (e) {}
    }

    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch(`${API_BASE_URL}/problems/${problemId}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (response.ok) {
        setConfirmed(true);
        setCount(data.confirmation_count ?? (count + 1));
        await SecureStore.setItemAsync(`confirmed_${problemId}`, 'true');
      } else {
        Alert.alert('Error', data.error || 'Failed to confirm problem.');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Connection Issue', 'Failed to connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity 
      style={[
        styles.button, 
        confirmed && styles.confirmedButton,
        loading && styles.loadingButton
      ]}
      onPress={handleConfirm}
      disabled={confirmed || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator size="small" color={confirmed ? '#10B981' : '#0a84ff'} />
      ) : (
        <>
          <Ionicons 
            name={confirmed ? "checkbox" : "checkbox-outline"} 
            size={18} 
            color={confirmed ? '#FFF' : '#0a84ff'} 
          />
          <Text style={[styles.text, confirmed && styles.confirmedText]}>
            {confirmed ? 'I see this too' : 'I see this too'} ({count})
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderColor: '#0a84ff',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
    minHeight: 44,
  },
  confirmedButton: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  loadingButton: {
    opacity: 0.8,
  },
  text: {
    color: '#0a84ff',
    fontWeight: '700',
    fontSize: 14,
  },
  confirmedText: {
    color: '#FFF',
  },
});
