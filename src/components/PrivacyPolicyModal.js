import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, spacing } from '../theme/colors';
import { Button } from './ui';

export default function PrivacyPolicyModal({ visible, onClose }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>Privacy and data</Text>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Close privacy policy">
            <Ionicons name="close" size={26} color={colors.text} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.intro}>OpenFit uses your data to provide fitness tracking features you choose to use.</Text>
          <Text style={styles.heading}>Health records</Text>
          <Text style={styles.body}>If you connect Health Connect or Google Fit, OpenFit reads only the permissions you grant, such as daily steps, active calories, or sleep. Imported daily totals are stored in your OpenFit account. You can revoke access in the provider's settings at any time.</Text>
          <Text style={styles.heading}>AI processing</Text>
          <Text style={styles.body}>After you accept the AI notice, OpenFit sends the meal text or photo, saved food preferences, recent coach chat, and the selected profile or health context needed for your request to Google Gemini. Gemini API quotas and pricing can change; check Google's AI Studio terms for your key. AI values are estimates and need your review.</Text>
          <Text style={styles.heading}>Storage and access</Text>
          <Text style={styles.body}>Account data is stored in OpenFit's Supabase project and protected by user-level access policies. Your Gemini key is stored on your device: Android SecureStore on Android, iOS secure storage on iOS, and browser storage on web. The web browser does not provide the same encrypted storage guarantee.</Text>
          <Text style={styles.heading}>Retention and deletion</Text>
          <Text style={styles.body}>Account data remains until you delete it. Use Export my data to save a JSON copy. Delete my account and data permanently removes your OpenFit profile and associated cloud records. Local Health Connect or Google Fit records remain with their providers.</Text>
          <Text style={styles.heading}>Health Connect permission rationale</Text>
          <Text style={styles.body}>OpenFit reads the selected health metrics to show your daily and weekly activity. It does not write health records. Grant only the metrics you want to share; use Manage permissions to change access.</Text>
          <Button variant="primary" onPress={onClose}>Done</Button>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.text, fontSize: font.lg, fontWeight: '800' },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  intro: { color: colors.text, fontSize: font.base, lineHeight: 23, marginBottom: spacing.lg },
  heading: { color: colors.text, fontSize: font.md, fontWeight: '700', marginTop: spacing.md, marginBottom: spacing.xs },
  body: { color: colors.textMuted, fontSize: font.sm, lineHeight: 21 },
});
