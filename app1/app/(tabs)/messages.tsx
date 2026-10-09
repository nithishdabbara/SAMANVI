import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  ScrollView, 
  SafeAreaView,
  Image,
  TextInput,
  RefreshControl
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../../constants/Config';
import { MessageRowSkeleton } from '@/components/SkeletonLoader';
import { EmptyState, ErrorState } from '@/components/FeedbackState';

export default function MessagesInboxScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = async () => {
    setError(null);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) {
        setError("Please log in to view your messages.");
        setLoading(false);
        setRefreshing(false);
        return;
      }
      
      const response = await fetch(`${API_BASE_URL}/messages`, {
          headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
          const data = await response.json();
          setChats(data.messages || []);
      } else {
          setError("Failed to fetch inbox messages.");
      }
    } catch (err) {
      console.error("Failed to fetch messages", err);
      setError("Network connection issue. Please check your network and try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  React.useEffect(() => {
    fetchMessages();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMessages();
  };

  const filteredChats = chats.filter(chat => {
    const userStr = typeof chat.user === 'string' ? chat.user.toLowerCase() : '';
    const msgStr = typeof chat.lastMessage === 'string' ? chat.lastMessage.toLowerCase() : '';
    const q = searchQuery.toLowerCase();
    return userStr.includes(q) || msgStr.includes(q);
  });

  const handleChatPress = (chatId: string) => {
    // Mark as read in local state
    setChats(prev => prev.map(chat => 
      chat.id === chatId ? { ...chat, unreadCount: 0 } : chat
    ));
    router.push(`/chat/${chatId}` as any);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      
      {/* Header */}
      <View style={styles.topHeader}>
        <View style={styles.headerTitleGroup}>
          <TouchableOpacity style={styles.menuBtn}>
            <MaterialIcons name="menu" size={24} color="#64748b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Messages</Text>
        </View>
        <TouchableOpacity style={styles.menuBtn}>
          <MaterialIcons name="add-comment" size={24} color="#0a84ff" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#0a84ff']}
          />
        }
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.pageTitle}>Inbox</Text>
          <Text style={styles.pageSubtitle}>Chat with your neighbors and helpers</Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <MaterialIcons name="search" size={20} color="#64748b" style={styles.searchIcon} />
          <TextInput 
            style={styles.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Chats List */}
        <View style={styles.inboxList}>
          {error ? (
            <ErrorState onRetry={fetchMessages} message={error} />
          ) : loading ? (
            <View>
              <MessageRowSkeleton />
              <MessageRowSkeleton />
              <MessageRowSkeleton />
            </View>
          ) : filteredChats.length > 0 ? (
            filteredChats.map((chat) => (
              <TouchableOpacity 
                key={chat.id} 
                style={styles.chatRow}
                activeOpacity={0.7}
                onPress={() => handleChatPress(chat.id)}
              >
                <View style={styles.avatarContainer}>
                  <Image source={{ uri: chat.avatar }} style={styles.avatarImg} />
                  {chat.isBot && (
                    <View style={styles.botBadge}>
                      <MaterialIcons name="smart-toy" size={10} color="#FFF" />
                    </View>
                  )}
                  {chat.isOnline && !chat.isBot && <View style={styles.onlineDot} />}
                </View>

                <View style={styles.chatDetails}>
                  <View style={styles.topRow}>
                    <Text style={[styles.userName, chat.unreadCount > 0 && styles.userNameUnread]}>
                      {chat.user}
                    </Text>
                    <Text style={[styles.timeText, chat.unreadCount > 0 && styles.timeTextUnread]}>
                      {chat.time}
                    </Text>
                  </View>
                  <View style={styles.bottomRow}>
                    <Text 
                      style={[styles.lastMessage, chat.unreadCount > 0 && styles.lastMessageUnread]} 
                      numberOfLines={1}
                    >
                      {chat.lastMessage}
                    </Text>
                    {chat.unreadCount > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadBadgeText}>{chat.unreadCount}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <EmptyState
              icon="chatbubbles-outline"
              title="No conversations yet"
              subtitle="Find neighbors in need to start a chat and offer help!"
            />
          )}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#eef0f5', 
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 64,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(58, 123, 255, 0.05)',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0a84ff',
    letterSpacing: -0.5,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 24,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  sectionHeader: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#424654',
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF', 
    borderRadius: 16,
    marginHorizontal: 20,
    paddingHorizontal: 16,
    height: 52,
    marginBottom: 20,
    shadowColor: '#191C1E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: '#0f172a',
  },
  inboxList: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 24,
    paddingVertical: 8,
    shadowColor: '#191C1E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 4,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(236, 238, 241, 0.5)',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatarImg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ECEEF1',
  },
  botBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#0a84ff',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981', // green
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  chatDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  userNameUnread: {
    fontWeight: '800',
  },
  timeText: {
    fontSize: 12,
    color: '#64748b',
  },
  timeTextUnread: {
    color: '#0a84ff',
    fontWeight: '700',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: '#64748b',
    marginRight: 16,
  },
  lastMessageUnread: {
    color: '#0f172a',
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: '#0a84ff',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateTitle: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748b',
    fontWeight: '600',
  }
});

