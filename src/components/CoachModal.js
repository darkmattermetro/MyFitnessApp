import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useResponsive } from './ui';
import { colors, font, radius, spacing } from '../theme/colors';
import { coachReply } from '../services/api';

const IS_WEB = Platform.OS === 'web';

const SUGGESTIONS = [
  'Create my personalized 20-minute home workout and vegetarian meal plan for today.',
  'How do I hit my protein goal?',
  'Review my last 7 days and suggest one improvement.',
];

const WELCOME =
  "Hi! I'm your OpenFit coach. Ask me about meals, training, hydration or how to reach your goals. I can see today's summary, so you can just say \"what now?\". When you send a message, your recent chat and today's summary are sent to Google Gemini using your key.";

let counter = 0;
function uid() {
  counter += 1;
  return `msg-${Date.now()}-${counter}`;
}

export default function CoachModal({ visible, onClose, context, onOpenProfile }) {
  const { isDesktop } = useResponsive();
  const { height } = useWindowDimensions();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (visible && messages.length === 0) {
      setMessages([{ id: 'welcome', role: 'coach', text: WELCOME }]);
    }
  }, [visible, messages.length]);

  const close = () => {
    if (sending) return;
    onClose();
  };

  const send = async (preset) => {
    const question = String(preset ?? input).trim();
    if (!question || sending) return;

    const withUser = [...messages, { id: uid(), role: 'user', text: question }];
    setMessages(withUser);
    setInput('');
    setError(null);
    setSending(true);

    try {
      const history = withUser
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.role, text: m.text }));
      const answer = await coachReply(context, history);
      setMessages((prev) => [...prev, { id: uid(), role: 'coach', text: answer }]);
    } catch (e) {
      setError(e.message || 'Could not reach the coach. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const needsKey = Boolean(error && /api key/i.test(error));
  const hasUserMessage = messages.some((m) => m.role === 'user');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={[styles.backdrop, isDesktop && styles.backdropDesktop]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[
            styles.sheet,
            {
              height: isDesktop ? Math.min(600, Math.max(460, height * 0.8)) : height * 0.86,
            },
            isDesktop && styles.sheetDesktop,
          ]}
        >
          <View style={styles.header}>
            <View style={styles.avatar}>
              <Ionicons name="sparkles" size={18} color={colors.primaryDark} />
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.title}>AI Coach</Text>
              <Text style={styles.subtitle}>Powered by Gemini · your own key</Text>
            </View>
            <TouchableOpacity onPress={close} hitSlop={10} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.messages}
            contentContainerStyle={styles.messagesContent}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            keyboardShouldPersistTaps="handled"
          >
            {messages.map((message) => {
              const mine = message.role === 'user';
              return (
                <View
                  key={message.id}
                  style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowCoach]}
                >
                  {!mine ? (
                    <View style={styles.bubbleAvatar}>
                      <Ionicons name="sparkles" size={12} color={colors.primaryDark} />
                    </View>
                  ) : null}
                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleCoach]}>
                    <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
                      {message.text}
                    </Text>
                  </View>
                </View>
              );
            })}

            {sending ? (
              <View style={[styles.bubbleRow, styles.bubbleRowCoach]}>
                <View style={styles.bubbleAvatar}>
                  <Ionicons name="sparkles" size={12} color={colors.primaryDark} />
                </View>
                <View style={[styles.bubble, styles.bubbleCoach, styles.typing]}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.typingText}>Thinking…</Text>
                </View>
              </View>
            ) : null}

            {!hasUserMessage ? (
              <View style={styles.suggestions}>
                {SUGGESTIONS.map((suggestion) => (
                  <TouchableOpacity
                    key={suggestion}
                    style={styles.suggestion}
                    onPress={() => send(suggestion)}
                    disabled={sending}
                  >
                    <Text style={styles.suggestionText}>{suggestion}</Text>
                    <Ionicons name="arrow-forward" size={14} color={colors.primary} />
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
                {needsKey && onOpenProfile ? (
                  <TouchableOpacity
                    style={styles.errorBtn}
                    onPress={() => {
                      onClose();
                      onOpenProfile();
                    }}
                  >
                    <Text style={styles.errorBtnText}>Open Profile</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.inputRow}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ask your coach…"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              multiline
              maxLength={800}
              onSubmitEditing={() => send()}
              submitBehavior="submit"
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!input.trim() || sending) && { opacity: 0.45 },
              ]}
              onPress={() => send()}
              disabled={!input.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Ionicons name="arrow-up" size={20} color={colors.white} />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  backdropDesktop: { justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  sheet: {
    width: '100%',
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  sheetDesktop: { maxWidth: 620, borderRadius: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: { flex: 1 },
  title: { fontSize: font.md, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: font.xs, color: colors.textMuted, marginTop: 1 },
  closeBtn: { padding: spacing.xs },
  messages: { flex: 1 },
  messagesContent: { padding: spacing.md, gap: spacing.sm },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  bubbleRowCoach: { justifyContent: 'flex-start' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleAvatar: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  bubbleCoach: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleMine: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleText: { fontSize: font.base, color: colors.text, lineHeight: 20 },
  bubbleTextMine: { color: colors.white },
  typing: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  typingText: { fontSize: font.sm, color: colors.textMuted },
  suggestions: { gap: spacing.xs, marginTop: spacing.sm },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...(IS_WEB ? { cursor: 'pointer' } : {}),
  },
  suggestionText: { fontSize: font.base, color: colors.primaryDark, fontWeight: '600' },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  errorText: { fontSize: font.sm, color: colors.danger, lineHeight: 18 },
  errorBtn: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    backgroundColor: colors.danger,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  errorBtnText: { color: colors.white, fontSize: font.sm, fontWeight: '700' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    maxHeight: 96,
    minHeight: 44,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: font.md,
    color: colors.text,
    ...(IS_WEB ? { outlineStyle: 'none' } : {}),
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...(IS_WEB ? { cursor: 'pointer' } : {}),
  },
});
