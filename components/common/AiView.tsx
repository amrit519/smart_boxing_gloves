import React from 'react';
import { useState } from 'react';
import { StyleSheet, Text, View, Dimensions, Modal } from 'react-native';
import { Switch } from 'react-native-paper';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { TouchableOpacity } from 'react-native';
import { THEME_COLOR } from '@/constants/Colors';
import CameraScreen from '@/components/common/CameraScreen';
import { RadioButton } from 'react-native-paper';
import HandGestureDetector from './HandGestureDetector';
import { useTheme } from '@/context/ThemeContext';
import { Colors } from '@/constants/Colors';

const { width } = Dimensions.get('window');

const TARGET_OPTIONS = [
  'sports ball',
  'person',
  'dog',
  'cat',
  'teddy bear',
  'bottle',
  'cell phone',
  'remote',
  'laptop'
];

export default function AiView() {
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? Colors.dark : Colors.light;
  
  const [objectDetection, setObjectDetection] = useState(true);
  // const [signDetection, setSignDetection] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState('sports ball');
  const [showDropdown, setShowDropdown] = useState(false);

  

  

  const handleTargetSelect = (target: string) => {
    setSelectedTarget(target);
    setShowDropdown(false);
  };

  return (
    <View style={[styles.mainContainer, { backgroundColor: theme.surface }]}>
      <View style={styles.cameraContainer}>
        {objectDetection ? (
          <CameraScreen selectedTarget={selectedTarget.toLowerCase()} />
        ) : (
          <HandGestureDetector />
        )}
      </View>


      
      <View style={[styles.settingsContainer, { backgroundColor: theme.surface }]}>
        <ThemedText style={styles.settingsTitle}>Detection Settings</ThemedText>
        
        <View style={styles.settingRow}>
          <ThemedText>Object Detection</ThemedText>
          <RadioButton
            value="objectDetection"
            status={objectDetection ? 'checked' : 'unchecked'}
            onPress={() => { setObjectDetection(true);  }}
            color={theme.primary}
          />
        </View>

        <View style={styles.settingRow}>
          <ThemedText>Sign Detection</ThemedText>
          <RadioButton
            value="signDetection"
            status={!objectDetection ? 'checked' : 'unchecked'}
            onPress={() => { setObjectDetection(false); }}
            color={theme.primary}
          />
        </View>

        {objectDetection ? (
          <View style={styles.targetSection}>
            <ThemedText style={styles.settingsTitle}>What to follow?</ThemedText>
            <TouchableOpacity 
              style={[styles.dropdown, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => setShowDropdown(true)}
            >
              <ThemedText>{selectedTarget}</ThemedText>
              <IconSymbol name="keyboard-arrow-down" size={24} color={theme.secondary} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.targetSection}>
            <ThemedText style={styles.settingsTitle}>Available Gestures</ThemedText>
            <View style={styles.gestureGrid}>
              <View style={styles.gestureItem}>
                <ThemedText style={styles.gestureText}>👋 Hello</ThemedText>
              </View>
              <View style={styles.gestureItem}>
                <ThemedText style={styles.gestureText}>👍 Yes</ThemedText>
              </View>
              <View style={styles.gestureItem}>
                <ThemedText style={styles.gestureText}>👎 No</ThemedText>
              </View>
              <View style={styles.gestureItem}>
                <ThemedText style={styles.gestureText}>✋ Stop</ThemedText>
              </View>
              <View style={styles.gestureItem}>
                <ThemedText style={styles.gestureText}>👆 Attention</ThemedText>
              </View>
              <View style={styles.gestureItem}>
                <ThemedText style={styles.gestureText}>✌️ Celebrate</ThemedText>
              </View>
              <View style={styles.gestureItem}>
                <ThemedText style={styles.gestureText}>🤟 Spin</ThemedText>
              </View>
              <View style={styles.gestureItem}>
                <ThemedText style={styles.gestureText}>👆👆 Dance</ThemedText>
              </View>
            </View>
          </View>
        )}
      </View>

      <Modal
        visible={showDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDropdown(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDropdown(false)}
        >
          <View style={[styles.dropdownMenu, { backgroundColor: theme.surfaceContainer }]}>
            {TARGET_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.dropdownItem,
                  selectedTarget === option && [styles.selectedItem, { backgroundColor: `${theme.primary}15` }]
                ]}
                onPress={() => handleTargetSelect(option)}
              >
                <ThemedText style={[
                  styles.dropdownText,
                  selectedTarget === option && [styles.selectedText, { color: theme.primary }]
                ]}>
                  {option}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  cameraContainer: {
    width: '100%',
    aspectRatio: 10/9,
    borderRadius: 12,
    overflow: 'hidden',
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  detectionOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detectionBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  detectionText: {
    color: 'white',
    fontSize: 14,
  },
  settingsContainer: {
    padding: 16,
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  targetSection: {
    marginBottom: 12,
  },
  dropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  message: {
    textAlign: 'center',
    marginBottom: 16,
  },
  permissionButton: {
    backgroundColor: THEME_COLOR,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  permissionText: {
    color: 'white',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownMenu: {
    borderRadius: 12,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '80%',
  },
  dropdownItem: {
    padding: 12,
    borderRadius: 8,
  },
  selectedItem: {
    backgroundColor: `${THEME_COLOR}15`,
  },
  dropdownText: {
    fontSize: 16,
  },
  selectedText: {
    fontWeight: '600',
  },
  gestureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  gestureItem: {
    width: '48%',
    marginBottom: 12,
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  gestureText: {
    fontSize: 16,
  },
});
