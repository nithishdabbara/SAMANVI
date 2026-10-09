import React from 'react';
import { Modal, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './ui';
import { useTheme } from '../theme';

export function Dialog({ visible, title, message, onOk, okText = 'OK' }: {
  visible: boolean; title: string; message: string; onOk: () => void; okText?: string;
}) {
  const t = useTheme();
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onOk}>
      <View style={{ flex: 1, backgroundColor: '#0008', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        <View style={{ backgroundColor: t.card, borderRadius: 26, padding: 22, width: '100%', alignItems: 'center' }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: t.green + '24', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Ionicons name="checkmark" size={36} color={t.green} />
          </View>
          <Text style={{ fontSize: 20, fontWeight: '800', color: t.text }}>{title}</Text>
          <Text style={{ fontSize: 14, color: t.mute, textAlign: 'center', lineHeight: 20, marginVertical: 10 }}>{message}</Text>
          <Button title={okText} onPress={onOk} style={{ alignSelf: 'stretch' }} />
        </View>
      </View>
    </Modal>
  );
}
