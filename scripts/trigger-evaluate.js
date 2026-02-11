const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const env = fs.readFileSync("/var/www/assiny/.env.local", "utf8");
const getEnv = (key) => { const m = env.match(new RegExp(key + "=(.*)")); return m ? m[1].trim() : null; };
const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
const sb = createClient(url, key);

(async () => {
  try {
    const { data: emp } = await sb.from("employees").select("user_id, name, role").eq("user_id", "4d6ba670-b2b9-4b3e-8189-dca53b66cf57").limit(1);
    if (!emp || emp.length === 0) { console.log("No admin found"); return; }
    console.log("Admin:", emp[0].name);

    const { data: { user } } = await sb.auth.admin.getUserById(emp[0].user_id);
    if (!user) { console.log("No auth user"); return; }

    const { data: linkData, error: linkError } = await sb.auth.admin.generateLink({ type: "magiclink", email: user.email });
    if (linkError) { console.log("Link error:", linkError.message); return; }

    const token = linkData?.properties?.hashed_token;
    if (!token) { console.log("No hashed_token"); return; }

    const { data: session, error: otpError } = await sb.auth.verifyOtp({ token_hash: token, type: "magiclink" });
    if (otpError) { console.log("OTP error:", otpError.message); return; }

    const accessToken = session.session.access_token;
    console.log("Got token, calling evaluate-rounds...");

    const res = await fetch("http://localhost:3000/api/copilot/evaluate-rounds", {
      method: "POST",
      headers: { "Authorization": "Bearer " + accessToken }
    });

    const result = await res.json();
    console.log("Status:", res.status);
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("Error:", err.message);
  }
})();
