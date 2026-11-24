import fs from "node:fs";
import path from "node:path";

const androidDir = path.resolve("android");
const appDir = path.join(androidDir, "app");
const rootGradlePath = path.join(androidDir, "build.gradle");
const manifestPath = path.join(appDir, "src/main/AndroidManifest.xml");
const buildGradlePath = path.join(appDir, "build.gradle");
const proguardPath = path.join(appDir, "proguard-rules.pro");
const stringsPath = path.join(appDir, "src/main/res/values/strings.xml");
const resXmlDir = path.join(appDir, "src/main/res/xml");
const resLayoutDir = path.join(appDir, "src/main/res/layout");

if (!fs.existsSync(manifestPath)) {
  console.error("Android project directory not found at android/app");
  process.exit(1);
}

fs.mkdirSync(resXmlDir, { recursive: true });
fs.mkdirSync(resLayoutDir, { recursive: true });

// Read package name from build.gradle or capacitor config
let appId = "com.moviehub.plus";
const gradleText = fs.readFileSync(buildGradlePath, "utf8");
const idMatch = /applicationId\s+"([^"]+)"/.exec(gradleText);
if (idMatch?.[1]) {
  appId = idMatch[1];
} else {
  const capJsonPath = path.join(appDir, "src/main/assets/capacitor.config.json");
  if (fs.existsSync(capJsonPath)) {
    try {
      const capCfg = JSON.parse(fs.readFileSync(capJsonPath, "utf8"));
      if (capCfg?.appId) appId = capCfg.appId;
    } catch {
      /* fallback to default */
    }
  }
}

const pkgPath = appId.replace(/\./g, "/");
const srcPkgDir = path.join(appDir, "src/main/java", pkgPath);
fs.mkdirSync(srcPkgDir, { recursive: true });

// Remove legacy Java entry/widget files so Kotlin implementations compile cleanly
for (const legacyFile of ["MainActivity.java", "MukulAppWidget.java", "MukulWeatherWidget.java"]) {
  const p = path.join(srcPkgDir, legacyFile);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

// 1. Update strings.xml branding to Movie Hub+
if (fs.existsSync(stringsPath)) {
  let stringsXml = fs.readFileSync(stringsPath, "utf8");
  stringsXml = stringsXml
    .replace(/<string name="app_name">[^<]*<\/string>/, '<string name="app_name">Movie Hub+</string>')
    .replace(/<string name="title_activity_main">[^<]*<\/string>/, '<string name="title_activity_main">Movie Hub+</string>');
  fs.writeFileSync(stringsPath, stringsXml, "utf8");
}

// 2. Network Security Config: trust ONLY system CAs (blocks user-installed MITM proxy certs like Charles/Burp/HTTP Toolkit)
fs.writeFileSync(
  path.join(resXmlDir, "network_security_config.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="true">
    <trust-anchors>
      <certificates src="system" />
    </trust-anchors>
  </base-config>
</network-security-config>
`,
  "utf8"
);

// 3. Native Android Home-Screen Widget Layouts (Movie Hub+)
fs.writeFileSync(
  path.join(resLayoutDir, "widget_moviehub_app.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:id="@+id/widget_app_root"
  android:layout_width="match_parent"
  android:layout_height="match_parent"
  android:orientation="vertical"
  android:padding="14dp"
  android:background="#0B150E">

  <LinearLayout
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:orientation="horizontal"
    android:gravity="center_vertical">

    <TextView
      android:layout_width="0dp"
      android:layout_height="wrap_content"
      android:layout_weight="1"
      android:text="Movie Hub+"
      android:textColor="#2EE83F"
      android:textSize="16sp"
      android:textStyle="bold" />

    <TextView
      android:layout_width="wrap_content"
      android:layout_height="wrap_content"
      android:text="10X SHIELD"
      android:textColor="#8DA398"
      android:textSize="10sp"
      android:textStyle="bold" />
  </LinearLayout>

  <TextView
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="4dp"
    android:text="লাইভ স্পোর্টস, Mukul Movie, ড্রামা ও মিউজিক"
    android:textColor="#EEF7F0"
    android:textSize="11sp" />

  <LinearLayout
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="10dp"
    android:orientation="horizontal">

    <Button
      android:id="@+id/btn_open_sports"
      android:layout_width="0dp"
      android:layout_height="36dp"
      android:layout_weight="1"
      android:layout_marginEnd="6dp"
      android:background="#2EE83F"
      android:text="লাইভ ম্যাচ"
      android:textColor="#040A06"
      android:textSize="11sp"
      android:textStyle="bold" />

    <Button
      android:id="@+id/btn_open_movies"
      android:layout_width="0dp"
      android:layout_height="36dp"
      android:layout_weight="1"
      android:background="#112017"
      android:text="Movie Hub+"
      android:textColor="#EEF7F0"
      android:textSize="11sp"
      android:textStyle="bold" />
  </LinearLayout>
</LinearLayout>
`,
  "utf8"
);

fs.writeFileSync(
  path.join(resLayoutDir, "widget_moviehub_weather.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:id="@+id/widget_wx_root"
  android:layout_width="match_parent"
  android:layout_height="match_parent"
  android:orientation="vertical"
  android:padding="14dp"
  android:background="#09140C">

  <LinearLayout
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:orientation="horizontal"
    android:gravity="center_vertical">

    <TextView
      android:id="@+id/wx_city"
      android:layout_width="0dp"
      android:layout_height="wrap_content"
      android:layout_weight="1"
      android:text="ঢাকা · আবহাওয়া"
      android:textColor="#8DA398"
      android:textSize="12sp"
      android:textStyle="bold" />

    <TextView
      android:id="@+id/wx_refresh"
      android:layout_width="wrap_content"
      android:layout_height="wrap_content"
      android:padding="4dp"
      android:text="রিফ্রেশ ↻"
      android:textColor="#2EE83F"
      android:textSize="11sp"
      android:textStyle="bold" />
  </LinearLayout>

  <TextView
    android:id="@+id/wx_temp"
    android:layout_width="wrap_content"
    android:layout_height="wrap_content"
    android:layout_marginTop="4dp"
    android:text="--°C"
    android:textColor="#EEF7F0"
    android:textSize="28sp"
    android:textStyle="bold" />

  <TextView
    android:id="@+id/wx_cond"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="2dp"
    android:text="তথ্য লোড করতে ট্যাপ করুন"
    android:textColor="#2EE83F"
    android:textSize="12sp" />
</LinearLayout>
`,
  "utf8"
);

// 4. AppWidgetProvider metadata XMLs
fs.writeFileSync(
  path.join(resXmlDir, "widget_moviehub_app_info.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:minWidth="250dp"
  android:minHeight="110dp"
  android:targetCellWidth="4"
  android:targetCellHeight="2"
  android:updatePeriodMillis="1800000"
  android:initialLayout="@layout/widget_moviehub_app"
  android:resizeMode="horizontal|vertical"
  android:widgetCategory="home_screen" />
`,
  "utf8"
);

fs.writeFileSync(
  path.join(resXmlDir, "widget_moviehub_weather_info.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:minWidth="180dp"
  android:minHeight="110dp"
  android:targetCellWidth="3"
  android:targetCellHeight="2"
  android:updatePeriodMillis="1800000"
  android:initialLayout="@layout/widget_moviehub_weather"
  android:resizeMode="horizontal|vertical"
  android:widgetCategory="home_screen" />
`,
  "utf8"
);

// 5. Full Kotlin Android 10-Layer Security Shield (SecurityShield.kt)
fs.writeFileSync(
  path.join(srcPkgDir, "SecurityShield.kt"),
  `package ${appId}

import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.os.Build
import android.os.Debug
import java.io.File
import java.net.InetSocketAddress
import java.net.Socket
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

data class SecurityVerdict(
  val shieldScore: Int,
  val isDebuggable: Boolean,
  val debuggerAttached: Boolean,
  val rootDetected: Boolean,
  val hookFrameworkDetected: Boolean,
  val proxyDetected: Boolean,
  val emulatorDetected: Boolean,
  val signatureSha256: String
) {
  val isCompromised: Boolean
    get() = debuggerAttached || hookFrameworkDetected
}

object SecurityShield {
  private val rootPaths = arrayOf(
    "/system/app/Superuser.apk",
    "/sbin/su",
    "/system/bin/su",
    "/system/xbin/su",
    "/data/local/xbin/su",
    "/data/local/bin/su",
    "/system/sd/xbin/su",
    "/data/local/su",
    "/su/bin/su",
    "/system/bin/magisk",
    "/data/adb/magisk"
  )

  private val hookMarkers = arrayOf(
    "frida",
    "xposed",
    "lsposed",
    "edxposed",
    "substrate",
    "cydia"
  )

  fun verifyEnvironment(context: Context): SecurityVerdict {
    val isDebuggable = (context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
    val debugger = Debug.isDebuggerConnected() || Debug.waitingForDebugger()
    val rooted = detectRoot()
    val hooked = detectHooks() || detectFridaPort()
    val proxy = detectActiveProxy()
    val emulator = detectEmulator()
    val sig = getSignatureSha256(context)

    var score = 10
    if (isDebuggable) score -= 2
    if (debugger) score -= 3
    if (rooted) score -= 1
    if (hooked) score -= 3
    if (proxy) score -= 1

    return SecurityVerdict(
      shieldScore = score.coerceIn(1, 10),
      isDebuggable = isDebuggable,
      debuggerAttached = debugger,
      rootDetected = rooted,
      hookFrameworkDetected = hooked,
      proxyDetected = proxy,
      emulatorDetected = emulator,
      signatureSha256 = sig
    )
  }

  private fun detectRoot(): Boolean {
    if (Build.TAGS?.contains("test-keys") == true) return true
    return rootPaths.any { File(it).exists() }
  }

  private fun detectHooks(): Boolean {
    val stack = Thread.currentThread().stackTrace.joinToString("\\n") { it.className.lowercase() }
    if (hookMarkers.any { stack.contains(it) }) return true
    return try {
      val maps = File("/proc/self/maps").readText().lowercase()
      hookMarkers.any { maps.contains(it) }
    } catch (_: Exception) {
      false
    }
  }

  private fun detectFridaPort(): Boolean {
    val ports = intArrayOf(27042, 27043)
    for (port in ports) {
      try {
        Socket().use { sock ->
          sock.connect(InetSocketAddress("127.0.0.1", port), 120)
          return true
        }
      } catch (_: Exception) {
        // Closed port is expected
      }
    }
    return false
  }

  private fun detectActiveProxy(): Boolean {
    val host = System.getProperty("http.proxyHost") ?: System.getProperty("https.proxyHost")
    return !host.isNullOrBlank()
  }

  private fun detectEmulator(): Boolean {
    val fp = Build.FINGERPRINT.lowercase()
    val model = Build.MODEL.lowercase()
    val product = Build.PRODUCT.lowercase()
    return fp.startsWith("generic") ||
      fp.startsWith("unknown") ||
      model.contains("emulator") ||
      model.contains("sdk_gphone") ||
      product.contains("sdk")
  }

  @Suppress("DEPRECATION")
  fun getSignatureSha256(context: Context): String {
    return try {
      val pm = context.packageManager
      val pkgName = context.packageName
      val sigBytes = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        val info = pm.getPackageInfo(pkgName, PackageManager.GET_SIGNING_CERTIFICATES)
        info.signingInfo?.apkContentsSigners?.firstOrNull()?.toByteArray()
      } else {
        val info = pm.getPackageInfo(pkgName, PackageManager.GET_SIGNATURES)
        info.signatures?.firstOrNull()?.toByteArray()
      } ?: return ""
      val digest = MessageDigest.getInstance("SHA-256").digest(sigBytes)
      digest.joinToString("") { "%02x".format(it) }
    } catch (_: Exception) {
      ""
    }
  }

  fun sealData(plain: ByteArray, keyBytes: ByteArray): ByteArray {
    val iv = ByteArray(12).also { SecureRandom().nextBytes(it) }
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(keyBytes.copyOf(32), "AES"), GCMParameterSpec(128, iv))
    val encrypted = cipher.doFinal(plain)
    return iv + encrypted
  }

  fun unsealData(payload: ByteArray, keyBytes: ByteArray): ByteArray {
    val iv = payload.copyOfRange(0, 12)
    val cipherText = payload.copyOfRange(12, payload.size)
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(keyBytes.copyOf(32), "AES"), GCMParameterSpec(128, iv))
    return cipher.doFinal(cipherText)
  }
}
`,
  "utf8"
);

// 6. Full Kotlin MainActivity.kt (BridgeActivity + PiP + FLAG_SECURE + Hardened WebView)
fs.writeFileSync(
  path.join(srcPkgDir, "MainActivity.kt"),
  `package ${appId}

import android.app.PictureInPictureParams
import android.content.res.Configuration
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.util.Rational
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.getcapacitor.BridgeActivity
import java.util.concurrent.Executors

class MainActivity : BridgeActivity() {
  @Volatile
  private var lastVerdict: SecurityVerdict? = null
  @Volatile
  private var pipAllowed: Boolean = false
  private val secExecutor = Executors.newSingleThreadExecutor()

  @Suppress("DEPRECATION")
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    window.statusBarColor = Color.parseColor("#040A06")
    window.navigationBarColor = Color.parseColor("#040A06")
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)

    hardenWebView()

    secExecutor.execute {
      val verdict = SecurityShield.verifyEnvironment(applicationContext)
      lastVerdict = verdict
      if (verdict.isCompromised) {
        runOnUiThread {
          bridge?.webView?.loadUrl("about:blank")
          finishAffinity()
        }
      }
    }
  }

  private fun hardenWebView() {
    val wv = bridge?.webView ?: return
    WebView.setWebContentsDebuggingEnabled(false)
    wv.settings.apply {
      allowFileAccess = false
      allowContentAccess = false
      @Suppress("DEPRECATION")
      allowFileAccessFromFileURLs = false
      @Suppress("DEPRECATION")
      allowUniversalAccessFromFileURLs = false
      domStorageEnabled = true
      databaseEnabled = true
      mediaPlaybackRequiresUserGesture = false
    }
    wv.addJavascriptInterface(MovieHubNativeBridge(), "MovieHubNative")
  }

  override fun onUserLeaveHint() {
    super.onUserLeaveHint()
    if (pipAllowed) {
      triggerPipMode()
    }
  }

  override fun onPictureInPictureModeChanged(isInPictureInPictureMode: Boolean, newConfig: Configuration) {
    super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
    val js = "window.dispatchEvent(new CustomEvent('moviehub:pip', { detail: { active: $isInPictureInPictureMode } }));"
    bridge?.webView?.post {
      bridge?.webView?.evaluateJavascript(js, null)
    }
  }

  fun triggerPipMode(): Boolean {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      return try {
        val params = PictureInPictureParams.Builder()
          .setAspectRatio(Rational(16, 9))
          .build()
        enterPictureInPictureMode(params)
      } catch (_: Exception) {
        false
      }
    }
    return false
  }

  override fun onDestroy() {
    secExecutor.shutdownNow()
    super.onDestroy()
  }

  inner class MovieHubNativeBridge {
    @JavascriptInterface
    fun getAppBrand(): String = "Movie Hub+"

    @JavascriptInterface
    fun getSecurityLevel(): Int = lastVerdict?.shieldScore ?: 10

    @JavascriptInterface
    fun setPipEnabled(enabled: Boolean) {
      pipAllowed = enabled
    }

    @JavascriptInterface
    fun enterPip(): Boolean {
      runOnUiThread { triggerPipMode() }
      return Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
    }
  }
}
`,
  "utf8"
);

// 7. Native Kotlin Widget Providers
fs.writeFileSync(
  path.join(srcPkgDir, "MovieHubAppWidget.kt"),
  `package ${appId}

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

class MovieHubAppWidget : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    for (id in ids) {
      val views = RemoteViews(context.packageName, R.layout.widget_moviehub_app)
      val openApp = Intent(context, MainActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      }
      val pi = PendingIntent.getActivity(
        context,
        101,
        openApp,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
      views.setOnClickPendingIntent(R.id.widget_app_root, pi)
      views.setOnClickPendingIntent(R.id.btn_open_sports, pi)
      views.setOnClickPendingIntent(R.id.btn_open_movies, pi)
      manager.updateAppWidget(id, views)
    }
  }
}
`,
  "utf8"
);

fs.writeFileSync(
  path.join(srcPkgDir, "MovieHubWeatherWidget.kt"),
  `package ${appId}

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import kotlin.math.roundToInt

class MovieHubWeatherWidget : AppWidgetProvider() {
  companion object {
    private const val ACTION_REFRESH = "${appId}.ACTION_WX_REFRESH"
  }

  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    for (id in ids) {
      val views = RemoteViews(context.packageName, R.layout.widget_moviehub_weather)
      val openApp = Intent(context, MainActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      }
      val openPi = PendingIntent.getActivity(
        context,
        201,
        openApp,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
      views.setOnClickPendingIntent(R.id.widget_wx_root, openPi)

      val refreshIntent = Intent(context, MovieHubWeatherWidget::class.java).apply {
        action = ACTION_REFRESH
        putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
      }
      val refreshPi = PendingIntent.getBroadcast(
        context,
        id,
        refreshIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
      views.setOnClickPendingIntent(R.id.wx_refresh, refreshPi)
      manager.updateAppWidget(id, views)
      fetchAsync(context, manager, id)
    }
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    if (ACTION_REFRESH == intent.action) {
      val id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
      if (id != AppWidgetManager.INVALID_APPWIDGET_ID) {
        fetchAsync(context, AppWidgetManager.getInstance(context), id)
      }
    }
  }

  private fun fetchAsync(context: Context, manager: AppWidgetManager, widgetId: Int) {
    Thread {
      try {
        val url = URL("https://api.open-meteo.com/v1/forecast?latitude=23.8103&longitude=90.4125&current=temperature_2m,relative_humidity_2m,wind_speed_10m")
        val conn = (url.openConnection() as HttpURLConnection).apply {
          connectTimeout = 6000
          readTimeout = 6000
        }
        val body = BufferedReader(InputStreamReader(conn.inputStream)).use { it.readText() }
        val cur = JSONObject(body).getJSONObject("current")
        val temp = cur.optDouble("temperature_2m", 0.0).roundToInt()
        val hum = cur.optInt("relative_humidity_2m", 0)
        val views = RemoteViews(context.packageName, R.layout.widget_moviehub_weather).apply {
          setTextViewText(R.id.wx_city, "ঢাকা · Movie Hub+ আবহাওয়া")
          setTextViewText(R.id.wx_temp, "${'$'}temp°C")
          setTextViewText(R.id.wx_cond, "আর্দ্রতা ${'$'}hum% · লাইভ আপডেট")
        }
        manager.updateAppWidget(widgetId, views)
      } catch (_: Exception) {
        // Ignore transient network errors in home-screen widget
      }
    }.start()
  }
}
`,
  "utf8"
);

// 8. Harden AndroidManifest.xml: allowBackup=false, networkSecurityConfig, FOREGROUND_SERVICE, WAKE_LOCK, PiP, Kotlin Widget Receivers
let manifest = fs.readFileSync(manifestPath, "utf8");
manifest = manifest.replace(/android:allowBackup="true"/g, 'android:allowBackup="false"');
if (!manifest.includes("android:allowBackup=")) {
  manifest = manifest.replace(/<application\b/, '<application android:allowBackup="false"');
}
if (!manifest.includes("android:networkSecurityConfig=")) {
  manifest = manifest.replace(
    /<application\b/,
    '<application android:networkSecurityConfig="@xml/network_security_config"'
  );
}

for (const perm of [
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.WAKE_LOCK",
  "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
]) {
  if (!manifest.includes(perm)) {
    manifest = manifest.replace(
      /<application\b/,
      `<uses-permission android:name="${perm}" />\n    <application`
    );
  }
}

if (!manifest.includes("android:supportsPictureInPicture=")) {
  manifest = manifest.replace(
    /<activity\b/,
    '<activity android:supportsPictureInPicture="true" android:resizeableActivity="true"'
  );
}

if (!manifest.includes("MovieHubAppWidget")) {
  manifest = manifest.replace(
    "</application>",
    `    <receiver android:name=".MovieHubAppWidget" android:exported="true" android:label="Movie Hub+ অ্যাপ উইগেট">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
      </intent-filter>
      <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_moviehub_app_info" />
    </receiver>
    <receiver android:name=".MovieHubWeatherWidget" android:exported="true" android:label="Movie Hub+ ওয়েদার উইগেট">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
      </intent-filter>
      <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_moviehub_weather_info" />
    </receiver>
    </application>`
  );
}
fs.writeFileSync(manifestPath, manifest, "utf8");

// 9. Configure Root build.gradle for Kotlin Android Plugin (1.9.25 compatible with AGP 8.7.2 & Java 21)
if (fs.existsSync(rootGradlePath)) {
  let rootGradle = fs.readFileSync(rootGradlePath, "utf8");
  if (!rootGradle.includes("kotlin_version")) {
    rootGradle = rootGradle.replace(
      "buildscript {",
      "buildscript {\n    ext.kotlin_version = '1.9.25'"
    );
  }
  if (!rootGradle.includes("kotlin-gradle-plugin")) {
    rootGradle = rootGradle.replace(
      "classpath 'com.android.tools.build:gradle:8.7.2'",
      "classpath 'com.android.tools.build:gradle:8.7.2'\n        classpath \"org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlin_version\""
    );
  }
  fs.writeFileSync(rootGradlePath, rootGradle, "utf8");
}

// 10. Harden app/build.gradle: apply kotlin-android, JVM 21 options, core-ktx, AGP 8+ proguard-android-optimize.txt, R8 minify + shrinkResources
let gradle = fs.readFileSync(buildGradlePath, "utf8");
if (!gradle.includes("kotlin-android")) {
  gradle = gradle.replace(
    "apply plugin: 'com.android.application'",
    "apply plugin: 'com.android.application'\napply plugin: 'kotlin-android'"
  );
}
if (!gradle.includes("kotlinOptions")) {
  gradle = gradle.replace(
    "buildTypes {",
    `compileOptions {
        sourceCompatibility JavaVersion.VERSION_21
        targetCompatibility JavaVersion.VERSION_21
    }
    kotlinOptions {
        jvmTarget = '21'
    }
    buildTypes {`
  );
}
if (!gradle.includes("core-ktx")) {
  gradle = gradle.replace(
    "dependencies {",
    `dependencies {
    implementation "org.jetbrains.kotlin:kotlin-stdlib:1.9.25"
    implementation "androidx.core:core-ktx:1.15.0"`
  );
}
gradle = gradle.replace(/minifyEnabled\s+false/g, "minifyEnabled true\n            shrinkResources true");
gradle = gradle.replace(/getDefaultProguardFile\(['"]proguard-android\.txt['"]\)/g, "getDefaultProguardFile('proguard-android-optimize.txt')");
fs.writeFileSync(buildGradlePath, gradle, "utf8");

// 11. 10x R8 / ProGuard Obfuscation Rules
const extraRules = `
-repackageclasses 'mh'
-allowaccessmodification
-keepattributes JavascriptInterface,AnnotationDefault,*Annotation*,Signature,InnerClasses,EnclosingMethod
-keepclassmembers class * { @android.webkit.JavascriptInterface <methods>; }
-keep class ${appId}.MainActivity { *; }
-keep class ${appId}.MainActivity$MovieHubNativeBridge { *; }
-keep class ${appId}.SecurityShield { *; }
-keep class ${appId}.SecurityVerdict { *; }
-keep class ${appId}.MovieHubAppWidget { *; }
-keep class ${appId}.MovieHubWeatherWidget { *; }
-keep class com.getcapacitor.** { *; }
-keep class com.capacitorjs.** { *; }
-dontwarn com.getcapacitor.**
-dontwarn com.capacitorjs.**
-dontwarn kotlin.**
-dontwarn kotlinx.**
-assumenosideeffects class android.util.Log {
  public static boolean isLoggable(java.lang.String, int);
  public static int v(...);
  public static int i(...);
  public static int w(...);
  public static int d(...);
  public static int e(...);
}
`;
const curProguard = fs.existsSync(proguardPath) ? fs.readFileSync(proguardPath, "utf8") : "";
if (!curProguard.includes("-repackageclasses")) {
  fs.writeFileSync(proguardPath, curProguard + extraRules, "utf8");
}

console.log("Movie Hub+ Kotlin Android, 10x SecurityShield, PiP, R8 & home-screen widgets applied.");
