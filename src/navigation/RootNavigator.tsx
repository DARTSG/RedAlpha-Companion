import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NavigationContainer, DefaultTheme, useNavigationState } from '@react-navigation/native';
import { BottomTabBarProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthContext';
import { LoginScreen } from '@/screens/LoginScreen';
import { CohortPickerScreen } from '@/screens/CohortPickerScreen';
import { OnboardingFormScreen } from '@/screens/OnboardingFormScreen';
import { HomeScreen } from '@/screens/student/HomeScreen';
import { GradesScreen } from '@/screens/student/GradesScreen';
import { CommunityScreen } from '@/screens/student/CommunityScreen';
import { UpskillingScreen } from '@/screens/student/UpskillingScreen';
import { DashboardScreen } from '@/screens/staff/DashboardScreen';
import { GrowthScreen } from '@/screens/staff/GrowthScreen';
import { AnnouncementsScreen } from '@/screens/student/AnnouncementsScreen';
import { StudentManagementScreen } from '@/screens/staff/StudentManagementScreen';
import { colors, radius, shadow, spacing, typography } from '@/theme';
import { StaffWebPortal } from '@/navigation/StaffWebPortal';

const Tab = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.surface,
    border: colors.border,
    text: colors.textPrimary,
    primary: colors.primary,
  },
};

// ---------------------------------------------------------------------------
// Shared tab config
// ---------------------------------------------------------------------------

const STUDENT_TABS = [
  { name: 'Home',       component: HomeScreen,          label: 'Home',      emoji: '🏠' },
  { name: 'Grades',     component: GradesScreen,        label: 'Grades',    emoji: '📊' },
  { name: 'Community',  component: CommunityScreen,     label: 'Community', emoji: '🏆' },
  { name: 'News',       component: AnnouncementsScreen, label: 'News',      emoji: '📣' },
  { name: 'Upskilling', component: UpskillingScreen,    label: 'Upskill',   emoji: '🎓' },
];

const STAFF_TABS = [
  { name: 'Management',    component: StudentManagementScreen, label: 'Students',  emoji: '👥' },
  { name: 'Dashboard',     component: DashboardScreen,          label: 'Dashboard', emoji: '📋' },
  { name: 'Growth',        component: GrowthScreen,             label: 'Growth',    emoji: '📈' },
  { name: 'StaffNews',     component: AnnouncementsScreen,      label: 'News',      emoji: '📣' },
];

// ---------------------------------------------------------------------------
// Animated mobile tab bar (unchanged)
// ---------------------------------------------------------------------------

function AnimatedTabItem({ isFocused, emoji, label, onPress }: {
  isFocused: boolean; emoji: string; label: string; onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(isFocused ? 1.08 : 1)).current;
  const bgAnim = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: isFocused ? 1.08 : 1, useNativeDriver: true, damping: 14, stiffness: 130 }),
      Animated.timing(bgAnim, { toValue: isFocused ? 1 : 0, duration: 180, useNativeDriver: false }),
    ]).start();
  }, [isFocused]);

  const bgColor = bgAnim.interpolate({ inputRange: [0, 1], outputRange: ['transparent', colors.primaryMid] });

  return (
    <Pressable onPress={onPress} style={tabStyles.tabItem}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Animated.View style={[tabStyles.tabContent, { backgroundColor: bgColor }]}>
          <Text style={[tabStyles.emoji, isFocused && tabStyles.emojiFocused]}>{emoji}</Text>
          <Text style={[tabStyles.label, isFocused && tabStyles.labelFocused]}>{label}</Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

function AnimatedTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[tabStyles.container, { paddingBottom: Math.max(insets.bottom, spacing.xs) }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const emoji = (options.tabBarAccessibilityLabel as string) ?? '●';
        const label = options.title ?? route.name;
        return (
          <AnimatedTabItem
            key={route.key}
            isFocused={isFocused}
            emoji={emoji}
            label={label}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
          />
        );
      })}
    </View>
  );
}

const tabStyles = StyleSheet.create({
  container: {
    flexDirection: 'row', backgroundColor: colors.surface,
    paddingTop: spacing.sm, paddingHorizontal: spacing.xs,
    borderTopWidth: 1, borderTopColor: colors.borderLight, ...shadow.md,
  },
  tabItem: { flex: 1, alignItems: 'center' },
  tabContent: { alignItems: 'center', paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.xs, borderRadius: radius.lg, minWidth: 44 },
  emoji: { fontSize: 19, opacity: 0.4 },
  emojiFocused: { opacity: 1 },
  label: { ...typography.label, color: colors.tabBarInactive, marginTop: 2, fontSize: 10 },
  labelFocused: { color: colors.primary },
});

// ---------------------------------------------------------------------------
// Web sidebar for staff
// ---------------------------------------------------------------------------

function StaffWebSidebar({
  tabs,
  activeIndex,
  onSelect,
}: {
  tabs: typeof STAFF_TABS;
  activeIndex: number;
  onSelect: (i: number) => void;
}) {
  return (
    <View style={sidebarStyles.sidebar}>
      {/* Logo / brand */}
      <View style={sidebarStyles.brand}>
        <View style={sidebarStyles.brandDot} />
        <Text style={sidebarStyles.brandText}>Red Alpha</Text>
      </View>
      <View style={sidebarStyles.brandSub}>
        <Text style={sidebarStyles.brandSubText}>Staff Portal</Text>
      </View>

      <View style={sidebarStyles.divider} />

      {/* Nav items */}
      {tabs.map((tab, i) => {
        const isActive = i === activeIndex;
        return (
          <TouchableOpacity
            key={tab.name}
            style={[sidebarStyles.navItem, isActive && sidebarStyles.navItemActive]}
            onPress={() => onSelect(i)}
            activeOpacity={0.75}
          >
            <Text style={[sidebarStyles.navEmoji, isActive && sidebarStyles.navEmojiActive]}>{tab.emoji}</Text>
            <Text style={[sidebarStyles.navLabel, isActive && sidebarStyles.navLabelActive]}>{tab.label}</Text>
            {isActive && <View style={sidebarStyles.activeBar} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const sidebarStyles = StyleSheet.create({
  sidebar: {
    width: 220,
    backgroundColor: colors.headerBg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.06)',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: 4,
  },
  brandDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: colors.primary,
  },
  brandText: {
    fontSize: 18, fontWeight: '800', color: '#FFF', letterSpacing: -0.5,
  },
  brandSub: { paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  brandSubText: { ...typography.caption, color: 'rgba(255,255,255,0.35)', fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: spacing.md },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 0,
    marginBottom: 2,
    position: 'relative',
  },
  navItemActive: { backgroundColor: 'rgba(255,255,255,0.07)' },
  navEmoji: { fontSize: 18, opacity: 0.45 },
  navEmojiActive: { opacity: 1 },
  navLabel: { ...typography.body, color: 'rgba(255,255,255,0.45)', fontWeight: '600' },
  navLabelActive: { color: '#FFF' },
  activeBar: {
    position: 'absolute',
    left: 0, top: 8, bottom: 8,
    width: 3,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
});

// ---------------------------------------------------------------------------
// Staff web layout — sidebar + content
// ---------------------------------------------------------------------------

function StaffWebLayout() {
  const [activeIndex, setActiveIndex] = useState(0);
  const ActiveScreen = STAFF_TABS[activeIndex].component;

  return (
    <View style={webStyles.root}>
      <StaffWebSidebar tabs={STAFF_TABS} activeIndex={activeIndex} onSelect={setActiveIndex} />
      <View style={webStyles.content}>
        <ActiveScreen />
      </View>
    </View>
  );
}

const webStyles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: colors.background },
  content: { flex: 1, overflow: 'hidden' as any },
});

// ---------------------------------------------------------------------------
// Tab navigators (mobile)
// ---------------------------------------------------------------------------

function StudentTabs() {
  return (
    <Tab.Navigator tabBar={(props) => <AnimatedTabBar {...props} />} screenOptions={{ headerShown: false }}>
      {STUDENT_TABS.map((t) => (
        <Tab.Screen key={t.name} name={t.name} component={t.component}
          options={{ title: t.label, tabBarAccessibilityLabel: t.emoji }} />
      ))}
    </Tab.Navigator>
  );
}

function StaffTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <AnimatedTabBar {...props} />}
      screenOptions={{ headerShown: false }}
      initialRouteName="Management"
    >
      {STAFF_TABS.map((t) => (
        <Tab.Screen key={t.name} name={t.name} component={t.component}
          options={{ title: t.label, tabBarAccessibilityLabel: t.emoji }} />
      ))}
    </Tab.Navigator>
  );
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

function StudentViewBanner() {
  const { exitStudentView } = useAuth();
  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: '#0E7090' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, paddingVertical: 7, paddingHorizontal: 14 }}>
        <Text style={{ color: '#FFF', fontSize: 12.5, fontWeight: '700' }}>👀 Student view — you're testing as a student</Text>
        <TouchableOpacity
          onPress={exitStudentView}
          style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 }}
          activeOpacity={0.8}
        >
          <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>Exit to admin</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function LoadingScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.headerBg }}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Root navigator
// ---------------------------------------------------------------------------

export function RootNavigator() {
  const { user, cohortId, profileComplete, isLoading, viewAsStudent } = useAuth();

  if (isLoading) return <LoadingScreen />;

  // In student view (admin testing), staff are routed through the student flow.
  const isStaff = (user?.role === 'staff' || user?.role === 'admin') && !viewAsStudent;
  const showBanner = Boolean(user) && viewAsStudent;

  // Staff on web gets the professional portal (no NavigationContainer needed)
  if (user && isStaff && Platform.OS === 'web') {
    return <StaffWebPortal />;
  }

  return (
    <View style={{ flex: 1 }}>
      {showBanner && <StudentViewBanner />}
      <NavigationContainer theme={navTheme}>
        {!user ? (
          <LoginScreen />
        ) : isStaff ? (
          // Staff: skip cohort picker, go straight to tabs
          <StaffTabs />
        ) : !cohortId ? (
          <CohortPickerScreen />
        ) : !profileComplete ? (
          <OnboardingFormScreen />
        ) : (
          <StudentTabs />
        )}
      </NavigationContainer>
    </View>
  );
}
