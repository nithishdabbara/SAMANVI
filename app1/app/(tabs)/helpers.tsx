import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  SafeAreaView, 
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../../constants/Config';
import { Colors } from '../../constants/Colors';
import { Typography } from '../../constants/Typography';
import { haptic } from '../../utils/haptics';
import { SpringButton } from '../../components/ScreenTransition';

export default function HelpersTab() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [helpers, setHelpers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('top'); // 'top' or 'new'
  const [userLocName, setUserLocName] = useState('Local Hub');

  useEffect(() => {
    fetchRealHelpers(sortBy);
  }, []);

  const fetchRealHelpers = async (currentSort = sortBy) => {
    setLoading(true);
    try {
      const lat = await SecureStore.getItemAsync('userLat');
      const lng = await SecureStore.getItemAsync('userLng');
      const locName = await SecureStore.getItemAsync('userLocation');
      
      if (locName) setUserLocName(locName.split(',')[0]);

      const url = `${API_BASE_URL}/helpers?lat=${lat}&lng=${lng}&radius=1&sort=${currentSort}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (response.ok) {
        setHelpers(data.helpers || []);
      }
    } catch (err) {
      console.error("Helper fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSortToggle = (newSort: string) => {
    haptic.selection();
    setSortBy(newSort);
    fetchRealHelpers(newSort);
  };

  const filteredHelpers = helpers.filter(helper => 
    (helper.skills && helper.skills.some((skill: string) => skill.toLowerCase().includes(searchQuery.toLowerCase()))) ||
    helper.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
          <Text style={styles.headerTitle}>Nearby Helpers</Text>
          <View style={styles.lockedBadge}>
            <Text style={styles.lockedBadgeText}>🔒 1km Lock</Text>
          </View>
        </View>
        <Text style={styles.headerSubtitle}>Trusted neighbors within 1km of {userLocName}</Text>
      </View>

      {/* Sorting Toggle Selector (Exactly like Reference) */}
      <View style={styles.toggleContainer}>
        <View style={styles.toggleWrapper}>
          <TouchableOpacity
            style={[styles.toggleBtn, sortBy === 'top' && styles.toggleBtnActive]}
            onPress={() => handleSortToggle('top')}
          >
            <Text style={[styles.toggleBtnText, sortBy === 'top' && styles.toggleBtnTextActive]}>
              Top Helpers
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, sortBy === 'new' && styles.toggleBtnActive]}
            onPress={() => handleSortToggle('new')}
          >
            <Text style={[styles.toggleBtnText, sortBy === 'new' && styles.toggleBtnTextActive]}>
              New Joiners
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <MaterialIcons name="search" size={20} color="#64748b" />
          <TextInput 
            style={styles.searchInput}
            placeholder="Search by skill (e.g. Plumbing, Tutor)..."
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        {/* Helpers List */}
        <View style={styles.helpersList}>
          {loading ? (
             <ActivityIndicator size="large" color={Colors.primary} style={{marginTop: 50}} />
          ) : filteredHelpers.map((helper) => {
            // Helper is new if they have resolved 0 issues OR account age < 30 days
            const isNew = helper.helped_count === 0 || helper.account_age_days < 30;
            
            return (
              <SpringButton 
                key={helper.id} 
                style={styles.helperCard}
                onPress={() => router.push(`/user/${helper.id}` as any)}
                hapticType="light"
              >
                <Image 
                  source={{ uri: helper.avatar_url || 'https://cdn-icons-png.flaticon.com/512/1144/1144760.png' }} 
                  style={styles.avatarImg} 
                />
                
                <View style={styles.helperInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.helperName} numberOfLines={1}>{helper.name}</Text>
                    {isNew && (
                      <View style={styles.newBadge}>
                        <Text style={styles.newBadgeText}>NEW</Text>
                      </View>
                    )}
                  </View>
                  
                  <Text style={styles.helperMeta} numberOfLines={1}>
                    {helper.address?.split(',')[0] || 'Local Neighborhood'} · {helper.distance !== undefined ? `${helper.distance}km` : 'Nearby'} · {helper.helped_count || 0} helped
                  </Text>
                  
                  <View style={styles.skillsContainer}>
                    {(helper.skills || []).slice(0, 3).map((skill: string, index: number) => (
                      <View key={index} style={styles.skillChip}>
                        <Text style={styles.skillText}>{skill}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Shield Score Badge */}
                <View style={styles.scoreBadge}>
                  <Text style={styles.shieldIcon}>✓</Text>
                  <Text style={styles.scoreText}>{Math.round(helper.trust_score || 50)}</Text>
                </View>

                <Ionicons name="chevron-forward" size={16} color={Colors.systemGray3} style={styles.chevron} />
              </SpringButton>
            );
          })}

          {!loading && filteredHelpers.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color="#C2C6D7" />
              <Text style={styles.emptyStateTitle}>No helpers found</Text>
              <Text style={styles.emptyStateDesc}>Try adjusting your search terms</Text>
            </View>
          )}
        </View>

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
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  headerTitle: {
    ...Typography.title2,
    color: Colors.label,
  },
  lockedBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  lockedBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  headerSubtitle: {
    ...Typography.caption1,
    color: Colors.secondaryLabel,
    marginTop: 4,
  },
  toggleContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
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
  searchSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separator,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.label,
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
  helpersList: {
    gap: 12,
  },
  helperCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.separator,
  },
  avatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f1f5f9',
  },
  helperInfo: {
    flex: 1,
    marginLeft: 12,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  helperName: {
    ...Typography.body,
    fontWeight: '700',
    color: Colors.label,
  },
  newBadge: {
    backgroundColor: Colors.score,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 16,
    marginLeft: 6,
  },
  newBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
  },
  helperMeta: {
    ...Typography.caption1,
    color: Colors.secondaryLabel,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  skillChip: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 16,
  },
  skillText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 16,
    gap: 2,
    marginRight: 6,
  },
  shieldIcon: {
    color: Colors.score,
    fontSize: 10,
    fontWeight: '800',
  },
  scoreText: {
    color: Colors.score,
    fontSize: 13,
    fontWeight: '800',
  },
  chevron: {
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyStateTitle: {
    ...Typography.headline,
    color: Colors.label,
  },
  emptyStateDesc: {
    ...Typography.subheadline,
    color: Colors.systemGray,
  },
});
