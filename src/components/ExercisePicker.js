import { useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, ChipGroup } from './ui';
import { EXERCISES, MUSCLES } from '../data/exercises';
import { colors, font, radius, spacing } from '../theme/colors';

const FILTERS = [{ value: 'all', label: 'All' }, ...MUSCLES];

export default function ExercisePicker({ visible, addedNames = [], onPick, onClose }) {
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState('all');

  const added = useMemo(
    () => new Set(addedNames.map((n) => String(n).toLowerCase())),
    [addedNames],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return EXERCISES.filter((ex) => {
      if (muscle !== 'all' && ex.muscle !== muscle) return false;
      if (!q) return true;
      return ex.name.toLowerCase().includes(q) || ex.equipment.toLowerCase().includes(q);
    });
  }, [query, muscle]);

  const custom = query.trim();
  const canCreate =
    custom.length > 1 &&
    !EXERCISES.some((ex) => ex.name.toLowerCase() === custom.toLowerCase());

  const handleClose = () => {
    setQuery('');
    setMuscle('all');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.flex}>
        <View style={styles.header}>
          <Text style={styles.title}>Add exercise</Text>
          <TouchableOpacity onPress={handleClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.search}
            placeholder="Search exercise or equipment"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersScroll}
          contentContainerStyle={styles.filters}
        >
          {FILTERS.map((f) => {
            const activeFilter = f.value === muscle;
            return (
              <TouchableOpacity
                key={f.value}
                onPress={() => setMuscle(f.value)}
                style={[styles.filterChip, activeFilter && styles.filterChipActive]}
              >
                <Text style={[styles.filterText, activeFilter && styles.filterTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          {canCreate ? (
            <TouchableOpacity
              style={[styles.row, styles.customRow]}
              onPress={() =>
                onPick({
                  name: custom,
                  muscle: muscle === 'all' ? 'other' : muscle,
                  equipment: 'Custom',
                })
              }
            >
              <View style={styles.customIcon}>
                <Ionicons name="add" size={18} color={colors.primary} />
              </View>
              <View style={styles.rowInfo}>
                <Text style={styles.rowName}>Create “{custom}”</Text>
                <Text style={styles.rowMeta}>Custom exercise</Text>
              </View>
            </TouchableOpacity>
          ) : null}

          {results.map((ex) => {
            const isAdded = added.has(ex.name.toLowerCase());
            return (
              <TouchableOpacity
                key={ex.name}
                style={[styles.row, isAdded && styles.rowAdded]}
                onPress={() => !isAdded && onPick(ex)}
                disabled={isAdded}
              >
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName}>{ex.name}</Text>
                  <Text style={styles.rowMeta}>
                    {ex.equipment} · {MUSCLES.find((m) => m.value === ex.muscle)?.label ?? 'Other'}
                  </Text>
                </View>
                <Ionicons
                  name={isAdded ? 'checkmark-circle' : 'add-circle-outline'}
                  size={22}
                  color={isAdded ? colors.primary : colors.textMuted}
                />
              </TouchableOpacity>
            );
          })}

          {results.length === 0 && !canCreate ? (
            <Text style={styles.empty}>No exercises match your search.</Text>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button variant="primary" onPress={handleClose} icon="checkmark">
            Done
          </Button>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: { fontSize: font.xl, fontWeight: '800', color: colors.text },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  search: { flex: 1, paddingVertical: spacing.md, fontSize: font.md, color: colors.text },
  filtersScroll: { flexGrow: 0, marginTop: spacing.md },
  filters: { paddingHorizontal: spacing.md, gap: spacing.xs },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontSize: font.base, fontWeight: '600', color: colors.textMuted },
  filterTextActive: { color: colors.white },
  list: { padding: spacing.md, paddingBottom: spacing.xxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  rowAdded: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  customRow: { borderStyle: 'dashed', borderColor: colors.primary },
  customIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: { flex: 1 },
  rowName: { fontSize: font.md, fontWeight: '600', color: colors.text },
  rowMeta: { fontSize: font.sm, color: colors.textMuted, marginTop: 2 },
  empty: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.lg },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
