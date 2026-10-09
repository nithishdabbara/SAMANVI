import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

type ProblemCardProps = {
  title: string;
  category: string;
  time: string;
  status: string;
  distance?: string;
  showViewDetails?: boolean;
  imageUrl?: string;
  id?: string;
  postType?: string;
  budgetRange?: string;
};

export default function ProblemCard({ 
  title, category, time, status, distance, showViewDetails = false, imageUrl, id, postType, budgetRange 
}: ProblemCardProps) {
  const router = useRouter();
  
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'resolved': return '#10B981';
      case 'in progress': return '#FF9800';
      default: return '#EF4444'; // pending
    }
  };

  const getPostTypeLabel = (type: string) => {
    switch (type) {
      case 'free_help': return '🙋 Free Help';
      case 'referral': return '📞 Referral';
      case 'paid_help': return '💰 Paid Work';
      default: return '🙋 Free Help';
    }
  };

  const getPostTypeColor = (type: string) => {
    switch (type) {
      case 'free_help': return '#10B981';
      case 'referral': return '#8B5CF6';
      case 'paid_help': return '#0a84ff';
      default: return '#10B981';
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        {imageUrl && (
          <View style={styles.imageContainer}>
            <Image 
              source={{ uri: imageUrl }} 
              style={styles.thumbnail}
              resizeMode="cover"
            />
          </View>
        )}
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status) + '15' }]}>
              <Text style={[styles.statusText, { color: getStatusColor(status) }]}>{status.toUpperCase()}</Text>
            </View>
            {postType && (
              <View style={[styles.statusBadge, { backgroundColor: getPostTypeColor(postType) + '15' }]}>
                <Text style={[styles.statusText, { color: getPostTypeColor(postType) }]}>
                  {getPostTypeLabel(postType)}
                </Text>
              </View>
            )}
            {postType === 'paid_help' && budgetRange && (
              <View style={[styles.statusBadge, { backgroundColor: '#F59E0B15' }]}>
                <Text style={[styles.statusText, { color: '#D97706' }]}>
                  {budgetRange}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
      
      <View style={styles.details}>
        <View style={styles.detailRow}>
          <Ionicons name="pricetag-outline" size={14} color="#666" />
          <Text style={styles.detailText}>{category}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={14} color="#666" />
          <Text style={styles.detailText}>{time}</Text>
        </View>
        {distance && (
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={14} color="#666" />
            <Text style={styles.detailText}>{distance}</Text>
          </View>
        )}
      </View>

      {showViewDetails && (
        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.detailsButton}
            onPress={() => {
              if (id) {
                router.push(`/problem/${id}` as any);
              }
            }}
          >
            <Text style={styles.detailsButtonText}>View Details</Text>
            <Ionicons name="chevron-forward" size={16} color="#0a84ff" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 12,
  },
  imageContainer: {
    width: 60,
    height: 60,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#eef0f5',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  textContainer: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 22,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  details: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    rowGap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  footer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  detailsButtonText: {
    color: '#0a84ff',
    fontSize: 14,
    fontWeight: '700',
  },
});
