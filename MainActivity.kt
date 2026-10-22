package ke.ac.floodalert

import android.app.Activity
import android.os.Bundle
import android.view.ViewGroup
import android.widget.*
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

class MainActivity : Activity() {
    private var token = ""
    private lateinit var status: TextView
    private lateinit var output: TextView
    private lateinit var email: EditText
    private lateinit var password: EditText
    private lateinit var type: Spinner
    private lateinit var location: EditText
    private lateinit var description: EditText
    private lateinit var phone: EditText

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val scroll = ScrollView(this)
        val page = LinearLayout(this).apply { orientation=LinearLayout.VERTICAL; setPadding(28,28,28,28) }
        scroll.addView(page); setContentView(scroll)
        fun heading(s:String) { page.addView(TextView(this).apply { text=s; textSize=22f; setPadding(0,22,0,8) }) }
        fun field(h:String, secret:Boolean=false):EditText {
            val v=EditText(this); v.hint=h
            if(secret) v.inputType=android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD
            page.addView(v,ViewGroup.LayoutParams(-1,ViewGroup.LayoutParams.WRAP_CONTENT)); return v
        }
        fun button(s:String, action:()->Unit) { page.addView(Button(this).apply { text=s; setOnClickListener { action() } }) }
        heading("Flood Alert · Garissa")
        page.addView(TextView(this).apply { text="Flood information and incident reporting"; textSize=15f })
        status=TextView(this).apply { text="Connecting…"; setPadding(0,12,0,12) }; page.addView(status)
        heading("Latest forecast and alerts")
        output=TextView(this).apply { textSize=16f }; page.addView(output)
        button("Refresh") { loadPublic() }
        heading("Sign in")
        email=field("Email"); password=field("Password",true)
        button("Sign in") { login() }
        heading("Report an incident")
        type=Spinner(this); type.adapter=ArrayAdapter(this,android.R.layout.simple_spinner_dropdown_item,listOf("flooding","rescue_request","evacuation_help","property_damage","other"));page.addView(type)
        location=field("Location / landmark"); description=field("Describe the incident"); description.minLines=3
        phone=field("Contact phone (optional)")
        button("Submit report") { submit() }
        page.addView(TextView(this).apply { text="Prototype only. Do not rely on this app as an emergency service; contact local emergency services if in immediate danger." })
        loadPublic()
    }

    private fun api(path:String, method:String="GET", body:JSONObject?=null):JSONObject {
        val c=URL(ApiConfig.BASE_URL+path).openConnection() as HttpURLConnection
        try {
            c.requestMethod=method; c.connectTimeout=8000; c.readTimeout=8000
            c.setRequestProperty("Accept","application/json")
            if(token.isNotBlank()) c.setRequestProperty("Authorization","Bearer $token")
            if(body!=null){c.doOutput=true;c.setRequestProperty("Content-Type","application/json");c.outputStream.use{it.write(body.toString().toByteArray())}}
            val stream=if(c.responseCode in 200..299)c.inputStream else c.errorStream
            val result=JSONObject(stream.bufferedReader().use{it.readText()}.ifBlank{"{}"})
            if(c.responseCode !in 200..299) throw Exception(result.optString("error","Request failed"))
            return result
        } finally { c.disconnect() }
    }
    private fun loadPublic() { thread { try {
        val p=api("/api/predictions").optJSONArray("data"); val a=api("/api/alerts").optJSONArray("data")
        val s=StringBuilder()
        if(p==null||p.length()==0)s.append("No forecast data.\n") else {val x=p.getJSONObject(0);s.append("Location: ${x.optString("location_name")}\nRisk: ${x.optString("risk_level")}\nDischarge: ${x.optString("predicted_discharge_m3s")} m³/s\nSource: ${x.optString("source")}\n");if(x.optString("source")=="demo")s.append("DEMO DATA — not a live warning.\n")}
        s.append("\nAlerts:\n");if(a==null||a.length()==0)s.append("No alerts") else for(i in 0 until minOf(a.length(),5)){val x=a.getJSONObject(i);s.append("• ${x.optString("risk_level")}: ${x.optString("title")}\n${x.optString("message")}\n\n")}
        runOnUiThread{output.text=s.toString();status.text="API connected"}
    } catch(e:Exception){runOnUiThread{status.text="Connection failed: ${e.message}";output.text="Start the backend and check ApiConfig.kt"}} } }
    private fun login() { thread { try {
        val r=api("/api/auth/login","POST",JSONObject().put("email",email.text.toString().trim()).put("password",password.text.toString()))
        token=r.getString("token");runOnUiThread{status.text="Signed in. You can submit a report."}
    } catch(e:Exception){runOnUiThread{status.text="Sign-in failed: ${e.message}"}} } }
    private fun submit() {
        if(token.isBlank()){status.text="Sign in before submitting a report";return}
        val loc=location.text.toString().trim();val desc=description.text.toString().trim()
        if(loc.isBlank()||desc.isBlank()){status.text="Location and description are required";return}
        val body=JSONObject().put("incident_type",type.selectedItem.toString()).put("location_name",loc).put("description",desc).put("contact_phone",phone.text.toString())
        thread { try { val r=api("/api/incidents","POST",body);runOnUiThread{status.text="Report submitted. Reference #${r.optInt("id")}";description.text.clear()} }
            catch(e:Exception){runOnUiThread{status.text="Submission failed: ${e.message}"}} }
    }
}
