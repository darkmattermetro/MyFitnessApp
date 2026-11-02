import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, spacing } from '../theme/colors';

export default function FoodCameraModal({ visible, onClose, onCapture, onError }) {
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const capture = async () => {
    if (!cameraRef.current || !ready || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.6 });
      if (!photo?.base64) throw new Error('The camera did not return image data. Please try again.');
      onCapture({
        uri: photo.uri,
        base64: photo.base64,
        mimeType: 'image/jpeg',
        width: photo.width,
        height: photo.height,
      });
      onClose();
    } catch (error) {
      onError?.(error.message || 'Could not capture the photo.');
    } finally {
      setCapturing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        {permission?.granted ? (
          <>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              mode="picture"
              onCameraReady={() => setReady(true)}
            />
            <View style={styles.overlay}>
              <View style={styles.topBar}>
                <TouchableOpacity style={styles.close} onPress={onClose} accessibilityLabel="Close camera">
                  <Ionicons name="close" size={24} color={colors.white} />
                </TouchableOpacity>
                <Text style={styles.tip}>Fit the full plate in the frame</Text>
              </View>
              <TouchableOpacity
                style={[styles.shutter, (!ready || capturing) && styles.shutterDisabled]}
                onPress={capture}
                disabled={!ready || capturing}
                accessibilityLabel="Take meal photo"
              >
                {capturing ? <ActivityIndicator color={colors.primary} /> : <View style={styles.shutterInner} />}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.permission}>
            <Ionicons name="camera-outline" size={34} color={colors.primary} />
            <Text style={styles.permissionTitle}>Allow camera access</Text>
            <Text style={styles.permissionHint}>OpenFit uses this photo to estimate meal ingredients and portions. You can review the description before logging.</Text>
            <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
              <Text style={styles.permissionButtonText}>Allow camera</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose}><Text style={styles.cancel}>Cancel</Text></TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050505' },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', padding: spacing.lg },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingTop: spacing.xl },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  tip: { color: colors.white, fontSize: font.sm, marginLeft: spacing.md, backgroundColor: 'rgba(0,0,0,0.48)', padding: spacing.sm, borderRadius: 12 },
  shutter: { alignSelf: 'center', width: 76, height: 76, borderRadius: 38, borderWidth: 5, borderColor: colors.white, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl },
  shutterDisabled: { opacity: 0.55 },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.white },
  permission: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.background },
  permissionTitle: { color: colors.text, fontSize: font.lg, fontWeight: '700', marginTop: spacing.md },
  permissionHint: { color: colors.textMuted, fontSize: font.sm, lineHeight: 21, textAlign: 'center', marginVertical: spacing.md },
  permissionButton: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: 20, backgroundColor: colors.primary },
  permissionButtonText: { color: colors.white, fontWeight: '700' },
  cancel: { color: colors.textMuted, marginTop: spacing.lg },
});
