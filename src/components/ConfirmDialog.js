import { Modal, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card } from './ui';
import { colors, font, radius, spacing } from '../theme/colors';

export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmText = 'Eliminar',
  icon = 'trash-outline',
  loading = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Card style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name={icon} size={26} color={colors.danger} />
          </View>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.actions}>
            <Button variant="secondary" onPress={onCancel} disabled={loading} style={styles.btn}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              icon={loading ? undefined : icon}
              onPress={onConfirm}
              loading={loading}
              disabled={loading}
              style={styles.btn}
            >
              {confirmText}
            </Button>
          </View>
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { fontSize: font.md, fontWeight: '700', color: colors.text, textAlign: 'center' },
  message: {
    fontSize: font.base,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  actions: { flexDirection: 'row', gap: spacing.sm, width: '100%' },
  btn: { flex: 1 },
});