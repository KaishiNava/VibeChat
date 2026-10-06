"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const supabase = createClient();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function sendOtp() {
    setBusy(true); setError("");
    const { error } = await supabase.auth.signInWithOtp({ phone });
    setBusy(false);
    if (error) setError(error.message); else setSent(true);
  }

  async function verifyOtp() {
    setBusy(true); setError("");
    const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: "sms" });
    setBusy(false);
    if (error) return setError(error.message);
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen grid place-items-center p-5 bg-[#07110f]">
      <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#0d1816] p-7 shadow-2xl">
        <div className="mb-7 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-400 text-xl font-black text-black">V</div>
          <div><h1 className="text-2xl font-black">VibeChat</h1><p className="text-xs text-white/40">Chat. Status. Channels.</p></div>
        </div>
        {!sent ? (
          <>
            <label className="text-sm text-white/65">Nomor telepon</label>
            <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+628123456789" className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 outline-none focus:border-emerald-400" />
            <button disabled={!phone || busy} onClick={sendOtp} className="mt-4 w-full rounded-2xl bg-emerald-400 py-3.5 font-bold text-black disabled:opacity-40">{busy ? "Mengirim..." : "Kirim OTP"}</button>
          </>
        ) : (
          <>
            <p className="text-sm text-white/55">Masukkan OTP yang dikirim ke <b className="text-white">{phone}</b>.</p>
            <input value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,""))} maxLength={6} inputMode="numeric" placeholder="123456" className="mt-4 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 text-center text-2xl tracking-[.55em] outline-none focus:border-emerald-400" />
            <button disabled={otp.length !== 6 || busy} onClick={verifyOtp} className="mt-4 w-full rounded-2xl bg-emerald-400 py-3.5 font-bold text-black disabled:opacity-40">{busy ? "Memverifikasi..." : "Masuk ke VibeChat"}</button>
            <button onClick={()=>setSent(false)} className="mt-3 w-full text-sm text-white/40">Ganti nomor</button>
          </>
        )}
        {error && <div className="mt-4 rounded-2xl bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
      </div>
    </main>
  );
}
