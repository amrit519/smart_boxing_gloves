/* eslint-disable @typescript-eslint/no-var-requires */
import * as React from "react";
import { StyleSheet, View, Text, NativeModules,
  NativeEventEmitter, TouchableOpacity
} from "react-native";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
  VisionCameraProxy,
  Frame
} from "react-native-vision-camera"
import { Worklets, useSharedValue } from "react-native-worklets-core";
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { toggleCameraPosition } from '@/store/slices/cameraSlice';
import { MaterialIcons } from '@expo/vector-icons';
import { useBluetooth } from '@/hooks/useBluetooth';

// Define the service and characteristic UUIDs for LED control
const LED_SERVICE_UUID = "12345678-1234-5678-1234-56789abcdef0";
const LED_CHARACTERISTIC_UUID = "abcdef01-1234-5678-1234-56789abcdef0";

const { HandLandmarks } = NativeModules;
const handLandmarksEmitter = new NativeEventEmitter()
const handLandMarkPlugin = VisionCameraProxy.initFrameProcessorPlugin(
  "handLandmarks",
  {}
);

interface GestureData {
  categoryName: string;
  score: number;
}

interface HandednessData {
  categoryName: string;
  score: number;
}

interface HandGesture {
  gesture: string;
  confidence: number;
  hand: string;
}

function handLandmarks(frame: Frame) {
  'worklet';
  if (handLandMarkPlugin == null) {
    throw new Error('Failed to load Frame Processor Plugin!');
  }
  return handLandMarkPlugin.call(frame);
}

export default function HandGestureDetector() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const cameraPosition = useAppSelector(state => state.camera.position);
  const device = useCameraDevice(cameraPosition);
  const dispatch = useAppDispatch();
  const [handGestures, setHandGestures] = React.useState<HandGesture[]>([]);
  const landmarks = useSharedValue({});
  const count = useSharedValue(0);
  const detectionTimeoutRef = React.useRef<NodeJS.Timeout>();
  const { writeCharacteristic } = useBluetooth();
  const { isConnected, deviceId } = useAppSelector(state => state.connection);

  // Function to send command to microcontroller
  const sendCommand = async (command: string) => {
    if (!isConnected || !deviceId) {
      console.log("Not connected to device");
      return;
    }

    try {
      console.log('Sending command:', command);
      await writeCharacteristic(
        LED_SERVICE_UUID,
        LED_CHARACTERISTIC_UUID,
        command
      );
    } catch (error) {
      console.error('Error sending command:', error);
    }
  };

  // Function to process gestures and send commands
  const processGestures = async (gestures: HandGesture[]) => {
    if (gestures.length === 0) return;

    // Process each gesture
    for (const gesture of gestures) {
      if (gesture.confidence > 0.2) {
        switch (gesture.gesture) {
          case 'hello':
            await sendCommand('GESTURE_HELLO');
            break;
          case 'yes':
            await sendCommand('GESTURE_YES');
            break;
          case 'no':
            await sendCommand('GESTURE_NO');
            break;
          case 'stop':
            await sendCommand('GESTURE_STOP');
            break;
          case 'attention':
            await sendCommand('GESTURE_ATTENTION');
            break;
          case 'celebrate':
            await sendCommand('GESTURE_CELEBRATE');
            break;
          case 'spin':
            await sendCommand('GESTURE_SPIN');
            break;
          case 'dance':
            await sendCommand('GESTURE_DANCE');
            break;
        }
      }
    }
  };

  // Function to reset gestures after delay
  const resetGesturesAfterDelay = () => {
    if (detectionTimeoutRef.current) {
      clearTimeout(detectionTimeoutRef.current);
    }
    detectionTimeoutRef.current = setTimeout(() => {
      setHandGestures([]);
    }, 500);
  };

  React.useEffect(() => {
    console.log("Initialising")
    
    // Set up event listeners first
    const subscription = handLandmarksEmitter.addListener(
      'onHandLandmarksDetected',
      event => {
        landmarks.value = event.landmarks;
        
        // Process gesture data for all detected hands
        if (event.gestures && Array.isArray(event.gestures) && event.handedness && Array.isArray(event.handedness)) {
          const newHandGestures: HandGesture[] = event.gestures.map((gestureList: GestureData[], index: number) => {
            const handedness = event.handedness[index]?.[0] as HandednessData;
            const gesture = gestureList[0] as GestureData;
            
            // Log the received data for debugging
            console.log('Received gesture data:', {
              hand: handedness?.categoryName || 'Unknown',
              gesture: gesture?.categoryName || 'None',
              confidence: gesture?.score || 0
            });

            return {
              gesture: gesture?.categoryName || 'None',
              confidence: gesture?.score || 0,
              hand: handedness?.categoryName || 'Unknown'
            };
          }).filter((gesture: HandGesture) => gesture.gesture !== 'None' && gesture.confidence > 0.2);

          // Check for dance gesture (both hands showing attention)
          if (newHandGestures.length === 2 && 
              newHandGestures[0].gesture === 'attention' && 
              newHandGestures[1].gesture === 'attention') {
            // Store confidences before clearing the array
            const confidence1 = newHandGestures[0].confidence;
            const confidence2 = newHandGestures[1].confidence;
            
            // Replace both attention gestures with a single dance gesture
            newHandGestures.length = 0; // Clear the array
            newHandGestures.push({
              gesture: 'dance',
              confidence: Math.min(confidence1, confidence2),
              hand: 'both'
            });
          }
          
          if (newHandGestures.length > 0) {
            setHandGestures(newHandGestures);
            processGestures(newHandGestures);
            resetGesturesAfterDelay();
          } else {
            setHandGestures([]);
          }
        }
      },
    );

    const statusSubscription = handLandmarksEmitter.addListener(
      'onHandLandmarksStatus',
      event => {
        console.log("Status: ", event.status);
        setHandGestures([]);
      }
    );

    const errorSubscription = handLandmarksEmitter.addListener(
      'onHandLandmarksError',
      event => {
        console.error("Error: ", event.error);
        setHandGestures([]);
      }
    );

    // Initialize model after setting up listeners
    setTimeout(() => {
      HandLandmarks.initModel();
    }, 1000);

    return () => {
      subscription.remove();
      statusSubscription.remove();
      errorSubscription.remove();
      if (detectionTimeoutRef.current) {
        clearTimeout(detectionTimeoutRef.current);
      }
    };
  }, []);

  // Request camera permission
  React.useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  const frameProcessor = useFrameProcessor((frame) => {
    "worklet";
    count.value++;
    if(count.value % 5 == 0){
      handLandmarks(frame)
    }
  }, []);

  if (!hasPermission || !device) {
    return <Text>No Camera available or permission denied.</Text>;
  }

  return (
    <View style={styles.container}>
      <Camera
        device={device}
        style={StyleSheet.absoluteFill}
        isActive={true}
        frameProcessor={frameProcessor}
        pixelFormat="yuv"
      />
      <TouchableOpacity 
        style={styles.flipButton}
        onPress={() => dispatch(toggleCameraPosition())}
      >
        <MaterialIcons name="flip-camera-ios" size={24} color="white" />
      </TouchableOpacity>
      <View style={styles.overlay}>
        {handGestures.length === 0 ? (
          <Text style={styles.gestureText}>No gestures detected</Text>
        ) : (
          handGestures.map((handGesture, index) => (
            <Text key={index} style={styles.gestureText}>
              {handGesture.hand}: {handGesture.gesture} 
              {handGesture.confidence > 0 ? ` (${(handGesture.confidence * 100).toFixed(1)}%)` : ''}
            </Text>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    marginVertical: 125,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 5,
    minWidth: 200,
  },
  gestureText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginVertical: 2,
    textAlign: "center",
  },
  flipButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 10,
    borderRadius: 25,
  },
});