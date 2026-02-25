package com.neoscribe

import android.app.Activity
import android.graphics.Color
import android.os.Build
import android.view.View
import android.view.Window
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class ThemeModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "ThemeModule"
    }

    @ReactMethod
    fun setNavigationBarColor(color: String, lightMode: Boolean) {
        val activity = reactApplicationContext.currentActivity ?: return
        activity.runOnUiThread {
            try {
                val window: Window = activity.window
                val hexColor = Color.parseColor(color)
                window.navigationBarColor = hexColor

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    var flags = window.decorView.systemUiVisibility
                    if (lightMode) {
                        flags = flags or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
                    } else {
                        flags = flags and View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR.inv()
                    }
                    window.decorView.systemUiVisibility = flags
                }
            } catch (e: Exception) {
                // Ignore errors
            }
        }
    }
}
