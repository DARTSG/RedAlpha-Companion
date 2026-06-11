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
import { fetchCertSubmissions, getStudentProfile, saveStudentProfile, submitCertification, uploadCV } from '@/data/profileApi';
import { CertSubmission, StudentProfile } from '@/types';
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
  const [certSubs, setCertSubs] = useState<CertSubmission[]>([]);
  const [certName, setCertName] = useState('');
  const [certProvider, setCertProvider] = useState('');
  const [certDate, setCertDate] = useState('');
  const [certSending, setCertSending] = useState(false);

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
    fetchCertSubmissions(user.id).then(setCertSubs).catch(() => {});
  }, [visible]);

  async function handleSubmitCert() {
    if (!certName.trim()) { Alert.alert('Missing field', 'Please enter the certification name.'); return; }
    setCertSending(true);
    try {
      await submitCertification(user!.id, certName.trim(), certProvider.trim() || undefined, certDate.trim() || undefined);
      setCertName(''); setCertProvider(''); setCertDate('');
      const subs = await fetchCertSubmissions(user!.id);
      setCertSubs(subs);
      Alert.alert('Submitted', 'Your certification was sent to Red Alpha staff for verification.');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not submit. Please try again.');
    } finally {
      setCertSending(false);
    }
  }

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

              <Field label="Certifications" hint="Verified by staff before they show">
                {certSubs.length > 0 && (
                  <View style={{ gap: spacing.xs, marginBottom: spacing.sm }}>
                    {certSubs.map((c) => (
                      <View key={c.id} style={s.cvRow}>
                        <Text style={s.cvIcon}>🏅</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={s.cvName} numberOfLines={1}>{c.name}</Text>
                          {(c.provider || c.earnedAt) ? <Text style={s.cvSize}>{[c.provider, c.earnedAt].filter(Boolean).join(' · ')}</Text> : null}
                        </View>
                        <View style={[s.certStatus, c.status === 'approved' ? s.certApproved : c.status === 'rejected' ? s.certRejected : s.certPending]}>
                          <Text style={[s.certStatusText, { color: c.status === 'approved' ? colors.accent : c.status === 'rejected' ? colors.error : colors.warning }]}>
                            {c.status === 'approved' ? 'Verified' : c.status === 'rejected' ? 'Rejected' : 'Pending'}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
                <TextInput
                  style={[s.input, { marginBottom: spacing.xs }]}
                  value={certName}
                  onChangeText={setCertName}
                  placeholder="Certification name (e.g. OSCP)"
                  placeholderTextColor={colors.textTertiary}
                />
                <TextInput
                  style={[s.input, { marginBottom: spacing.xs }]}
                  value={certProvider}
                  onChangeText={setCertProvider}
                  placeholder="Provider (e.g. OffSec)"
                  placeholderTextColor={colors.textTertiary}
                />
                <TextInput
                  style={[s.input, { marginBottom: spacing.sm }]}
                  value={certDate}
                  onChangeText={setCertDate}
                  placeholder="Date earned (YYYY-MM-DD, optional)"
                  placeholderTextColor={colors.textTertiary}
                  maxLength={10}
                />
                <TouchableOpacity style={s.cvPicker} onPress={handleSubmitCert} activeOpacity={0.8} disabled={certSending}>
                  <Text style={s.cvPickerText}>{certSending ? 'Submitting…' : '🏅 Submit for verification'}</Text>
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
  certStatus: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full },
  certApproved: { backgroundColor: colors.accentLight },
  certRejected: { backgroundColor: colors.errorLight },
  certPending: { backgroundColor: colors.warningLight },
  certStatusText: { ...typography.caption, fontWeight: '700' },
});
