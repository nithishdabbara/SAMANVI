import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  ScrollView, 
  SafeAreaView,
  Image,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { API_BASE_URL } from '../../constants/Config';

const { width } = Dimensions.get('window');

export default function PublicHelperProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    const fetchPublicProfile = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/users/${id}`);
        const data = await response.json();
        if (response.ok) {
          const p = data.profile;
          p.isAvailable = p.availability_status === 'available';
          p.contributorLevel = p.role || 'Member';
          setUser(p);
        } else {
          setError(data.error || "User not found");
        }
      } catch (err) {
        console.error("Public fetch error:", err);
        setError("Network request failed");
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchPublicProfile();
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#0a84ff" />
        <Text style={{ marginTop: 12, color: '#64748b' }}>Loading helper profile...</Text>
      </SafeAreaView>
    );
  }

  if (error || !user) {
    return (
      <SafeAreaView style={[styles.safeArea, { padding: 20 }]}>
         <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
           <MaterialIcons name="arrow-back" size={24} color="#0f172a" />
         </TouchableOpacity>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="alert-circle-outline" size={64} color="#F43F5E" />
          <Text style={{ fontSize: 18, fontWeight: '800', marginTop: 16 }}>{error || "User Not Found"}</Text>
          <TouchableOpacity 
            style={[styles.primaryActionBtn, { marginTop: 24, paddingHorizontal: 32 }]}
            onPress={() => router.back()}
          >
            <Text style={styles.primaryActionText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      
      {/* Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.shareBtn}>
          <MaterialIcons name="share" size={22} color="#424654" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        
        {/* Main Identity Card */}
        <View style={styles.identityCard}>
          <View style={styles.identityTopRow}>
            <Image source={{ uri: user.avatar_url || 'https://cdn-icons-png.flaticon.com/512/1144/1144760.png' }} style={styles.bigAvatar} />
            <View style={styles.trustScoreOrb}>
              <Ionicons name="star" size={24} color="#F59E0B" style={{marginBottom: -2}}/>
              <Text style={styles.trustScoreOrbNumber}>
                {(!user.community_helps || user.community_helps === 0) ? "New Member" : (user.trust_score || 0)}
              </Text>
            </View>
          </View>

          <View style={styles.nameHeaderRow}>
            <Text style={styles.userName}>{user.name}</Text>
            {user.isVerified && (
              <MaterialIcons name="verified" size={20} color="#0a84ff" style={{marginLeft: 6, marginTop: 4}} />
            )}
          </View>

          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={16} color="#64748b" />
            <Text style={styles.locationText}>{user.address || 'Local Hub'}</Text>
            <Text style={styles.dotSeparator}>•</Text>
            <Text style={styles.joinDateText}>Joined {user.created_at || 'Recently'}</Text>
          </View>

          <View style={styles.badgesWrapper}>
            <View style={styles.levelBadge}>
              <MaterialIcons name="emoji-events" size={14} color="#0a84ff" />
              <Text style={styles.levelBadgeText}>{user.contributorLevel}</Text>
            </View>
            <View style={[styles.availabilityBadge, !user.isAvailable && styles.busyBadge]}>
              <View style={[styles.statusDot, !user.isAvailable && { backgroundColor: '#F43F5E' }]} />
              <Text style={[styles.availabilityText, !user.isAvailable && { color: '#F43F5E' }]}>
                {user.isAvailable ? 'Available to Help' : 'Currently Busy'}
              </Text>
            </View>
          </View>
        </View>

        {/* Primary Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity 
            style={styles.primaryActionBtn}
            onPress={() => router.push(`/chat/${user.id}` as any)}
          >
            <Ionicons name="chatbubble-ellipses" size={20} color="#FFF" style={{marginRight: 8}}/>
            <Text style={styles.primaryActionText}>Message {user.name.split(' ')[0]}</Text>
          </TouchableOpacity>
        </View>

        {/* Skills Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Community Skills</Text>
        </View>
        <View style={styles.skillsContainer}>
          {(user.skills || []).map((skill: string, index: number) => (
            <View key={index} style={styles.skillChip}>
              <Text style={styles.skillChipText}>{skill}</Text>
            </View>
          ))}
        </View>

        <View style={styles.divider} />

        {/* Reputation Metrics */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Reputation</Text>
        </View>
        <View style={styles.metricsRow}>
          <View style={styles.metricColumn}>
            <Text style={styles.metricBigNumber}>{user.people_helped || 0}</Text>
            <Text style={styles.metricSubLabel}>PEOPLE HELPED</Text>
          </View>
          <View style={styles.verticalDivider} />
          <View style={styles.metricColumn}>
            <Text style={styles.metricBigNumber}>{user.community_helps || 0}</Text>
            <Text style={styles.metricSubLabel}>HELP ACTIONS</Text>
          </View>
          <View style={styles.verticalDivider} />
          <View style={styles.metricColumn}>
            <Text style={styles.metricBigNumber}>{user.helps_received || 0}</Text>
            <Text style={styles.metricSubLabel}>TIMES HELPED</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Reviews Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent Reviews</Text>
          {user.reviews && user.reviews.length > 0 && (
            <TouchableOpacity>
              <Text style={styles.seeAllText}>SEE ALL</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.reviewsContainer}>
          {(!user.reviews || user.reviews.length === 0) ? (
            <View style={[styles.reviewCard, { alignItems: 'center', paddingVertical: 32 }]}>
              <Ionicons name="chatbox-ellipses-outline" size={32} color="#A0AAB4" style={{ marginBottom: 8 }} />
              <Text style={{ fontSize: 14, color: '#64748b', fontWeight: '600', textAlign: 'center', lineHeight: 20 }}>
                No reviews yet. This helper is ready to accept their first community action!
              </Text>
            </View>
          ) : (
            user.reviews.map((review: any) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewAuthorGroup}>
                    <View style={styles.reviewAvatarPlaceholder}>
                      <Text style={styles.reviewAvatarInitial}>{review.author.charAt(0)}</Text>
                    </View>
                    <View>
                      <Text style={styles.reviewAuthorName}>{review.author}</Text>
                      <Text style={styles.reviewDate}>{review.date}</Text>
                    </View>
                  </View>
                  <View style={styles.reviewStars}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <Ionicons 
                        key={star} 
                        name={star <= review.rating ? "star" : "star-outline"} 
                        size={14} 
                        color={star <= review.rating ? "#F59E0B" : "#E6E8EB"} 
                      />
                    ))}
                  </View>
                </View>
                <Text style={styles.reviewText}>{"\""}{review.text}{"\""}</Text>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 64,
    backgroundColor: '#FFFFFF',
    zIndex: 10,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#eef0f5',
  },
  shareBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#eef0f5',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  identityCard: {
    alignItems: 'center',
    marginBottom: 24,
  },
  identityTopRow: {
    position: 'relative',
    marginBottom: 16,
  },
  bigAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E6E8EB',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    shadowColor: '#191C1E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
  },
  trustScoreOrb: {
    position: 'absolute',
    bottom: 0,
    right: -10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
    gap: 4,
  },
  trustScoreOrbNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: '#D97706',
  },
  nameHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  userName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  locationText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
    marginLeft: 4,
  },
  dotSeparator: {
    marginHorizontal: 8,
    color: '#C2C6D7',
  },
  joinDateText: {
    fontSize: 14,
    color: '#64748b',
  },
  badgesWrapper: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  levelBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0a84ff',
    textTransform: 'uppercase',
  },
  availabilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5', // Light green
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  busyBadge: {
    backgroundColor: '#FFF1F2', // Light red
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  availabilityText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#10B981',
    textTransform: 'uppercase',
  },
  actionRow: {
    width: '100%',
    marginBottom: 32,
  },
  primaryActionBtn: {
    backgroundColor: '#0a84ff',
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 20,
    shadowColor: '#0a84ff',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 4,
  },
  primaryActionText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0a84ff',
    letterSpacing: 0.5,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  skillChip: {
    backgroundColor: '#eef0f5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  skillChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#424654',
  },
  divider: {
    height: 1,
    backgroundColor: '#F2F4F7',
    marginVertical: 24,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FDFDFD',
    borderWidth: 1,
    borderColor: '#ECEEF1',
    paddingVertical: 24,
    paddingHorizontal: 10,
    borderRadius: 24,
    shadowColor: '#191C1E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 12,
    elevation: 1,
  },
  metricColumn: {
    flex: 1,
    alignItems: 'center',
  },
  metricBigNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0a84ff',
    marginBottom: 4,
  },
  metricSubLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  verticalDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#ECEEF1',
  },
  reviewsContainer: {
    gap: 16,
  },
  reviewCard: {
    backgroundColor: '#FDFDFD',
    borderWidth: 1,
    borderColor: '#ECEEF1',
    borderRadius: 24,
    padding: 20,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reviewAuthorGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reviewAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E6E8EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarInitial: {
    fontSize: 16,
    fontWeight: '800',
    color: '#64748b',
  },
  reviewAuthorName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  reviewDate: {
    fontSize: 12,
    color: '#64748b',
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#424654',
    fontStyle: 'italic',
  }
});
