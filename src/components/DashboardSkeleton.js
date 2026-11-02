import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { colors, radius, spacing } from '../theme/colors';

function Placeholder({ width = '100%', height = 18, style }) {
  const phase = useSharedValue(0.45);
  useEffect(() => { phase.value = withRepeat(withTiming(0.9, { duration: 850 }), -1, true); }, [phase]);
  const animated = useAnimatedStyle(() => ({ opacity: phase.value }));
  return <Animated.View style={[styles.placeholder, { width, height }, style, animated]} />;
}

export default function DashboardSkeleton() {
  return (
    <View style={styles.page}>
      <Placeholder width="42%" height={26} style={{ marginBottom: spacing.lg }} />
      <Placeholder height={150} style={styles.block} />
      <Placeholder height={118} style={styles.block} />
      <View style={styles.row}><Placeholder height={120} style={styles.half} /><Placeholder height={120} style={styles.half} /></View>
      <Placeholder height={170} style={styles.block} />
    </View>
  );
}

const styles = StyleSheet.create({ page: { flex: 1, padding: spacing.md, paddingTop: spacing.xl, backgroundColor: colors.background },
  placeholder: { borderRadius: radius.md, backgroundColor: '#DCE2E8' }, block: { marginBottom: spacing.md }, row: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md }, half: { flex: 1 } });
