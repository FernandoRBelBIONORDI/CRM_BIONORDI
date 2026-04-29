"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Mail, Lock, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Completa todos los campos."); return; }

    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.ok) {
      router.push("/");
      router.refresh();
    } else {
      setError("Correo o contraseña incorrectos.");
    }
  };

  return (
    <div className="min-h-screen bg-[#0C1630] flex items-center justify-center px-4">

      {/* Fondo decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-200px] left-[-200px] w-[600px] h-[600px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(75,94,199,0.12) 0%, transparent 70%)" }} />
        <div className="absolute bottom-[-150px] right-[-150px] w-[500px] h-[500px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(61,187,121,0.07) 0%, transparent 70%)" }} />
      </div>

      <div className="relative w-full max-w-[400px]">

        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/LOGO_PRINCIPAL.png" alt="Bionordi Medical Technology"
            className="h-12 w-auto mx-auto mb-5 brightness-0 invert" />
          <div className="text-[10px] text-white/30 font-bold tracking-[0.2em] uppercase">
            Plataforma Operativa
          </div>
        </div>

        {/* Card */}
        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
          <h1 className="text-[18px] font-bold text-white mb-1">Iniciar sesión</h1>
          <p className="text-[13px] text-white/40 mb-6">Acceso restringido · Solo personal autorizado</p>

          <form onSubmit={handleSubmit} className="space-y-4">

            <div>
              <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-1.5">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="usuario@bionordi.mx"
                  autoComplete="email"
                  className="w-full bg-white/[0.06] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-[13px] text-white placeholder:text-white/20 outline-none focus:border-[#4E60A9]/60 focus:bg-white/[0.08] transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-white/40 uppercase tracking-wider mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full bg-white/[0.06] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-[13px] text-white placeholder:text-white/20 outline-none focus:border-[#4E60A9]/60 focus:bg-white/[0.08] transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <AlertCircle size={14} className="text-red-400 shrink-0" />
                <p className="text-[12px] text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-[14px] text-white transition-all mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: loading ? "rgba(78,96,169,0.5)" : "linear-gradient(135deg, #4E60A9, #38AD64)" }}
            >
              {loading ? "Verificando…" : "Entrar"}
            </button>

          </form>
        </div>

        <p className="text-center text-[11px] text-white/20 mt-6">
          © 2025 Bionordi S.A. de C.V. · Uso interno exclusivo
        </p>
      </div>
    </div>
  );
}
