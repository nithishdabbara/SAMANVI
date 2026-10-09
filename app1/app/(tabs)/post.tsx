import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Modal,
  TouchableWithoutFeedback,
  Image
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import { API_BASE_URL } from '../../constants/Config';
import BottomSheetModal from '../../components/BottomSheetModal';
import { SpringButton } from '../../components/ScreenTransition';
import { haptic } from '../../utils/haptics';

export default function PostScreen() {
  const router = useRouter();
  
  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [urgency, setUrgency] = useState('medium'); // low, medium, high, critical
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [coords, setCoords] = useState<{latitude: number, longitude: number} | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  
  const [postType, setPostType] = useState('free_help'); // 'free_help', 'referral', 'paid_help'
  const [budgetRange, setBudgetRange] = useState('');
  
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [showUrgencySheet, setShowUrgencySheet] = useState(false);

  // ML suggestions state
  const [categorySuggestion, setCategorySuggestion] = useState<{ value: string, confidence: number } | null>(null);
  const [urgencySuggestion, setUrgencySuggestion] = useState<{ value: string, confidence: number } | null>(null);

  // Draft recovery state
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<any>(null);

  // Auto-fetch location on mount
  React.useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          let loc = await Location.getCurrentPositionAsync({});
          setCoords({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude
          });
          let address = await Location.reverseGeocodeAsync(loc.coords);
          if (address.length > 0) {
            setLocation(`${address[0].city || address[0].region}, ${address[0].district || ''}`);
          }
        }
      } catch (e) {
        console.log('Error fetching location for post:', e);
      }
    })();
  }, []);

  // Load draft on mount
  React.useEffect(() => {
    const checkDraft = async () => {
      try {
        const raw = await SecureStore.getItemAsync('problem_draft');
        if (raw) {
          const draft = JSON.parse(raw);
          const savedAt = new Date(draft.savedAt);
          const hoursPassed = (new Date().getTime() - savedAt.getTime()) / (1000 * 60 * 60);
          if (hoursPassed <= 48) {
            setPendingDraft(draft);
            setShowDraftPrompt(true);
          } else {
            await SecureStore.deleteItemAsync('problem_draft');
          }
        }
      } catch (e) {
        console.log('Error reading draft:', e);
      }
    };
    checkDraft();
  }, []);

  // Save draft on changes (debounced to avoid writing continuously)
  React.useEffect(() => {
    const timer = setTimeout(async () => {
      if (title.trim() || description.trim() || category || urgency !== 'medium') {
        try {
          await SecureStore.setItemAsync('problem_draft', JSON.stringify({
            title,
            description,
            category,
            urgency,
            savedAt: new Date().toISOString()
          }));
        } catch (e) {
          console.log('Error saving draft:', e);
        }
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [title, description, category, urgency]);

  // Debounced text analysis for ML suggestions
  React.useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (description.trim().length < 15) return;
      try {
        const token = await SecureStore.getItemAsync('userToken');
        const response = await fetch(`${API_BASE_URL}/ml/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ title, description })
        });
        if (response.ok) {
          const data = await response.json();
          // Suggest category if not manually selected
          if (!category) {
            setCategorySuggestion({
              value: data.suggested_category,
              confidence: data.category_confidence
            });
          }
          // Suggest urgency
          if (urgency === 'medium') {
            setUrgencySuggestion({
              value: data.suggested_urgency,
              confidence: data.urgency_confidence
            });
          }
        }
      } catch (err) {
        console.log('ML suggestion failed silently:', err);
      }
    }, 800);

    return () => clearTimeout(delayDebounce);
  }, [title, description]);

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        alert('Sorry, we need camera permissions to make this work!');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhotos(prev => [...prev, result.assets[0].uri]);
      }
    } catch (e) {
      console.log('Error taking photo:', e);
    } finally {
      setShowPhotoOptions(false);
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert('Sorry, we need camera roll permissions to make this work!');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        allowsMultipleSelection: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newUris = result.assets.map(a => a.uri);
        setPhotos(prev => [...prev, ...newUris]);
      }
    } catch (e) {
      console.log('Error picking image:', e);
    } finally {
      setShowPhotoOptions(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !category) {
      if (Platform.OS !== 'web') {
        try {
          const Haptics = require('expo-haptics');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } catch (e) {}
      }
      alert('Please fill out all required fields.');
      return;
    }

    if (!coords) {
      if (Platform.OS !== 'web') {
        try {
          const Haptics = require('expo-haptics');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } catch (e) {}
      }
      alert('We need your location to post a problem nearby.');
      return;
    }

    setIsPosting(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      
      let uploadedPhotoUrl = null;
      
      if (photos.length > 0) {
        const photoUri = photos[0];
        const formData = new FormData();
        const filename = photoUri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename || '');
        const type = match ? `image/${match[1]}` : `image`;

        formData.append('file', {
          uri: photoUri,
          name: filename,
          type: type,
        } as any);

        const uploadResponse = await fetch(`${API_BASE_URL}/problems/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });

        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          uploadedPhotoUrl = uploadData.photo_url;
        } else {
          console.error("Photo upload failed");
        }
      }

      const response = await fetch(`${API_BASE_URL}/problems`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          description,
          category_id: null,
          category: category,
          priority: urgency,
          latitude: coords.latitude,
          longitude: coords.longitude,
          photo_url: uploadedPhotoUrl,
          post_type: postType,
          budget_range: postType === 'paid_help' ? budgetRange : null
        })
      });

      const data = await response.json();
      if (response.ok) {
        if (Platform.OS !== 'web') {
          try {
            const Haptics = require('expo-haptics');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (e) {}
        }
        alert('Problem posted successfully!');
        // Clear draft
        await SecureStore.deleteItemAsync('problem_draft');
        // Clear form and navigate back
        setTitle('');
        setDescription('');
        setCategory('');
        setLocation('');
        setPhotos([]);
        setUrgency('medium');
        setPostType('free_help');
        setBudgetRange('');
        router.replace('/(tabs)/problems');
      } else {
        if (Platform.OS !== 'web') {
          try {
            const Haptics = require('expo-haptics');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          } catch (e) {}
        }
        alert(data.error || 'Failed to post problem');
      }
    } catch (e) {
      if (Platform.OS !== 'web') {
        try {
          const Haptics = require('expo-haptics');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } catch (err) {}
      }
      console.log('Error submitting post:', e);
      alert('Network error while posting.');
    } finally {
      setIsPosting(false);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerIconButton}>
            <MaterialIcons name="arrow-back" size={24} color="#0a84ff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Post a Problem</Text>
          <TouchableOpacity style={styles.headerIconButton}>
            <MaterialIcons name="info-outline" size={24} color="#0a84ff" />
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.container} 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Draft Recovery Banner */}
          {showDraftPrompt && pendingDraft && (
            <View style={styles.draftPromptCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.draftPromptTitle}>Unsaved Draft Found</Text>
                <Text style={styles.draftPromptDesc}>Would you like to restore your previous post?</Text>
              </View>
              <View style={styles.draftPromptActions}>
                <TouchableOpacity 
                  style={[styles.draftActionBtn, { backgroundColor: '#0a84ff' }]} 
                  onPress={() => {
                    setTitle(pendingDraft.title || '');
                    setDescription(pendingDraft.description || '');
                    setCategory(pendingDraft.category || '');
                    setUrgency(pendingDraft.urgency || 'medium');
                    setShowDraftPrompt(false);
                  }}
                >
                  <Text style={[styles.draftActionText, { color: '#FFF' }]}>Restore</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.draftActionBtn, { backgroundColor: '#ECEEF1' }]} 
                  onPress={async () => {
                    await SecureStore.deleteItemAsync('problem_draft');
                    setShowDraftPrompt(false);
                  }}
                >
                  <Text style={[styles.draftActionText, { color: '#64748b' }]}>Discard</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Image Upload Section */}
          {photos.length > 0 ? (
            <View style={styles.uploadSectionContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 8, gap: 12 }}>
                {photos.map((uri, index) => (
                  <View key={index} style={[styles.uploadedPhotoBox, { paddingVertical: 0, overflow: 'hidden', width: 200, height: 200 }]}>
                    <Image source={{ uri }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                    <TouchableOpacity 
                      style={[styles.uploadSuccessBadge, { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(255,255,255,0.9)' }]}
                      onPress={() => removePhoto(index)}
                    >
                      <Ionicons name="trash" size={20} color="#E11D48" style={{ padding: 6 }} />
                    </TouchableOpacity>
                  </View>
                ))}
                
                <TouchableOpacity 
                  style={[styles.uploadDashedBox, { width: 140, height: 200, paddingVertical: 0 }]}
                  onPress={() => setShowPhotoOptions(true)}
                >
                  <Ionicons name="add" size={32} color="#0a84ff" />
                  <Text style={[styles.uploadTitle, { fontSize: 14, marginTop: 8 }]}>Add More</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.uploadSectionContainer} 
              activeOpacity={0.8}
              onPress={() => setShowPhotoOptions(true)}
            >
              <View style={styles.uploadDashedBox}>
                <View style={styles.uploadIconCircle}>
                  <Ionicons name="camera" size={32} color="#0a84ff" />
                </View>
                <Text style={styles.uploadTitle}>Add Photo (Optional)</Text>
                <Text style={styles.uploadSubtitle}>Show what the problem is about</Text>
              </View>
            </TouchableOpacity>
          )}

          <View style={styles.formContent}>
            
            {/* Post Title Input */}
            <View style={styles.cardInputContainer}>
              <Text style={styles.inputLabel}>PROBLEM TITLE</Text>
              <TextInput
                style={styles.inputField}
                placeholder="e.g., Water pipe leakage or Streetlight flickering"
                placeholderTextColor="#A0AAB4"
                value={title}
                onChangeText={setTitle}
                maxLength={100}
              />
            </View>

            {/* Category Dropdown */}
            <View style={styles.cardInputContainer}>
              <Text style={styles.inputLabel}>CATEGORY</Text>
              <TouchableOpacity
                style={styles.rowInputContainer}
                onPress={() => {
                  haptic.light();
                  setShowCategorySheet(true);
                }}
              >
                <MaterialIcons name="category" size={20} color="#64748b" style={styles.inputIcon} />
                <Text style={[styles.pickerValueText, !category && { color: '#A0AAB4' }]}>
                  {category || 'Select a Category'}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#64748b" style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
            </View>
            
            {/* ML Category Suggestion Badge */}
            {categorySuggestion && !category && categorySuggestion.confidence >= 50 && (
              <View style={styles.suggestionBadgeCard}>
                <Ionicons name="sparkles" size={16} color="#0a84ff" />
                <Text style={styles.suggestionBadgeText}>
                  {categorySuggestion.confidence <= 75 ? (
                    <>Suggested Category: <Text style={{fontWeight: '700'}}>{categorySuggestion.value}</Text> (Low Confidence)</>
                  ) : (
                    <>Recommended Category: <Text style={{fontWeight: '700'}}>{categorySuggestion.value}</Text></>
                  )}
                </Text>
                <View style={styles.suggestionBadgeActions}>
                  <TouchableOpacity 
                    style={styles.suggestionAcceptBtn} 
                    onPress={() => {
                      setCategory(categorySuggestion.value);
                      setCategorySuggestion(null);
                    }}
                  >
                    <Text style={styles.suggestionAcceptBtnText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.suggestionIgnoreBtn} 
                    onPress={() => {
                      setCategorySuggestion(null);
                    }}
                  >
                    <Text style={styles.suggestionIgnoreBtnText}>Ignore</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Urgency Level Selector */}
            <View style={styles.cardInputContainer}>
              <Text style={styles.inputLabel}>URGENCY LEVEL</Text>
              <TouchableOpacity
                style={styles.rowInputContainer}
                onPress={() => {
                  haptic.light();
                  setShowUrgencySheet(true);
                }}
              >
                <MaterialIcons name="error-outline" size={20} color="#64748b" style={styles.inputIcon} />
                <Text style={styles.pickerValueText}>
                  {urgency.charAt(0).toUpperCase() + urgency.slice(1)}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#64748b" style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
            </View>

            {/* ML Urgency Suggestion Badge */}
            {urgencySuggestion && urgency === 'medium' && urgencySuggestion.confidence >= 50 && (
              <View style={styles.suggestionBadgeCard}>
                <Ionicons name="sparkles" size={16} color="#0a84ff" />
                <Text style={styles.suggestionBadgeText}>
                  {urgencySuggestion.confidence <= 75 ? (
                    <>Suggested Urgency: <Text style={{fontWeight: '700'}}>{urgencySuggestion.value}</Text> (Low Confidence)</>
                  ) : (
                    <>Recommended Urgency: <Text style={{fontWeight: '700'}}>{urgencySuggestion.value}</Text></>
                  )}
                </Text>
                <View style={styles.suggestionBadgeActions}>
                  <TouchableOpacity 
                    style={styles.suggestionAcceptBtn} 
                    onPress={() => {
                      setUrgency(urgencySuggestion.value.toLowerCase());
                      setUrgencySuggestion(null);
                    }}
                  >
                    <Text style={styles.suggestionAcceptBtnText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.suggestionIgnoreBtn} 
                    onPress={() => {
                      setUrgencySuggestion(null);
                    }}
                  >
                    <Text style={styles.suggestionIgnoreBtnText}>Ignore</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Location Field */}
            <View style={styles.cardInputContainer}>
              <Text style={styles.inputLabel}>LOCATION</Text>
              <View style={styles.rowInputContainer}>
                <MaterialIcons name="location-on" size={20} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  style={styles.flexInput}
                  placeholder="Street Address or Block Name"
                  placeholderTextColor="#A0AAB4"
                  value={location}
                  onChangeText={setLocation}
                />
                <TouchableOpacity style={styles.gpsButton}>
                  <MaterialIcons name="my-location" size={20} color="#0a84ff" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Description Input */}
            <View style={styles.cardInputContainer}>
              <Text style={styles.inputLabel}>DESCRIPTION</Text>
              <View style={[styles.rowInputContainer, styles.textAreaContainer]}>
                <MaterialIcons name="description" size={20} color="#64748b" style={styles.inputIconTop} />
                <TextInput
                  style={[styles.flexInput, styles.textArea]}
                  placeholder="Describe the issue you need help with"
                  placeholderTextColor="#A0AAB4"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                />
              </View>
            </View>

            {/* Help Type Selection */}
            <View style={styles.cardInputContainer}>
              <Text style={styles.inputLabel}>HELP TYPE</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                {[
                  { id: 'free_help', label: '🙋 Free Help', sub: 'Volunteer' },
                  { id: 'referral', label: '📞 Referral', sub: 'Recommend' },
                  { id: 'paid_help', label: '💰 Paid Work', sub: 'Skilled' }
                ].map(type => (
                  <SpringButton
                    key={type.id}
                    style={[{
                      flex: 1, padding: 10, borderRadius: 16, borderWidth: 1, borderColor: '#E0E0E0', alignItems: 'center', backgroundColor: '#FFF'
                    }, postType === type.id && {
                      borderColor: '#0a84ff', backgroundColor: '#0a84ff10', borderWidth: 2
                    }]}
                    onPress={() => setPostType(type.id)}
                    hapticType="selection"
                  >
                    <Text style={[{ fontSize: 13, fontWeight: 'bold', color: '#0f172a' }, postType === type.id && { color: '#0a84ff' }]}>
                      {type.label.split(' ')[0]} {type.label.split(' ').slice(1).join(' ')}
                    </Text>
                    <Text style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{type.sub}</Text>
                  </SpringButton>
                ))}
              </View>
            </View>

            {/* Budget Range (Conditional on Paid Help) */}
            {postType === 'paid_help' && (
              <View style={styles.cardInputContainer}>
                <Text style={styles.inputLabel}>BUDGET RANGE</Text>
                <View style={styles.rowInputContainer}>
                  <MaterialIcons name="attach-money" size={20} color="#64748b" style={styles.inputIcon} />
                  <TextInput
                    style={styles.flexInput}
                    placeholder="e.g. ₹500 - ₹1000 or Hourly rate"
                    placeholderTextColor="#A0AAB4"
                    value={budgetRange}
                    onChangeText={setBudgetRange}
                  />
                </View>
              </View>
            )}

            {/* Privacy Toggle */}
            <View style={styles.privacyCard}>
              <View style={styles.privacyLeft}>
                <MaterialIcons name="visibility-off" size={24} color="#475D93" />
                <Text style={styles.privacyLabel}>Post Anonymously</Text>
              </View>
              <Switch
                trackColor={{ false: '#E0E3E6', true: '#0a84ff' }}
                thumbColor={'#FFF'}
                ios_backgroundColor="#E0E3E6"
                onValueChange={(val) => {
                  haptic.selection();
                  setIsAnonymous(val);
                }}
                value={isAnonymous}
              />
            </View>

          </View>
        </ScrollView>

        {/* Fixed Submit Button */}
        <View style={styles.fixedSubmitContainer}>
          <SpringButton 
            style={styles.submitButton}
            onPress={handleSubmit}
            hapticType="medium"
          >
            <Text style={styles.submitButtonText}>Post to Community</Text>
            <MaterialIcons name="arrow-forward" size={20} color="#FFF" />
          </SpringButton>
        </View>

        {/* Photo Options Modal */}
        {showPhotoOptions && (
          <Modal transparent visible={showPhotoOptions} animationType="fade">
            <TouchableWithoutFeedback onPress={() => setShowPhotoOptions(false)}>
              <View style={styles.modalOverlay}>
                <TouchableWithoutFeedback>
                  <View style={styles.actionSheet}>
                    <Text style={styles.actionSheetTitle}>Select Photo Source</Text>
                    
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={takePhoto}
                    >
                      <Ionicons name="camera-outline" size={24} color="#0a84ff" />
                      <Text style={styles.actionButtonText}>Take Photo</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={pickImage}
                    >
                      <Ionicons name="images-outline" size={24} color="#0a84ff" />
                      <Text style={styles.actionButtonText}>Choose from Gallery</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={pickImage}
                    >
                      <Ionicons name="folder-open-outline" size={24} color="#0a84ff" />
                      <Text style={styles.actionButtonText}>Browse Files</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.actionButton, { marginTop: 8, borderTopColor: 'transparent' }]}
                      onPress={() => setShowPhotoOptions(false)}
                    >
                      <Text style={[styles.actionButtonText, { color: '#E11D48', fontWeight: '800' }]}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableWithoutFeedback>
              </View>
            </TouchableWithoutFeedback>
          </Modal>
        )}
      </KeyboardAvoidingView>

      {/* Category Bottom Sheet */}
      <BottomSheetModal
        visible={showCategorySheet}
        onClose={() => setShowCategorySheet(false)}
        title="Select Category"
        height={460}
      >
        <ScrollView style={{ paddingHorizontal: 16 }}>
          {[
            "Electricity",
            "Water",
            "Road",
            "Safety",
            "Sanitation",
            "Home Repairs & Plumbing",
            "Tutoring & Tech Help",
            "Borrowing Tools",
            "Errands & Moving",
            "Community Event"
          ].map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.sheetItem,
                category === cat && styles.sheetItemActive
              ]}
              onPress={() => {
                haptic.selection();
                setCategory(cat);
                setShowCategorySheet(false);
              }}
            >
              <Text style={[
                styles.sheetItemText,
                category === cat && styles.sheetItemTextActive
              ]}>
                {cat}
              </Text>
              {category === cat && (
                <Ionicons name="checkmark" size={18} color="#007AFF" />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </BottomSheetModal>

      {/* Urgency Bottom Sheet */}
      <BottomSheetModal
        visible={showUrgencySheet}
        onClose={() => setShowUrgencySheet(false)}
        title="Select Urgency Level"
        height={320}
      >
        <ScrollView style={{ paddingHorizontal: 16 }}>
          {[
            { id: 'low', label: 'Low' },
            { id: 'medium', label: 'Medium' },
            { id: 'high', label: 'High' },
            { id: 'critical', label: 'Critical' }
          ].map((urg) => (
            <TouchableOpacity
              key={urg.id}
              style={[
                styles.sheetItem,
                urgency === urg.id && styles.sheetItemActive
              ]}
              onPress={() => {
                haptic.selection();
                setUrgency(urg.id);
                setShowUrgencySheet(false);
              }}
            >
              <Text style={[
                styles.sheetItemText,
                urgency === urg.id && styles.sheetItemTextActive
              ]}>
                {urg.label}
              </Text>
              {urgency === urg.id && (
                <Ionicons name="checkmark" size={18} color="#007AFF" />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </BottomSheetModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#eef0f5',
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 64,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: '#ECEEF1',
    zIndex: 10,
  },
  headerIconButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#191C1E',
    letterSpacing: -0.5,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  uploadSectionContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 4,
    shadowColor: '#191C1E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 24,
  },
  uploadDashedBox: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#C2C6D7',
    borderRadius: 20,
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFB',
  },
  uploadIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(58, 123, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  uploadTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  uploadSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '500',
  },
  uploadedPhotoBox: {
    borderWidth: 2,
    borderColor: '#10B981',
    borderRadius: 20,
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
  },
  uploadSuccessBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  formContent: {
    gap: 16,
  },
  cardInputContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#191C1E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0a84ff',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  inputField: {
    backgroundColor: '#eef0f5',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '500',
  },
  rowInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef0f5',
    borderRadius: 16,
    paddingHorizontal: 16,
    minHeight: 52,
  },
  inputIcon: {
    marginRight: 12,
  },
  inputIconTop: {
    marginRight: 12,
    marginTop: 16,
  },
  picker: {
    height: 52,
    width: '100%',
    color: '#0f172a',
  },
  flexInput: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '500',
    paddingVertical: 14,
  },
  gpsButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(58, 123, 255, 0.08)',
  },
  textAreaContainer: {
    alignItems: 'flex-start',
  },
  textArea: {
    minHeight: 120,
    paddingTop: 16,
    paddingBottom: 16,
  },
  privacyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 4,
    borderLeftColor: '#0a84ff',
    shadowColor: '#191C1E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  privacyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  privacyLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  fixedSubmitContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(236, 238, 241, 0.7)',
    zIndex: 20,
  },
  submitButton: {
    backgroundColor: '#0a84ff',
    borderRadius: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#0a84ff',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  actionSheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 16,
    textAlign: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eef0f5',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginLeft: 12,
  },
  draftPromptCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ECEEF1',
    shadowColor: '#191C1E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  draftPromptTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  draftPromptDesc: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  draftPromptActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  draftActionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  draftActionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  suggestionBadgeCard: {
    backgroundColor: '#F0F4FF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#D4E2FF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: -8,
    marginBottom: 8,
  },
  suggestionBadgeText: {
    fontSize: 13,
    color: '#0a84ff',
    flex: 1,
  },
  suggestionBadgeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  suggestionAcceptBtn: {
    backgroundColor: '#0a84ff',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  suggestionAcceptBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  suggestionIgnoreBtn: {
    backgroundColor: '#ECEEF1',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  suggestionIgnoreBtnText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  pickerValueText: {
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '500',
    flex: 1,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
  },
  sheetItemActive: {
    backgroundColor: '#F2F2F7',
  },
  sheetItemText: {
    fontSize: 17,
    color: '#000000',
  },
  sheetItemTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
});
