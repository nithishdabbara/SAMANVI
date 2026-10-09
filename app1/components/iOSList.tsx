import React from 'react';
import { StyleSheet, Text, View, Switch, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { Typography } from '../constants/Typography';
import { Layout } from '../constants/Layout';
import { SpringButton } from './ScreenTransition';

interface IOSListSectionProps {
  title?: string;
  footer?: string;
  children: React.ReactNode;
}

export function IOSListSection({ title, footer, children }: IOSListSectionProps) {
  return (
    <View style={styles.sectionContainer}>
      {title && <Text style={styles.sectionHeader}>{title.toUpperCase()}</Text>}
      <View style={styles.sectionBody}>
        {React.Children.map(children, (child, index) => {
          if (!React.isValidElement(child)) return null;
          const isLast = index === React.Children.count(children) - 1;
          return React.cloneElement(child as React.ReactElement<any>, {
            showDivider: child.props.showDivider !== undefined ? child.props.showDivider : !isLast
          });
        })}
      </View>
      {footer && <Text style={styles.sectionFooter}>{footer}</Text>}
    </View>
  );
}

interface IOSListRowProps {
  icon?: string;
  iconColor?: string;
  iconBackgroundColor?: string;
  title: string;
  subtitle?: string;
  rightElement?: React.ReactNode;
  onPress?: () => void;
  showDivider?: boolean;
}

export function IOSListRow({
  icon,
  iconColor = '#FFFFFF',
  iconBackgroundColor = Colors.primary,
  title,
  subtitle,
  rightElement,
  onPress,
  showDivider = true
}: IOSListRowProps) {
  const content = (
    <View style={styles.rowWrapper}>
      <View style={styles.leftContainer}>
        {icon && (
          <View style={[styles.iconContainer, { backgroundColor: iconBackgroundColor }]}>
            <Ionicons name={icon as any} size={18} color={iconColor} />
          </View>
        )}
        <View style={styles.textContainer}>
          <Text style={styles.rowTitle}>{title}</Text>
          {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      <View style={styles.rightContainer}>
        {rightElement}
        {onPress && !rightElement && (
          <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.rowContainer}>
      {onPress ? (
        <SpringButton onPress={onPress} style={styles.rowPressable}>
          {content}
        </SpringButton>
      ) : (
        <View style={styles.rowNonPressable}>
          {content}
        </View>
      )}
      {showDivider && <View style={styles.divider} />}
    </View>
  );
}

interface IOSToggleProps {
  value: boolean;
  onValueChange: (val: boolean) => void;
  disabled?: boolean;
}

export function IOSToggle({ value, onValueChange, disabled = false }: IOSToggleProps) {
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: Colors.border, true: '#34C759' }}
      thumbColor={Platform.OS === 'ios' ? undefined : '#FFFFFF'}
      ios_backgroundColor={Colors.border}
    />
  );
}

const styles = StyleSheet.create({
  sectionContainer: {
    marginHorizontal: 16,
    marginVertical: 10,
  },
  sectionHeader: {
    ...Typography.footnote,
    color: Colors.textSecondary,
    marginLeft: 8,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  sectionBody: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    ...Layout.shadow.small,
  },
  sectionFooter: {
    ...Typography.footnote,
    color: Colors.textSecondary,
    marginLeft: 8,
    marginTop: 6,
  },
  rowContainer: {
    backgroundColor: '#FFFFFF',
  },
  rowPressable: {
    backgroundColor: '#FFFFFF',
  },
  rowNonPressable: {
    backgroundColor: '#FFFFFF',
  },
  rowWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flexDirection: 'column',
    flex: 1,
  },
  rowTitle: {
    ...Typography.body,
    color: Colors.textPrimary,
  },
  rowSubtitle: {
    ...Typography.footnote,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginLeft: 56,
  },
});
