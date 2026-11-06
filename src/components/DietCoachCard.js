import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Button, Card, ChipGroup, Input, SectionLabel } from './ui';
import CoachModal from './CoachModal';
import { useToast } from './Toast';
import { font, radius, spacing } from '../theme/colors';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import {
  createUserPreference,
  getUser,
  listFoodEntries,
  listUserPreferences,
  updateUserPreference,
} from '../services/api';
import {
  DIET_PREFERENCE_PREFIX,
  DIET_PRESETS,
  findDietPreference,
  isDietPreference,
  presetForDietText,
} from '../utils/dietPreference.mjs';
import { itemTotals, MEAL_LABEL } from '../utils/nutricion';
import { friendlyError } from '../utils/networkErrors.mjs';

export default function DietCoachCard({ mealType }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const navigation = useNavigation();
  const { showToast: toast } = useToast();
  const [preset, setPreset] = useState(null);
  const [dietText, setDietText] = useState('');
  const [customText, setCustomText] = useState('');
  const [profile, setProfile] = useState(null);
  const [todayEntries, setTodayEntries] = useState([]);
  const [preferences, setPreferences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingPref, setSavingPref] = useState(false);
  const [showCoach, setShowCoach] = useState(false);
  const savingRef = useRef(false);
  const dietIdRef = useRef(null);
  const pendingRef = useRef(null);

  const cargar = useCallback(() => {
    if (savingRef.current) return;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    Promise.all([
      listUserPreferences(),
      getUser().catch(() => null),
      listFoodEntries({ desde: start.toISOString() }).catch(() => []),
    ])
      .then(([prefs, user, entries]) => {
        const current = findDietPreference(prefs);
        if (current) {
          dietIdRef.current = current.id;
          setDietText(current.text);
          setPreset(presetForDietText(current.text));
          setCustomText(presetForDietText(current.text) === 'custom' ? current.text : '');
        } else {
          dietIdRef.current = null;
          setDietText('');
          setPreset(null);
          setCustomText('');
        }
        setProfile(user);
        setPreferences(prefs);
        setTodayEntries(Array.isArray(entries) ? entries : []);
      })
      .catch((e) => toast(friendlyError(e, 'Could not load your diet preference.'), 'error'))
      .finally(() => setLoading(false));
  }, [toast]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  const guardarPreferencia = async (raw) => {
    const text = String(raw || '').trim();
    if (!text) {
      toast('Choose or write a diet preference first.', 'info');
      return;
    }
    // Keep the newest choice instead of dropping it when a save is in flight.
    if (savingRef.current) {
      pendingRef.current = text;
      return;
    }
    savingRef.current = true;
    setSavingPref(true);
    let lastSaved = dietText;
    try {
      let next = text;
      while (next) {
        const stored = DIET_PREFERENCE_PREFIX + next;
        if (dietIdRef.current) {
          await updateUserPreference(dietIdRef.current, stored);
        } else {
          const row = await createUserPreference(stored);
          dietIdRef.current = row?.id ?? null;
        }
        lastSaved = next;
        setDietText(next);
        next = pendingRef.current;
        pendingRef.current = null;
      }
      toast('Diet preference saved.', 'success');
    } catch (e) {
      pendingRef.current = null;
      toast(friendlyError(e, 'Could not save the diet preference.'), 'error');
      setPreset(presetForDietText(lastSaved) ?? null);
    } finally {
      savingRef.current = false;
      setSavingPref(false);
    }
  };

  const elegirPreset = (value) => {
    setPreset(value);
    if (value === 'custom') {
      setCustomText(preset === 'custom' ? customText : '');
      return;
    }
    const option = DIET_PRESETS.find((item) => item.value === value);
    if (option?.text) guardarPreferencia(option.text);
  };

  const totals = itemTotals((todayEntries || []).flatMap((entry) => entry.items || []));
  const calorieGoal = Number(profile?.objetivo_kcal) || 2000;
  const remaining = Math.max(0, Math.round(calorieGoal - totals.kcal));
  const savedPreferences = (preferences || [])
    .filter((preference) => !isDietPreference(preference?.texto))
    .map((preference) => preference.texto)
    .join('; ');
  const mealLabel = MEAL_LABEL[mealType] || 'meal';

  const coachContext = {
    screen: 'Food log',
    dietPreference: dietText || 'not set',
    mealBeingLogged: mealLabel,
    calorieGoalKcal: calorieGoal,
    caloriesConsumedToday: Math.round(totals.kcal),
    caloriesRemainingKcal: remaining,
    proteinGramsToday: Math.round(totals.protein),
    carbsGramsToday: Math.round(totals.carbs),
    fatGramsToday: Math.round(totals.fat),
    goalType: profile?.goal_type ?? 'maintain',
    weightGoalKg: profile?.meta_peso_kg ?? 'not set',
    mealsLoggedToday: (todayEntries || []).length,
    savedPreferences,
    request: `Suggest food and a simple meal plan for the rest of today (especially ${mealLabel}) that fits my diet preference${dietText ? `: ${dietText}` : ''}. Use Indian meal ideas when the preference is Indian, stay close to my remaining calorie goal, and give estimated kcal and protein per item. Do not suggest food that conflicts with my diet preference. If no preference is set, offer Indian veg, Indian non-veg and Indian egg + veg options and ask which one I follow.`,
  };

  const suggestions = [
    dietText
      ? `Give me a ${dietText} meal plan for the rest of today within my calories.`
      : 'Give me Indian veg, non-veg and egg + veg meal options for today.',
    'What should I eat next to hit my protein goal?',
    `Suggest a ${dietText || 'healthy'} snack under 250 kcal.`,
  ];

  const welcome = dietText
    ? `Hi! I'm your diet coach. I'll use your ${dietText} preference, today's totals and your goals to suggest meals and snacks. Ask for a single meal, a snack, or a full day of ideas.`
    : "Hi! I'm your diet coach. Pick a diet preference above or ask me for meal ideas. I can see today's calories and your goal, so tell me what you like and I'll suggest something that fits.";

  return (
    <>
      <Card style={styles.card}>
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Ionicons name="nutrition-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.headerInfo}>
            <SectionLabel>AI diet coach</SectionLabel>
            <Text style={styles.subtitle}>
              Get meal ideas that match your diet preference and today's goal.
            </Text>
          </View>
        </View>

        <Text style={styles.label}>Diet preference</Text>
        <ChipGroup
          options={DIET_PRESETS.map((item) => ({ value: item.value, label: item.label }))}
          value={preset}
          onChange={elegirPreset}
        />

        {preset === 'custom' ? (
          <>
            <Input
              multiline
              value={customText}
              onChangeText={setCustomText}
              placeholder="e.g. Jain, vegan, gluten-free, South Indian, high protein"
              style={styles.customInput}
            />
            <Button
              variant="secondary"
              icon="save-outline"
              onPress={() => guardarPreferencia(customText)}
              disabled={savingPref}
              loading={savingPref}
              style={styles.saveBtn}
            >
              Save preference
            </Button>
          </>
        ) : null}

        {loading ? (
          <ActivityIndicator style={styles.loading} color={colors.primary} />
        ) : (
          <Text style={styles.savedHint}>
            {dietText ? `Using: ${dietText}` : 'No diet preference saved yet.'}
          </Text>
        )}

        <Button
          variant="primary"
          icon="sparkles-outline"
          onPress={() => setShowCoach(true)}
          style={styles.askBtn}
        >
          Ask AI Diet Coach
        </Button>
        <Text style={styles.privacy}>
          Your diet preference, goals and today's meal totals are sent to Google
          Gemini using your key after consent.
        </Text>
      </Card>

      <CoachModal
        visible={showCoach}
        onClose={() => setShowCoach(false)}
        title="AI Diet Coach"
        suggestions={suggestions}
        welcome={welcome}
        context={coachContext}
        onOpenProfile={() => navigation.navigate('Profile')}
      />
    </>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  card: { marginBottom: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: { flex: 1 },
  subtitle: { fontSize: font.sm, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
  label: { fontSize: font.sm, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  customInput: { marginTop: spacing.sm },
  saveBtn: { marginTop: spacing.sm },
  loading: { marginTop: spacing.sm, alignSelf: 'flex-start' },
  savedHint: { fontSize: font.xs, color: colors.textMuted, marginTop: spacing.sm },
  askBtn: { marginTop: spacing.md },
  privacy: { fontSize: font.xs, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 16 },
});
