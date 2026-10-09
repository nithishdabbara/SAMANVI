import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Image,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
  Modal,
  TouchableWithoutFeedback,
  Alert
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../../constants/Config';
import ConfirmButton from '../../components/ConfirmButton';
import VoteButton from '../../components/VoteButton';

const StatusTimeline = ({ activeIndex }: { activeIndex: number }) => {
  const steps = ['Posted', 'Helper Found', 'En Route', 'Arrived', 'Resolved'];
  return (
    <View style={timelineStyles.container}>
      <View style={timelineStyles.progressLineBackground} />
      <View 
        style={[
          timelineStyles.progressLineActive, 
          { width: `${(activeIndex / (steps.length - 1)) * 100}%` }
        ]} 
      />
      <View style={timelineStyles.stepsContainer}>
        {steps.map((step, idx) => {
          const isCompleted = idx < activeIndex;
          const isActive = idx === activeIndex;
          return (
            <View key={step} style={timelineStyles.stepItem}>
              <View 
                style={[
                  timelineStyles.dot,
                  isCompleted && timelineStyles.dotCompleted,
                  isActive && timelineStyles.dotActive,
                ]}
              >
                {isCompleted ? (
                  <Ionicons name="checkmark" size={10} color="#FFF" />
                ) : isActive ? (
                  <View style={timelineStyles.dotActiveInner} />
                ) : null}
              </View>
              <Text 
                style={[
                  timelineStyles.label,
                  isCompleted && timelineStyles.labelCompleted,
                  isActive && timelineStyles.labelActive,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {step}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const timelineStyles = StyleSheet.create({
  container: {
    marginVertical: 20,
    paddingHorizontal: 8,
    position: 'relative',
    height: 52,
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ECEEF1',
  },
  progressLineBackground: {
    position: 'absolute',
    left: 32,
    right: 32,
    height: 3,
    backgroundColor: '#E2E8F0',
    top: 18,
    borderRadius: 1.5,
  },
  progressLineActive: {
    position: 'absolute',
    left: 32,
    height: 3,
    backgroundColor: '#0a84ff',
    top: 18,
    borderRadius: 1.5,
  },
  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  stepItem: {
    alignItems: 'center',
    width: 60,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    borderWidth: 2,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dotActive: {
    backgroundColor: '#FFF',
    borderColor: '#0a84ff',
  },
  dotActiveInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0a84ff',
  },
  dotCompleted: {
    backgroundColor: '#0a84ff',
    borderColor: '#0a84ff',
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 6,
    textAlign: 'center',
  },
  labelActive: {
    color: '#0a84ff',
    fontWeight: '800',
  },
  labelCompleted: {
    color: '#0f172a',
  },
});

export default function ProblemDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [problem, setProblem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [potentialHelpers, setPotentialHelpers] = useState<any[]>([]);
  const [selectedHelperId, setSelectedHelperId] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [offers, setOffers] = useState<any[]>([]);
  const [isPosting, setIsPosting] = useState(false);

  // Edit & Delete states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  // Accept / Decline states
  const [acceptedCode, setAcceptedCode] = useState<string | null>(null);
  const [showCodeModal, setShowCodeModal] = useState(false);

  React.useEffect(() => {
    const fetchProblemDetails = async () => {
      try {
        const storedUser = await SecureStore.getItemAsync('userData');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          setCurrentUserId(userData.id);
        }

        const response = await fetch(`${API_BASE_URL}/problems/${id}`);
        const data = await response.json();
        if (response.ok) {
          setProblem(data.problem);
          fetchOffers(); // Also get offers
        }
      } catch (err) {
        console.error("Failed to fetch problem details", err);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchProblemDetails();
  }, [id]);

  React.useEffect(() => {
    const loadStoredCode = async () => {
      try {
        const code = await SecureStore.getItemAsync(`arrival_code_${id}`);
        if (code) {
          setAcceptedCode(code);
        }
      } catch (e) {
        console.error("Failed to load stored code", e);
      }
    };
    if (id) loadStoredCode();
  }, [id]);

  const fetchOffers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/problems/${id}/offers`);
      const data = await response.json();
      if (response.ok) {
        setOffers(data.offers);
      }
    } catch (err) {
    }
  };

  const getActiveStepIndex = () => {
    if (!problem) return 0;
    if (problem.status === 'resolved') return 4;
    
    // Check if there is an accepted offer
    const acceptedOffer = offers.find(o => o.status === 'accepted' || o.status === 'active');
    if (acceptedOffer) {
      if (acceptedOffer.status === 'active') {
        return 3; // Arrived
      }
      return 2; // En Route
    }
    
    const pendingOffers = offers.filter(o => o.status === 'pending');
    if (pendingOffers.length > 0) return 1; // Helper Found
    
    return 0; // Posted
  };

  const handleAcceptOffer = async (offerId: string) => {
    // Fire haptic feedback on button press
    if (Platform.OS !== 'web') {
      try {
        const Haptics = require('expo-haptics');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) {
        console.warn("Haptics failed to load", e);
      }
    }

    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch(`${API_BASE_URL}/offers/${offerId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        const code = data.offer.arrival_code;
        setAcceptedCode(code);
        setShowCodeModal(true);
        // Save code locally in SecureStore so it persists across refreshes
        await SecureStore.setItemAsync(`arrival_code_${id}`, code);
        fetchOffers();
        // Refresh problem details to update status
        const probRes = await fetch(`${API_BASE_URL}/problems/${id}`);
        const probData = await probRes.json();
        if (probRes.ok) {
          setProblem(probData.problem);
        }
      } else {
        alert(data.error || "Failed to accept offer.");
      }
    } catch (err) {
      console.error("Accept offer error:", err);
      alert("Network error.");
    }
  };

  const handleDeclineOffer = async (offerId: string) => {
    // Fire light haptic
    if (Platform.OS !== 'web') {
      try {
        const Haptics = require('expo-haptics');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (e) {
        console.warn("Haptics failed to load", e);
      }
    }

    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch(`${API_BASE_URL}/offers/${offerId}/decline`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        alert("Offer declined.");
        fetchOffers();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to decline offer.");
      }
    } catch (err) {
      console.error("Decline offer error:", err);
      alert("Network error.");
    }
  };

  const handlePostOffer = async () => {
    if (!commentText.trim()) return;
    setIsPosting(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch(`${API_BASE_URL}/problems/${id}/offers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content: commentText })
      });
      if (response.ok) {
        setCommentText('');
        fetchOffers(); // Refresh the list
      } else {
        alert("Failed to post offer.");
      }
    } catch (err) {
      console.error("Post offer error:", err);
      alert("Network error.");
    } finally {
      setIsPosting(false);
    }
  };

  const fetchPotentialHelpers = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch(`${API_BASE_URL}/problems/${id}/helpers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setPotentialHelpers(data.helpers);
        // Pre-select if only one person chatted
        if (data.helpers.length === 1) setSelectedHelperId(data.helpers[0].id);
      }
    } catch (err) {
      console.error("Failed to fetch potential helpers", err);
    }
  };

  const handleResolveProblem = async () => {
    if (potentialHelpers.length > 0 && !selectedHelperId) {
      alert("Please select who helped you.");
      return;
    }
    if (rating === 0) {
      alert("Please provide a star rating.");
      return;
    }

    setIsResolving(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch(`${API_BASE_URL}/problems/${id}/resolve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          helper_id: selectedHelperId,
          rating: rating
        })
      });
      
      if (response.ok) {
        if (Platform.OS !== 'web') {
          try {
            const Haptics = require('expo-haptics');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (e) {
            console.warn("Haptics failed to load", e);
          }
        }
        setProblem({ ...problem, status: 'resolved' });
        setShowResolveModal(false);
        alert("Success! Trust points awarded to your neighbor.");
      } else {
        alert("Failed to resolve problem.");
      }
    } catch (e) {
      console.error(e);
      alert("Network error.");
    } finally {
      setIsResolving(false);
    }
  };

  const handleDeleteProblem = () => {
    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this community post? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            try {
              const token = await SecureStore.getItemAsync('userToken');
              const response = await fetch(`${API_BASE_URL}/problems/${id}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              });
              if (response.ok) {
                alert("Problem deleted successfully.");
                router.replace('/(tabs)' as any);
              } else {
                alert("Failed to delete problem.");
              }
            } catch (err) {
              console.error(err);
              alert("Network error.");
            }
          } 
        }
      ]
    );
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim() || !editDescription.trim()) {
      alert("Title and description cannot be empty.");
      return;
    }
    setIsSavingEdit(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch(`${API_BASE_URL}/problems/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription
        })
      });
      if (response.ok) {
        setProblem({ ...problem, title: editTitle, description: editDescription });
        setShowEditModal(false);
        alert("Problem updated successfully.");
      } else {
        alert("Failed to update problem.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleCancelOffer = (offerId: string) => {
    Alert.alert(
      "Cancel Help Offer",
      "Are you sure you want to cancel your offer? This will deduct 5 points from your Community Score.",
      [
        { text: "Keep Offer", style: "cancel" },
        {
          text: "Cancel Offer (-5 pts)",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await SecureStore.getItemAsync('userToken');
              const response = await fetch(`${API_BASE_URL}/offers/cancel`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ offer_id: offerId })
              });
              if (response.ok) {
                alert("Offer cancelled. 5 points deducted from your Community Score.");
                fetchOffers();
              } else {
                const errData = await response.json();
                alert(errData.error || "Failed to cancel offer.");
              }
            } catch (err) {
              console.error(err);
              alert("Network error.");
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#0a84ff" />
        <Text style={{marginTop: 16, color: '#64748b'}}>Loading details...</Text>
      </View>
    );
  }

  if (!problem) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{color: '#64748b'}}>Problem not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{marginTop: 10}}>
           <Text style={{color: '#0a84ff'}}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Scrollable Content */}
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Image Area */}
        <View style={styles.heroContainer}>
          <Image 
            source={{ uri: problem.photo_url || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80' }} 
            style={styles.heroImage}
            resizeMode="cover"
            onLoadStart={() => setImageLoading(true)}
            onLoadEnd={() => setImageLoading(false)}
          />
          {imageLoading && (
            <View style={[StyleSheet.absoluteFill, styles.skeletonLoader]}>
              <ActivityIndicator size="large" color="#0a84ff" />
            </View>
          )}
          <View style={styles.heroOverlay} />
        </View>

        {/* Main Content Card (Floating over image) */}
        <View style={styles.contentCard}>
          {/* Header Row */}
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: problem.status === 'resolved' ? '#ECFDF5' : (problem.priority === 'high' ? '#FEF2F2' : '#F0F9FF') }]}>
              <Text style={[styles.statusBadgeText, { color: problem.status === 'resolved' ? '#10B981' : (problem.priority === 'high' ? '#EF4444' : '#3B82F6') }]}>
                {problem.status === 'resolved' ? 'RESOLVED' : `${problem.priority?.toUpperCase()} PRIORITY`}
              </Text>
            </View>
            <Text style={styles.timeText}>{new Date(problem.created_at).toLocaleDateString()}</Text>
          </View>

          {/* Status Timeline */}
          <StatusTimeline activeIndex={getActiveStepIndex()} />

          {/* Owner Actions Row */}
          {currentUserId === problem.user_id && (
            <View style={styles.ownerActionsRow}>
              <TouchableOpacity 
                style={[styles.actionButton, styles.editButton]} 
                onPress={() => {
                  setEditTitle(problem.title);
                  setEditDescription(problem.description);
                  setShowEditModal(true);
                }}
              >
                <Ionicons name="create-outline" size={16} color="#0054cb" style={{ marginRight: 6 }} />
                <Text style={styles.editButtonText}>Edit Post</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.actionButton, styles.deleteButton]} 
                onPress={handleDeleteProblem}
              >
                <Ionicons name="trash-outline" size={16} color="#ba1a1a" style={{ marginRight: 6 }} />
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Title */}
          <Text style={styles.title}>
            {problem.title}
          </Text>

          {/* Reporter Info */}
          <TouchableOpacity 
            style={styles.reporterCard}
            onPress={() => router.push(`/user/${problem.user_id}` as any)}
          >
            <Image 
              source={{ uri: problem.avatar_url || 'https://cdn-icons-png.flaticon.com/512/1144/1144760.png' }} 
              style={styles.avatar}
            />
            <View style={styles.reporterDetails}>
              <Text style={styles.reporterName}>Posted by {problem.author_name}</Text>
              <View style={styles.verifiedRow}>
                <MaterialIcons name="verified-user" size={14} color="#0a84ff" />
                <Text style={styles.verifiedText}>Community Score: {problem.trust_score}</Text>
              </View>
            </View>
          </TouchableOpacity>

          <Text style={styles.descriptionText}>
            {problem.description}
          </Text>

          {/* Details Flex Row */}
          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Ionicons name="location-outline" size={20} color="#0a84ff" />
              <View style={styles.detailTextCol}>
                <Text style={styles.detailTitle}>Location</Text>
                <Text style={styles.detailValue}>{problem.address || 'Nearby'}</Text>
              </View>
            </View>
            
            <View style={styles.detailItem}>
              <Ionicons name="pricetag-outline" size={20} color="#4CAF50" />
              <View style={styles.detailTextCol}>
                <Text style={styles.detailTitle}>Category</Text>
                <Text style={styles.detailValue}>{problem.category_id === 1 ? 'General' : 'Community'}</Text>
              </View>
            </View>
          </View>

          {/* Community Verification & Prioritization */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16, marginTop: 8 }}>
            <View style={{ flex: 1 }}>
              <ConfirmButton problemId={String(id)} initialCount={problem.confirmation_count || 0} />
            </View>
            <View style={{ flex: 1 }}>
              <VoteButton problemId={String(id)} initialCount={problem.vote_count || 0} />
            </View>
          </View>

          {/* Engagement Bar & I Can Help */}
          <View style={styles.engagementBar}>
            {problem.status === 'resolved' ? (
              <View style={[styles.helperBtn, { backgroundColor: '#eef0f5', shadowOpacity: 0 }]}>
                 <Ionicons name="checkmark-circle" size={20} color="#10B981" style={{ marginRight: 8 }} />
                 <Text style={[styles.helperBtnText, { color: '#10B981' }]}>Resolved</Text>
              </View>
            ) : currentUserId === problem.user_id ? (
              <TouchableOpacity 
                style={[styles.helperBtn, { backgroundColor: '#4CAF50', shadowColor: '#4CAF50' }]} 
                activeOpacity={0.8}
                onPress={() => {
                  fetchPotentialHelpers();
                  setShowResolveModal(true);
                }}
              >
                <>
                  <Ionicons name="checkmark-done-circle" size={20} color="#FFF" style={{ marginRight: 8 }} />
                  <Text style={styles.helperBtnText}>Mark as Resolved</Text>
                </>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={styles.helperBtn} 
                activeOpacity={0.8}
                onPress={() => router.push(`/chat/${problem.user_id}` as any)}
              >
                <Ionicons name="hand-right" size={20} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.helperBtnText}>I Can Help</Text>
              </TouchableOpacity>
            )}
            
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity style={styles.circleActionButton}>
                <Ionicons name="heart-outline" size={24} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.circleActionButton}>
                <Ionicons name="share-social-outline" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Comments Section */}
          <View style={styles.commentsSection}>
            <View style={styles.commentsHeader}>
              <Text style={styles.commentsTitle}>Community Offers ({offers.length})</Text>
              <TouchableOpacity onPress={fetchOffers}>
                <Ionicons name="refresh" size={16} color="#0a84ff" />
              </TouchableOpacity>
            </View>

            {offers.length === 0 ? (
               <View style={styles.noCommentsBox}>
                  <Text style={styles.noCommentsText}>No offers yet. Be the first to help!</Text>
               </View>
                        ) : offers.map((offer: any) => {
              const isPending = offer.status === 'pending';
              const isAccepted = offer.status === 'accepted';
              const isActive = offer.status === 'active';
              const isDeclined = offer.status === 'declined';
              
              return (
                <View key={offer.id} style={styles.commentCard}>
                  <View style={styles.commentHeaderRow}>
                    <Image source={{ uri: offer.avatar || 'https://cdn-icons-png.flaticon.com/512/1144/1144760.png' }} style={styles.commentAvatar} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.commentName}>{offer.user}</Text>
                      <View style={styles.verifiedRow}>
                        <Ionicons name="star" size={12} color="#F59E0B" />
                        <Text style={[styles.verifiedText, { fontSize: 11, color: '#D97706', textTransform: 'none' }]}>Community Score: {offer.trust_score}</Text>
                      </View>
                    </View>
                    <Text style={styles.commentTime}>
                      {new Date(offer.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>

                  <Text style={styles.commentText}>
                    {offer.text}
                  </Text>

                  {/* Skills badges */}
                  {offer.skills ? (
                    <View style={styles.offerSkillsContainer}>
                      {offer.skills.split(', ').map((skill: string, sIdx: number) => (
                        <View key={sIdx} style={styles.offerSkillBadge}>
                          <Text style={styles.offerSkillText}>{skill}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {/* Accept / Decline actions for Resident (Problem Owner) */}
                  {currentUserId === problem.user_id && isPending && (
                    <View style={styles.offerActionButtonsRow}>
                      <TouchableOpacity 
                        style={[styles.offerActionButton, styles.offerAcceptBtn]}
                        onPress={() => handleAcceptOffer(offer.id)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="checkmark-circle-outline" size={14} color="#FFF" style={{ marginRight: 4 }} />
                        <Text style={styles.offerAcceptBtnText}>Accept Offer</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.offerActionButton, styles.offerDeclineBtn]}
                        onPress={() => handleDeclineOffer(offer.id)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="close-circle-outline" size={14} color="#EF4444" style={{ marginRight: 4 }} />
                        <Text style={styles.offerDeclineBtnText}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Show accepted code to Resident */}
                  {currentUserId === problem.user_id && isAccepted && (
                    <View style={styles.acceptedCodeContainer}>
                      <Text style={styles.acceptedStatusText}>En Route (Offer Accepted)</Text>
                      {acceptedCode && (
                        <View style={styles.codeDisplayBox}>
                          <Text style={styles.codeLabelText}>Arrival Code:</Text>
                          <Text style={styles.codeText}>{acceptedCode}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Status displays for all users */}
                  {isAccepted && currentUserId !== problem.user_id && (
                    <View style={styles.acceptedStatusWrapper}>
                      <Ionicons name="time" size={16} color="#F59E0B" style={{ marginRight: 6 }} />
                      <Text style={styles.acceptedStatusLabel}>Helper is en route</Text>
                    </View>
                  )}

                  {isActive && (
                    <View style={styles.activeStatusWrapper}>
                      <Ionicons name="checkmark-done-circle" size={16} color="#10B981" style={{ marginRight: 6 }} />
                      <Text style={styles.activeStatusLabel}>Helper arrived & verified</Text>
                    </View>
                  )}

                  {isDeclined && (
                    <View style={styles.declinedStatusWrapper}>
                      <Text style={styles.declinedStatusLabel}>Offer declined</Text>
                    </View>
                  )}

                  {currentUserId === offer.user_id && isPending && (
                    <TouchableOpacity 
                      style={styles.cancelOfferBtn}
                      onPress={() => handleCancelOffer(offer.id)}
                    >
                      <Ionicons name="close-circle-outline" size={14} color="#ba1a1a" style={{ marginRight: 4 }} />
                      <Text style={styles.cancelOfferBtnText}>Cancel Help Offer</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>

        </View>
      </ScrollView>

      {/* Floating Back Button (Top Left) */}
      <SafeAreaView style={styles.floatingHeader}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Mockup 2 Action Panel */}
      {currentUserId !== problem?.user_id && (
        <View style={styles.actionPanelContainer}>
          <View style={styles.actionPanelInner}>
            {/* Auto Action */}
            <View style={styles.autoActionBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.autoActionTitle}>No helper within 1 km?</Text>
                <Text style={styles.autoActionSub}>Planned: widen to 3 km after 30 min, then 5 km</Text>
              </View>
              <View style={styles.autoActionBtn}>
                <Text style={styles.autoActionBtnText}>Auto</Text>
              </View>
            </View>

            {/* Municipal Office */}
            <TouchableOpacity style={styles.municipalBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.autoActionTitle}>Send to municipal office</Text>
                <Text style={styles.autoActionSub}>Planned: for burst pipes, road damage, live wires</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#0f172a" />
            </TouchableOpacity>

            {/* Bottom Buttons */}
            <View style={styles.bottomButtonsRow}>
              <TouchableOpacity style={styles.offerHelpBtn} onPress={() => setShowOfferModal(true)}>
                <Text style={styles.offerHelpBtnText}>Offer Help</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.reportBtn}>
                <Text style={styles.reportBtnText}>Report</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Offer Help Modal (Replaces inline input) */}
      <Modal
        visible={showOfferModal}
        transparent
        animationType="slide"
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setShowOfferModal(false)}>
            <View style={styles.modalOverlay} />
          </TouchableWithoutFeedback>
          <View style={[styles.modalContent, { marginTop: 'auto', paddingBottom: 40 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Write your offer</Text>
              <TouchableOpacity onPress={() => setShowOfferModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <View style={styles.bottomBar}>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.textInput}
                  placeholder="I can reach in 10 minutes..."
                  placeholderTextColor="#64748b"
                  value={commentText}
                  onChangeText={setCommentText}
                  autoFocus
                />
              </View>
              <TouchableOpacity 
                style={[styles.sendButton, (!commentText.trim() || isPosting) && styles.sendButtonDisabled]}
                disabled={!commentText.trim() || isPosting}
                onPress={handlePostOffer}
              >
                {isPosting ? <ActivityIndicator color="#FFF" size="small" /> : <MaterialIcons name="send" size={20} color="#FFF" />}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Resolution & Rating Modal */}
      <Modal
        visible={showResolveModal}
        transparent
        animationType="slide"
      >
        <TouchableWithoutFeedback onPress={() => setShowResolveModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Resolve Problem</Text>
                  <TouchableOpacity onPress={() => setShowResolveModal(false)}>
                    <Ionicons name="close" size={24} color="#64748b" />
                  </TouchableOpacity>
                </View>

                {potentialHelpers.length > 0 ? (
                  <>
                    <Text style={styles.modalSubtitle}>Who helped you with this task?</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.helperList}>
                      {potentialHelpers.map((helper) => (
                        <TouchableOpacity 
                          key={helper.id}
                          style={[styles.helperItem, selectedHelperId === helper.id && styles.helperItemActive]}
                          onPress={() => setSelectedHelperId(helper.id)}
                        >
                          <Image source={{ uri: helper.avatar_url || 'https://cdn-icons-png.flaticon.com/512/1144/1144760.png' }} style={styles.helperAvatar} />
                          <Text style={styles.helperName} numberOfLines={1}>{helper.name.split(' ')[0]}</Text>
                          {selectedHelperId === helper.id && (
                            <View style={styles.helperCheck}>
                              <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                            </View>
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                ) : (
                  <View style={styles.noHelpersBox}>
                    <Text style={styles.noHelpersText}>No chat history found for this problem. You can still mark it as resolved.</Text>
                  </View>
                )}

                <Text style={styles.modalSubtitle}>Rate the experience</Text>
                <View style={styles.starRow}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <TouchableOpacity key={s} onPress={() => setRating(s)}>
                      <Ionicons 
                        name={rating >= s ? "star" : "star-outline"} 
                        size={40} 
                        color={rating >= s ? "#FFC107" : "#CBD5E1"} 
                        style={{ marginHorizontal: 4 }}
                      />
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity 
                  style={[styles.modalSubmitBtn, (potentialHelpers.length > 0 && !selectedHelperId) && { opacity: 0.5 }]}
                  onPress={handleResolveProblem}
                  disabled={isResolving}
                >
                  {isResolving ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.modalSubmitText}>Award Trust Points</Text>
                  )}
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Edit Problem Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
      >
        <TouchableWithoutFeedback onPress={() => setShowEditModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Edit Post</Text>
                  <TouchableOpacity onPress={() => setShowEditModal(false)}>
                    <Ionicons name="close" size={24} color="#64748b" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.inputLabel}>Title</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editTitle}
                  onChangeText={setEditTitle}
                  placeholder="Problem Title"
                />

                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={[styles.modalInput, styles.modalTextarea]}
                  value={editDescription}
                  onChangeText={setEditDescription}
                  placeholder="Detailed description of the issue"
                  multiline
                  numberOfLines={4}
                />

                <TouchableOpacity 
                  style={[styles.modalSubmitBtn, { marginTop: 16 }]}
                  onPress={handleSaveEdit}
                  disabled={isSavingEdit}
                >
                  {isSavingEdit ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.modalSubmitText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Generated Arrival Code Modal */}
      <Modal
        visible={showCodeModal}
        transparent
        animationType="fade"
      >
        <TouchableWithoutFeedback onPress={() => setShowCodeModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalContent, { padding: 32, alignItems: 'center' }]}>
                <View style={{ backgroundColor: '#EBF3FB', width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                  <Ionicons name="shield-checkmark" size={40} color="#0a84ff" />
                </View>
                <Text style={[styles.modalTitle, { textAlign: 'center', marginBottom: 8 }]}>Offer Accepted!</Text>
                <Text style={{ fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
                  Please share this secure 6-digit arrival code with the helper when they physically arrive.
                </Text>
                
                <View style={{ backgroundColor: '#F1F5F9', paddingVertical: 16, paddingHorizontal: 32, borderRadius: 16, borderStyle: 'dashed', borderWidth: 2, borderColor: '#0a84ff', marginBottom: 24 }}>
                  <Text style={{ fontSize: 32, fontWeight: '800', color: '#0f172a', letterSpacing: 4 }}>{acceptedCode}</Text>
                </View>

                <TouchableOpacity 
                  style={[styles.modalSubmitBtn, { width: '100%' }]}
                  onPress={() => setShowCodeModal(false)}
                >
                  <Text style={styles.modalSubmitText}>Got It</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef0f5',
  },
  scrollContent: {
    paddingBottom: 100, // Make room for fixed bottom bar
  },
  heroContainer: {
    width: '100%',
    height: 320,
    backgroundColor: '#E0E3E6', 
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.15)', // Very light gradient/overlay to ensure header buttons are visible
  },
  floatingHeader: {
    position: 'absolute',
    top: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#191C1E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  contentCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -32,
    paddingHorizontal: 24,
    paddingTop: 32,
    shadowColor: '#191C1E',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.05,
    shadowRadius: 24,
    elevation: 8,
    minHeight: 600, 
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    backgroundColor: '#FEE2E2', // light red
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusBadgeText: {
    color: '#B91C1C', 
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  timeText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
    lineHeight: 32,
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  reporterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef0f5',
    padding: 16,
    borderRadius: 20,
    marginBottom: 24,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 16,
  },
  reporterDetails: {
    flex: 1,
  },
  reporterName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 2,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0a84ff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 4,
  },
  descriptionText: {
    fontSize: 16,
    color: '#424654',
    lineHeight: 26,
    marginBottom: 24,
  },
  detailsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6E8EB',
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  detailTextCol: {
    marginLeft: 12,
  },
  detailTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  engagementBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  helperBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a84ff',
    paddingVertical: 16,
    borderRadius: 20,
    marginRight: 16,
    shadowColor: '#0a84ff',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  helperBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  circleActionButton: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef0f5',
    borderRadius: 26,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(194, 198, 215, 0.3)',
    marginBottom: 24,
  },
  commentsSection: {
    marginBottom: 32,
  },
  commentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  commentsTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0a84ff',
  },
  commentCard: {
    backgroundColor: '#eef0f5',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  commentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  commentName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    flex: 1,
  },
  commentTime: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  commentText: {
    fontSize: 15,
    color: '#424654',
    lineHeight: 22,
    marginLeft: 48, 
  },
  noCommentsBox: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  noCommentsText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  bottomBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(194, 198, 215, 0.2)',
    shadowColor: '#191C1E',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 8,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#eef0f5',
    borderRadius: 24,
    paddingHorizontal: 20,
    height: 48,
    justifyContent: 'center',
    marginRight: 12,
  },
  textInput: {
    fontSize: 15,
    color: '#0f172a',
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0a84ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#B1C5FF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginTop: 8,
  },
  helperList: {
    marginBottom: 20,
  },
  helperItem: {
    alignItems: 'center',
    marginRight: 16,
    width: 64,
    position: 'relative',
  },
  helperItemActive: {
    opacity: 1,
  },
  helperAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#eef0f5',
    marginBottom: 6,
  },
  helperName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#424654',
  },
  helperCheck: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  noHelpersBox: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 16,
    marginBottom: 20,
  },
  noHelpersText: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  starRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 32,
    marginTop: 8,
  },
  modalSubmitBtn: {
    backgroundColor: '#0a84ff',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#0a84ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modalSubmitText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  ownerActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  editButton: {
    borderColor: '#0a84ff',
    backgroundColor: 'rgba(58, 123, 255, 0.05)',
  },
  editButtonText: {
    color: '#0054cb',
    fontWeight: '700',
    fontSize: 13,
  },
  deleteButton: {
    borderColor: '#ba1a1a',
    backgroundColor: 'rgba(186, 26, 26, 0.05)',
  },
  deleteButtonText: {
    color: '#ba1a1a',
    fontWeight: '700',
    fontSize: 13,
  },
  cancelOfferBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(186, 26, 26, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(186, 26, 26, 0.15)',
  },
  cancelOfferBtnText: {
    fontSize: 12,
    color: '#ba1a1a',
    fontWeight: '700',
  },
  skeletonLoader: {
    backgroundColor: '#E0E3E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#424654',
    marginBottom: 8,
    marginTop: 12,
  },
  modalInput: {
    backgroundColor: '#eef0f5',
    borderRadius: 16,
    padding: 14,
    fontSize: 15,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  modalTextarea: {
    height: 100,
    textAlignVertical: 'top',
  },
  offerSkillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginLeft: 48,
  },
  offerSkillBadge: {
    backgroundColor: '#EBF3FB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
  },
  offerSkillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0a84ff',
  },
  offerActionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    marginLeft: 48,
  },
  offerActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  offerAcceptBtn: {
    backgroundColor: '#10B981',
  },
  offerAcceptBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  offerDeclineBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  offerDeclineBtnText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },
  acceptedCodeContainer: {
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 16,
    marginTop: 12,
    marginLeft: 48,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  acceptedStatusText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#D97706',
    marginBottom: 8,
  },
  codeDisplayBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  codeLabelText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '700',
    marginRight: 8,
  },
  codeText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 2,
  },
  acceptedStatusWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginTop: 12,
    marginLeft: 48,
  },
  acceptedStatusLabel: {
    fontSize: 13,
    color: '#D97706',
    fontWeight: '700',
  },
  activeStatusWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginTop: 12,
    marginLeft: 48,
  },
  activeStatusLabel: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '700',
  },
  declinedStatusWrapper: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginTop: 12,
    marginLeft: 48,
  },
  declinedStatusLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  actionPanelContainer: {
    backgroundColor: '#FFF',
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  actionPanelInner: {
    gap: 12,
  },
  autoActionBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  autoActionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  autoActionSub: {
    fontSize: 12,
    color: '#64748b',
    paddingRight: 10,
  },
  autoActionBtn: {
    backgroundColor: '#0a84ff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  autoActionBtnText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  municipalBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bottomButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  offerHelpBtn: {
    flex: 1,
    backgroundColor: '#4f46e5',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#4f46e5',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  offerHelpBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  },
  reportBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  reportBtnText: {
    color: '#0f172a',
    fontWeight: '600',
    fontSize: 15,
  }
});
