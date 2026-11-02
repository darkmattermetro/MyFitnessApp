import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Card, ChipGroup, Container, EmptyState, SectionLabel, useResponsive } from '../components/ui';
import ExercisePicker from '../components/ExercisePicker';
import ConfirmDialog from '../components/ConfirmDialog';
import CoachModal from '../components/CoachModal';
import { useToast } from '../components/Toast';
import { colors, font, radius, spacing } from '../theme/colors';
import { TEMPLATES, MUSCLE_LABEL, findExercise, planForDate } from '../data/exercises';
import {
  createWorkoutSession,
  deleteWorkoutSession,
  listWorkoutSessions,
} from '../services/api';
import {
  elapsedSeconds,
  formatDuration,
  formatStopwatch,
  lastPerformance,
  personalRecords,
  sessionSetCount,
  sessionVolume,
  summarizeExercises,
  toNumber,
  trainingStreak,
  uid,
  weekStats,
} from '../utils/workout';

const REST_DEFAULT = 90;
const IS_WEB = Platform.OS === 'web';

function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateLong(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatVolume(value) {
  return `${Math.round(toNumber(value)).toLocaleString('en-US')} kg`;
}

function newSet(weight = '', reps = '') {
  return { id: uid('set'), weight: String(weight), reps: String(reps), done: false };
}

function buildExercise(name, last) {
  const info = findExercise(name);
  const weight = last ? String(last.weight) : '';
  const reps = last ? String(last.reps) : '';
  return {
    id: uid('ex'),
    name,
    muscle: info?.muscle ?? 'other',
    sets: [newSet(weight, reps), newSet(weight, reps)],
  };
}

// Pre-fills the number of sets the weekday plan asks for, and reuses the
// previous weight/reps for that lift so the session is quicker to log.
function buildPlanExercise(item, last) {
  const info = findExercise(item.name);
  const count = Math.max(1, Math.min(6, Number(item.sets) || 3));
  const weight = last ? String(last.weight) : '';
  const reps = last ? String(last.reps) : '';
  return {
    id: uid('ex'),
    name: item.name,
    muscle: info?.muscle ?? 'other',
    sets: Array.from({ length: count }, () => newSet(weight, reps)),
  };
}

export default function WorkoutScreen() {
  const { isDesktop } = useResponsive();
  const { showToast } = useToast();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [active, setActive] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [rest, setRest] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [planEnv, setPlanEnv] = useState('gym');
  const [showCoach, setShowCoach] = useState(false);
  const saveControllerRef = useRef(null);
  const saveLockRef = useRef(false);

  useEffect(() => () => saveControllerRef.current?.abort(), []);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const rows = await listWorkoutSessions();
      setSessions(rows);
    } catch (e) {
      setError(e.message || 'Could not load your workouts.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  // Stopwatch tick while a session is open.
  useEffect(() => {
    if (!active) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active ? active.id : null]);

  // Rest countdown.
  const resting = Boolean(rest && rest.left > 0);
  useEffect(() => {
    if (!resting) return undefined;
    const timer = setInterval(() => {
      setRest((current) => {
        if (!current) return null;
        if (current.left <= 1) {
          if (!IS_WEB) Vibration.vibrate([0, 160, 90, 160]);
          return null;
        }
        return { ...current, left: current.left - 1 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [resting]);

  const lastPerf = useMemo(() => lastPerformance(sessions), [sessions]);
  const records = useMemo(() => personalRecords(sessions), [sessions]);
  const weekly = useMemo(() => weekStats(sessions), [sessions]);
  const plan = useMemo(() => planForDate(new Date()), []);
  const streak = useMemo(() => trainingStreak(sessions), [sessions]);

  const onRefresh = () => {
    setRefreshing(true);
    cargar();
  };

  const startRest = (seconds = REST_DEFAULT) => {
    setRest({ left: seconds, total: seconds });
  };

  const startWorkout = (template = null) => {
    const exercises = template
      ? template.exercises.map((name) => buildExercise(name, lastPerf.get(name)))
      : [];
    setActive({
      id: uid('session'),
      name: template ? template.name : '',
      startedAt: new Date().toISOString(),
      exercises,
      notes: '',
    });
    setRest(null);
    setNow(Date.now());
  };

  const startPlanWorkout = () => {
    const items = planEnv === 'home' ? plan.home : plan.gym;
    const exercises = items.map((item) =>
      buildPlanExercise(item, lastPerf.get(item.name)),
    );
    setActive({
      id: uid('session'),
      name: plan.title,
      startedAt: new Date().toISOString(),
      exercises,
      notes: plan.note,
    });
    setRest(null);
    setNow(Date.now());
  };

  const addExercise = (exercise) => {
    setActive((current) =>
      current
        ? {
            ...current,
            exercises: [
              ...current.exercises,
              buildExercise(exercise.name, lastPerf.get(exercise.name)),
            ],
          }
        : current,
    );
  };

  const removeExercise = (exerciseId) => {
    setActive((current) =>
      current
        ? {
            ...current,
            exercises: current.exercises.filter((ex) => ex.id !== exerciseId),
          }
        : current,
    );
  };

  const patchSet = (exerciseId, setId, patch) => {
    setActive((current) =>
      current
        ? {
            ...current,
            exercises: current.exercises.map((ex) =>
              ex.id !== exerciseId
                ? ex
                : {
                    ...ex,
                    sets: ex.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
                  },
            ),
          }
        : current,
    );
  };

  const toggleSet = (exerciseId, set) => {
    const willBeDone = !set.done;
    patchSet(exerciseId, set.id, { done: willBeDone });
    if (willBeDone) startRest(REST_DEFAULT);
  };

  const addSet = (exerciseId) => {
    setActive((current) =>
      current
        ? {
            ...current,
            exercises: current.exercises.map((ex) => {
              if (ex.id !== exerciseId) return ex;
              const previous = ex.sets[ex.sets.length - 1];
              return {
                ...ex,
                sets: [...ex.sets, newSet(previous?.weight ?? '', previous?.reps ?? '')],
              };
            }),
          }
        : current,
    );
  };

  const removeSet = (exerciseId, setId) => {
    setActive((current) =>
      current
        ? {
            ...current,
            exercises: current.exercises.map((ex) =>
              ex.id !== exerciseId
                ? ex
                : { ...ex, sets: ex.sets.filter((s) => s.id !== setId) },
            ),
          }
        : current,
    );
  };

  const requestFinish = () => {
    const done = sessionSetCount(active?.exercises);
    if (!done) {
      showToast('Log at least one set before finishing.', 'error');
      return;
    }
    setRest(null);
    setConfirm({ kind: 'finish' });
  };

  const saveWorkout = async () => {
    if (!active || saveLockRef.current) return;
    saveLockRef.current = true;
    const controller = new AbortController();
    saveControllerRef.current = controller;
    setSaving(true);
    try {
      const exercises = active.exercises
        .map((ex) => ({
          id: ex.id,
          name: ex.name,
          muscle: ex.muscle,
          sets: ex.sets
            .filter((s) => toNumber(s.reps) > 0)
            .map((s) => ({ weight: toNumber(s.weight), reps: toNumber(s.reps) })),
        }))
        .filter((ex) => ex.sets.length > 0);

      const minutes = Math.max(1, Math.round(elapsedSeconds(active.startedAt) / 60));
      await createWorkoutSession({
        name: active.name.trim() || 'Workout',
        startedAt: new Date(active.startedAt),
        endedAt: new Date(),
        durationMin: minutes,
        notes: active.notes.trim(),
        exercises,
        totalVolumeKg: sessionVolume(exercises),
        totalSets: sessionSetCount(exercises),
        clientRequestId: active.id,
      }, controller.signal);
      setActive(null);
      setRest(null);
      setConfirm(null);
      showToast('Workout saved. Nice work!', 'success');
      await cargar();
    } catch (e) {
      if (!controller.signal.aborted) showToast(e.message || 'Could not save the workout.', 'error');
    } finally {
      saveLockRef.current = false;
      setSaving(false);
    }
  };

  const discardWorkout = () => {
    setActive(null);
    setRest(null);
    setConfirm(null);
  };

  const removeSession = async (id) => {
    setSaving(true);
    try {
      await deleteWorkoutSession(id);
      setConfirm(null);
      if (expanded === id) setExpanded(null);
      showToast('Workout deleted.', 'success');
      await cargar();
    } catch (e) {
      showToast(e.message || 'Could not delete the workout.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = () => {
    if (!confirm) return;
    if (confirm.kind === 'finish') saveWorkout();
    else if (confirm.kind === 'discard') discardWorkout();
    else if (confirm.kind === 'delete') removeSession(confirm.id);
  };

  const confirmProps = (() => {
    if (!confirm) return {};
    if (confirm.kind === 'finish') {
      return {
        title: 'Finish workout?',
        message: 'Your session will be saved to your history.',
        confirmText: 'Finish',
        cancelText: 'Keep going',
        icon: 'checkmark-circle-outline',
        tone: 'primary',
      };
    }
    if (confirm.kind === 'discard') {
      return {
        title: 'Discard workout?',
        message: 'Everything you logged in this session will be lost.',
        confirmText: 'Discard',
        cancelText: 'Keep going',
        icon: 'trash-outline',
        tone: 'danger',
      };
    }
    return {
      title: 'Delete workout?',
      message: 'This session will be removed from your history.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      icon: 'trash-outline',
      tone: 'danger',
    };
  })();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // ---------- Active session ----------
  if (active) {
    const totalSets = sessionSetCount(active.exercises);
    const volume = sessionVolume(active.exercises);

    return (
      <View style={styles.flex}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Container>
            <View style={styles.sessionHeader}>
              <TouchableOpacity
                onPress={() => setConfirm({ kind: 'discard' })}
                hitSlop={10}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
              <View style={styles.sessionTitleWrap}>
                <TextInput
                  value={active.name}
                  onChangeText={(name) => setActive((a) => (a ? { ...a, name } : a))}
                  placeholder="Workout name"
                  placeholderTextColor={colors.textMuted}
                  style={styles.nameInput}
                  autoCorrect={false}
                />
                <Text style={styles.sessionMeta}>
                  {formatStopwatch(elapsedSeconds(active.startedAt, now))} · {totalSets}{' '}
                  {totalSets === 1 ? 'set' : 'sets'} · {formatVolume(volume)}
                </Text>
              </View>
              <Button
                icon="checkmark"
                onPress={requestFinish}
                style={styles.finishBtn}
                disabled={saving}
              >
                Finish
              </Button>
            </View>

            {active.exercises.length === 0 ? (
              <EmptyState
                icon="barbell-outline"
                title="Build your session"
                hint="Add exercises as you go, then log the weight and reps for each set."
              />
            ) : (
              active.exercises.map((exercise, index) => {
                const previous = lastPerf.get(exercise.name);
                return (
                  <Card key={exercise.id} style={styles.exerciseCard}>
                    <View style={styles.exerciseHeader}>
                      <View style={styles.exerciseIndex}>
                        <Text style={styles.exerciseIndexText}>{index + 1}</Text>
                      </View>
                      <View style={styles.exerciseInfo}>
                        <Text style={styles.exerciseName}>{exercise.name}</Text>
                        <Text style={styles.exerciseMeta}>
                          {MUSCLE_LABEL[exercise.muscle] ?? 'Other'}
                          {previous
                            ? ` · Last: ${previous.weight} kg × ${previous.reps}`
                            : ''}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => removeExercise(exercise.id)}
                        hitSlop={8}
                      >
                        <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.setHeaderRow}>
                      <Text style={[styles.setHeaderText, styles.setIndexCol]}>Set</Text>
                      <Text style={[styles.setHeaderText, styles.setCol]}>kg</Text>
                      <Text style={[styles.setHeaderText, styles.setCol]}>Reps</Text>
                      <View style={styles.setCheckCol} />
                      <View style={styles.setRemoveCol} />
                    </View>

                    {exercise.sets.map((set, setIndex) => (
                      <View key={set.id} style={styles.setRow}>
                        <Text style={[styles.setIndex, styles.setIndexCol]}>{setIndex + 1}</Text>
                        <TextInput
                          value={set.weight}
                          onChangeText={(value) => patchSet(exercise.id, set.id, { weight: value })}
                          keyboardType="decimal-pad"
                          placeholder="0"
                          placeholderTextColor={colors.textMuted}
                          style={[styles.setInput, styles.setCol]}
                        />
                        <TextInput
                          value={set.reps}
                          onChangeText={(value) => patchSet(exercise.id, set.id, { reps: value })}
                          keyboardType="number-pad"
                          placeholder="0"
                          placeholderTextColor={colors.textMuted}
                          style={[styles.setInput, styles.setCol]}
                        />
                        <TouchableOpacity
                          onPress={() => toggleSet(exercise.id, set)}
                          style={[styles.setCheckCol, styles.checkBtn, set.done && styles.checkBtnDone]}
                          hitSlop={6}
                        >
                          <Ionicons
                            name="checkmark"
                            size={18}
                            color={set.done ? colors.white : colors.textMuted}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => removeSet(exercise.id, set.id)}
                          style={[styles.setRemoveCol, styles.removeSetBtn]}
                          hitSlop={6}
                        >
                          <Ionicons name="remove" size={16} color={colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                    ))}

                    <TouchableOpacity
                      onPress={() => addSet(exercise.id)}
                      style={styles.addSetBtn}
                    >
                      <Ionicons name="add" size={16} color={colors.primary} />
                      <Text style={styles.addSetText}>Add set</Text>
                    </TouchableOpacity>
                  </Card>
                );
              })
            )}

            <Button
              variant="secondary"
              icon="add"
              onPress={() => setPickerOpen(true)}
              style={styles.addExerciseBtn}
            >
              Add exercise
            </Button>

            <SectionLabel style={styles.notesLabel}>Notes</SectionLabel>
            <TextInput
              value={active.notes}
              onChangeText={(notes) => setActive((a) => (a ? { ...a, notes } : a))}
              placeholder="How did it feel? Anything to remember for next time?"
              placeholderTextColor={colors.textMuted}
              style={styles.notesInput}
              multiline
            />
            <View style={{ height: spacing.xxl }} />
          </Container>
        </ScrollView>

        {resting ? (
          <View style={styles.restBar}>
            <View style={styles.restInfo}>
              <Text style={styles.restLabel}>Rest</Text>
              <Text style={styles.restTime}>
                {String(Math.floor(rest.left / 60)).padStart(2, '0')}:
                {String(rest.left % 60).padStart(2, '0')}
              </Text>
            </View>
            <View style={styles.restActions}>
              <TouchableOpacity
                onPress={() => setRest((r) => (r ? { ...r, left: r.left + 15, total: r.total + 15 } : r))}
                style={styles.restBtn}
              >
                <Text style={styles.restBtnText}>+15s</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setRest(null)} style={styles.restBtn}>
                <Text style={styles.restBtnText}>Skip</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.restTrack}>
              <View
                style={[
                  styles.restFill,
                  { width: `${Math.max(0, Math.min(1, rest.left / rest.total)) * 100}%` },
                ]}
              />
            </View>
          </View>
        ) : null}

        <ExercisePicker
          visible={pickerOpen}
          addedNames={active.exercises.map((ex) => ex.name)}
          onPick={addExercise}
          onClose={() => setPickerOpen(false)}
        />

        <ConfirmDialog
          visible={Boolean(confirm)}
          loading={saving}
          onCancel={() => setConfirm(null)}
          onConfirm={handleConfirm}
          {...confirmProps}
        />
      </View>
    );
  }

  // ---------- Idle / overview ----------
  const recent = sessions.slice(0, 20);

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Container>
          <Text style={styles.title}>Train</Text>

          <LinearGradient
            colors={colors.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <Text style={styles.heroLabel}>Ready when you are</Text>
            <Text style={styles.heroTitle}>Log today's session</Text>
            <Text style={styles.heroHint}>
              Track sets, reps and weight. Your history and personal records update
              automatically.
            </Text>
            {streak > 0 ? (
              <View style={styles.heroStreak}>
                <Ionicons name="flame" size={14} color={colors.white} />
                <Text style={styles.heroStreakText}>
                  {streak}-day training streak
                </Text>
              </View>
            ) : null}
            <TouchableOpacity style={styles.heroBtn} onPress={() => startWorkout(null)}>
              <Ionicons name="barbell" size={18} color={colors.primaryDark} />
              <Text style={styles.heroBtnText}>Start empty workout</Text>
            </TouchableOpacity>
          </LinearGradient>

          <SectionLabel style={styles.sectionLabel}>
            Today's plan ·{' '}
            {new Date().toLocaleDateString('en-US', { weekday: 'long' })}
          </SectionLabel>
          <Card style={styles.planCard}>
            <View style={styles.planHeader}>
              <View style={styles.planHeaderInfo}>
                <Text style={styles.planTitle}>{plan.title}</Text>
                <Text style={styles.planFocus}>{plan.focus}</Text>
              </View>
              <View style={styles.planIcon}>
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              </View>
            </View>

            <ChipGroup
              options={[
                { value: 'home', label: 'Home' },
                { value: 'gym', label: 'Gym' },
              ]}
              value={planEnv}
              onChange={setPlanEnv}
            />

            <View style={styles.planList}>
              {(planEnv === 'home' ? plan.home : plan.gym).map((item) => (
                <View key={item.name} style={styles.planItem}>
                  <View style={styles.planItemTop}>
                    <Text style={styles.planItemName}>{item.name}</Text>
                    <Text style={styles.planItemScheme}>
                      {item.sets} × {item.reps}
                    </Text>
                  </View>
                  {item.tip ? (
                    <Text style={styles.planItemTip}>{item.tip}</Text>
                  ) : null}
                </View>
              ))}
            </View>

            <Text style={styles.planNote}>{plan.note}</Text>

            <Button icon="play" onPress={startPlanWorkout}>
              Start this workout
            </Button>
          </Card>

          <Card style={{ marginTop: spacing.md }}>
            <Text style={styles.planTitle}>AI training suggestions</Text>
            <Text style={styles.planFocus}>Get ideas using this week’s training and today’s plan.</Text>
            <Button icon="sparkles-outline" onPress={() => setShowCoach(true)}>
              Ask AI Coach
            </Button>
          </Card>

          <SectionLabel style={styles.sectionLabel}>This week</SectionLabel>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{weekly.count}</Text>
              <Text style={styles.statLabel}>Sessions</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{weekly.sets}</Text>
              <Text style={styles.statLabel}>Sets</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{Math.round(weekly.volume).toLocaleString('en-US')}</Text>
              <Text style={styles.statLabel}>Volume (kg)</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{weekly.minutes}</Text>
              <Text style={styles.statLabel}>Minutes</Text>
            </View>
          </View>

          <SectionLabel style={styles.sectionLabel}>Quick start</SectionLabel>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.templates}
          >
            {TEMPLATES.map((template) => (
              <TouchableOpacity
                key={template.id}
                style={styles.templateCard}
                onPress={() => startWorkout(template)}
              >
                <View style={styles.templateIcon}>
                  <Ionicons name={template.icon} size={22} color={colors.primary} />
                </View>
                <Text style={styles.templateName}>{template.name}</Text>
                <Text style={styles.templateMeta}>
                  {template.exercises.length} exercises
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {error ? (
            <Card style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
            </Card>
          ) : null}

          <View style={isDesktop ? styles.twoCol : null}>
            <View style={isDesktop ? styles.col : null}>
              <SectionLabel style={styles.sectionLabel}>Personal records</SectionLabel>
              {records.length === 0 ? (
                <Card style={styles.mutedCard}>
                  <Text style={styles.mutedText}>
                    No records yet. Log a few sets and your heaviest lifts show up here.
                  </Text>
                </Card>
              ) : (
                <Card style={styles.recordsCard}>
                  {records.slice(0, 5).map((record, index) => (
                    <View
                      key={record.name}
                      style={[styles.recordRow, index > 0 && styles.rowDivider]}
                    >
                      <View style={styles.recordMedal}>
                        <Ionicons name="trophy-outline" size={16} color={colors.warning} />
                      </View>
                      <View style={styles.recordInfo}>
                        <Text style={styles.recordName}>{record.name}</Text>
                        <Text style={styles.recordMeta}>
                          {MUSCLE_LABEL[record.muscle] ?? 'Other'} · {formatDate(record.date)}
                        </Text>
                      </View>
                      <Text style={styles.recordValue}>
                        {record.weight} kg × {record.reps}
                      </Text>
                    </View>
                  ))}
                </Card>
              )}
          
              <SectionLabel style={styles.sectionLabel}>Recent workouts</SectionLabel>
              {recent.length === 0 ? (
                <EmptyState
                  icon="barbell-outline"
                  title="No workouts yet"
                  hint="Start an empty workout or pick a template above."
                />
              ) : (
                recent.map((session) => {
                  const open = expanded === session.id;
                  const summary = summarizeExercises(session.exercises);
                  return (
                    <Card key={session.id} style={styles.sessionCard}>
                      <TouchableOpacity
                        onPress={() => setExpanded(open ? null : session.id)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.sessionRow}>
                          <View style={styles.sessionIcon}>
                            <Ionicons name="barbell-outline" size={18} color={colors.primary} />
                          </View>
                          <View style={styles.sessionInfo}>
                            <Text style={styles.sessionName}>{session.name || 'Workout'}</Text>
                            <Text style={styles.sessionSub}>
                              {formatDateLong(session.started_at)} · {formatTime(session.started_at)}
                            </Text>
                          </View>
                          <Ionicons
                            name={open ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            color={colors.textMuted}
                          />
                        </View>
                        <View style={styles.sessionStats}>
                          <Text style={styles.sessionStat}>
                            {formatDuration((Number(session.duration_min) || 0) * 60)}
                          </Text>
                          <Text style={styles.sessionDot}>·</Text>
                          <Text style={styles.sessionStat}>
                            {Number(session.total_sets) || 0} sets
                          </Text>
                          <Text style={styles.sessionDot}>·</Text>
                          <Text style={styles.sessionStat}>
                            {formatVolume(session.total_volume_kg)}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {open ? (
                        <View style={styles.sessionDetail}>
                          {summary.map((ex) => (
                            <View key={ex.name} style={styles.detailRow}>
                              <Text style={styles.detailName}>{ex.name}</Text>
                              <Text style={styles.detailValue}>
                                {ex.sets} × {ex.topWeight > 0 ? `${ex.topWeight} kg` : 'bodyweight'}
                                {ex.topReps > 0 ? ` × ${ex.topReps}` : ''}
                              </Text>
                            </View>
                          ))}
                          {session.notes ? (
                            <Text style={styles.sessionNotes}>{session.notes}</Text>
                          ) : null}
                          <View style={styles.detailActions}>
                            <Button
                              variant="danger"
                              icon="trash-outline"
                              onPress={() => setConfirm({ kind: 'delete', id: session.id })}
                              style={styles.deleteBtn}
                            >
                              Delete
                            </Button>
                          </View>
                        </View>
                      ) : null}
                    </Card>
                  );
                })
              )}
            </View>
          </View>
        </Container>
      </ScrollView>
      <CoachModal
        visible={showCoach}
        onClose={() => setShowCoach(false)}
        context={{ screen: 'Training planner', todayPlan: plan.title, planFocus: plan.focus, environment: planEnv, workoutsThisWeek: weekly.count, setsThisWeek: weekly.sets, trainingMinutesThisWeek: weekly.minutes, recentWorkouts: sessions.slice(0, 5).map((s) => s.name), request: 'Suggest a safe practical workout for today that fits the plan and training history.' }}
      />

      <ConfirmDialog
        visible={Boolean(confirm)}
        loading={saving}
        onCancel={() => setConfirm(null)}
        onConfirm={handleConfirm}
        {...confirmProps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingBottom: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: font.xl, fontWeight: '800', color: colors.text, marginBottom: spacing.md },

  // Hero
  hero: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  heroLabel: {
    fontSize: font.sm,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: font.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  heroTitle: {
    fontSize: font.xxl,
    fontWeight: '800',
    color: colors.white,
    marginTop: spacing.xs,
  },
  heroHint: {
    fontSize: font.base,
    color: 'rgba(255,255,255,0.9)',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  heroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    ...(IS_WEB ? { cursor: 'pointer' } : {}),
  },
  heroBtnText: { color: colors.primaryDark, fontWeight: '700', fontSize: font.base },
  heroStreak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
  },
  heroStreakText: { color: colors.white, fontSize: font.xs, fontWeight: '700' },

  // Weekday plan
  planCard: { padding: spacing.md },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  planHeaderInfo: { flex: 1 },
  planTitle: { fontSize: font.lg, fontWeight: '800', color: colors.text },
  planFocus: { fontSize: font.sm, color: colors.textMuted, marginTop: 2 },
  planIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planList: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  planItem: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  planItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  planItemName: { flex: 1, fontSize: font.base, fontWeight: '700', color: colors.text },
  planItemScheme: {
    fontSize: font.sm,
    fontWeight: '700',
    color: colors.primaryDark,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  planItemTip: {
    fontSize: font.sm,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 17,
  },
  planNote: {
    fontSize: font.sm,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: spacing.md,
    marginBottom: spacing.md,
    lineHeight: 18,
  },

  sectionLabel: { marginTop: spacing.md, marginBottom: spacing.sm },

  // Week stats
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statCard: {
    flex: 1,
    minWidth: 76,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  statValue: { fontSize: font.lg, fontWeight: '800', color: colors.text },
  statLabel: {
    fontSize: font.xs,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },

  // Templates
  templates: { gap: spacing.sm, paddingBottom: spacing.xs },
  templateCard: {
    width: 150,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    ...(IS_WEB ? { cursor: 'pointer' } : {}),
  },
  templateIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  templateName: { fontSize: font.base, fontWeight: '700', color: colors.text },
  templateMeta: { fontSize: font.sm, color: colors.textMuted, marginTop: 2 },

  // Records
  recordsCard: { paddingVertical: spacing.xs },
  recordRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  recordMedal: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.warningSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordInfo: { flex: 1, marginLeft: spacing.sm },
  recordName: { fontSize: font.base, fontWeight: '600', color: colors.text },
  recordMeta: { fontSize: font.sm, color: colors.textMuted, marginTop: 1 },
  recordValue: { fontSize: font.base, fontWeight: '700', color: colors.primaryDark },
  mutedCard: { backgroundColor: colors.surfaceMuted },
  mutedText: { fontSize: font.base, color: colors.textMuted },

  // Recent sessions
  sessionCard: { marginBottom: spacing.sm },
  sessionRow: { flexDirection: 'row', alignItems: 'center' },
  sessionIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionInfo: { flex: 1, marginLeft: spacing.sm },
  sessionName: { fontSize: font.md, fontWeight: '700', color: colors.text },
  sessionSub: { fontSize: font.sm, color: colors.textMuted, marginTop: 1 },
  sessionStats: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  sessionStat: { fontSize: font.sm, color: colors.textMuted, fontWeight: font.weight.medium },
  sessionDot: { color: colors.borderStrong },
  sessionDetail: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: 3,
  },
  detailName: { flex: 1, fontSize: font.base, color: colors.text },
  detailValue: { fontSize: font.base, color: colors.textMuted, fontWeight: font.weight.medium },
  sessionNotes: {
    fontSize: font.sm,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
  detailActions: { flexDirection: 'row', marginTop: spacing.md },
  deleteBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },

  // Active session
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  closeBtn: { padding: spacing.xs },
  sessionTitleWrap: { flex: 1 },
  nameInput: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text,
    paddingVertical: 2,
    ...(IS_WEB ? { outlineStyle: 'none' } : {}),
  },
  sessionMeta: { fontSize: font.sm, color: colors.textMuted, marginTop: 2 },
  finishBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },

  exerciseCard: { marginBottom: spacing.md },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  exerciseIndex: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseIndexText: { fontSize: font.sm, fontWeight: '700', color: colors.primaryDark },
  exerciseInfo: { flex: 1 },
  exerciseName: { fontSize: font.md, fontWeight: '700', color: colors.text },
  exerciseMeta: { fontSize: font.sm, color: colors.textMuted, marginTop: 1 },

  setHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingHorizontal: 2,
  },
  setHeaderText: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  setIndexCol: { width: 28, textAlign: 'center' },
  setCol: { flex: 1 },
  setCheckCol: { width: 40 },
  setRemoveCol: { width: 26 },
  setIndex: { fontSize: font.base, color: colors.textMuted, fontWeight: font.weight.semibold },
  setInput: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    fontSize: font.md,
    color: colors.text,
    textAlign: 'center',
  },
  checkBtn: {
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBtnDone: { backgroundColor: colors.primary },
  removeSetBtn: { alignItems: 'center', justifyContent: 'center', height: 40 },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
    ...(IS_WEB ? { cursor: 'pointer' } : {}),
  },
  addSetText: { fontSize: font.base, fontWeight: '600', color: colors.primary },
  addExerciseBtn: { marginBottom: spacing.lg },
  notesLabel: { marginTop: spacing.xs },
  notesInput: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    minHeight: 84,
    fontSize: font.base,
    color: colors.text,
    textAlignVertical: 'top',
  },

  // Rest bar
  restBar: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  restInfo: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, flex: 1 },
  restLabel: {
    fontSize: font.sm,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: font.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  restTime: { fontSize: font.xl, fontWeight: '800', color: colors.white },
  restActions: { flexDirection: 'row', gap: spacing.xs },
  restBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: radius.sm,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
    ...(IS_WEB ? { cursor: 'pointer' } : {}),
  },
  restBtnText: { color: colors.white, fontSize: font.sm, fontWeight: '700' },
  restTrack: {
    width: '100%',
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  restFill: { height: 4, backgroundColor: colors.white },

  // Misc
  errorCard: { backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft, marginTop: spacing.md },
  errorText: { color: colors.danger },
  twoCol: { flexDirection: 'row', gap: spacing.lg },
  col: { flex: 1 },
});
