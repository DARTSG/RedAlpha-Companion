import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '@/auth/AuthContext';
import { getStudentProfile, saveStudentProfile, uploadCV } from '@/data/profileApi';
import { StudentProfile } from '@/types';
import { colors, radius, spacing, typography } from '@/theme';

const MAX_CV_BYTES = 5 * 1024 * 1024;

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function ProfileScreen({ visible, onClose }: Props) {
  const { user, cohortId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [cohortName, setCohortName] = useState('');
  const [cvUrl, setCvUrl] = useState<string | undefined>();
  const [cvFilename, setCvFilename] = useState<string | undefined>();
  const [newCvFile, setNewCvFile] = useState<{ uri: string; name: string; size: number; mimeType: string } | null>(null);

  useEffect(() => {
    if (!visible || !user) return;
    setLoading(true);
    getStudentProfile(user.id).then((profile) => {
      if (profile) {
        setFullName(profile.fullName);
        setEmail(profile.email);
        setDateOfBirth(profile.dateOfBirth);
        setCohortName(profile.cohortName);
        setCvUrl(profile.cvUrl);
        setCvFilename(profile.cvFilename);
      } else {
        setFullName(user.displayName ?? '');
        setEmail(user.email ?? '');
        setCohortName(cohortId ?? '');
      }
      setLoading(false);
    });
  }, [visible]);

  async function handlePickCV() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      if (asset.size && asset.size > MAX_CV_BYTES) {
        Alert.alert('File too large', 'Please upload a CV under 5 MB.');
        return;
      }
      setNewCvFile({ uri: asset.uri, name: asset.name, size: asset.size ?? 0, mimeType: asset.mimeType ?? 'application/pdf' });
    } catch {
      Alert.alert('Error', 'Could not open file picker.');
    }
  }

  async function handleSave() {
    if (!fullName.trim()) { Alert.alert('Missing field', 'Please enter your full name.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) { Alert.alert('Invalid date', 'Date of birth must be YYYY-MM-DD.'); return; }
    setSaving(true);
    try {
      let finalCvUrl = cvUrl;
      let finalCvFilename = cvFilename;
      if (newCvFile) {
        finalCvUrl = await uploadCV(user!.id, newCvFile.uri, newCvFile.name, newCvFile.mimeType);
        finalCvFilename = newCvFile.name;
      }
      const profile: StudentProfile = {
        userId: user!.id,
        fullName: fullName.trim(),
        email: email.trim(),
        dateOfBirth,
        cohortId: cohortId ?? '',
        cohortName,
        cvUrl: finalCvUrl,
        cvFilename: finalCvFilename,
        completedAt: new Date().toISOString(),
      };
      await saveStudentProfile(profile);
      setNewCvFile(null);
      Alert.alert('Saved', 'Your profile has been updated.', [{ text: 'OK', onPress: onClose }]);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Header */}
          <View style={s.header}>
            <TouchableOpacity onPress={onClose} style={s.cancelBtn}>
              <Text style={s.cancelText}>Close</Text>
            </TouchableOpacity>
            <Text style={s.headerTitle}>My Profile</Text>
            <TouchableOpacity onPress={handleSave} style={s.saveBtn} disabled={saving}>
              {saving ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={s.saveText}>Save</Text>}
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={s.center}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : (
            <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
              {/* Cohort badge */}
              <View style={s.cohortBadge}>
                <Text style={s.cohortBadgeText}>🎓 {cohortName || cohortId}</Text>
              </View>

              <Field label="Full Name">
                <TextInput
                  style={s.input}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Full name"
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="words"
                />
              </Field>

              <Field label="Email" hint="Contact staff to change">
                <View style={[s.input, s.readOnly]}>
                  <Text style={s.readOnlyText}>{email}</Text>
                </View>
              </Field>

              <Field label="Date of Birth" hint="YYYY-MM-DD">
                <TextInput
                  style={s.input}
                  value={dateOfBirth}
                  onChangeText={setDateOfBirth}
                  placeholder="1999-06-15"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                />
              </Field>

              <Field label="CV / Résumé" hint="PDF or Word · max 5 MB">
                {/* Current CV */}
                {(cvFilename || cvUrl) && !newCvFile && (
                  <View style={s.cvRow}>
                    <Text style={s.cvIcon}>📄</Text>
                    <Text style={s.cvName} numberOfLines={1}>{cvFilename ?? 'Current CV'}</Text>
                    {cvUrl && (
                      <TouchableOpacity onPress={() => Linking.openURL(cvUrl!)} style={s.cvViewBtn}>
                        <Text style={s.cvViewText}>View</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                {/* New CV selected */}
                {newCvFile && (
                  <View style={[s.cvRow, { backgroundColor: colors.accentLight, borderColor: colors.accent + '55' }]}>
                    <Text style={s.cvIcon}>📄</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cvName} numberOfLines={1}>{newCvFile.name}</Text>
                      <Text style={s.cvSize}>{(newCvFile.size / 1024).toFixed(0)} KB · new</Text>
                    </View>
                    <TouchableOpacity onPress={() => setNewCvFile(null)} style={s.cvRemoveBtn}>
                      <Text style={s.cvRemoveText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <TouchableOpacity style={s.cvPicker} onPress={handlePickCV} activeOpacity={0.8}>
                  <Text style={s.cvPickerText}>{cvFilename || cvUrl ? '🔄 Replace CV' : '⬆️ Upload CV'}</Text>
                </TouchableOpacity>
              </Field>

              <View style={{ height: spacing.xxxl }} />
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={s.field}>
      <View style={s.labelRow}>
        <Text style={s.label}>{label}</Text>
        {hint && <Text style={s.hint}>{hint}</Text>}
      </View>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  headerTitle: { ...typography.heading, color: colors.textPrimary },
  cancelBtn: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  cancelText: { ...typography.body, color: colors.textSecondary },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    minWidth: 64,
    alignItems: 'center',
  },
  saveText: { ...typography.bodySmall, color: '#FFF', fontWeight: '700' },

  scroll: { flex: 1 },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl * 2 },

  cohortBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginBottom: spacing.lg,
  },
  cohortBadgeText: { ...typography.bodySmall, color: colors.primary, fontWeight: '700' },

  field: { gap: 6, marginBottom: spacing.lg },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { ...typography.bodySmall, color: colors.textPrimary, fontWeight: '600' },
  hint: { ...typography.caption, color: colors.textTertiary },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    ...typography.body,
    color: colors.textPrimary,
  },
  readOnly: { backgroundColor: colors.surfaceAlt },
  readOnlyText: { ...typography.body, color: colors.textSecondary },

  cvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cvIcon: { fontSize: 20 },
  cvName: { flex: 1, ...typography.bodySmall, color: colors.textPrimary, fontWeight: '600' },
  cvSize: { ...typography.caption, color: colors.textSecondary },
  cvViewBtn: { paddingHorizontal: spacing.sm, paddingVertical: 3 },
  cvViewText: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  cvRemoveBtn: { paddingHorizontal: spacing.sm, paddingVertical: 3 },
  cvRemoveText: { fontSize: 14, color: colors.error, fontWeight: '700' },
  cvPicker: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  cvPickerText: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600' },
});
