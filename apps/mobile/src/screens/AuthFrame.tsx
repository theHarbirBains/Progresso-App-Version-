import { useEffect, useRef, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Image, View } from 'react-native';
import { Text } from '../design/Text';
import { Screen } from '../design/Screen';
import { authStyles as styles } from './authStyles';

const logo = require('../../assets/progresso-mark.png');

interface Props {
  title: string;
  subtitle?: string;
  /** Show the Progresso mark above the title (Sign Up / Welcome). */
  showLogo?: boolean;
  children: ReactNode;
}

// The one frame for every signed-out screen (Sign In, Sign Up, Forgot/Reset
// Password) and the post-signup Welcome: the shared Screen with keyboard
// avoidance, content centred, a title (and optional mark/subtitle) over the
// form, and the same short fade-in on arrival -- skipped under Reduce Motion.
export function AuthFrame({ title, subtitle, showLogo, children }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    let mounted = true;
    let animation: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!mounted) return;
      if (reduceMotion) {
        opacity.setValue(1);
        translateY.setValue(0);
        return;
      }
      animation = Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]);
      animation.start();
    });
    return () => {
      mounted = false;
      animation?.stop();
    };
  }, [opacity, translateY]);

  return (
    <Screen keyboardAvoiding contentContainerStyle={styles.content}>
      <Animated.View style={[styles.frame, { opacity, transform: [{ translateY }] }]}>
        <View style={styles.header}>
          {showLogo ? <Image source={logo} style={styles.logo} resizeMode="contain" /> : null}
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {children}
      </Animated.View>
    </Screen>
  );
}
