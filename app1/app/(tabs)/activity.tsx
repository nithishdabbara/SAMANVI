import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  SafeAreaView, 
  TouchableOpacity, 
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../../constants/Config';
import { Colors } from '../../constants/Colors';
import { Typography } from '../../constants/Typography';
import { haptic } from '../../utils/haptics';
import { ListItemTransition } from '../../components/ScreenTransition';
import ProblemCard from '@/components/ProblemCard';
import { EmptyState } from '@/components/FeedbackState';

export default function ActivityTab() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'requests' | 'helped'>('requests');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [helped, setHelped] = useState<any[]>([]);

  useEffect(() => {
    fetchActivity();
  }, []);

  const fetchActivity = async () => {
    setLoading(true);
    setError(false);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) {
        setError(true);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const response = await fetch(`${API_BASE_URL}/user/activity`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setRequests(data.requests || []);
        setHelped(data.helped || []);
      } else {
        setError(true);
      }
    } catch (err) {
      console.error("Activity fetch error:", err);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleToggle = (tab: 'requests' | 'helped') => {
    haptic.selection();
    setActiveTab(tab);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchActivity();
  };

  const currentList = activeTab === 'requests' ? requests : helped;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>Activity</Text>
          <TouchableOpacity 
            style={styles.chatIconBtn}
            onPress={() => router.push('/(tabs)/messages')}
          >
            <Ionicons name="chatbubbles-outline" size={24} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Segment Selector (Exactly like Reference) */}
      <View style={styles.toggleContainer}>
        <View style={styles.toggleWrapper}>
          <TouchableOpacity
            style={[styles.toggleBtn, activeTab === 'requests' && styles.toggleBtnActive]}
            onPress={() => handleToggle('requests')}
          >
            <Text style={[styles.toggleBtnText, activeTab === 'requests' && styles.toggleBtnTextActive]}>
              My Requests
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, activeTab === 'helped' && styles.toggleBtnActive]}
            onPress={() => handleToggle('helped')}
          >
            <Text style={[styles.toggleBtnText, activeTab === 'helped' && styles.toggleBtnTextActive]}>
              I Helped
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* List content */}
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 50 }} />
        ) : error ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Ionicons name="alert-circle-outline" size={48} color="#FF3B30" />
            <Text style={{ marginTop: 10, color: Colors.textSecondary, fontFamily: 'Inter-Medium', textAlign: 'center' }}>
              Failed to load activity.
            </Text>
            <TouchableOpacity style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: Colors.surface, borderRadius: 8 }} onPress={fetchActivity}>
              <Text style={{ color: Colors.primary, fontFamily: 'Inter-SemiBold' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : currentList.length > 0 ? (
          <View style={styles.listContainer}>
            {currentList.map((p, index) => (
              <ListItemTransition key={p.id} index={index}>
                <ProblemCard
                  id={p.id}
                  title={p.title}
                  category={p.category_name || 'General'}
                  time={new Date(p.created_at).toLocaleDateString()}
                  status={p.status || 'Open'}
                  distance={p.distance !== undefined ? `${p.distance.toFixed(1)} km away` : 'Nearby'}
                  imageUrl={p.photo_url}
                  postType={p.post_type}
                  budgetRange={p.budget_range}
                  showViewDetails={true}
                />
              </ListItemTransition>
            ))}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <EmptyState
              icon={activeTab === 'requests' ? "receipt-outline" : "heart-outline"}
              title={activeTab === 'requests' ? "No Requests Yet" : "No Completed Helps"}
              subtitle={
                activeTab === 'requests' 
                  ? "You haven't posted any problems in your neighborhood yet." 
                  : "You haven't accepted or completed any help requests in your community yet."
              }
            />
          </View>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    ...Typography.title2,
    color: Colors.textPrimary,
  },
  chatIconBtn: {
    padding: 8,
    borderRadius: 20,
  },
  toggleContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  toggleWrapper: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    padding: 2,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  toggleBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  toggleBtnTextActive: {
    color: Colors.primary,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  listContainer: {
    gap: 12,
  },
  emptyContainer: {
    paddingVertical: 60,
  }
});
