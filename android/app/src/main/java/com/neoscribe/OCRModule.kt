package com.neoscribe

import android.net.Uri
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions

class OCRModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private val TAG = "OCRModule"

    override fun getName(): String = "OCRModule"

    // No download needed for ML Kit (handled by Play Services automatically)
    @ReactMethod
    fun downloadModel(lang: String, type: String, promise: Promise) {
        // Just resolve immediately to keep JS happy for now, or we can remove the call in JS
        promise.resolve("ML_KIT_READY") 
    }

    @ReactMethod
    fun recognizeText(imageUri: String, lang: String, type: String, promise: Promise) {
        try {
            val uri = Uri.parse(imageUri)
            val image = InputImage.fromFilePath(reactApplicationContext, uri)
            
            // Using Default (Latin) options. 
            // Note: Arabic is NOT supported by ML Kit Text Recognition V2 native.
            // This module now only supports Latin-based languages (English, French, etc.)
            val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
            
            recognizer.process(image)
                .addOnSuccessListener { visionText ->
                     val response = Arguments.createMap().apply {
                        putString("text", visionText.text)
                        putInt("confidence", 100) // Dummy confidence
                    }
                    promise.resolve(response)
                }
                .addOnFailureListener { e ->
                    Log.e(TAG, "ML Kit failed", e)
                    promise.reject("OCR_ERROR", e.message)
                }
        } catch (e: Exception) {
            Log.e(TAG, "OCR Error", e)
            promise.reject("OCR_ERROR", e.message)
        }
    }

    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }
}
