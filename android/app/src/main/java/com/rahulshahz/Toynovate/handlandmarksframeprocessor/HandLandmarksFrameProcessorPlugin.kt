package com.rahulshahz.Toynovate.handlandmarksframeprocessor

import androidx.camera.core.ImageProxy
import com.rahulshahz.Toynovate.GestureRecognizerHolder
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.MPImage
import com.mrousavy.camera.frameprocessors.Frame
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin
import com.mrousavy.camera.frameprocessors.VisionCameraProxy
import android.util.Log
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import java.nio.ByteBuffer

class HandLandmarksFrameProcessorPlugin(proxy: VisionCameraProxy, options: Map<String, Any>?) : FrameProcessorPlugin() {
  override fun callback(frame: Frame, arguments: Map<String, Any>?): Any {
    if (GestureRecognizerHolder.gestureRecognizer == null) {
      return "GestureRecognizer is not initialized" // Return early if initialization failed
    }

    try {
      // Convert the frame to a Bitmap from ImageProxy
      val imageProxy: ImageProxy = frame.imageProxy
      val bitmap: Bitmap = imageProxy.toBitmap()

      // Rotate the bitmap by 90 degrees (from landscape left to portrait)
      val rotatedBitmap = rotateBitmap(bitmap, 270f)

      // Build the MPImage from the rotated bitmap
      val mpImage: MPImage = BitmapImageBuilder(rotatedBitmap).build()

      // Get the timestamp from the frame
      val timestamp = frame.timestamp ?: System.currentTimeMillis()

      // Call detectAsync with MPImage and timestamp
      GestureRecognizerHolder.gestureRecognizer?.recognizeAsync(mpImage, timestamp)

      return "Frame processed successfully"
    } catch (e: Exception) {
      e.printStackTrace()
      Log.e("HandLandmarksFrameProcessor", "Error processing frame: ${e.message}")
      return "Error processing frame: ${e.message}"
    }
  }
}

// Extension function to convert ImageProxy to Bitmap remains unchanged
fun ImageProxy.toBitmap(): Bitmap {
    val buffer: ByteBuffer = planes[0].buffer
    buffer.rewind() // Reset the buffer position to the beginning
    val bytes = ByteArray(buffer.remaining())
    buffer.get(bytes)
    return BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
}

// Helper function to rotate a bitmap by the given angle
fun rotateBitmap(source: Bitmap, angle: Float): Bitmap {
    val matrix = Matrix()
    matrix.postRotate(angle)
    return Bitmap.createBitmap(source, 0, 0, source.width, source.height, matrix, true)
}
