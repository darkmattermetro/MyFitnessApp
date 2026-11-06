import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useResponsive } from './ui';
import { font, radius, spacing } from '../theme/colors';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import { coachReply } from '../services/api';
import { friendlyError } from '../utils/networkErrors.mjs';

const IS_WEB = Platform.OS === 'web';

// Mobile browsers shrink the visual viewport for the on-screen keyboard but
// leave the layout viewport alone, so a bottom-anchored sheet stays hidden.
// Track the covered area and lift the sheet like a native keyboard would.
function useWebKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    if (!IS_WEB || typeof window === 'undefined' || !window.visualViewport) {
      return undefined;
    }
    const viewport = window.visualViewport;
    const update = () => {
      const hidden = window.innerHeight - (viewport.height + viewport.offsetTop);
      setInset(hidden > 120 ? Math.round(hidden) : 0);
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, []);
  return inset;
}

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

export default function CoachModal({
  visible,
  onClose,
  context,
  onOpenProfile,
  title = 'AI Coach',
  suggestions = SUGGESTIONS,
  welcome = WELCOME,
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { isDesktop } = useResponsive();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const webKeyboardInset = useWebKeyboardInset();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [failedMessage, setFailedMessage] = useState(null);
  const [inputFocused, setInputFocused] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const scrollRef = useRef(null);
  const requestRef = useRef(null);
  const sendingRef = useRef(false);
  const atBottomRef = useRef(true);

  const scrollToEnd = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated });
    });
  }, []);

  useEffect(() => {
    if (visible && messages.length === 0) {
      setMessages([{ id: 'welcome', role: 'coach', text: welcome }]);
    }
  }, [visible, messages.length, welcome]);

  useEffect(() => () => requestRef.current?.abort(), []);

  // Keep the input (and the latest message) above the keyboard on native.
  useEffect(() => {
    if (!visible || IS_WEB) return undefined;
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => {
      setKeyboardOpen(true);
      atBottomRef.current = true;
      scrollToEnd(false);
    });
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [visible, scrollToEnd]);

  const close = () => {
    requestRef.current?.abort();
    onClose();
  };

  const send = async (preset, retry = null) => {
    const question = String(preset ?? input).trim();
    if (!question || sendingRef.current) return;

    const userMessage = retry ? null : { id: uid(), role: 'user', text: question };
    const withUser = retry ? messages : [...messages, userMessage];
    if (!retry) {
      setMessages(withUser);
      setInput('');
    }
    setError(null);
    setFailedMessage(null);
    const controller = new AbortController();
    requestRef.current = controller;
    sendingRef.current = true;
    setSending(true);

    try {
      const history = withUser
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.role, text: m.text }));
      const answer = await coachReply(context, history, controller.signal);
      setMessages((prev) => [...prev, { id: uid(), role: 'coach', text: answer }]);
    } catch (e) {
      if (controller.signal.aborted) {
        if (userMessage) setMessages((prev) => prev.filter((message) => message.id !== userMessage.id));
        setInput((current) => current.trim() ? current : question);
      } else {
        setError(friendlyError(e, 'Could not reach the coach. Please try again.'));
        setFailedMessage({ id: userMessage?.id || retry?.id, text: question });
        setInput((current) => current.trim() ? current : question);
      }
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      sendingRef.current = false;
      setSending(false);
    }
  };

  const needsKey = Boolean(error && /api key/i.test(error));
  const hasUserMessage = messages.some((m) => m.role === 'user');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
        style={styles.avoider}
      >
        <View
          style={[
            styles.backdrop,
            isDesktop && styles.backdropDesktop,
            webKeyboardInset > 0 && { paddingBottom: webKeyboardInset },
          ]}
        >
          <View
            style={[
              styles.sheet,
              isDesktop
                ? { height: Math.min(600, Math.max(460, height * 0.8)) }
                : styles.sheetMobile,
              isDesktop && styles.sheetDesktop,
            ]}
          >
            <View style={styles.header}>
              <View style={styles.avatar}>
                <Ionicons name="sparkles" size={18} color={colors.primaryDark} />
              </View>
              <View style={styles.headerInfo}>
                <Text style={styles.title}>{title}</Text>
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
              onContentSizeChange={() => {
                if (atBottomRef.current) scrollToEnd(false);
              }}
              onScroll={(event) => {
                const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
                atBottomRef.current =
                  contentOffset.y + layoutMeasurement.height >= contentSize.height - 24;
              }}
              scrollEventThrottle={16}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
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
                  {suggestions.map((suggestion) => (
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
                  {failedMessage ? (
                    <TouchableOpacity style={styles.retryBtn} onPress={() => send(failedMessage.text, failedMessage)} disabled={sending}>
                      <Text style={styles.retryBtnText}>Retry message</Text>
                    </TouchableOpacity>
                  ) : null}
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

            <View
              style={[
                styles.inputRow,
                {
                  paddingBottom: keyboardOpen
                    ? spacing.sm + 2
                    : Math.max(spacing.md, insets.bottom + spacing.xs),
                },
              ]}
            >
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder={IS_WEB ? 'Message your coach… (Shift+Enter for a new line)' : 'Message your coach…'}
                placeholderTextColor={colors.textMuted}
                style={[styles.input, inputFocused && styles.inputFocused]}
                multiline
                maxLength={800}
                selectionColor={colors.primary}
                accessibilityLabel="Message your AI coach"
                accessibilityHint="Type a question. Use the arrow button to send."
                submitBehavior="newline"
                onFocus={() => {
                  setInputFocused(true);
                  atBottomRef.current = true;
                  scrollToEnd();
                }}
                onBlur={() => setInputFocused(false)}
                onKeyPress={IS_WEB ? (event) => {
                  if (event.nativeEvent.key === 'Enter' && !event.nativeEvent.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault?.();
                    send();
                  }
                } : undefined}
              />
              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  (!input.trim() || sending) && { opacity: 0.45 },
                ]}
                onPress={() => send()}
                disabled={!input.trim() || sending}
                accessibilityRole="button"
                accessibilityLabel="Send message to AI coach"
              >
                {sending ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Ionicons name="arrow-up" size={20} color={colors.white} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  avoider: { flex: 1 },
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
    ...(IS_WEB
      ? { boxShadow: '0 -16px 48px rgba(0, 0, 0, 0.32)' }
      : { elevation: 24, shadowColor: '#000000', shadowOpacity: 0.3, shadowRadius: 24, shadowOffset: { width: 0, height: -6 } }),
  },
  sheetMobile: { height: '92%' },
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
  retryBtn: { alignSelf: 'flex-start', marginTop: spacing.sm, paddingVertical: spacing.xs },
  retryBtnText: { color: colors.danger, fontSize: font.sm, fontWeight: '700' },
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
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: font.md,
    color: colors.text,
    textAlignVertical: 'top',
    ...(IS_WEB ? { outlineStyle: 'none' } : {}),
  },
  inputFocused: { borderColor: colors.primary },
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
