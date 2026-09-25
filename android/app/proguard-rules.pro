# Proguard rules for Farm Finance

# Keep Room entities and DAOs
-keep class com.farmfinance.app.data.local.entity.** { *; }
-keep interface com.farmfinance.app.data.local.dao.** { *; }
-keep class * extends androidx.room.RoomDatabase

# Keep Domain models and Money value class
-keep class com.farmfinance.app.domain.model.** { *; }

# Keep Keystore & Security Crypto classes
-keep class androidx.security.crypto.** { *; }

# Keep JavaScript Interface for WebView Bridge
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.farmfinance.app.bridge.** { *; }

