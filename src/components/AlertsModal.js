import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useResponsive } from './ui';
import { font, radius, spacing } from '../theme/colors';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';

const tonesFor = (colors) => ({
  success: { icon: 'checkmark-circle', bg: colors.primarySoft, fg: colors.primaryDark },
  info: { icon: 'information-circle', bg: colors.primarySoft, fg: colors.primaryDark },
  warning: { icon: 'alert-circle', bg: colors.warningSoft, fg: colors.warning },
  danger: { icon: 'warning', bg: colors.dangerSoft, fg: colors.danger },
  streak: { icon: 'flame', bg: colors.warningSoft, fg: colors.warning },
});

// In-app notification centre. Alerts are generated from today's data instead
// of being stored, so they are always up to date.
export default function AlertsModal({ visible, onClose, alerts = [], dayLabel = 'today' }) {
  const { isDesktop } = useResponsive();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const tones = tonesFor(colors);
  const actionable = alerts.filter((a) => a.tone !== 'success').length;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, isDesktop && styles.backdropDesktop]}>
        <View style={[styles.sheet, isDesktop && styles.sheetDesktop]}>
          <View style={styles.header}>
            <View style={styles.headerInfo}>
              <View style={styles.headerIcon}>
                <Ionicons name="notifications-outline" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Alerts</Text>
                <Text style={styles.subtitle}>
                  {alerts.length === 0
                    ? `Nothing needs your attention ${dayLabel}.`
                    : `${actionable} to check · ${alerts.length} total`}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {alerts.length === 0 ? (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="checkmark-done" size={26} color={colors.primary} />
                </View>
                <Text style={styles.emptyTitle}>You are all caught up</Text>
                <Text style={styles.emptyHint}>
                  Log meals, water and workouts and your reminders will show up here.
                </Text>
              </View>
            ) : (
              alerts.map((alert) => {
                const tone = tones[alert.tone] ?? tones.info;
                return (
                  <View key={alert.id} style={styles.row}>
                    <View style={[styles.rowIcon, { backgroundColor: tone.bg }]}>
                      <Ionicons name={alert.icon || tone.icon} size={18} color={tone.fg} />
                    </View>
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowTitle}>{alert.title}</Text>
                      <Text style={styles.rowMessage}>{alert.message}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  backdropDesktop: { justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  sheet: {
    width: '100%',
    maxHeight: '86%',
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: spacing.md,
  },
  sheetDesktop: {
    width: 520,
    maxHeight: '80%',
    borderRadius: 20,
    paddingBottom: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: font.lg, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: font.sm, color: colors.textMuted, marginTop: 1 },
  closeBtn: { padding: spacing.xs },
  list: { flexGrow: 0 },
  listContent: { padding: spacing.md, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: { flex: 1 },
  rowTitle: { fontSize: font.base, fontWeight: '700', color: colors.text },
  rowMessage: { fontSize: font.sm, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
  empty: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: { fontSize: font.md, fontWeight: '700', color: colors.text },
  emptyHint: {
    fontSize: font.base,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    maxWidth: 280,
    lineHeight: 20,
  },
});
