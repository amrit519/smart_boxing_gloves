/* eslint-disable @typescript-eslint/no-var-requires */
import * as React from 'react'
import { StyleSheet, View, Text, ActivityIndicator, TouchableOpacity } from 'react-native'
import {
  useTensorflowModel,
} from 'react-native-fast-tflite'
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor
} from 'react-native-vision-camera'
import { useResizePlugin } from 'vision-camera-resize-plugin'
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { toggleCameraPosition } from '@/store/slices/cameraSlice';
import { MaterialIcons } from '@expo/vector-icons';
import { useBluetooth } from '@/hooks/useBluetooth';
import { Worklets } from 'react-native-worklets-core'

// Define the service and characteristic UUIDs for LED control
const LED_SERVICE_UUID = "12345678-1234-5678-1234-56789abcdef0";
const LED_CHARACTERISTIC_UUID = "abcdef01-1234-5678-1234-56789abcdef0";

const labels = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
  'traffic light', 'fire hydrant', 'street sign', 'stop sign', 'parking meter', 'bench',
  'bird', 'cat', 'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe',
  'hat', 'backpack', 'umbrella', 'shoe', 'eye glasses', 'handbag', 'tie', 'suitcase',
  'frisbee', 'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove',
  'skateboard', 'surfboard', 'tennis racket', 'bottle', 'plate', 'wine glass', 'cup',
  'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich', 'orange', 'broccoli',
  'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch', 'potted plant', 'bed',
  'mirror', 'dining table', 'window', 'desk', 'toilet', 'door', 'tv', 'laptop', 'mouse',
  'remote', 'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator',
  'blender', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush', 'hair brush'
];

interface CameraScreenProps {
  selectedTarget: string;
}

export default function App({ selectedTarget }: CameraScreenProps): React.ReactNode {
  const { hasPermission, requestPermission } = useCameraPermission()
  const cameraPosition = useAppSelector(state => state.camera.position);
  const device = useCameraDevice(cameraPosition)
  const dispatch = useAppDispatch();
  const { writeCharacteristic } = useBluetooth();
  
  // Add frame counter ref
  const frameCountRef = React.useRef(0);

  const model = useTensorflowModel(require('../../assets/efficientdet.tflite'))
  const actualModel = model.state === 'loaded' ? model.model : undefined

  const { resize } = useResizePlugin()
  
  // Function to send command to microcontroller
  const sendCommand = Worklets.createRunOnJS(async (command: string) => {
    console.log('Sending command:', command);
    try {
      await writeCharacteristic(
        LED_SERVICE_UUID,
        LED_CHARACTERISTIC_UUID,
        command
      );
    } catch (error) {
      console.error('Error sending command:', error);
    }
  })
  // const sendCommand = async (command: string) => {
  //   'worklet'
  //   try {
  //     console.log('Sending command:', command);
  //     await writeCharacteristic(
  //       LED_SERVICE_UUID,
  //       LED_CHARACTERISTIC_UUID,
  //       command
  //     );
  //   } catch (error) {
  //     console.error('Error sending command:', error);
  //   }
  // };

  const frameProcessor = useFrameProcessor(async frame => {
    'worklet';
    
    if (!actualModel) {
      return;
    }

    // Increment frame counter
    frameCountRef.current += 1;

    // Only process every 30th frame
    if (frameCountRef.current % 20 !== 0) {
      return;
    }
  
    const resized = resize(frame, {
      scale: {
        width: 320,
        height: 320,
      },
      pixelFormat: 'rgb',
      dataType: 'uint8',
    });
  
    const modelInput = [resized];
    const outputs = actualModel.runSync(modelInput);
  
    const detection_boxes = outputs[0];
    const detection_classes = outputs[1];
    const detection_scores = outputs[2];
  
    const frameWidth = frame.width;
    const frameHeight = frame.height;
    const frameCenterX = frameWidth / 2;
    const frameCenterY = frameHeight / 2;
  
    const numDetections = detection_boxes.length / 4;
  
    for (let i = 0; i < numDetections; i++) {
      const confidence = detection_scores[i];
  
      if (confidence > 0.1) {
        const classIndex = Number(detection_classes[i]); // Convert bigint to number
        const detectedLabel = labels[classIndex];
  
        if (detectedLabel === selectedTarget) {
          const left = Number(detection_boxes[i * 4]) * frameWidth;
          const top = Number(detection_boxes[i * 4 + 1]) * frameHeight;
          const right = Number(detection_boxes[i * 4 + 2]) * frameWidth;
          const bottom = Number(detection_boxes[i * 4 + 3]) * frameHeight;
  
          const ballCenterX = (left + right) / 2;
          const ballCenterY = (top + bottom) / 2;
          
          // Calculate distance from center
          const xOffset = ballCenterX - frameCenterX;
          const yOffset = ballCenterY - frameCenterY;
          
          // Define thresholds for movement
          const centerThreshold = frameWidth * 0.1; // 10% of frame width
          
          // Determine direction based on ball position
          let direction = '';
          
          if (Math.abs(xOffset) > centerThreshold) {
            // Ball is not centered horizontally
            if (xOffset > 0) {
              direction = 'MOVE_LEFT';
            } else {
              direction = 'MOVE_RIGHT';
            }
          } else {
            direction = 'MOVE_FORWARD';
          }
          
          // Log ball position info
          console.log(`Frame ${frameCountRef.current} - Ball position: center(${ballCenterX.toFixed(2)}, ${ballCenterY.toFixed(2)}), ` +
                     `offset from center(${xOffset.toFixed(2)}, ${yOffset.toFixed(2)})`);
          
          // Send movement command
          sendCommand(direction);
          
          break; // Process only the first detected ball
        }
      }
    }
  }, [actualModel]);
  React.useEffect(() => {
    requestPermission()
  }, [requestPermission])

  return (
    <View style={styles.container}>
      {hasPermission && device != null ? (
        <>
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
          <View style={{ marginVertical: 125 }} />
        </>
      ) : (
        <Text>No Camera available.</Text>
      )}

      {model.state === 'loading' && (
        <ActivityIndicator size="small" color="white" />
      )}

      {model.state === 'error' && (
        <Text>Failed to load model! {model.error.message}</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flipButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 10,
    borderRadius: 25,
  },
})

