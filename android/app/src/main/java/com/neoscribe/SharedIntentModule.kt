package com.neoscribe

import android.content.Intent
import android.net.Uri
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap

class SharedIntentModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "SharedIntentModule"
    }

    @ReactMethod
    fun getSharedData(promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("E_NO_ACTIVITY", "Current activity is null")
            return
        }

        val intent = activity.intent
        if (intent == null) {
            promise.resolve(null)
            return
        }

        val action = intent.action
        val type = intent.type

        val result = Arguments.createMap()

        if (Intent.ACTION_SEND == action) {
            result.putString("action", "SEND")
            result.putString("type", type ?: "text/plain")

            val sharedText = intent.getStringExtra(Intent.EXTRA_TEXT)
            val sharedSubject = intent.getStringExtra(Intent.EXTRA_SUBJECT)
            val sharedStream = intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)

            if (sharedText != null) {
                result.putString("value", sharedText)
                result.putString("subject", sharedSubject)
            } else if (sharedStream != null) {
                result.putString("value", sharedStream.toString())
            } else {
                // Fallback for some apps that don't use standard extras
                result.putString("value", intent.dataString)
            }
            promise.resolve(result)
        } else if (Intent.ACTION_VIEW == action) {
            result.putString("action", "VIEW")
            result.putString("type", type ?: "*/*")
            result.putString("value", intent.dataString)
            promise.resolve(result)
        } else {
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun clearIntent() {
        val activity = reactApplicationContext.currentActivity
        if (activity != null) {
            val intent = activity.intent
            if (intent != null) {
                // Clear all extras
                intent.replaceExtras(android.os.Bundle())
                // Clear action and data
                intent.action = null
                intent.data = null
                // Also clear the type
                intent.type = null
            }
        }
    }
}
