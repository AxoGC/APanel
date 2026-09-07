import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("rust")
}

val tauriProperties = Properties().apply {
    val propFile = file("tauri.properties")
    if (propFile.exists()) {
        propFile.inputStream().use { load(it) }
    }
}

android {
    compileSdk = 36
    namespace = "net.axogc.apanel"
    defaultConfig {
        // apanel's standalone client connects to a server address the admin
        // enters at runtime (see web/src/lib/apiBase.ts), which is commonly
        // a plain-HTTP LAN instance — apanel supports that on every other
        // build target, so the release build can't block cleartext traffic
        // the way Tauri's Android template defaults to. Without this, every
        // request to an http:// server fails at the OS network layer before
        // it's even visible to JS, surfacing as an opaque "something went
        // wrong" on login instead of a real error.
        manifestPlaceholders["usesCleartextTraffic"] = "true"
        applicationId = "net.axogc.apanel"
        minSdk = 24
        // Kept at Android 14 (not compileSdk's 36) deliberately: target API
        // 35+ makes Android 15 force edge-to-edge regardless of whether
        // MainActivity calls enableEdgeToEdge() itself, which pushes the
        // WebView's content back up under the status bar. Neither the
        // frontend nor Tauri's WebView fully handles window insets, so
        // 34 keeps the system drawing content below the status bar as
        // normal instead (see /root/TAURI_ANDROID_STATUS_BAR_INSETS.md).
        targetSdk = 34
        versionCode = tauriProperties.getProperty("tauri.android.versionCode", "1").toInt()
        versionName = tauriProperties.getProperty("tauri.android.versionName", "1.0")
    }
    buildTypes {
        getByName("debug") {
            applicationIdSuffix = ".debug"
            manifestPlaceholders["usesCleartextTraffic"] = "true"
            isDebuggable = true
            isJniDebuggable = true
            isMinifyEnabled = false
            packaging {                jniLibs.keepDebugSymbols.add("*/arm64-v8a/*.so")
                jniLibs.keepDebugSymbols.add("*/armeabi-v7a/*.so")
                jniLibs.keepDebugSymbols.add("*/x86/*.so")
                jniLibs.keepDebugSymbols.add("*/x86_64/*.so")
            }
        }
        getByName("release") {
            isMinifyEnabled = true
            proguardFiles(
                *fileTree(".") { include("**/*.pro") }
                    .plus(getDefaultProguardFile("proguard-android-optimize.txt"))
                    .toList().toTypedArray()
            )
        }
    }
    kotlinOptions {
        jvmTarget = "1.8"
    }
    buildFeatures {
        buildConfig = true
    }
}

rust {
    rootDirRel = "../../../"
}

dependencies {
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.lifecycle:lifecycle-process:2.10.0")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.4")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.0")
}

apply(from = "tauri.build.gradle.kts")