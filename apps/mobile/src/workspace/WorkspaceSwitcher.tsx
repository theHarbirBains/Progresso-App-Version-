import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../design/Avatar';
import { GlassBackground } from '../design/GlassBackground';
import { Text } from '../design/Text';
import { colors, fonts, radii, spacing, typeScale } from '../design/theme';
import { useReduceMotionPreference } from '../navigation/navigationTransitions';
import { useProgressTheme } from '../progress/useProgressTheme';
import { withAlpha } from '../theme/accentColor';
import { WORKSPACES, useWorkspace, type Workspace } from './WorkspaceContext';
import { useAppTheme } from '../theme/appThemeContext';

const SLIDE_MS = 260;
const PANEL_TRAVEL = 420;

/**
 * A trainer's workspace switcher: a pill in the header (their picture, the
 * workspace they're in, a chevron) that drops a "Switch Workspace" panel down
 * from the top of the screen. Picking a workspace switches to it and goes to
 * its home. Renders nothing for anyone who isn't a trainer, or outside the app.
 */
export function WorkspaceSwitcher({ testID = 'workspace-switcher' }: { testID?: string }) {
  const workspace = useWorkspace();
  const { displayName, avatarUrl } = useProgressTheme();
  const [open, setOpen] = useState(false);
  if (!workspace?.isTrainer) return null;

  const current = WORKSPACES[workspace.workspace];
  const initial = (displayName ?? '').trim().charAt(0).toUpperCase() || null;

  return (
    <>
      <TouchableOpacity
        testID={testID}
        style={styles.pill}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${current.title}, ${current.subtitle}. Switch workspace`}
      >
        <GlassBackground />
        <WorkspaceAvatar which={workspace.workspace} uri={avatarUrl} initial={initial} size={30} />
        <View style={styles.pillText}>
          <Text style={styles.pillTitle} numberOfLines={1}>
            {current.title}
          </Text>
          <Text style={styles.pillSubtitle} numberOfLines={1}>
            {current.subtitle}
          </Text>
        </View>
        <Feather name="chevron-down" size={16} color={colors.textSecondary} />
      </TouchableOpacity>

      <SwitchWorkspacePanel
        testID={`${testID}-panel`}
        visible={open}
        current={workspace.workspace}
        avatarUrl={avatarUrl}
        initial={initial}
        onClose={() => setOpen(false)}
        onPick={(next) => {
          setOpen(false);
          if (next !== workspace.workspace) workspace.switchTo(next);
        }}
      />
    </>
  );
}

// The personal workspace is the person's own picture; the trainer workspace a
// group glyph in an accent-tinted circle.
function WorkspaceAvatar({
  which,
  uri,
  initial,
  size,
}: {
  which: Workspace;
  uri?: string | null;
  initial: string | null;
  size: number;
}) {
  const accent = useAppTheme().accent.accent;
  const frame = { width: size, height: size, borderRadius: size / 2 };
  if (which === 'trainer') {
    return (
      <View style={[styles.avatar, frame, { backgroundColor: withAlpha(accent, 0.16) }]}>
        <Feather name="users" size={Math.round(size * 0.5)} color={accent} />
      </View>
    );
  }
  return (
    <View style={[styles.avatar, frame]}>
      <Avatar
        uri={uri}
        initial={initial}
        size={size}
        iconSize={Math.round(size * 0.5)}
        iconColor={colors.textSecondary}
        initialStyle={[styles.avatarInitial, { fontSize: Math.round(size * 0.4) }]}
      />
    </View>
  );
}

function SwitchWorkspacePanel({
  testID,
  visible,
  current,
  avatarUrl,
  initial,
  onClose,
  onPick,
}: {
  testID: string;
  visible: boolean;
  current: Workspace;
  avatarUrl?: string | null;
  initial: string | null;
  onClose: () => void;
  onPick: (workspace: Workspace) => void;
}) {
  const { accent: themeAccent } = useAppTheme();
  const accent = themeAccent.accent;
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotionPreference();
  const progress = useRef(new Animated.Value(0)).current;
  // Kept mounted through the close animation.
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) setMounted(true);
    if (reduceMotion) {
      progress.setValue(visible ? 1 : 0);
      if (!visible) setMounted(false);
      return undefined;
    }
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: SLIDE_MS,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
    return () => animation.stop();
  }, [visible, reduceMotion, progress]);

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: progress }]}>
        <Pressable
          testID={`${testID}-backdrop`}
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          onPress={onClose}
          accessibilityLabel="Close"
        />
      </Animated.View>
      <Animated.View
        testID={testID}
        accessibilityViewIsModal
        style={[
          styles.panel,
          { paddingTop: insets.top + spacing.lg },
          {
            transform: [
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-PANEL_TRAVEL, 0],
                }),
              },
            ],
          },
        ]}
      >
        <GlassBackground variant="chrome" bordered={false} />
        <Text style={styles.panelTitle}>Switch Workspace</Text>
        {(['personal', 'trainer'] as const).map((which) => {
          const selected = which === current;
          const info = WORKSPACES[which];
          return (
            <TouchableOpacity
              key={which}
              testID={`${testID}-${which}`}
              style={[
                styles.option,
                selected && {
                  borderColor: accent,
                  backgroundColor: withAlpha(accent, 0.08),
                },
              ]}
              onPress={() => onPick(which)}
              activeOpacity={0.8}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${info.title}, ${info.subtitle}`}
            >
              <WorkspaceAvatar which={which} uri={avatarUrl} initial={initial} size={48} />
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>{info.title}</Text>
                <Text style={styles.optionSubtitle}>{info.subtitle}</Text>
                <Text style={styles.optionDescription}>{info.description}</Text>
              </View>
              {selected ? (
                <View style={[styles.mark, { backgroundColor: accent }]}>
                  <Feather name="check" size={14} color={themeAccent.onAccent} />
                </View>
              ) : (
                <View style={[styles.mark, styles.markOff]} />
              )}
            </TouchableOpacity>
          );
        })}
        <View style={styles.grabber} />
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // ---- The header pill -------------------------------------------------------
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: spacing.md,
    borderRadius: radii.pill,
    overflow: 'hidden',
    maxWidth: '100%',
  },
  pillText: {
    flexShrink: 1,
  },
  pillTitle: {
    ...typeScale.callout,
    fontFamily: fonts.semibold,
    color: colors.textPrimary,
  },
  pillSubtitle: {
    ...typeScale.caption,
    color: colors.textSecondary,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
  },
  avatarInitial: {
    fontFamily: fonts.display,
    color: colors.textSecondary,
  },

  // ---- The panel that drops from the top -------------------------------------
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
    borderBottomLeftRadius: radii.xl,
    borderBottomRightRadius: radii.xl,
    overflow: 'hidden',
  },
  panelTitle: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.surfaceLift,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  optionSubtitle: {
    ...typeScale.callout,
    color: colors.textSecondary,
  },
  optionDescription: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    marginTop: 2,
  },
  mark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markOff: {
    borderWidth: 1.5,
    borderColor: colors.textMuted,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
  },
});
