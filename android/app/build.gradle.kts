plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
}

android {
    namespace = "com.farmfinance.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.farmfinance.app"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }

        ksp {
            arg("room.schemaLocation", "$projectDir/schemas")
            arg("room.incremental", "true")
            arg("room.expandProjection", "true")
        }
    }

    signingConfigs {
        val keystorePath = System.getenv("RELEASE_KEYSTORE_PATH")
            ?: System.getProperty("RELEASE_KEYSTORE_PATH")
            ?: (findProperty("RELEASE_KEYSTORE_PATH") as? String)

        if (!keystorePath.isNullOrBlank() && file(keystorePath).exists()) {
            create("release") {
                storeFile = file(keystorePath)
                val storePass = System.getenv("RELEASE_KEYSTORE_PASSWORD")
                    ?: System.getProperty("RELEASE_KEYSTORE_PASSWORD")
                    ?: (findProperty("RELEASE_KEYSTORE_PASSWORD") as? String)
                    ?: ""
                val alias = System.getenv("RELEASE_KEY_ALIAS")
                    ?: System.getProperty("RELEASE_KEY_ALIAS")
                    ?: (findProperty("RELEASE_KEY_ALIAS") as? String)
                    ?: ""
                val keyPass = System.getenv("RELEASE_KEY_PASSWORD")
                    ?: System.getProperty("RELEASE_KEY_PASSWORD")
                    ?: (findProperty("RELEASE_KEY_PASSWORD") as? String)

                storePassword = storePass
                keyAlias = alias
                keyPassword = if (!keyPass.isNullOrBlank()) keyPass else storePass
            }
        }
    }

    buildTypes {
        release {
            isDebuggable = false
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfigs.findByName("release")?.let {
                signingConfig = it
            }
        }
        debug {
            applicationIdSuffix = ".debug"
            isDebuggable = true
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
        freeCompilerArgs += listOf(
            "-opt-in=androidx.compose.material3.ExperimentalMaterial3Api",
            "-opt-in=kotlinx.coroutines.ExperimentalCoroutinesApi"
        )
    }

    buildFeatures {
        compose = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    implementation(libs.androidx.material.icons.extended)
    implementation(libs.androidx.navigation.compose)

    // Room
    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)

    // Coroutines
    implementation(libs.kotlinx.coroutines.core)
    implementation(libs.kotlinx.coroutines.android)

    // Security & Keystore
    implementation(libs.androidx.security.crypto)
    compileOnly("com.google.code.findbugs:jsr305:3.0.2")
    compileOnly("com.google.errorprone:error_prone_annotations:2.28.0")

    // AndroidX WebKit for standalone offline web runtime
    implementation(libs.androidx.webkit)

    // WorkManager
    implementation(libs.androidx.work.runtime.ktx)

    // Unit Testing
    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.androidx.room.testing)

    // Android Instrumentation Testing
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.ui.test.junit4)

    debugImplementation(libs.androidx.ui.tooling)
    debugImplementation(libs.androidx.ui.test.manifest)
}
