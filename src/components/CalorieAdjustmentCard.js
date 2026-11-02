import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button, Card, SectionLabel } from './ui';
import { useToast } from './Toast';
import { generateDailyCalorieSuggestion } from '../services/api';
import { addDays, dayKey } from '../utils/dates';
import { colors, font, spacing } from '../theme/colors';

export default function CalorieAdjustmentCard({ onApply }) {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [applied, setApplied] = useState(false);
  const { showToast } = useToast();
  const sourceDay = dayKey(addDays(new Date(), -1));

  const generate = async () => {
    setLoading(true);
    try {
      setSuggestion(await generateDailyCalorieSuggestion(sourceDay));
      setApplied(false);
    } catch (error) {
      showToast(error.message || 'Could not prepare a calorie suggestion.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const apply = async () => {
    if (!suggestion?.suggested || !suggestion?.requiresConfirmation) return;
    try {
      await onApply(suggestion.suggestedKcal);
      setApplied(true);
      showToast('The suggested calorie goal was saved to your profile.', 'success');
    } catch (error) {
      showToast(error.message || 'Could not save the suggested calorie goal.', 'error');
    }
  };

  return (
    <Card style={styles.card}>
      <SectionLabel>Step-based calorie review</SectionLabel>
      <Text style={styles.copy}>Ask Gemini to review yesterday's steps against your goal and suggest a small change for the next day. OpenFit will not change your goal until you apply it.</Text>
      {loading ? <ActivityIndicator color={colors.primary} style={styles.spinner} /> : null}
      {suggestion ? (
        <View style={styles.result}>
          {suggestion.suggested ? (
            <>
              <Text style={styles.value}>{suggestion.suggestedKcal.toLocaleString()} kcal</Text>
              <Text style={styles.copy}>{suggestion.reason}</Text>
              <Text style={styles.meta}>Yesterday: {Number(suggestion.steps || 0).toLocaleString()} / {Number(suggestion.stepGoal || 0).toLocaleString()} steps · maximum change {suggestion.maxReduction} kcal</Text>
              <Button variant="primary" icon="checkmark-circle-outline" onPress={apply} disabled={applied || loading}>
                {applied ? 'Applied' : 'Apply this goal'}
              </Button>
            </>
          ) : <Text style={styles.copy}>{suggestion.reason}</Text>}
        </View>
      ) : null}
      <Button variant="secondary" icon="sparkles-outline" onPress={generate} loading={loading} disabled={loading}>
        Review yesterday's steps
      </Button>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  copy: { color: colors.textMuted, fontSize: font.sm, lineHeight: 19, marginBottom: spacing.sm },
  spinner: { marginVertical: spacing.sm },
  result: { backgroundColor: colors.surfaceMuted, borderRadius: 14, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.xs },
  value: { color: colors.text, fontSize: font.xl, fontWeight: '800' },
  meta: { color: colors.textMuted, fontSize: font.xs, lineHeight: 17 },
});
