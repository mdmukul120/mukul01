import fs from "node:fs";
import path from "node:path";

const androidDir = path.resolve("android");
const appDir = path.join(androidDir, "app");
const manifestPath = path.join(appDir, "src/main/AndroidManifest.xml");
const buildGradlePath = path.join(appDir, "build.gradle");
const proguardPath = path.join(appDir, "proguard-rules.pro");
const resXmlDir = path.join(appDir, "src/main/res/xml");
const resLayoutDir = path.join(appDir, "src/main/res/layout");

if (!fs.existsSync(manifestPath)) {
  console.error("Android project directory not found at android/app");
  process.exit(1);
}

fs.mkdirSync(resXmlDir, { recursive: true });
fs.mkdirSync(resLayoutDir, { recursive: true });

// Read package name from build.gradle or capacitor config
let appId = "com.mukul.plus";
try {
  const capCfg = JSON.parse(fs.readFileSync(path.resolve("capacitor.config.json"), "utf8"));
  if (capCfg?.appId) appId = capCfg.appId;
} catch {
  const gradleText = fs.readFileSync(buildGradlePath, "utf8");
  const m = /applicationId\s+"([^"]+)"/.exec(gradleText);
  if (m) appId = m[1];
}
const pkgPath = appId.replace(/\./g, "/");
const javaPkgDir = path.join(appDir, "src/main/java", pkgPath);
fs.mkdirSync(javaPkgDir, { recursive: true });

// 1. Network Security Config: trust ONLY system CAs (blocks user-installed MITM proxy certs like Charles/Burp/HTTP Toolkit)
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

// 2. Native Android Home-Screen Widget Layouts
fs.writeFileSync(
  path.join(resLayoutDir, "widget_mukul_app.xml"),
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
      android:text="Mukul Plus"
      android:textColor="#2EE83F"
      android:textSize="15sp"
      android:textStyle="bold" />

    <TextView
      android:layout_width="wrap_content"
      android:layout_height="wrap_content"
      android:text="APP WIDGET"
      android:textColor="#8DA398"
      android:textSize="10sp"
      android:textStyle="bold" />
  </LinearLayout>

  <TextView
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="4dp"
    android:text="লাইভ স্পোর্টস, Mukul Movie, মুকুল ড্রামা ও মিউজিক"
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
      android:text="Mukul Movie"
      android:textColor="#EEF7F0"
      android:textSize="11sp"
      android:textStyle="bold" />
  </LinearLayout>
</LinearLayout>
`,
  "utf8"
);

fs.writeFileSync(
  path.join(resLayoutDir, "widget_mukul_weather.xml"),
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

// 3. AppWidgetProvider metadata XMLs
fs.writeFileSync(
  path.join(resXmlDir, "widget_mukul_app_info.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:minWidth="250dp"
  android:minHeight="110dp"
  android:targetCellWidth="4"
  android:targetCellHeight="2"
  android:updatePeriodMillis="1800000"
  android:initialLayout="@layout/widget_mukul_app"
  android:resizeMode="horizontal|vertical"
  android:widgetCategory="home_screen" />
`,
  "utf8"
);

fs.writeFileSync(
  path.join(resXmlDir, "widget_mukul_weather_info.xml"),
  `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:minWidth="180dp"
  android:minHeight="110dp"
  android:targetCellWidth="3"
  android:targetCellHeight="2"
  android:updatePeriodMillis="1800000"
  android:initialLayout="@layout/widget_mukul_weather"
  android:resizeMode="horizontal|vertical"
  android:widgetCategory="home_screen" />
`,
  "utf8"
);

// 4. Native Java Widget Providers
fs.writeFileSync(
  path.join(javaPkgDir, "MukulAppWidget.java"),
  `package ${appId};

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

public class MukulAppWidget extends AppWidgetProvider {
  @Override
  public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
    for (int id : ids) {
      RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_mukul_app);
      Intent openApp = new Intent(context, MainActivity.class);
      openApp.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
      PendingIntent pi = PendingIntent.getActivity(context, 101, openApp, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
      views.setOnClickPendingIntent(R.id.widget_app_root, pi);
      views.setOnClickPendingIntent(R.id.btn_open_sports, pi);
      views.setOnClickPendingIntent(R.id.btn_open_movies, pi);
      manager.updateAppWidget(id, views);
    }
  }
}
`,
  "utf8"
);

fs.writeFileSync(
  path.join(javaPkgDir, "MukulWeatherWidget.java"),
  `package ${appId};

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONObject;

public class MukulWeatherWidget extends AppWidgetProvider {
  private static final String ACTION_REFRESH = "${appId}.ACTION_WX_REFRESH";

  @Override
  public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
    for (int id : ids) {
      RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_mukul_weather);
      Intent openApp = new Intent(context, MainActivity.class);
      openApp.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
      PendingIntent openPi = PendingIntent.getActivity(context, 201, openApp, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
      views.setOnClickPendingIntent(R.id.widget_wx_root, openPi);

      Intent refreshIntent = new Intent(context, MukulWeatherWidget.class);
      refreshIntent.setAction(ACTION_REFRESH);
      refreshIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
      PendingIntent refreshPi = PendingIntent.getBroadcast(context, id, refreshIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
      views.setOnClickPendingIntent(R.id.wx_refresh, refreshPi);
      manager.updateAppWidget(id, views);
      fetchAsync(context, manager, id);
    }
  }

  @Override
  public void onReceive(Context context, Intent intent) {
    super.onReceive(context, intent);
    if (ACTION_REFRESH.equals(intent.getAction())) {
      int id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
      if (id != AppWidgetManager.INVALID_APPWIDGET_ID) {
        fetchAsync(context, AppWidgetManager.getInstance(context), id);
      }
    }
  }

  private void fetchAsync(final Context context, final AppWidgetManager manager, final int widgetId) {
    new Thread(() -> {
      try {
        URL u = new URL("https://geocoding-api.open-meteo.com/v1/forecast?latitude=23.8103&longitude=90.4125&current=temperature_2m,relative_humidity_2m,wind_speed_10m");
        HttpURLConnection conn = (HttpURLConnection) u.openConnection();
        conn.setConnectTimeout(6000);
        conn.setReadTimeout(6000);
        BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream()));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = br.readLine()) != null) sb.append(line);
        br.close();
        JSONObject cur = new JSONObject(sb.toString()).getJSONObject("current");
        double temp = cur.optDouble("temperature_2m", 0);
        int hum = cur.optInt("relative_humidity_2m", 0);
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_mukul_weather);
        views.setTextViewText(R.id.wx_city, "ঢাকা · আবহাওয়া");
        views.setTextViewText(R.id.wx_temp, Math.round(temp) + "°C");
        views.setTextViewText(R.id.wx_cond, "আর্দ্রতা " + hum + "% · লাইভ আপডেট");
        manager.updateAppWidget(widgetId, views);
      } catch (Exception ignored) {
      }
    }).start();
  }
}
`,
  "utf8"
);

// 5. Harden AndroidManifest.xml: allowBackup=false, networkSecurityConfig, FOREGROUND_SERVICE, WAKE_LOCK, PiP, Receivers
let manifest = fs.readFileSync(manifestPath, "utf8");
manifest = manifest.replace(/android:allowBackup="true"/g, 'android:allowBackup="false"');
if (!manifest.includes("android:allowBackup=")) {
  manifest = manifest.replace("<application ", '<application android:allowBackup="false" ');
}
if (!manifest.includes("android:networkSecurityConfig=")) {
  manifest = manifest.replace(
    "<application ",
    '<application android:networkSecurityConfig="@xml/network_security_config" '
  );
}

for (const perm of [
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.WAKE_LOCK",
  "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
]) {
  if (!manifest.includes(perm)) {
    manifest = manifest.replace(
      "<application",
      `<uses-permission android:name="${perm}" />\n    <application`
    );
  }
}

if (!manifest.includes("android:supportsPictureInPicture=")) {
  manifest = manifest.replace(
    "<activity",
    '<activity android:supportsPictureInPicture="true"'
  );
}

if (!manifest.includes("MukulAppWidget")) {
  manifest = manifest.replace(
    "</application>",
    `    <receiver android:name=".MukulAppWidget" android:exported="true" android:label="Mukul Plus অ্যাপ উইগেট">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
      </intent-filter>
      <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_mukul_app_info" />
    </receiver>
    <receiver android:name=".MukulWeatherWidget" android:exported="true" android:label="Mukul ওয়েদার উইগেট">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
      </intent-filter>
      <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_mukul_weather_info" />
    </receiver>
    </application>`
  );
}
fs.writeFileSync(manifestPath, manifest, "utf8");

// 6. Harden Gradle & R8/ProGuard 4x rules
let gradle = fs.readFileSync(buildGradlePath, "utf8");
gradle = gradle.replace(/minifyEnabled\s+false/g, "minifyEnabled true\n            shrinkResources true");
fs.writeFileSync(buildGradlePath, gradle, "utf8");

const extraRules = `
-repackageclasses 'o'
-allowaccessmodification
-optimizationpasses 5
-keepattributes *Annotation*
-keepclassmembers class * { @android.webkit.JavascriptInterface <methods>; }
-keep class com.getcapacitor.** { *; }
-dontwarn com.getcapacitor.**
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

console.log("Android 4x security, PiP, network security config & home-screen widgets applied.");
