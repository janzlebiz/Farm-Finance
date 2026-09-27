# Proguard rules for Farm Finance

# Keep Room entities, DAOs, and migrations
-keep class com.farmfinance.app.data.local.entity.** { *; }
-keep interface com.farmfinance.app.data.local.dao.** { *; }
-keep class * extends androidx.room.RoomDatabase
-keep class com.farmfinance.app.data.local.migration.** { *; }
-keepclassmembers class com.farmfinance.app.data.local.migration.MigrationsKt { *; }

# Keep Domain models and Money value class
-keep class com.farmfinance.app.domain.model.** { *; }

# Keep Keystore & Security Crypto classes
-keep class androidx.security.crypto.** { *; }
-keep class com.google.crypto.tink.** { *; }

# Suppress missing classes warnings for annotations referenced by Tink and standard libraries
-dontwarn com.google.errorprone.annotations.**
-dontwarn javax.annotation.**
-dontwarn javax.annotation.concurrent.**
-dontwarn org.checkerframework.**
-dontwarn org.codehaus.mojo.animal_sniffer.**
-dontwarn com.google.crypto.tink.**

# Keep JavaScript Interface for WebView Bridge
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.farmfinance.app.bridge.** { *; }

