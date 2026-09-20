import { useEffect, useRef } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from './Text';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  APP_MENU_SECTIONS,
  type AppMenuRoute,
  type AppMenuSection,
} from '../navigation/appMenuSections';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
import { Badge } from './Badge';
import { GlassBackground } from './GlassBackground';
import { SectionHeader } from './SectionHeader';
import { colors, radii, spacing, typeScale } from './theme';

const PANEL_WIDTH = 280;

interface Props {
  visible: boolean;
  activeRoute: AppMenuRoute;
  onNavigate: (route: AppMenuRoute) => void;
  onClose: () => void;
  accentColor: string;
  /** Defaults to the Workout-mode APP_MENU_SECTIONS -- pass NUTRITION_MENU_SECTIONS while in Nutrition Mode. */
  sections?: AppMenuSection[];
  /** Defaults to "Progresso" -- pass a mode-branded variant (e.g. "Progresso · Nutrition") while in Nutrition Mode. */
  title?: string;
}

/**
 * Progresso's app-level global navigation drawer -- distinct from the
 * 5-destination bottom nav (quick access) and from Progress/Settings' own
 * internal section navigation (each a horizontal CategoryTabs row scoped to
 * that one screen). Section/item content lives entirely in
 * appMenuSections.ts, so adding a future destination (once its screen
 * actually exists) never requires touching this component. Built with
 * Animated/Pressable -- no drawer-navigator/gesture-handler dependency.
 */
export function AppSideMenu({
  visible,
  activeRoute,
  onNavigate,
  onClose,
  accentColor,
  sections = APP_MENU_SECTIONS,
  title = 'Progresso',
}: Props) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotionPreference();
  const translateX = useRef(new Animated.Value(-PANEL_WIDTH)).current;
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      translateX.setValue(visible ? 0 : -PANEL_WIDTH);
      return;
    }
    Animated.timing(translateX, {
      toValue: visible ? 0 : -PANEL_WIDTH,
      duration: reduceMotion ? 0 : 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, reduceMotion, translateX]);

  // Android hardware back button dismisses the menu instead of navigating
  // the screen underneath it -- only intercepted while actually open.
  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [visible, onClose]);

  return (
    <>
      {visible ? (
        <Pressable
          testID="app-menu-backdrop"
          style={styles.backdrop}
          onPress={onClose}
          accessibilityLabel="Close menu"
          accessibilityRole="button"
        />
      ) : null}
      <Animated.View
        testID="app-menu-panel"
        style={[styles.panel, { paddingTop: insets.top + spacing.xl, transform: [{ translateX }] }]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <GlassBackground variant="chrome" bordered={false} />
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>{title}</Text>
          {sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <SectionHeader label={section.title} />
              {section.items.map((item) => {
                if ('comingSoon' in item) {
                  return (
                    <View
                      key={item.label}
                      testID={`app-menu-item-${item.label}`}
                      style={[styles.item, styles.itemDisabled]}
                    >
                      <Feather name={item.icon} size={18} color={colors.textMuted} />
                      <Text style={[styles.itemLabel, styles.itemLabelDisabled]}>{item.label}</Text>
                      <Badge
                        label="Coming Soon"
                        color={colors.textMuted}
                        backgroundColor={colors.surfaceRaised}
                      />
                    </View>
                  );
                }

                const isActive = item.route === activeRoute;
                return (
                  <Pressable
                    key={item.route}
                    testID={`app-menu-item-${item.route}`}
                    style={[styles.item, isActive && { backgroundColor: colors.surfaceRaised }]}
                    onPress={() => onNavigate(item.route)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Feather
                      name={item.icon}
                      size={18}
                      color={isActive ? accentColor : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.itemLabel,
                        isActive && { color: colors.textPrimary, fontWeight: '700' },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </ScrollView>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: 1000,
    elevation: 1000,
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: PANEL_WIDTH,
    borderRightWidth: 1,
    borderRightColor: colors.glassBorderStrong,
    paddingHorizontal: spacing.xl,
    zIndex: 1001,
    elevation: 1001,
    overflow: 'hidden',
  },
  title: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
  },
  itemLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    flex: 1,
  },
  itemDisabled: {
    opacity: 0.6,
  },
  itemLabelDisabled: {
    color: colors.textMuted,
  },
});
