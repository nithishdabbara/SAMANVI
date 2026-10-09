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

interface VoteButtonProps {
  problemId: string;
  initialCount: number;
}

export default function VoteButton({ problemId, initialCount }: VoteButtonProps) {
  const [voted, setVoted] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if user has already voted on this problem locally
    (async () => {
      try {
        const value = await SecureStore.getItemAsync(`voted_${problemId}`);
        if (value === 'true') {
          setVoted(true);
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

  const handleVote = async () => {
    if (voted || loading) return;

    // Fire light haptic feedback
    if (Platform.OS !== 'web') {
      try {
        const Haptics = require('expo-haptics');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {}
    }

    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch(`${API_BASE_URL}/problems/${problemId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (response.ok) {
        setVoted(true);
        setCount(data.vote_count ?? (count + 1));
        await SecureStore.setItemAsync(`voted_${problemId}`, 'true');
      } else {
        Alert.alert('Error', data.error || 'Failed to vote on problem.');
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
        voted && styles.votedButton,
        loading && styles.loadingButton
      ]}
      onPress={handleVote}
      disabled={voted || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator size="small" color={voted ? '#D97706' : '#D97706'} />
      ) : (
        <>
          <Ionicons 
            name={voted ? "star" : "star-outline"} 
            size={18} 
            color={voted ? '#FFF' : '#D97706'} 
          />
          <Text style={[styles.text, voted && styles.votedText]}>
            {voted ? 'Prioritized' : 'Prioritize'} ({count})
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
    backgroundColor: '#FFFBEB',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
    minHeight: 44,
  },
  votedButton: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  loadingButton: {
    opacity: 0.8,
  },
  text: {
    color: '#D97706',
    fontWeight: '700',
    fontSize: 14,
  },
  votedText: {
    color: '#FFF',
  },
});
