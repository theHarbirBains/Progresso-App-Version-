import { useEffect, useRef } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_MENU_SECTIONS, type AppMenuRoute } from '../navigation/appMenuSections';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
import { SectionHeader } from './SectionHeader';
import { colors, radii, spacing, typeScale } from './theme';

const PANEL_WIDTH = 280;

interface Props {
  visible: boolean;
  activeRoute: AppMenuRoute;
  onNavigate: (route: AppMenuRoute) => void;
  onClose: () => void;
  accentColor: string;
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
export function AppSideMenu({ visible, activeRoute, onNavigate, onClose, accentColor }: Props) {
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
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Progresso</Text>
          {APP_MENU_SECTIONS.map((section) => (
            <View key={section.title} style={styles.section}>
              <SectionHeader label={section.title} />
              {section.items.map((item) => {
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
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingHorizontal: spacing.xl,
    zIndex: 1001,
    elevation: 1001,
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
  },
});
