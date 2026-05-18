import { useEffect, useRef, useState } from 'react';
import * as handPoseDetection from '@tensorflow-models/hand-pose-detection';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-react-native';

export function useDetector() {
  const detectorRef = useRef(null);
  const [detector, setDetector] = useState(null);

  useEffect(() => {
    async function loadHandPoseModel() {
      try {
        await tf.ready();
        console.log('TensorFlow.js is ready.');
        const model = handPoseDetection.SupportedModels.MediaPipeHands;
        const detectorConfig = {
          runtime: 'tfjs',
          maxHands: 2,
          solutionPath: 'https://cdn.jsdelivr.net/npm/@tensorflow-models/hand-pose-detection'
        };
        console.log('Loading hand pose model...');
        const detectorInstance = await handPoseDetection.createDetector(model, detectorConfig);
        detectorRef.current = detectorInstance;
        setDetector(detectorInstance);
        console.log('Hand pose model loaded.');
      } catch (error) {
        console.error('Error loading hand pose model:', error);
      }
    }
    loadHandPoseModel();
  }, []);

  return detectorRef;
}
