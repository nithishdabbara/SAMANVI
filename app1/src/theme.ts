export const theme = {
  color: {
    surface: '#FFFFFF',
    onSurface: '#1C1C1E',
    surfaceSecondary: '#F2F2F7',
    onSurfaceSecondary: '#3A3A3C',
    surfaceTertiary: '#E5E5EA',
    onSurfaceTertiary: '#8E8E93',
    surfaceInverse: '#1C1C1E',
    onSurfaceInverse: '#F2F2F7',
    brand: '#3E7760',
    brandPrimary: '#3E7760',
    onBrandPrimary: '#FFFFFF',
    brandSecondary: '#8BACA0',
    brandTertiary: '#E3ECE8',
    onBrandTertiary: '#264D3E',
    success: '#34C759',
    warning: '#FF9F0A',
    error: '#FF3B30',
    info: '#8E8E93',
    border: '#E5E5EA',
    borderStrong: '#C7C7CC',
    divider: '#E5E5EA',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, '2xl': 32, '3xl': 48 },
  radius: { sm: 6, md: 12, lg: 20, pill: 999 },
  font: {
    sm: 12, base: 14, lg: 16, xl: 20, '2xl': 24, '3xl': 30,
  },
};

export const CATEGORIES = [
  { key: 'plumbing', label: 'Plumbing', icon: 'water-outline' },
  { key: 'electrical', label: 'Electrical', icon: 'flash-outline' },
  { key: 'medical', label: 'Medical', icon: 'medkit-outline' },
  { key: 'groceries', label: 'Groceries', icon: 'basket-outline' },
  { key: 'tutoring', label: 'Tutoring', icon: 'school-outline' },
  { key: 'transport', label: 'Transport', icon: 'car-outline' },
  { key: 'pet_care', label: 'Pet Care', icon: 'paw-outline' },
  { key: 'cleaning', label: 'Cleaning', icon: 'sparkles-outline' },
  { key: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' },
];

export function categoryMeta(key: string) {
  return CATEGORIES.find((c) => c.key === key) || CATEGORIES[CATEGORIES.length - 1];
}

export function trustBadgeColor(score: number) {
  if (score >= 70) return theme.color.success;
  if (score >= 40) return theme.color.warning;
  return theme.color.error;
}
