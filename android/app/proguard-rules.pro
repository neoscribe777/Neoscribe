# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# Keep PDF library classes
-keep class com.tom_roush.pdfbox.** { *; }
-keep class com.gemalto.jp2.** { *; }
-dontwarn com.gemalto.jp2.**
-dontwarn com.tom_roush.pdfbox.**

# Keep React Native WebView
-keep class com.reactnativecommunity.webview.** { *; }
-keepclassmembers class com.reactnativecommunity.webview.** { *; }

# Keep ML Kit
-keep class com.google.mlkit.** { *; }
-dontwarn com.google.mlkit.**

# iText 7 and SLF4J
-keep class com.itextpdf.** { *; }
-dontwarn com.itextpdf.**
-dontwarn org.slf4j.**
-dontwarn javax.xml.stream.**
-dontwarn javax.xml.transform.**
-dontwarn javax.xml.xpath.**
-dontwarn javax.xml.namespace.**
-dontwarn org.bouncycastle.**
