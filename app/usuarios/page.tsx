"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { UserPlus, Key, Power, Trash2, Shield, User } from "lucide-react";

type Usuario = {
  id: number; nombre: string; email: string;
  rol: string; activo: number; created_at: string;
};

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[16px] font-bold text-[#1E293B]">{title}</h2>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#475569] text-xl font-bold">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function UsuariosPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showPassword, setShowPassword] = useState<Usuario | null>(null);
  const [error, setError] = useState("");

  const [form, setForm] = useState({ nombre: "", email: "", password: "", rol: "operador" });
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    fetch("/api/usuarios").then(r => r.json()).then(d => {
      setUsuarios(d.usuarios || []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  if (role !== "admin") return (
    <div className="flex items-center justify-center h-full text-[#94A3B8] text-sm">
      Solo los administradores pueden acceder a esta sección.
    </div>
  );

  const createUser = async () => {
    if (!form.nombre || !form.email || !form.password) return setError("Completa todos los campos");
    setSaving(true); setError("");
    const res = await fetch("/api/usuarios", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Error"); setSaving(false); return; }
    setShowCreate(false);
    setForm({ nombre: "", email: "", password: "", rol: "operador" });
    load();
    setSaving(false);
  };

  const changePassword = async () => {
    if (!newPassword || newPassword.length < 6) return setError("Mínimo 6 caracteres");
    setSaving(true); setError("");
    await fetch(`/api/usuarios/${showPassword!.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword }),
    });
    setShowPassword(null); setNewPassword(""); setSaving(false); load();
  };

  const toggleActivo = async (u: Usuario) => {
    await fetch(`/api/usuarios/${u.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: u.activo ? 0 : 1 }),
    });
    load();
  };

  return (
    <div className="flex flex-col h-full bg-[#F4F7FB]">
      <div className="px-8 pt-7 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#1E293B] tracking-tight">Usuarios</h1>
          <p className="text-[12px] text-[#94A3B8] mt-0.5">Gestión de cuentas del equipo</p>
        </div>
        <button onClick={() => { setShowCreate(true); setError(""); }}
          className="flex items-center gap-2 bg-[#4E60A9] text-white text-[13px] font-bold px-4 py-2 rounded-xl hover:bg-[#3d4f8f] transition-colors">
          <UserPlus size={15} /> Nuevo usuario
        </button>
      </div>

      <div className="flex-1 overflow-auto px-8 pb-8">
        {loading ? (
          <div className="text-center py-16 text-[#94A3B8] text-sm">Cargando...</div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#E8EFF8] overflow-hidden shadow-sm">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#E8EFF8] bg-[#F8FAFC]">
                  {["Usuario", "Email", "Rol", "Estado", "Creado", "Acciones"].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-[11px] font-bold text-[#94A3B8] uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usuarios.map(u => (
                  <tr key={u.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4E60A9] to-[#38AD64] flex items-center justify-center text-white text-[11px] font-bold shrink-0">
                          {u.nombre.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-[#1E293B]">{u.nombre}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[#64748B]">{u.email}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${u.rol === 'admin' ? 'bg-[#4E60A9]/10 text-[#4E60A9]' : 'bg-[#F1F5F9] text-[#64748B]'}`}>
                        {u.rol === 'admin' ? <Shield size={10} /> : <User size={10} />}
                        {u.rol}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${u.activo ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-500'}`}>
                        {u.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[#94A3B8]">{u.created_at?.slice(0, 10)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setShowPassword(u); setNewPassword(""); setError(""); }}
                          title="Cambiar contraseña"
                          className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#4E60A9] hover:bg-[#4E60A9]/10 transition-colors">
                          <Key size={14} />
                        </button>
                        <button onClick={() => toggleActivo(u)}
                          title={u.activo ? "Desactivar" : "Activar"}
                          className={`p-1.5 rounded-lg transition-colors ${u.activo ? 'text-[#94A3B8] hover:text-red-500 hover:bg-red-50' : 'text-[#94A3B8] hover:text-green-600 hover:bg-green-50'}`}>
                          <Power size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <Modal title="Nuevo usuario" onClose={() => setShowCreate(false)}>
          <div className="space-y-3">
            {error && <p className="text-red-500 text-[12px]">{error}</p>}
            {[
              { label: "Nombre", key: "nombre", type: "text", placeholder: "Ej. María García" },
              { label: "Email", key: "email", type: "email", placeholder: "usuario@empresa.com" },
              { label: "Contraseña", key: "password", type: "password", placeholder: "Mínimo 6 caracteres" },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key}>
                <label className="block text-[11px] font-bold text-[#64748B] mb-1 uppercase tracking-wide">{label}</label>
                <input type={type} placeholder={placeholder} value={(form as any)[key]}
                  onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#4E60A9]/30" />
              </div>
            ))}
            <div>
              <label className="block text-[11px] font-bold text-[#64748B] mb-1 uppercase tracking-wide">Rol</label>
              <select value={form.rol} onChange={e => setForm(p => ({ ...p, rol: e.target.value }))}
                className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#4E60A9]/30">
                <option value="operador">Operador</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <button onClick={createUser} disabled={saving}
              className="w-full mt-2 bg-[#4E60A9] text-white font-bold py-2.5 rounded-xl text-[13px] hover:bg-[#3d4f8f] disabled:opacity-50 transition-colors">
              {saving ? "Guardando..." : "Crear usuario"}
            </button>
          </div>
        </Modal>
      )}

      {showPassword && (
        <Modal title={`Cambiar contraseña — ${showPassword.nombre}`} onClose={() => setShowPassword(null)}>
          <div className="space-y-3">
            {error && <p className="text-red-500 text-[12px]">{error}</p>}
            <div>
              <label className="block text-[11px] font-bold text-[#64748B] mb-1 uppercase tracking-wide">Nueva contraseña</label>
              <input type="password" placeholder="Mínimo 6 caracteres" value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#4E60A9]/30" />
            </div>
            <button onClick={changePassword} disabled={saving}
              className="w-full mt-2 bg-[#4E60A9] text-white font-bold py-2.5 rounded-xl text-[13px] hover:bg-[#3d4f8f] disabled:opacity-50 transition-colors">
              {saving ? "Guardando..." : "Cambiar contraseña"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
