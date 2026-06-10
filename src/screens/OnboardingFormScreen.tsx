import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
import { saveStudentProfile, uploadCV } from '@/data/profileApi';
import { StudentProfile } from '@/types';
import { colors, radius, spacing, typography } from '@/theme';

const MAX_CV_BYTES = 5 * 1024 * 1024; // 5 MB

export function OnboardingFormScreen() {
  const { user, cohortId, completeProfile } = useAuth();

  const [fullName, setFullName] = useState(user?.displayName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [cvFile, setCvFile] = useState<{ uri: string; name: string; size: number; mimeType: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const cohortName = cohortId ?? 'Unknown Cohort';

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
      setCvFile({
        uri: asset.uri,
        name: asset.name,
        size: asset.size ?? 0,
        mimeType: asset.mimeType ?? 'application/pdf',
      });
    } catch (e) {
      Alert.alert('Error', 'Could not open file picker.');
    }
  }

  function validateDOB(value: string): boolean {
    // Accepts YYYY-MM-DD
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
  }

  async function handleSubmit() {
    if (!fullName.trim()) { Alert.alert('Missing field', 'Please enter your full name.'); return; }
    if (!email.trim()) { Alert.alert('Missing field', 'Please enter your email.'); return; }
    if (!validateDOB(dateOfBirth)) { Alert.alert('Invalid date', 'Please enter your date of birth as YYYY-MM-DD.'); return; }

    setSaving(true);
    try {
      let cvUrl: string | undefined;
      let cvFilename: string | undefined;
      if (cvFile) {
        try {
          cvUrl = await uploadCV(user!.id, cvFile.uri, cvFile.name, cvFile.mimeType);
          cvFilename = cvFile.name;
        } catch (e) {
          console.warn('[Onboarding] CV upload failed, continuing without it:', e);
        }
      }

      const profile: StudentProfile = {
        userId: user!.id,
        fullName: fullName.trim(),
        email: email.trim(),
        dateOfBirth,
        cohortId: cohortId ?? '',
        cohortName,
        cvUrl,
        cvFilename,
        completedAt: new Date().toISOString(),
      };

      // Best-effort backend save — never block onboarding if it fails (e.g. demo user
      // with no backend session, or a transient error). The profile-complete flag is
      // stored locally so the student always proceeds into the app.
      try {
        await saveStudentProfile(profile);
      } catch (e) {
        console.warn('[Onboarding] profile save failed, continuing:', e);
      }

      await completeProfile();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not complete onboarding. Please try again.');
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.eyebrow}>RED ALPHA · WELCOME</Text>
          <Text style={s.title}>Complete your profile</Text>
          <Text style={s.sub}>This takes about a minute and helps us keep track of your journey.</Text>
        </View>

        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Cohort badge (read-only) */}
          <View style={s.cohortBadge}>
            <Text style={s.cohortBadgeText}>🎓 {cohortName}</Text>
          </View>

          <Field label="Full Name *">
            <TextInput
              style={s.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="e.g. Alex Chen"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </Field>

          <Field label="Email *">
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor={colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="next"
            />
          </Field>

          <Field label="Date of Birth *" hint="Format: YYYY-MM-DD">
            <TextInput
              style={s.input}
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
              placeholder="1999-06-15"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              returnKeyType="done"
            />
          </Field>

          <Field label="CV / Résumé" hint="PDF or Word · max 5 MB">
            {cvFile ? (
              <View style={s.cvAttached}>
                <Text style={s.cvIcon}>📄</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.cvName} numberOfLines={1}>{cvFile.name}</Text>
                  <Text style={s.cvSize}>{(cvFile.size / 1024).toFixed(0)} KB</Text>
                </View>
                <TouchableOpacity onPress={() => setCvFile(null)} style={s.cvRemoveBtn}>
                  <Text style={s.cvRemoveText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={s.cvPicker} onPress={handlePickCV} activeOpacity={0.8}>
                <Text style={s.cvPickerIcon}>⬆️</Text>
                <Text style={s.cvPickerText}>Upload CV</Text>
              </TouchableOpacity>
            )}
          </Field>

          <TouchableOpacity
            style={[s.submitBtn, saving && s.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={s.submitText}>Save & continue →</Text>
            )}
          </TouchableOpacity>

          <Text style={s.note}>You can update this info anytime from your profile.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  safe: { flex: 1, backgroundColor: colors.headerBg },
  scroll: { flex: 1, backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  content: { padding: spacing.xl, gap: spacing.xs, paddingBottom: spacing.xxxl * 2 },

  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl + 8,
  },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 2, color: colors.primary, marginBottom: 8 },
  title: { ...typography.headline2, color: '#FFF', marginBottom: 8 },
  sub: { ...typography.body, color: 'rgba(255,255,255,0.65)', lineHeight: 22 },

  cohortBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginBottom: spacing.lg,
  },
  cohortBadgeText: { ...typography.bodySmall, color: colors.primary, fontWeight: '700' },

  field: { gap: 6, marginBottom: spacing.md },
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

  cvPicker: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  cvPickerIcon: { fontSize: 22 },
  cvPickerText: { ...typography.body, color: colors.textSecondary, fontWeight: '600' },

  cvAttached: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.accentLight,
    borderWidth: 1,
    borderColor: colors.accent + '55',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  cvIcon: { fontSize: 22 },
  cvName: { ...typography.bodySmall, color: colors.textPrimary, fontWeight: '600' },
  cvSize: { ...typography.caption, color: colors.textSecondary },
  cvRemoveBtn: { paddingHorizontal: spacing.sm, paddingVertical: 4 },
  cvRemoveText: { ...typography.caption, color: colors.error, fontWeight: '600' },

  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { ...typography.body, color: '#FFF', fontWeight: '700' },

  note: { ...typography.caption, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.md },
});
