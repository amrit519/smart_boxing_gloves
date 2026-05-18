package com.rahulshahz.Toynovate

import android.content.Context
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.mediapipe.framework.image.MPImage
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.OutputHandler
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.gesturerecognizer.GestureRecognizer
import com.google.mediapipe.tasks.vision.gesturerecognizer.GestureRecognizerResult

class HandLandmarks(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "HandLandmarks"
    }

    private fun sendEvent(eventName: String, params: WritableMap?) {
        try {
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit(eventName, params)
            Log.d("HandLandmarks", "📡 Sent event: $eventName")
        } catch (e: Exception) {
            Log.e("HandLandmarks", "Error sending event: $eventName", e)
        }
    }

    @ReactMethod
    fun initModel() {
        Log.d("HandLandmarks", "🚀 Initializing GestureRecognizer model...")

        // Check if the GestureRecognizer has already been initialized
        if (GestureRecognizerHolder.gestureRecognizer != null) {
            Log.d("HandLandmarks", "⚠️ Model already initialized, skipping re-initialization.")
            sendEvent("onHandLandmarksStatus", Arguments.createMap().apply {
                putString("status", "Model already initialized")
            })
            return
        }

        // Define the result listener
        val resultListener = OutputHandler.ResultListener { result: GestureRecognizerResult, image: MPImage ->
            try {
                val numHandsDetected = result.gestures().size
                Log.d("HandLandmarks", "🖐 Number of hands detected: $numHandsDetected")

                // Enhanced logging for multiple hands
                if (numHandsDetected > 0) {
                    Log.d("HandLandmarks", "=== Multiple Hands Detection ===")
                    result.gestures().forEachIndexed { index, gestureList ->
                        val handType = result.handedness().getOrNull(index)?.firstOrNull()?.categoryName() ?: "Unknown"
                        val gesture = gestureList.firstOrNull()?.categoryName() ?: "None"
                        val confidence = gestureList.firstOrNull()?.score() ?: 0f
                        
                        // Map gestures to their meanings
                        val mappedGesture = when (gesture) {
                            "Open_Palm" -> "hello"
                            "Thumb_Up" -> "yes"
                            "Thumb_Down" -> "no"
                            "Closed_Fist" -> "stop"
                            "Pointing_Up" -> "attention"
                            "Victory" -> "celebrate"
                            "ILoveYou" -> "spin"
                            else -> gesture
                        }
                        
                        Log.d("HandLandmarks", """
                            Hand ${index + 1}:
                            - Type: $handType
                            - Gesture: $mappedGesture
                            - Confidence: %.2f%%
                        """.trimIndent().format(confidence * 100))
                    }
                    Log.d("HandLandmarks", "=============================")
                }

                if (numHandsDetected > 0) {
                    val eventParams = Arguments.createMap().apply {
                        // Add landmarks data
                        putArray("landmarks", Arguments.createArray().apply {
                            result.landmarks().forEach { handLandmarks ->
                                pushArray(Arguments.createArray().apply {
                                    handLandmarks.forEach { landmark ->
                                        pushMap(Arguments.createMap().apply {
                                            putInt("keypoint", handLandmarks.indexOf(landmark))
                                            putDouble("x", landmark.x().toDouble())
                                            putDouble("y", landmark.y().toDouble())
                                            putDouble("z", landmark.z().toDouble())
                                        })
                                    }
                                })
                            }
                        })

                        // Add gesture recognition data with mapped gestures
                        putArray("gestures", Arguments.createArray().apply {
                            result.gestures().forEachIndexed { index, gestureList ->
                                if (gestureList.isNotEmpty()) {
                                    pushArray(Arguments.createArray().apply {
                                        gestureList.forEach { gesture ->
                                            pushMap(Arguments.createMap().apply {
                                                // Map the gesture to its meaning
                                                val mappedGesture = when (gesture.categoryName()) {
                                                    "Open_Palm" -> "hello"
                                                    "Thumbs_Up" -> "yes"
                                                    "Thumbs_Down" -> "no"
                                                    "Closed_Fist" -> "stop"
                                                    "Pointing_Up" -> "attention"
                                                    "Victory" -> "celebrate"
                                                    "ILoveYou" -> "spin"
                                                    else -> gesture.categoryName()
                                                }
                                                putString("categoryName", mappedGesture)
                                                putDouble("score", gesture.score().toDouble())
                                            })
                                        }
                                    })
                                }
                            }
                        })

                        // Add handedness data
                        putArray("handedness", Arguments.createArray().apply {
                            result.handedness().forEach { handednessList ->
                                pushArray(Arguments.createArray().apply {
                                    handednessList.forEach { handedness ->
                                        pushMap(Arguments.createMap().apply {
                                            putString("categoryName", handedness.categoryName())
                                            putDouble("score", handedness.score().toDouble())
                                        })
                                    }
                                })
                            }
                        })
                    }
                    
                    sendEvent("onHandLandmarksDetected", eventParams)
                }
            } catch (e: Exception) {
                Log.e("HandLandmarks", "Error processing gestures", e)
                sendEvent("onHandLandmarksError", Arguments.createMap().apply {
                    putString("error", "Error processing gestures: ${e.message}")
                })
            }
        }

        // Initialize the Gesture Recognizer
        try {
            val context: Context = reactApplicationContext
            val baseOptions = BaseOptions.builder()
                .setModelAssetPath("gesture_recognizer.task")
                .build()

            val gestureRecognizerOptions = GestureRecognizer.GestureRecognizerOptions.builder()
                .setBaseOptions(baseOptions)
                .setNumHands(2)
                .setMinHandDetectionConfidence(0.5f)
                .setMinHandPresenceConfidence(0.5f)
                .setMinTrackingConfidence(0.5f)
                .setRunningMode(RunningMode.LIVE_STREAM)
                .setResultListener(resultListener)
                .build()

            GestureRecognizerHolder.gestureRecognizer = GestureRecognizer.createFromOptions(context, gestureRecognizerOptions)
            Log.d("HandLandmarks", "✅ Gesture Recognizer initialized successfully.")

            sendEvent("onHandLandmarksStatus", Arguments.createMap().apply {
                putString("status", "Model initialized successfully")
            })

        } catch (e: Exception) {
            Log.e("HandLandmarks", "❌ Error initializing GestureRecognizer", e)
            sendEvent("onHandLandmarksError", Arguments.createMap().apply {
                putString("error", e.message ?: "Unknown error initializing GestureRecognizer")
            })
        }
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        Log.d("HandLandmarks", "🧹 Removing $count listeners")
    }
}
