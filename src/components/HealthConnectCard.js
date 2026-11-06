import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card } from './ui';
import { useToast } from './Toast';
import { friendlyError } from '../utils/networkErrors.mjs';
import { font, radius, spacing } from '../theme/colors';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';
import {
  getHealthConnectLastSync,
  getHealthConnectStatus,
  openHealthConnectPermissions,
  requestHealthConnectStepPermission,
  syncHealthConnectSteps,
} from '../services/healthConnect';

const DAY_MS = 24 * 60 * 60 * 1000;

export default function HealthConnectCard({ onOpenPrivacy }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { showToast } = useToast();
  const [status, setStatus] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [checking, setChecking] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const autoSyncing = useRef(false);

  const refresh = useCallback(async () => {
    setChecking(true);
    try {
      const [nextStatus, syncDate] = await Promise.all([
        getHealthConnectStatus(),
        getHealthConnectLastSync(),
      ]);
      setStatus(nextStatus);
      setLastSync(syncDate);
    } catch (error) {
      setStatus({ available: false, error });
    } finally {
      setChecking(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    refresh();
  }, [refresh]));

  const syncNow = useCallback(async (automatic = false) => {
    if (automatic && autoSyncing.current) return;
    if (automatic) autoSyncing.current = true;
    setSyncing(true);
    try {
      const result = await syncHealthConnectSteps(7);
      setLastSync(result.lastSync);
      if (!automatic) {
        if (result.imported === 0) {
          showToast('No step data found. Check that Health Connect is receiving steps from your apps.');
        } else if (result.updated === 0) {
          showToast('Step data arrived, but your saved counts are already higher.');
        } else {
          showToast(`Imported steps for ${result.updated} day(s).`, 'success');
        }
      }
    } catch (error) {
      if (/allow openfit|permission/i.test(error.message || '')) {
        setStatus((current) => current ? { ...current, permissionGranted: false } : current);
      }
      if (!automatic) showToast(friendlyError(error, 'Health Connect step sync failed.'), 'error');
    } finally {
      setSyncing(false);
      if (automatic) autoSyncing.current = false;
    }
  }, [showToast]);

  useEffect(() => {
    if (!status?.available || !status.permissionGranted || syncing) return;
    const age = lastSync ? Date.now() - new Date(lastSync).getTime() : Infinity;
    if (age < DAY_MS) return;
    syncNow(true);
  }, [lastSync, status?.available, status?.permissionGranted, syncing, syncNow]);

  const connect = async () => {
    setConnecting(true);
    try {
      const granted = await requestHealthConnectStepPermission();
      setStatus((current) => ({ ...(current || {}), available: true, permissionGranted: granted }));
      await refresh();
      if (granted) showToast('Steps access granted. Importing your recent data.', 'success');
      else showToast('Steps access was not granted. You can change it in Health Connect settings.');
    } catch (error) {
      showToast(friendlyError(error, 'Could not connect Health Connect.'), 'error');
      await refresh();
    } finally {
      setConnecting(false);
    }
  };

  const managePermissions = async () => {
    try {
      await openHealthConnectPermissions();
    } catch (error) {
      showToast(friendlyError(error, 'Could not open Health Connect settings.'), 'error');
    }
  };

  let unavailableMessage = Platform.OS === 'web'
    ? 'Health Connect cannot connect from a website. Install the Android app to read steps from Health Connect. Google Fit remains available above for web step syncing.'
    : Platform.OS !== 'android'
      ? 'Health Connect is available in the Android app. Use Google Fit on this device where supported.'
      : 'Health Connect is not available on this phone. It requires Android 9 or later and Google Play services.';
  if (status?.updateRequired) unavailableMessage = 'Update Health Connect from Google Play, then try again.';
  if (status?.error) unavailableMessage = 'Health Connect needs an Android development or production build. It cannot run in Expo Go. Build a new Android app after setup.';

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="fitness-outline" size={20} color={colors.primary} />
        <Text style={styles.title}>Health Connect</Text>
        {checking ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <View style={[styles.badge, { backgroundColor: status?.permissionGranted ? colors.primarySoft : colors.surfaceMuted }]}>
            <Text style={[styles.badgeText, { color: status?.permissionGranted ? colors.primaryDark : colors.textMuted }]}>
              {status?.permissionGranted ? 'Connected' : 'Not connected'}
            </Text>
          </View>
        )}
      </View>

      {checking ? (
        <Text style={styles.hint}>Checking Health Connect…</Text>
      ) : !status?.available ? (
        <Text style={styles.hint}>{unavailableMessage}</Text>
      ) : (
        <>
          <Text style={styles.hint}>
            Read daily steps, active calories, and sleep totals from Health Connect for your charts and AI coach. You choose which read permissions to grant. Today's steps now refresh automatically on the Today screen and when you return to the app; use the button below to import the full 7-day history.
          </Text>
          {lastSync ? <Text style={styles.meta}>Last full sync: {new Date(lastSync).toLocaleString()}</Text> : null}
          <Text style={styles.meta}>Provider totals replace the last provider total. Phone sensor counts and manual corrections are stored separately so syncing will not double-count steps.</Text>
          <View style={styles.actions}>
            {!status.metricsGranted ? (
              <Button variant="primary" icon="link-outline" onPress={connect} loading={connecting} disabled={connecting || checking}>
                {status.permissionGranted ? 'Enable steps, calories & sleep' : 'Connect Health Connect'}
              </Button>
            ) : (
              <>
                <Button variant="primary" icon="sync-outline" onPress={() => syncNow(false)} loading={syncing} disabled={syncing || checking}>
                  Sync steps (7 days)
                </Button>
                <Button variant="ghost" icon="settings-outline" onPress={managePermissions} disabled={syncing}>
                  Manage permissions
                </Button>
              </>
            )}
          </View>
        </>
      )}
      {onOpenPrivacy ? (
        <Button variant="ghost" icon="shield-checkmark-outline" onPress={onOpenPrivacy}>
          Health data privacy details
        </Button>
      ) : null}
    </Card>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  card: { marginBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  title: { flex: 1, fontSize: font.base, fontWeight: '700', color: colors.text },
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeText: { fontSize: font.xs, fontWeight: '700' },
  hint: { fontSize: font.sm, color: colors.textMuted, lineHeight: 18, marginBottom: spacing.sm },
  meta: { fontSize: font.xs, color: colors.textMuted, lineHeight: 16, marginBottom: spacing.sm },
  actions: { gap: spacing.sm },
});
