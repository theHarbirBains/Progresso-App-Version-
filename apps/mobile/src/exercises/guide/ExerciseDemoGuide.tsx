import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';
import { AppCard } from '../../design/AppCard';
import { PrimaryButton } from '../../design/Button';
import { SegmentedControl } from '../../design/SegmentedControl';
import { Text } from '../../design/Text';
import { colors, guideColors, radii, spacing, typeScale } from '../../design/theme';
import { useProfileIfAny } from '../../profile/profileContext';
import { heatmapFor } from '../../progress/MuscleActivityFigure';
import { withAlpha } from '../../theme/accentColor';
import type { ExerciseGuide } from '../builtinExtras';
import { EQUIPMENT_LABELS } from '../equipment';
import { BUILTIN_GUIDES, type TechniqueCard } from '../illustrations/builtinGuides.generated';
import {
  guidePhases,
  hasIllustration,
  illustrationFor,
  muscleMapFor,
} from '../illustrations/exerciseArt';
import { Frame, usePrefix } from '../illustrations/ExerciseIllustration';
import { sideOf } from '../illustrations/muscleMap';
import { EXERCISE_RENDERS } from '../illustrations/renders.generated';
import { TechniqueVisual } from '../illustrations/TechniqueVisuals';
import { LOAD_TYPE_LABELS, type LoadType } from '../machineLoad';
import { movementPatternLabel } from '../movementCategories';
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from '../muscleGroups';
import { figureSexFor } from '../MuscleBrowseStrip';
import { ExerciseVideo } from '../videos/ExerciseVideo';
import type { ExerciseDemo } from './exerciseDemos.generated';

type Section = 'howto' | 'muscles' | 'tips';

/** An exercise's name as a title over its variation: "Chest-Supported T-Bar Row" over "Upper Handles (Pronated Grip)". */
export function guideTitle(name: string): { title: string; variant: string | null } {
  const at = name.indexOf(' — ');
  return at < 0
    ? { title: name, variant: null }
    : { title: name.slice(0, at), variant: name.slice(at + 3) };
}

export interface GuideStep {
  title: string;
  text: string;
}

/**
 * Step-by-Step, from the exercise's own guide: Set Up (its first setup step), Starting Position
 * (the rest of its setup), the movement (named as its drawing's middle phase is: "Row", "Press")
 * and Control & Return (its last step) -- a step with nothing to say is left out.
 */
export function guideSteps(
  guide: Pick<ExerciseGuide, 'slug' | 'setupSteps' | 'executionSteps'>,
): GuideStep[] {
  const [setUp, ...starting] = guide.setupSteps;
  const moves = guide.executionSteps;
  const phases = guide.slug && hasIllustration(guide.slug) ? guidePhases(guide.slug) : [];
  const action = phases.length === 3 ? phases[1].label : 'Movement';
  const steps: GuideStep[] = [
    { title: 'Set Up', text: setUp ?? '' },
    { title: 'Starting Position', text: starting.join(' ') },
    { title: action, text: (moves.length > 1 ? moves.slice(0, -1) : moves).join(' ') },
    { title: 'Control & Return', text: moves.length > 1 ? moves[moves.length - 1] : '' },
  ];
  return steps.filter((step) => step.text.trim().length > 0);
}

/** A loop's length as a clock: 18 -> "0:18". */
export function clockText(seconds: number): string {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** The muscles it works, by group (for the figure) and by name (for the chips and key). */
function musclesOf(guide: ExerciseGuide) {
  const map = muscleMapFor(guide.slug);
  if (map) {
    return {
      primary: map.primary,
      secondary: map.secondary.filter((group) => !map.primary.includes(group)),
      primaryNames: map.primaryNames,
      secondaryNames: map.secondaryNames,
    };
  }
  const secondary = guide.secondaryMuscleGroups.filter((group) => group !== guide.muscleGroup);
  return {
    primary: [guide.muscleGroup],
    secondary,
    primaryNames: [MUSCLE_GROUP_LABELS[guide.muscleGroup]],
    secondaryNames: secondary.map((group) => MUSCLE_GROUP_LABELS[group]),
  };
}

/** Do and Avoid side by side only where each gets this much room; otherwise one over the other. */
const MIN_TIP_COLUMN = 168;
/** How tall the muscles figure draws. */
const FIGURE_HEIGHT = 230;
/** How much of the scroll the sticky tabs cover, until they've measured themselves. */
const TABS_HEIGHT = 68;

/**
 * The 3D Exercise Guide (Harbir's design, November 2026) -- for the exercises in
 * tools/exercise-guides/demos.json, the pilot first: its demonstration playing by itself, muted,
 * inline and round and round (Pause and, where it has a sound track, Sound in its corner), its
 * name over its variation, the muscles it targets and a line on what it is; then How To, Muscles
 * and Tips, which stay at the top as it scrolls and follow it. How To: Equipment & Details (the
 * machine, how it's loaded, the movement, the grip and handles -- what makes this variation what
 * it is, with its grip and setup pictures), Watch Full Demonstration, and Step-by-Step. Muscles:
 * the anatomy figure with its primary muscles in coral and its secondary ones in amber. Tips: Do
 * (its Key Tips) and Avoid (its common mistakes). Everything is the exercise's own guide, from the
 * catalogue; until its demonstration is rendered, its drawing stands where the video will be,
 * saying so.
 */
export function ExerciseDemoGuide({
  guide,
  demo,
  accent,
  onNameScrolledAway,
  testID = 'exercise-guide',
}: {
  guide: ExerciseGuide;
  demo: ExerciseDemo;
  accent: string;
  /** Told when the name at the top scrolls out of view (true) and back (false): a header can show it meanwhile. */
  onNameScrolledAway?: (away: boolean) => void;
  testID?: string;
}) {
  const window = useWindowDimensions();
  const [pageWidth, setPageWidth] = useState(window.width);
  const width = Math.max(0, pageWidth - spacing.xl * 2);
  const heroHeight = Math.round(width / demo.aspect);
  const { title, variant } = guideTitle(guide.name);
  const muscles = musclesOf(guide);
  const steps = guideSteps(guide);
  const own = guide.slug ? BUILTIN_GUIDES[guide.slug] : undefined;
  const tips = own?.tips ?? [];
  const mistakes = guide.commonMistakes;
  const drawn = !guide.illustrationUrl && hasIllustration(guide.slug);
  const technique = drawn && own ? own.technique : [];

  const sections: { value: Section; label: string; icon: (color: string) => ReactNode }[] = [
    {
      value: 'howto',
      label: 'How To',
      icon: (color) => <Feather name="play" size={14} color={color} />,
    },
    {
      value: 'muscles',
      label: 'Muscles',
      icon: (color) => <MaterialCommunityIcons name="arm-flex-outline" size={16} color={color} />,
    },
    ...(tips.length > 0 || mistakes.length > 0
      ? [
          {
            value: 'tips' as const,
            label: 'Tips',
            icon: (color: string) => (
              <MaterialCommunityIcons name="lightbulb-on-outline" size={16} color={color} />
            ),
          },
        ]
      : []),
  ];

  // Where each section starts, the name's bottom and the hero's, in the scroll's own terms.
  const scrollRef = useRef<ScrollViewInstance>(null);
  const sectionTop = useRef<Partial<Record<Section, number>>>({});
  const titleBottom = useRef(0);
  const tabsHeight = useRef(TABS_HEIGHT);
  const [section, setSection] = useState<Section>('howto');
  // A tab tapped holds until the page is next dragged (a short last section can't reach the top).
  const tapped = useRef(false);
  const [heroInView, setHeroInView] = useState(true);
  const [fullScreen, setFullScreen] = useState(false);
  const nameAway = useRef(false);
  const tellNameAway = useRef(onNameScrolledAway);
  tellNameAway.current = onNameScrolledAway;
  // Gone, the header goes back to its own title.
  useEffect(() => () => tellNameAway.current?.(false), []);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    const y = contentOffset.y;
    // Before the page has measured itself, the name is where it starts: in view.
    const away = titleBottom.current > 0 && y >= titleBottom.current;
    if (away !== nameAway.current) {
      nameAway.current = away;
      tellNameAway.current?.(away);
    }
    const heroShown = y < heroHeight;
    setHeroInView((was) => (was === heroShown ? was : heroShown));
    if (tapped.current) return;
    const atEnd = y + layoutMeasurement.height >= contentSize.height - 4;
    let current: Section = 'howto';
    for (const { value } of sections) {
      const top = sectionTop.current[value];
      if (top !== undefined && y + tabsHeight.current + spacing.sm >= top) current = value;
    }
    if (atEnd && y > 0) current = sections[sections.length - 1].value;
    setSection((was) => (was === current ? was : current));
  };

  const goTo = (value: Section) => {
    setSection(value);
    tapped.current = true;
    const top = sectionTop.current[value] ?? 0;
    scrollRef.current?.scrollTo({ y: Math.max(0, top - tabsHeight.current), animated: true });
  };

  const placed = (value: Section) => (event: LayoutChangeEvent) => {
    sectionTop.current[value] = event.nativeEvent.layout.y;
  };

  const sideBySide = (width - spacing.md) / 2 >= MIN_TIP_COLUMN;

  return (
    <View testID={`${testID}-demo-guide`} style={styles.page}>
      <ScrollView
        ref={scrollRef}
        testID={`${testID}-scroll`}
        keyboardDismissMode="on-drag"
        stickyHeaderIndices={[1]}
        onScroll={onScroll}
        onScrollBeginDrag={() => {
          tapped.current = false;
        }}
        scrollEventThrottle={32}
        onLayout={(event) => setPageWidth(event.nativeEvent.layout.width)}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View
          testID={`${testID}-top`}
          onLayout={(event) => {
            titleBottom.current = event.nativeEvent.layout.y + event.nativeEvent.layout.height;
          }}
        >
          <Hero
            guide={guide}
            demo={demo}
            width={width}
            height={heroHeight}
            accent={accent}
            active={heroInView && !fullScreen}
            testID={testID}
          />
          <Text testID={`${testID}-title`} style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {variant ? (
            <Text testID={`${testID}-variant`} style={styles.variant}>
              {variant}
            </Text>
          ) : null}
          <View style={styles.chips}>
            {muscles.primaryNames.map((name) => (
              <View key={name} testID={`${testID}-chip-${name}`} style={styles.chip}>
                <Text style={styles.chipText}>{name}</Text>
              </View>
            ))}
          </View>
          {guide.summary ? (
            <Text testID={`${testID}-summary`} style={styles.summary}>
              {guide.summary}
            </Text>
          ) : null}
        </View>

        <View
          style={styles.tabsBar}
          onLayout={(event) => {
            tabsHeight.current = event.nativeEvent.layout.height;
          }}
        >
          <SegmentedControl
            testID={`${testID}-tabs`}
            options={sections}
            value={section}
            onChange={goTo}
            accentColor={accent}
            stretch
          />
        </View>

        <View onLayout={placed('howto')} style={styles.section}>
          <EquipmentCard
            guide={guide}
            demo={demo}
            primaryNames={muscles.primaryNames}
            technique={technique}
            width={width}
            accent={accent}
            testID={testID}
          />
          {demo.video ? (
            <PrimaryButton
              testID={`${testID}-full-demo`}
              label={`Watch Full Demonstration${demo.seconds ? ` (${clockText(demo.seconds)})` : ''}`}
              icon="play"
              onPress={() => setFullScreen(true)}
              accentColor={accent}
            />
          ) : null}
          {steps.length > 0 ? (
            <AppCard testID={`${testID}-steps`}>
              <SectionHeader icon="format-list-numbered" title="Step-by-Step" accent={accent} />
              {steps.map((step, i) => (
                <View
                  key={step.title}
                  testID={`${testID}-step-${i + 1}`}
                  style={[styles.step, i > 0 && styles.stepDivided]}
                >
                  {demo.steps[i] ? (
                    <Image
                      source={demo.steps[i]}
                      style={styles.stepStill}
                      contentFit="cover"
                      accessibilityIgnoresInvertColors
                    />
                  ) : null}
                  <View style={[styles.stepNumber, { borderColor: accent }]}>
                    <Text style={[styles.stepNumberText, { color: accent }]}>{i + 1}</Text>
                  </View>
                  <View style={styles.stepText}>
                    <Text style={styles.stepTitle}>{step.title}</Text>
                    <Text style={styles.stepBody}>{step.text}</Text>
                  </View>
                </View>
              ))}
            </AppCard>
          ) : null}
        </View>

        <View onLayout={placed('muscles')} style={styles.section}>
          <AppCard testID={`${testID}-muscles`}>
            <SectionHeader icon="arm-flex-outline" title="Muscles Worked" accent={accent} />
            <View style={styles.musclesRow}>
              <GuideMuscleFigure
                primary={muscles.primary}
                secondary={muscles.secondary}
                side={sideOf(guide.muscleGroup)}
                height={FIGURE_HEIGHT}
                testID={`${testID}-muscle-figure`}
              />
              <View style={styles.muscleKey}>
                <MuscleKey
                  color={guideColors.primary}
                  label="Primary Muscles"
                  names={muscles.primaryNames}
                  testID={`${testID}-primary`}
                />
                {muscles.secondaryNames.length > 0 ? (
                  <MuscleKey
                    color={guideColors.secondary}
                    label="Secondary Muscles"
                    names={muscles.secondaryNames}
                    testID={`${testID}-secondary`}
                  />
                ) : null}
              </View>
            </View>
          </AppCard>
        </View>

        {tips.length > 0 || mistakes.length > 0 ? (
          <View onLayout={placed('tips')} style={[styles.section, sideBySide && styles.tipsRow]}>
            {tips.length > 0 ? (
              <TipsCard kind="do" items={tips} wide={!sideBySide} testID={`${testID}-do`} />
            ) : null}
            {mistakes.length > 0 ? (
              <TipsCard
                kind="avoid"
                items={mistakes}
                wide={!sideBySide}
                testID={`${testID}-avoid`}
              />
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {demo.video ? (
        <FullDemonstration
          visible={fullScreen}
          onClose={() => setFullScreen(false)}
          demo={demo}
          exerciseName={guide.name}
          accent={accent}
          testID={`${testID}-full`}
        />
      ) : null}
    </View>
  );
}

/**
 * The top of the guide: its demonstration, looping, with its length in a corner -- or, until it's
 * rendered, the exercise's movement as drawn (its 3D render's last frame, else its drawing's),
 * saying the demonstration is on its way.
 */
function Hero({
  guide,
  demo,
  width,
  height,
  accent,
  active,
  testID,
}: {
  guide: ExerciseGuide;
  demo: ExerciseDemo;
  width: number;
  height: number;
  accent: string;
  active: boolean;
  testID: string;
}) {
  const prefix = usePrefix();
  if (demo.video) {
    return (
      <View style={styles.hero}>
        <ExerciseVideo
          urls={{ video: demo.video, poster: demo.poster }}
          width={width}
          height={height}
          accentColor={accent}
          exerciseName={guide.name}
          loop
          sound={demo.audio}
          active={active}
          testID={`${testID}-video`}
        />
        {demo.seconds ? (
          <View pointerEvents="none" style={styles.duration}>
            <Text testID={`${testID}-duration`} style={styles.durationText}>
              {clockText(demo.seconds)}
            </Text>
          </View>
        ) : null}
      </View>
    );
  }
  const rendered = guide.slug ? EXERCISE_RENDERS[guide.slug] : undefined;
  const drawn = rendered ? null : illustrationFor(guide.slug);
  const side = Math.min(height - spacing.lg, width);
  let art = null;
  if (rendered) {
    art = (
      <Image
        source={rendered.frames[rendered.frames.length - 1]}
        style={{ width: side, height: side }}
        contentFit="contain"
        accessibilityIgnoresInvertColors
      />
    );
  } else if (drawn) {
    const vb = drawn.viewBox;
    const scale = Math.min(side / vb.width, side / vb.height);
    art = (
      <Frame
        frame={drawn.frames[drawn.frames.length - 1]}
        viewBox={vb}
        width={Math.round(vb.width * scale)}
        height={Math.round(vb.height * scale)}
        prefix={prefix}
      />
    );
  }
  return (
    <View
      testID={`${testID}-hero-still`}
      style={[styles.hero, styles.heroStill, { width, height }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${guide.name}. Its 3D demonstration is on its way.`}
    >
      {art}
      <View style={styles.comingBadge}>
        <Feather name="video" size={12} color={colors.textSecondaryBright} />
        <Text style={styles.comingText}>3D demonstration on its way</Text>
      </View>
    </View>
  );
}

/** A card's heading: its icon in the accent, its title, and a rule under them. */
function SectionHeader({
  icon,
  title,
  accent,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  accent: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <MaterialCommunityIcons name={icon} size={20} color={accent} />
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
    </View>
  );
}

/**
 * Equipment & Details: the machine alone, set up as this exercise uses it (once rendered), beside
 * what it is -- the equipment, how it's loaded, the movement, the grip, the handles and what it
 * targets -- then its grip and setup pictures with a line each (its Technique & Setup).
 */
function EquipmentCard({
  guide,
  demo,
  primaryNames,
  technique,
  width,
  accent,
  testID,
}: {
  guide: ExerciseGuide;
  demo: ExerciseDemo;
  primaryNames: string[];
  technique: readonly TechniqueCard[];
  width: number;
  accent: string;
  testID: string;
}) {
  const loading = guide.loadType ? LOAD_TYPE_LABELS[guide.loadType as LoadType] : undefined;
  const facts: {
    key: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    label: string;
    value: string | null | undefined;
  }[] = [
    {
      key: 'equipment',
      icon: 'dumbbell',
      label: 'Equipment',
      value: guide.equipment ? EQUIPMENT_LABELS[guide.equipment] : null,
    },
    { key: 'loading', icon: 'weight', label: 'Loading', value: loading },
    {
      key: 'movement',
      icon: 'swap-horizontal',
      label: 'Movement',
      value: movementPatternLabel(guide.movementPattern),
    },
    { key: 'grip', icon: 'hand-back-right-outline', label: 'Grip', value: guide.grip },
    { key: 'handles', icon: 'link-variant', label: 'Handles', value: guide.attachment },
    { key: 'primary', icon: 'target', label: 'Primary', value: primaryNames.join(', ') },
  ];
  const shown = facts.filter((fact) => fact.value);
  const picture = demo.equipment ? Math.round(width * 0.4) : 0;
  return (
    <AppCard testID={`${testID}-equipment`}>
      <SectionHeader icon="dumbbell" title="Equipment & Details" accent={accent} />
      <View style={styles.equipmentRow}>
        {demo.equipment ? (
          <Image
            testID={`${testID}-equipment-picture`}
            source={demo.equipment}
            style={{ width: picture, height: picture }}
            contentFit="contain"
            accessibilityIgnoresInvertColors
          />
        ) : null}
        <View style={styles.facts}>
          {shown.map((fact, i) => (
            <View
              key={fact.key}
              testID={`${testID}-fact-${fact.key}`}
              style={[styles.fact, i > 0 && styles.factDivided]}
            >
              <MaterialCommunityIcons name={fact.icon} size={16} color={accent} />
              <Text style={styles.factLabel}>{fact.label}</Text>
              <Text style={styles.factValue}>{fact.value}</Text>
            </View>
          ))}
        </View>
      </View>
      {technique.length > 0 && guide.slug ? (
        <View style={styles.technique}>
          {technique.map((card, i) => (
            <View key={card.title} testID={`${testID}-setup-${i}`} style={styles.techniqueRow}>
              <TechniqueVisual slug={guide.slug!} visual={card.visual} accent={accent} size={72} />
              <View style={styles.techniqueText}>
                <Text style={styles.stepTitle}>{card.title}</Text>
                <Text style={styles.stepBody}>{card.text}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </AppCard>
  );
}

/**
 * Harbir's anatomy figure (the Muscles tab's heat-map art, a woman's for a woman), from the side
 * the exercise's main muscle is seen from: its primary muscle groups in coral, its secondary ones
 * in amber, the rest the figure's own grey.
 */
function GuideMuscleFigure({
  primary,
  secondary,
  side,
  height,
  testID,
}: {
  primary: readonly MuscleGroup[];
  secondary: readonly MuscleGroup[];
  side: 'front' | 'back';
  height: number;
  testID: string;
}) {
  const art = heatmapFor(figureSexFor(useProfileIfAny()?.gender));
  if (!art) return null;
  const view = art[side];
  const width = Math.round(height * view.aspect);
  const tints = (Object.keys(view.layers) as MuscleGroup[]).flatMap((group) => {
    const color = primary.includes(group)
      ? guideColors.primary
      : secondary.includes(group)
        ? guideColors.secondary
        : null;
    return color ? [{ group, source: view.layers[group]!, color }] : [];
  });
  return (
    <View
      testID={testID}
      style={{ width, height }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Muscles worked, from the ${side}.`}
    >
      <Image
        source={view.body}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        accessibilityElementsHidden
      />
      {tints.map(({ group, source, color }) => (
        <Image
          key={group}
          testID={`${testID}-${group}`}
          source={source}
          tintColor={color}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
        />
      ))}
    </View>
  );
}

/** One line of the muscles' key: its colour, "Primary Muscles", and the muscles. */
function MuscleKey({
  color,
  label,
  names,
  testID,
}: {
  color: string;
  label: string;
  names: readonly string[];
  testID: string;
}) {
  return (
    <View testID={testID} style={styles.keyRow}>
      <View style={[styles.keyDot, { backgroundColor: color }]} />
      <View style={styles.keyText}>
        <Text style={styles.stepTitle}>{label}</Text>
        <Text style={styles.stepBody}>{names.join(', ')}</Text>
      </View>
    </View>
  );
}

/** Do (its Key Tips) or Avoid (its common mistakes), each in its own colour. */
function TipsCard({
  kind,
  items,
  wide,
  testID,
}: {
  kind: 'do' | 'avoid';
  items: readonly string[];
  wide: boolean;
  testID: string;
}) {
  const color = kind === 'do' ? guideColors.do : guideColors.avoid;
  return (
    <View
      testID={testID}
      style={[
        styles.tipsCard,
        !wide && styles.tipsColumn,
        { borderColor: withAlpha(color, 0.55), backgroundColor: withAlpha(color, 0.07) },
      ]}
    >
      <View style={styles.tipsHeader}>
        <Feather name={kind === 'do' ? 'check-circle' : 'x-circle'} size={20} color={color} />
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {kind === 'do' ? 'Do' : 'Avoid'}
        </Text>
      </View>
      {items.map((item) => (
        <View key={item} style={styles.tipRow}>
          <Feather name={kind === 'do' ? 'check' : 'x'} size={15} color={color} />
          <Text style={styles.tipText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

/** Watch Full Demonstration: the demonstration across the whole screen, looping, until closed. */
function FullDemonstration({
  visible,
  onClose,
  demo,
  exerciseName,
  accent,
  testID,
}: {
  visible: boolean;
  onClose: () => void;
  demo: ExerciseDemo;
  exerciseName: string;
  accent: string;
  testID: string;
}) {
  const window = useWindowDimensions();
  const width = window.width;
  const height = Math.min(Math.round(width / demo.aspect), window.height);
  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'landscape']}
    >
      <View testID={testID} style={styles.fullPage}>
        {demo.video ? (
          <ExerciseVideo
            urls={{ video: demo.video, poster: demo.poster }}
            width={width}
            height={height}
            accentColor={accent}
            exerciseName={exerciseName}
            loop
            sound={demo.audio}
            testID={`${testID}-video`}
          />
        ) : null}
        <TouchableOpacity
          testID={`${testID}-close`}
          onPress={onClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={styles.fullClose}
        >
          <Feather name="x" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  hero: {
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  heroStill: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  comingBadge: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: withAlpha(colors.background, 0.7),
  },
  comingText: {
    ...typeScale.caption,
    color: colors.textSecondaryBright,
  },
  duration: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: withAlpha(colors.background, 0.7),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorderStrong,
  },
  durationText: {
    ...typeScale.statSmall,
    color: colors.textPrimary,
  },
  title: {
    ...typeScale.screenTitle,
    color: colors.textPrimary,
    marginTop: spacing.lg,
  },
  variant: {
    ...typeScale.body,
    color: colors.textSecondaryBright,
    marginTop: 2,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: withAlpha(guideColors.chip, 0.18),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: withAlpha(guideColors.chip, 0.5),
  },
  chipText: {
    ...typeScale.label,
    color: colors.textPrimary,
  },
  summary: {
    ...typeScale.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  tabsBar: {
    paddingVertical: spacing.md,
    backgroundColor: withAlpha(colors.background, 0.94),
  },
  section: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.md,
    marginBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  sectionTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  equipmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  facts: {
    flex: 1,
  },
  fact: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  factDivided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  factLabel: {
    ...typeScale.secondary,
    color: colors.textSecondary,
    width: 76,
  },
  factValue: {
    ...typeScale.secondary,
    color: colors.textPrimary,
    flex: 1,
  },
  technique: {
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  techniqueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  techniqueText: {
    flex: 1,
    gap: 2,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  stepDivided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  stepStill: {
    width: 104,
    height: 72,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceRaised,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    ...typeScale.label,
  },
  stepText: {
    flex: 1,
    gap: 2,
  },
  stepTitle: {
    ...typeScale.cardTitle,
    color: colors.textPrimary,
  },
  stepBody: {
    ...typeScale.secondary,
    color: colors.textSecondaryBright,
  },
  musclesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  muscleKey: {
    flex: 1,
    gap: spacing.lg,
  },
  keyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  keyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  keyText: {
    flex: 1,
    gap: 2,
  },
  tipsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  tipsCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  tipsColumn: {
    flex: 1,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  tipText: {
    ...typeScale.secondary,
    color: colors.textSecondaryBright,
    flex: 1,
  },
  fullPage: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullClose: {
    position: 'absolute',
    top: spacing.xxxl + spacing.lg,
    right: spacing.xl,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceLift,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorderStrong,
  },
});
