plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.devtools.ksp")
}

android {
    namespace = "com.exiros.tracker"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.exiros.tracker"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "0.1"
    }

    buildTypes {
        debug {
            // 10.0.2.2 = host de la máquina anfitriona visto desde el emulador Android.
            buildConfigField("String", "API_BASE_URL", "\"http://10.0.2.2:3000\"")
            buildConfigField("String", "APP_KEY", "\"dev-app-key-cambia-en-prod\"")
        }
        release {
            isMinifyEnabled = false
            buildConfigField("String", "API_BASE_URL", "\"http://10.0.2.2:3000\"")
            buildConfigField("String", "APP_KEY", "\"dev-app-key-cambia-en-prod\"")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.activity:activity-compose:1.9.3")

    val composeBom = platform("androidx.compose:compose-bom:2024.10.01")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    debugImplementation("androidx.compose.ui:ui-tooling")
    implementation("androidx.compose.ui:ui-tooling-preview")

    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("io.coil-kt:coil-compose:2.7.0")

    // Room: cola local de puntos + estado del viaje activo (persistencia que sobrevive reinicio).
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")

    // FusedLocation: fija ubicación fusionando GPS+WiFi+celular, con accuracyMeters por fix.
    implementation("com.google.android.gms:play-services-location:21.3.0")

    // WorkManager: envío diferido por lotes (3.3), con reintentos + constraint de red.
    implementation("androidx.work:work-runtime-ktx:2.9.1")
}
