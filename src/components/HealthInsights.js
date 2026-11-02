import { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import Svg, { Circle } from 'react-native-svg';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { Card } from './ui';
import { colors, font, radius, spacing } from '../theme/colors';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function ProgressRing({ label, value, target, unit, color, size = 94 }) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = Math.min(1, Math.max(0, (Number(value) || 0) / Math.max(1, Number(target) || 1)));
  const offset = useSharedValue(circumference);
  useEffect(() => { offset.value = withTiming(circumference * (1 - progress), { duration: 700 }); }, [progress, circumference, offset]);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));
  return (
    <View style={[styles.ringWrap, { width: size }]}>
      <Svg width={size} height={size} style={styles.ringSvg}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.border} strokeWidth={stroke} fill="none" />
        <AnimatedCircle animatedProps={animatedProps} cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${circumference} ${circumference}`} fill="none" />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={styles.ringValue}>{Math.round(Number(value) || 0).toLocaleString()}</Text>
        <Text style={styles.ringUnit}>{unit}</Text>
      </View>
      <Text style={styles.ringLabel}>{label}</Text>
    </View>
  );
}

export default function HealthInsights({ days = [], stepsGoal = 8000, caloriesGoal = 300, water = 0, waterGoal = 8, streak = 0, achievements = [] }) {
  const rows = days.slice(-7);
  const chartData = (key) => rows.map((row) => ({ value: Number(row[key]) || 0, label: new Date(`${row.day}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1) }));
  const today = rows[rows.length - 1] || {};
  const step = Number(today.steps) || 0;
  const calories = Number(today.activeCalories) || 0;
  const available = Platform.OS === 'android' && rows.length > 0;
  return (
    <>
      <Card style={styles.card}>
        <View style={styles.headingRow}>
          <View><Text style={styles.title}>Your daily rings</Text><Text style={styles.sub}>Today’s progress</Text></View>
          <Text style={styles.streak}>🔥 {streak} day streak</Text>
        </View>
        <View style={styles.rings}>
          <ProgressRing label="Steps" value={step} target={stepsGoal} unit="steps" color="#22C55E" />
          <ProgressRing label="Active kcal" value={calories} target={caloriesGoal} unit="kcal" color="#F97316" />
          <ProgressRing label="Water" value={water} target={waterGoal} unit="glasses" color="#8B5CF6" />
        </View>
        <View style={styles.badges}>
          {(achievements || []).map((badge) => <Text key={badge.achievement_key} style={styles.badge}>🏅 {badge.achievement_key.replaceAll('_', ' ')}</Text>)}
          {!achievements?.length ? <Text style={styles.sub}>Hit your step goal to unlock your first badge.</Text> : null}
        </View>
      </Card>
      <Card style={styles.card}>
        <Text style={styles.title}>Health Connect · 7 days</Text>
        <Text style={styles.sub}>{available ? 'Daily steps, active calories and sleep' : 'Connect Health Connect on Android to see steps, active calories and sleep.'}</Text>
        {available ? ['steps', 'activeCalories', 'sleepMinutes'].map((key) => (
          <View key={key} style={styles.chartBlock}>
            <Text style={styles.chartTitle}>{key === 'steps' ? 'Steps' : key === 'activeCalories' ? 'Active calories' : 'Sleep minutes'}</Text>
            <BarChart data={chartData(key)} width={280} height={92} barWidth={20} spacing={14} roundedTop noOfSections={3} hideRules xAxisLabelTextStyle={styles.axis} yAxisTextStyle={styles.axis} yAxisThickness={0} xAxisThickness={0} frontColor={key === 'steps' ? '#22C55E' : key === 'activeCalories' ? '#F97316' : '#8B5CF6'} />
          </View>
        )) : null}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md, borderRadius: radius.lg },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontSize: font.md, fontWeight: '800' },
  sub: { color: colors.textMuted, fontSize: font.sm, marginTop: 3 },
  streak: { color: '#FBBF5A', backgroundColor: '#3A2D18', overflow: 'hidden', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6, fontSize: font.xs, fontWeight: '700' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  badge: { color: '#FDBA74', backgroundColor: '#3A2920', overflow: 'hidden', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6, fontSize: font.xs, fontWeight: '700' },
  rings: { flexDirection: 'row', justifyContent: 'space-around', marginTop: spacing.md, gap: spacing.xs },
  ringWrap: { alignItems: 'center' },
  ringSvg: { transform: [{ rotate: '-90deg' }] },
  ringCenter: { position: 'absolute', top: 24, alignItems: 'center' },
  ringValue: { color: colors.text, fontWeight: '800', fontSize: font.md },
  ringUnit: { color: colors.textMuted, fontSize: 9 },
  ringLabel: { color: colors.textMuted, fontSize: font.xs, fontWeight: '700', marginTop: 5 },
  chartBlock: { marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderColor: colors.border },
  chartTitle: { fontSize: font.sm, color: colors.text, fontWeight: '700' },
  axis: { color: colors.textMuted, fontSize: 10 },
});
