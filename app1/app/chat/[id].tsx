import React, { useState, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Image,
  SafeAreaView
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { ActivityIndicator } from 'react-native';
import { API_BASE_URL } from '../../constants/Config';

// Chat logic fetches from local backend via polling

export default function IndividualChatScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [chatPartner, setChatPartner] = useState<any>({ name: 'Loading...', avatar: null });
  const [loading, setLoading] = useState(true);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [isSolved, setIsSolved] = useState(false);

  const [isOfferAccepted, setIsOfferAccepted] = useState(false);
  const [arrivalCode, setArrivalCode] = useState('');
  const [isArrivalVerified, setIsArrivalVerified] = useState(false);
  const [userRole, setUserRole] = useState<'resident' | 'helper' | null>(null);
  const [offerId, setOfferId] = useState<string | null>(null);
  
  // Real integrations
  const [activeProblemId, setActiveProblemId] = useState<string | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [isResident, setIsResident] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchChat = async (isFirstLoad = false) => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const storedUser = await SecureStore.getItemAsync('userData');
      let myId: string | null = null;
      if (storedUser) {
        const u = JSON.parse(storedUser);
        setCurrentUserId(u.id);
        myId = u.id;
      }

      const response = await fetch(`${API_BASE_URL}/chat/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setMessages(data.messages);
        if (isFirstLoad) {
          setChatPartner({
            name: data.partner.name,
            avatar: data.partner.avatar_url || 'https://cdn-icons-png.flaticon.com/512/1144/1144760.png'
          });
        }
      }

      // Fetch active offer and coordination status
      const statusRes = await fetch(`${API_BASE_URL}/chat/${id}/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const statusData = await statusRes.json();
      if (statusRes.ok && statusData.status) {
        const status = statusData.status;
        setOfferId(status.offer_id);
        setActiveProblemId(status.problem_id);
        setIsOfferAccepted(status.offer_status === 'accepted' || status.offer_status === 'active');
        setIsArrivalVerified(status.arrival_verified);
        setIsSolved(status.problem_status === 'resolved');
        
        const residentMode = myId === status.author_id;
        setIsResident(residentMode);
        setUserRole(residentMode ? 'resident' : 'helper');

        if (residentMode && (status.offer_status === 'accepted' || status.offer_status === 'active')) {
          const savedCode = await SecureStore.getItemAsync(`arrival_code_${status.problem_id}`);
          if (savedCode) {
            setArrivalCode(savedCode);
          } else {
            setArrivalCode('Code shared');
          }
        }
      }
      
      if (isFirstLoad) {
        setLoading(false);
      }
    } catch (err) {
      console.error("Chat fetch error:", err);
    }
  };

  React.useEffect(() => {
    fetchChat(true);

    let isMounted = true;
    let pollInterval: any;

    const startPolling = () => {
      pollInterval = setInterval(() => {
        if (isMounted) {
          fetchChat(false);
        }
      }, 3000); // Poll every 3 seconds
    };

    startPolling();

    return () => {
      isMounted = false;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [id]);

  const handleAcceptOffer = async () => {
    if (!offerId) return;
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
        setArrivalCode(code);
        setIsOfferAccepted(true);
        if (activeProblemId) {
          await SecureStore.setItemAsync(`arrival_code_${activeProblemId}`, code);
        }
        alert(`Offer accepted! Share code with helper on arrival: ${code}`);
        fetchChat();
      } else {
        alert(data.error || "Failed to accept offer.");
      }
    } catch (err) {
      alert("Safety verification failed.");
    }
  };

  const handleVerifyArrival = async () => {
    if (!inputCode.trim() || !offerId) return;
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch(`${API_BASE_URL}/offers/${offerId}/verify-arrival`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code: inputCode })
      });
      const data = await response.json();
      if (response.ok) {
        setIsArrivalVerified(true);
        if (Platform.OS !== 'web') {
          try {
            const Haptics = require('expo-haptics');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (e) {}
        }
        alert("Arrival verified successfully! Coordination session is now active.");
        setInputCode('');
        fetchChat();
      } else {
        alert(data.error || "Failed to verify arrival code.");
      }
    } catch (err) {
      console.error("Verify arrival error:", err);
      alert("Network error.");
    }
  };

  const triggerSOS = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const lat = await SecureStore.getItemAsync('userLat');
      const lng = await SecureStore.getItemAsync('userLng');
      
      const response = await fetch(`${API_BASE_URL}/safety/sos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          reason: "SOS triggered from chat room",
          latitude: lat ? parseFloat(lat) : 22.31,
          longitude: lng ? parseFloat(lng) : 73.18
        })
      });
      if (response.ok) {
        alert("EMERGENCY SOS: Your location and trust profile shared with authorities! Help is on the way.");
      } else {
        alert("Failed to broadcast SOS. Please call local emergency services immediately.");
      }
    } catch (err) {
      console.error("SOS error:", err);
      alert("EMERGENCY SOS: Help is on the way.");
    }
  };

  const sendMessage = async () => {
    if (!message.trim()) return;

    if (Platform.OS !== 'web') {
      try {
        const Haptics = require('expo-haptics');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {}
    }

    const tempId = Date.now().toString();
    const newMessage = { id: tempId, text: message, isMe: true, time: 'Sending...' };
    setMessages(prev => [...prev, newMessage]);
    setMessage('');

    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch(`${API_BASE_URL}/chat/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: newMessage.text })
      });
      
      if (!response.ok) {
        alert("Failed to send message.");
        setMessages(prev => prev.filter(m => m.id !== tempId));
      }
    } catch (err) {
      console.error("Send message error:", err);
      alert("Failed to send message.");
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };

  const submitRating = async () => {
    if (rating === 0) {
      alert("Please select a star rating first.");
      return;
    }
    if (!activeProblemId) return;

    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch(`${API_BASE_URL}/problems/${activeProblemId}/resolve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          helper_id: id,
          rating: rating
        })
      });
      const data = await response.json();
      if (response.ok) {
        setShowRatingModal(false);
        setIsSolved(true);
        if (Platform.OS !== 'web') {
          try {
            const Haptics = require('expo-haptics');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (e) {}
        }
        alert(`Problem resolved! You rated ${chatPartner.name} ${rating} stars.`);
        fetchChat();
      } else {
        alert(data.error || "Failed to resolve problem.");
      }
    } catch (err) {
      console.error("Resolve error:", err);
      alert("Network error.");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView 
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#191C1E" />
          </TouchableOpacity>
          <View style={styles.headerUserInfo}>
            <Image source={{ uri: chatPartner.avatar }} style={styles.headerAvatar} />
            <View>
              <Text style={styles.headerName}>{chatPartner.name}</Text>
              <Text style={styles.headerStatus}>Online now</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.rateButton}
            onPress={() => setShowRatingModal(true)}
          >
            <Ionicons name="star" size={20} color="#F59E0B" />
          </TouchableOpacity>
        </View>

        {/* Chat Area */}
        <ScrollView 
          ref={scrollViewRef}
          style={styles.chatArea}
          contentContainerStyle={styles.chatScrollContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          <View style={styles.dateBadgeWrapper}>
            <View style={styles.dateBadge}>
              <Text style={styles.dateBadgeText}>TODAY</Text>
            </View>
          </View>

          {/* Physical Safety Layer Callouts */}
          {offerId && (
            <View>
              {!isArrivalVerified && !isSolved && (
                <View style={[styles.safetyCallout, isOfferAccepted && styles.safetyCalloutAccepted]}>
                  <View style={styles.safetyHeader}>
                    <Ionicons name="shield-checkmark" size={20} color={isOfferAccepted ? "#10B981" : "#0a84ff"} />
                    <Text style={styles.safetyHeaderTitle}>Physical Safety & Trust Framework</Text>
                  </View>
                  
                  {!isOfferAccepted ? (
                    isResident ? (
                      <View style={styles.safetyContent}>
                        <Text style={styles.safetyDesc}>This helper has offered to assist. Accept the offer to start coordination and generate a secure code.</Text>
                        <TouchableOpacity style={styles.safetyActionBtn} onPress={handleAcceptOffer}>
                          <Text style={styles.safetyBtnText}>Accept Offer & Generate Code</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.safetyContent}>
                        <Text style={styles.safetyDesc}>Your help offer is currently pending resident approval.</Text>
                      </View>
                    )
                  ) : (
                    isResident ? (
                      <View style={styles.safetyContent}>
                        <Text style={styles.safetyDesc}>Offer accepted! Share this 6-digit code with {chatPartner.name} upon arrival to verify their identity:</Text>
                        <View style={styles.codeContainer}>
                          <Text style={styles.codeText}>{arrivalCode}</Text>
                        </View>
                        <Text style={styles.safetyHint}>This code expires in 10 minutes. Only share it in person.</Text>
                        <TouchableOpacity style={[styles.safetyActionBtn, {backgroundColor: '#EF4444', marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center'}]} onPress={triggerSOS}>
                          <Ionicons name="alert-circle" size={18} color="#FFF" style={{marginRight: 6}} />
                          <Text style={styles.safetyBtnText}>Trigger Emergency SOS</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.safetyContent}>
                        <Text style={styles.safetyDesc}>Ask the resident for the 6-digit arrival code to verify your physical presence at their door:</Text>
                        <TextInput 
                          style={{
                            backgroundColor: '#FFFFFF',
                            borderWidth: 1.5,
                            borderColor: '#ECEEF1',
                            borderRadius: 16,
                            padding: 12,
                            marginVertical: 12,
                            textAlign: 'center',
                            fontWeight: '800',
                            fontSize: 20,
                            color: '#0f172a',
                            letterSpacing: 4
                          }}
                          placeholder="000000"
                          placeholderTextColor="#A0AAB4"
                          value={inputCode}
                          onChangeText={setInputCode}
                          keyboardType="number-pad"
                          maxLength={6}
                        />
                        <TouchableOpacity style={styles.safetyActionBtn} onPress={handleVerifyArrival}>
                          <Text style={styles.safetyBtnText}>Verify Arrival</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.safetyActionBtn, {backgroundColor: '#EF4444', marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center'}]} onPress={triggerSOS}>
                          <Ionicons name="alert-circle" size={18} color="#FFF" style={{marginRight: 6}} />
                          <Text style={styles.safetyBtnText}>Trigger Emergency SOS</Text>
                        </TouchableOpacity>
                      </View>
                    )
                  )}
                </View>
              )}

              {isArrivalVerified && !isSolved && (
                isResident ? (
                  <View style={[styles.arrivalVerifiedBanner, {flexDirection: 'column', alignItems: 'stretch', padding: 16}]}>
                    <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 12}}>
                      <Ionicons name="checkmark-circle" size={20} color="#10B981" style={{marginRight: 8}} />
                      <Text style={[styles.arrivalVerifiedText, {fontWeight: '700'}]}>Helper Arrival Verified. Physical Session Active.</Text>
                    </View>
                    <TouchableOpacity style={[styles.safetyActionBtn, {backgroundColor: '#10B981'}]} onPress={() => setShowRatingModal(true)}>
                      <Text style={styles.safetyBtnText}>Mark Resolved & Rate Helper</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.safetyActionBtn, {backgroundColor: '#EF4444', marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center'}]} onPress={triggerSOS}>
                      <Ionicons name="alert-circle" size={18} color="#FFF" style={{marginRight: 6}} />
                      <Text style={styles.safetyBtnText}>Trigger Emergency SOS</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={[styles.arrivalVerifiedBanner, {flexDirection: 'column', alignItems: 'stretch', padding: 16}]}>
                    <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 8}}>
                      <Ionicons name="checkmark-circle" size={20} color="#10B981" style={{marginRight: 8}} />
                      <Text style={[styles.arrivalVerifiedText, {fontWeight: '700'}]}>Arrival Verified. Coordination Active.</Text>
                    </View>
                    <Text style={{fontSize: 13, color: '#4E5058', lineHeight: 18}}>Please coordinate with the resident to complete the task. Once finished, they will mark it resolved.</Text>
                    <TouchableOpacity style={[styles.safetyActionBtn, {backgroundColor: '#EF4444', marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center'}]} onPress={triggerSOS}>
                      <Ionicons name="alert-circle" size={18} color="#FFF" style={{marginRight: 6}} />
                      <Text style={styles.safetyBtnText}>Trigger Emergency SOS</Text>
                    </TouchableOpacity>
                  </View>
                )
              )}

              {isSolved && (
                <View style={styles.arrivalVerifiedBanner}>
                  <Ionicons name="shield-checkmark" size={20} color="#0a84ff" style={{marginRight: 8}} />
                  <Text style={styles.arrivalVerifiedText}>Problem resolved and coordination successfully closed.</Text>
                </View>
              )}
            </View>
          )}

          {messages.map((msg) => (
            <View 
              key={msg.id} 
              style={[
                styles.messageRow, 
                msg.isMe ? styles.messageRowMe : styles.messageRowThem
              ]}
            >
              {!msg.isMe && (
                <Image source={{ uri: chatPartner.avatar }} style={styles.msgAvatar} />
              )}
              <View style={[
                styles.messageBubble,
                msg.isMe ? styles.messageBubbleMe : styles.messageBubbleThem
              ]}>
                <Text style={[
                  styles.messageText,
                  msg.isMe ? styles.messageTextMe : styles.messageTextThem
                ]}>
                  {msg.text}
                </Text>
                <Text style={[
                  styles.messageTime,
                  msg.isMe ? styles.messageTimeMe : styles.messageTimeThem
                ]}>
                  {msg.time}
                </Text>
              </View>
            </View>
          ))}
          <View style={{ paddingHorizontal: 16, marginTop: 12, marginBottom: 20 }}>
            
            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 16, padding: 16 }}
              onPress={() => router.push('/qr')}
            >
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: '#0f172a' }}>QR check in</Text>
              <Ionicons name="chevron-forward" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Input Area */}
        <View style={styles.inputArea}>
          <TouchableOpacity style={styles.attachButton}>
            <MaterialIcons name="add" size={28} color="#64748b" />
          </TouchableOpacity>
          <View style={styles.textInputWrapper}>
            <TextInput
              style={styles.textInput}
              placeholder="Type a message..."
              placeholderTextColor="#A0AAB4"
              value={message}
              onChangeText={setMessage}
              multiline
            />
          </View>
          <TouchableOpacity 
            style={[styles.sendButton, !message.trim() && styles.sendButtonDisabled]}
            disabled={!message.trim()}
            onPress={sendMessage}
          >
            <MaterialIcons name="send" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Rating Modal Overlay (Simulated with absolute position for simplicity) */}
        {showRatingModal && (
          <View style={styles.modalOverlay}>
            <View style={styles.ratingModal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Rate Helper</Text>
                <TouchableOpacity onPress={() => setShowRatingModal(false)}>
                  <MaterialIcons name="close" size={24} color="#64748b" />
                </TouchableOpacity>
              </View>
              
              <Image source={{ uri: chatPartner.avatar }} style={styles.modalAvatar} />
              <Text style={styles.modalDesc}>How was your experience getting help from {chatPartner.name}?</Text>
              
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity key={star} onPress={() => setRating(star)}>
                    <Ionicons 
                      name={star <= rating ? "star" : "star-outline"} 
                      size={40} 
                      color={star <= rating ? "#F59E0B" : "#C2C6D7"} 
                    />
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.submitRatingBtn} onPress={submitRating}>
                <Text style={styles.submitRatingText}>Submit Review</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 64,
    borderBottomWidth: 1,
    borderBottomColor: '#ECEEF1',
    backgroundColor: '#FFFFFF',
    zIndex: 10,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerUserInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerStatus: {
    fontSize: 12,
    color: '#16A34A', // green
    fontWeight: '600',
  },
  rateButton: {
    padding: 10,
    backgroundColor: '#FFFBEB',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  chatArea: {
    flex: 1,
    backgroundColor: '#eef0f5',
  },
  chatScrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  dateBadgeWrapper: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateBadge: {
    backgroundColor: '#E6E8EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  dateBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  messageRowThem: {
    justifyContent: 'flex-start',
  },
  msgAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  messageBubbleMe: {
    backgroundColor: '#0a84ff',
    borderBottomRightRadius: 4,
  },
  messageBubbleThem: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    shadowColor: '#191C1E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  messageTextMe: {
    color: '#FFFFFF',
  },
  messageTextThem: {
    color: '#0f172a',
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  messageTimeMe: {
    color: 'rgba(255,255,255,0.7)',
  },
  messageTimeThem: {
    color: '#A0AAB4',
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#ECEEF1',
    paddingBottom: Platform.OS === 'ios' ? 34 : 12,
  },
  attachButton: {
    padding: 8,
    marginRight: 4,
    marginBottom: 2,
  },
  textInputWrapper: {
    flex: 1,
    backgroundColor: '#eef0f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
    maxHeight: 120,
    justifyContent: 'center',
    marginRight: 10,
  },
  textInput: {
    fontSize: 15,
    color: '#0f172a',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0a84ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendButtonDisabled: {
    backgroundColor: '#B1C5FF',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 100,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  ratingModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 16,
  },
  modalDesc: {
    fontSize: 15,
    color: '#424654',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 32,
  },
  submitRatingBtn: {
    backgroundColor: '#0a84ff',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  submitRatingText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  systemCallout: {
    backgroundColor: '#E6F0FF',
    marginHorizontal: 16,
    marginBottom: 24,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(58, 123, 255, 0.1)',
    alignItems: 'center',
  },
  systemCalloutText: {
    fontSize: 13,
    color: '#424654',
    textAlign: 'center',
    marginVertical: 12,
    lineHeight: 18,
  },
  markSolvedBtn: {
    backgroundColor: '#0a84ff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#0a84ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  markSolvedText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  safetyCallout: {
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#0a84ff',
    borderStyle: 'dashed',
    marginHorizontal: 16,
    marginBottom: 24,
    padding: 16,
    borderRadius: 16,
  },
  safetyCalloutAccepted: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
    borderStyle: 'solid',
  },
  safetyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  safetyHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  safetyContent: {
    alignItems: 'center',
  },
  safetyDesc: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  safetyActionBtn: {
    backgroundColor: '#0a84ff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
  },
  safetyBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  codeContainer: {
    backgroundColor: '#FFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    marginBottom: 12,
  },
  codeText: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 4,
    color: '#111827',
  },
  safetyHint: {
    fontSize: 11,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  arrivalVerifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D1FAE5',
    padding: 12,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 24,
    gap: 8,
  },
  arrivalVerifiedText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
  },
  sosButton: {
    backgroundColor: '#FEF2F2',
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    width: 60,
  },
  sosText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#EF4444',
  },
});
