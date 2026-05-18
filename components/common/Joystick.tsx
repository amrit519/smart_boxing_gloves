import React, { useCallback, useState, useRef, useEffect } from 'react';
import { View, StyleSheet, PanResponder, Animated, TouchableOpacity } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { THEME_COLOR } from '@/constants/Colors';
import { useTheme } from '@/context/ThemeContext';
import { Colors } from '@/constants/Colors';
import { useBluetooth } from '@/hooks/useBluetooth';

// Define the service and characteristic UUIDs for LED control
const LED_SERVICE_UUID = "12345678-1234-5678-1234-56789abcdef0";
const LED_CHARACTERISTIC_UUID = "abcdef01-1234-5678-1234-56789abcdef0";

type Direction = 'FORWARD' | 'BACKWARD' | 'LEFT' | 'RIGHT' | 'LEFT_FORWARD' | 'RIGHT_FORWARD' | 'LEFT_BACKWARD' | 'RIGHT_BACKWARD' | null;

interface JoystickProps {
  size?: number;
  mode?: 'circular' | 'keyed';
  onRelease?: () => void;
  updateInterval?: number;
}

export function Joystick({ 
  size = 240, 
  mode = 'circular', 
  onRelease,
  updateInterval = 500
}: JoystickProps) {
  const [pan] = useState(new Animated.ValueXY());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentDirectionRef = useRef<Direction>(null);
  const maxDistance = size / 3;
  const innerCircleSize = size / 4;
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? Colors.dark : Colors.light;
  const { writeCharacteristic } = useBluetooth();

  // Function to determine direction based on x and y values
  const getDirection = (x: number, y: number): Direction => {
    const threshold = 0.3;
    const absX = Math.abs(x);
    const absY = Math.abs(y);

    if (absX < threshold && absY < threshold) return null;
    
    if (absX > threshold && absY > threshold) {
      if (x > 0) return y < 0 ? 'RIGHT_FORWARD' : 'RIGHT_BACKWARD';
      return y < 0 ? 'LEFT_FORWARD' : 'LEFT_BACKWARD';
    }
    
    return absX > absY ? (x > 0 ? 'RIGHT' : 'LEFT') : (y > 0 ? 'BACKWARD' : 'FORWARD');
  };

  // Function to handle position updates
  const updatePosition = (gesture: any) => {
    const distance = Math.sqrt(gesture.dx * gesture.dx + gesture.dy * gesture.dy);
    if (distance > maxDistance) {
      const angle = Math.atan2(gesture.dy, gesture.dx);
      pan.setValue({ 
        x: maxDistance * Math.cos(angle), 
        y: maxDistance * Math.sin(angle) 
      });
    } else {
      pan.setValue({ x: gesture.dx, y: gesture.dy });
    }
    return distance;
  };

  // Function to send command to microcontroller
  const sendCommand = async (command: string) => {
    try {
      console.log('Sending command:', command);
      const success = await writeCharacteristic(
        LED_SERVICE_UUID,
        LED_CHARACTERISTIC_UUID,
        command
      );
      // console.log('Command sent successfully:', success);
    } catch (error) {
      console.error('Error sending command:', error);
    }
  };

  // Function to start sending direction updates
  const startDirectionUpdates = useCallback((direction: Direction) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    currentDirectionRef.current = direction;

    intervalRef.current = setInterval(() => {
      if (currentDirectionRef.current) {
        sendCommand(`MOVE_${currentDirectionRef.current}`);
      }
    }, updateInterval);
  }, [updateInterval]);

  // Function to stop sending direction updates
  const stopDirectionUpdates = useCallback(async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    currentDirectionRef.current = null;
    await sendCommand("MOVE_STOP");
    onRelease?.();
  }, [onRelease]);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (_, gesture) => {
      updatePosition(gesture);
      const normalizedX = gesture.dx / maxDistance;
      const normalizedY = gesture.dy / maxDistance;
      const direction = getDirection(normalizedX, normalizedY);
      startDirectionUpdates(direction);
    },
    onPanResponderMove: (_, gesture) => {
      updatePosition(gesture);
      const normalizedX = gesture.dx / maxDistance;
      const normalizedY = gesture.dy / maxDistance;
      const newDirection = getDirection(normalizedX, normalizedY);
      if (newDirection !== currentDirectionRef.current) {
        currentDirectionRef.current = newDirection;
      }
    },
    onPanResponderRelease: () => {
      Animated.spring(pan, {
        toValue: { x: 0, y: 0 },
        useNativeDriver: false,
      }).start();
      stopDirectionUpdates();
    },
  });

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (mode === 'keyed') {
    return (
      <View style={[styles.keyedContainer, { width: size, height: size }]}>
        <TouchableOpacity 
          style={[styles.directionButton, styles.topButton, { backgroundColor: theme.surface }]}
          onPressIn={() => startDirectionUpdates('FORWARD')}
          onPressOut={stopDirectionUpdates}
          activeOpacity={0.7}
        >
          <IconSymbol name="keyboard-arrow-up" size={32} color={THEME_COLOR} />
        </TouchableOpacity>

        <View style={styles.middleRow}>
          <TouchableOpacity 
            style={[styles.directionButton, styles.leftButton, { backgroundColor: theme.surface }]}
            onPressIn={() => startDirectionUpdates('LEFT')}
            onPressOut={stopDirectionUpdates}
            activeOpacity={0.7}
          >
            <IconSymbol name="keyboard-arrow-left" size={32} color={THEME_COLOR} />
          </TouchableOpacity>

          <View style={styles.centerCircle} />

          <TouchableOpacity 
            style={[styles.directionButton, styles.rightButton, { backgroundColor: theme.surface }]}
            onPressIn={() => startDirectionUpdates('RIGHT')}
            onPressOut={stopDirectionUpdates}
            activeOpacity={0.7}
          >
            <IconSymbol name="keyboard-arrow-right" size={32} color={THEME_COLOR} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={[styles.directionButton, styles.bottomButton, { backgroundColor: theme.surface }]}
          onPressIn={() => startDirectionUpdates('BACKWARD')}
          onPressOut={stopDirectionUpdates}
          activeOpacity={0.7}
        >
          <IconSymbol name="keyboard-arrow-down" size={32} color={THEME_COLOR} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: size, height: size, backgroundColor: theme.surfaceContainer }]}>
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.joystick,
          {
            width: innerCircleSize,
            height: innerCircleSize,
            borderRadius: innerCircleSize / 2,
            backgroundColor: THEME_COLOR,
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
            ],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  joystick: {
    backgroundColor: THEME_COLOR,
  },
  keyedContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  middleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  directionButton: {
    width: 80,
    height: 80,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  centerCircle: {
    width: 80,
    height: 80,
    backgroundColor: `${THEME_COLOR}20`,
    borderRadius: 20,
  },
  topButton: { marginBottom: 8 },
  bottomButton: { marginTop: 8 },
  leftButton: { marginRight: 8 },
  rightButton: { marginLeft: 8 },
}); 