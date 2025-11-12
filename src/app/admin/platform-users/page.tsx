"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import Link from "next/link";

type PlatformUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "support" | "viewer";
  active: boolean;
  created_at: string;
};

export default function PlatformUsersPage() {
  const supabase = createClientComponentClient();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState({
    user_id: "",
    email: "",
    name: "",
    role: "admin" as "admin" | "support" | "viewer",
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/admin/platform-users");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al cargar usuarios");
      }

      setUsers(data);
    } catch (err: any) {
      setError(err?.message || "Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  };

  const createUser = async () => {
    if (!form.user_id || !form.email || !form.name) {
      setError("Todos los campos son obligatorios");
      return;
    }

    try {
      setError(null);
      const response = await fetch("/api/admin/platform-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al crear usuario");
      }

      setShowCreateModal(false);
      setForm({ user_id: "", email: "", name: "", role: "admin" });
      await loadUsers();
    } catch (err: any) {
      setError(err?.message || "Error al crear usuario");
    }
  };

  const toggleActive = async (userId: string, currentActive: boolean) => {
    try {
      setError(null);
      // TODO: Implementar endpoint para actualizar platform user
      // Por ahora, solo mostramos el estado
      alert("Funcionalidad de actualización pendiente");
    } catch (err: any) {
      setError(err?.message || "Error al actualizar usuario");
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <p>Cargando usuarios...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin" className="text-blue-600 hover:underline">
            ← Volver a administración
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Platform Users</h1>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Crear Platform User
        </button>
      </div>

      {error && (
        <div className="rounded border border-red-500 bg-red-50 p-4 text-red-600">
          {error}
        </div>
      )}

      <div className="rounded border">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">Nombre</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Email</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Rol</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Estado</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Creado</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm">{user.name}</td>
                <td className="px-4 py-3 text-sm">{user.email}</td>
                <td className="px-4 py-3 text-sm">
                  <span
                    className={`inline-block rounded px-2 py-1 text-xs ${
                      user.role === "admin"
                        ? "bg-purple-100 text-purple-800"
                        : user.role === "support"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  <span
                    className={`inline-block rounded px-2 py-1 text-xs ${
                      user.active
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {user.active ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="p-6 text-center text-gray-500">
            No hay platform users registrados.
          </div>
        )}
      </div>

      {/* Modal de creación */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold">Crear Platform User</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium">User ID (UUID de auth.users)</label>
                <input
                  className="mt-1 w-full rounded border p-2"
                  type="text"
                  placeholder="00000000-0000-0000-0000-000000000000"
                  value={form.user_id}
                  onChange={(e) => setForm({ ...form, user_id: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Email</label>
                <input
                  className="mt-1 w-full rounded border p-2"
                  type="email"
                  placeholder="admin@ejemplo.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Nombre</label>
                <input
                  className="mt-1 w-full rounded border p-2"
                  type="text"
                  placeholder="Nombre del admin"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Rol</label>
                <select
                  className="mt-1 w-full rounded border p-2"
                  value={form.role}
                  onChange={(e) =>
                    setForm({ ...form, role: e.target.value as any })
                  }
                >
                  <option value="admin">Admin</option>
                  <option value="support">Support</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setForm({ user_id: "", email: "", name: "", role: "admin" });
                }}
                className="flex-1 rounded border px-4 py-2"
              >
                Cancelar
              </button>
              <button
                onClick={createUser}
                className="flex-1 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

