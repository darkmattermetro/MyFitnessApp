const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');

const RATIONALE_ACTION = 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE';
const USAGE_ACTION = 'android.intent.action.VIEW_PERMISSION_USAGE';
const ALIAS_NAME = 'ViewPermissionUsageActivity';
const RATIONALE_CLASS = 'HealthConnectRationaleActivity';

const source = (packageName) => `package ${packageName}

import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

class ${RATIONALE_CLASS} : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    window.statusBarColor = Color.rgb(11, 17, 20)
    window.navigationBarColor = Color.rgb(11, 17, 20)
    val background = Color.rgb(11, 17, 20)
    val padding = (20 * resources.displayMetrics.density).toInt()
    val layout = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(padding, padding, padding, padding)
      setBackgroundColor(background)
    }
    val title = TextView(this).apply {
      text = "OpenFit health data privacy"
      textSize = 22f
      setTextColor(Color.rgb(237, 244, 241))
      setPadding(0, 0, 0, padding)
    }
    val body = TextView(this).apply {
      textSize = 16f
      setTextColor(Color.rgb(160, 173, 169))
      text = "Health records\\nOpenFit reads only the Health Connect metrics you grant: daily steps, active calories, and sleep sessions. It does not write health records. Imported daily totals are stored in your OpenFit account and used for your activity charts and insights. You can revoke access in Health Connect settings at any time.\\n\\nStorage and access\\nAccount data is stored in OpenFit's Supabase project and protected by user-level access policies. Your Gemini key is stored on this device in Android SecureStore.\\n\\nAI processing\\nWhen you choose an AI feature and accept its notice, the meal text or photo, saved food preferences, recent coach chat, or selected health/profile context needed for that request is sent to Google Gemini. Gemini quotas or charges may apply to your key. AI nutrition and fitness responses are estimates and should be reviewed.\\n\\nRetention and deletion\\nAccount data remains until you delete it. Export your data from Profile. Deleting your OpenFit account removes your cloud profile, health summaries, meals, workouts, weight entries, preferences, and achievements. Health Connect records remain with their provider."
      setLineSpacing(0f, 1.2f)
    }
    val done = Button(this).apply {
      text = "Done"
      setOnClickListener { finish() }
    }
    layout.addView(title)
    layout.addView(body, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
    layout.addView(done, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
      topMargin = padding
    })
    val scroll = ScrollView(this).apply { addView(layout) }
    setContentView(scroll)
  }
}
`;

function removeAction(activity, actionName) {
  activity['intent-filter'] = (activity['intent-filter'] || []).filter((filter) =>
    !((Array.isArray(filter.action) ? filter.action : [filter.action]).filter(Boolean))
      .some((action) => action.$?.['android:name'] === actionName)
  );
}

module.exports = function withHealthConnectRationale(config) {
  config = withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application?.[0];
    if (!app) return mod;
    const packageName = config.android?.package || mod.modResults.manifest.$?.package;
    if (!packageName) throw new Error('Set android.package before configuring the Health Connect rationale.');
    const fullName = packageName + '.' + RATIONALE_CLASS;
    const mainActivity = (app.activity || []).find((activity) =>
      String(activity.$?.['android:name'] || '').endsWith('.MainActivity')
    );
    if (mainActivity) removeAction(mainActivity, RATIONALE_ACTION);
    app.activity = app.activity || [];
    const existing = app.activity.find((activity) => activity.$?.['android:name'] === fullName);
    const rationaleActivity = existing || {
    $: {
      'android:name': fullName,
      'android:exported': 'true',
      'android:theme': '@android:style/Theme.Material.NoActionBar',
    },
      'intent-filter': [],
    };
    removeAction(rationaleActivity, RATIONALE_ACTION);
    rationaleActivity['intent-filter'] = rationaleActivity['intent-filter'] || [];
    rationaleActivity['intent-filter'].push({
      action: [{ $: { 'android:name': RATIONALE_ACTION } }],
    });
    if (!existing) app.activity.push(rationaleActivity);

    const alias = (app['activity-alias'] || []).find((activity) => activity.$?.['android:name'] === ALIAS_NAME);
    if (alias) alias.$['android:targetActivity'] = fullName;
    else {
      app['activity-alias'] = app['activity-alias'] || [];
      app['activity-alias'].push({
        $: {
          'android:name': ALIAS_NAME,
          'android:exported': 'true',
          'android:targetActivity': fullName,
          'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE',
        },
        'intent-filter': [{
          action: [{ $: { 'android:name': USAGE_ACTION } }],
          category: [{ $: { 'android:name': 'android.intent.category.HEALTH_PERMISSIONS' } }],
        }],
      });
    }
    return mod;
  });

  return withDangerousMod(config, ['android', async (mod) => {
    const packageName = config.android?.package;
    if (!packageName) throw new Error('Set android.package before generating the Health Connect rationale activity.');
    const packagePath = packageName.split('.').join(path.sep);
    const javaDir = path.join(mod.modRequest.platformProjectRoot, 'app', 'src', 'main', 'java', packagePath);
    await fs.promises.mkdir(javaDir, { recursive: true });
    await fs.promises.writeFile(path.join(javaDir, RATIONALE_CLASS + '.kt'), source(packageName), 'utf8');
    return mod;
  }]);
};
