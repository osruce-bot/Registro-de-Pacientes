import React, { useState } from "react";
import { AppUser } from "../types";
import { 
  ShieldCheck, 
  UserPlus, 
  KeyRound, 
  User, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  EyeOff, 
  AlertCircle,
  Lock,
  UserCheck,
  Copy,
  CopyCheck
} from "lucide-react";

interface UserManagerProps {
  users: AppUser[];
  onSaveUser: (user: AppUser) => Promise<boolean | void>;
  onDeleteUser: (id: string, username?: string) => Promise<void>;
  onRefreshUsers: () => Promise<void>;
}

export default function UserManager({
  users,
  onSaveUser,
  onDeleteUser,
  onRefreshUsers
}: UserManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  // User deletion state for custom confirmation modal
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // In-app alert / toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedUserId, setCopiedUserId] = useState<string | null>(null);

  const handleCopyCredentials = (u: AppUser) => {
    const webUrl = window.location.origin || window.location.href;
    const textToCopy = `🔐 ACCESO A LA APLICACIÓN MÉDICA\n\n🌐 Web: ${webUrl}\n👤 Usuario: ${u.username}\n🔑 Contraseña: ${u.password}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy).catch(() => {
        fallbackCopyTextToClipboard(textToCopy);
      });
    } else {
      fallbackCopyTextToClipboard(textToCopy);
    }

    setCopiedUserId(u.id);
    setToastMessage(`Credenciales de "${u.nombreCompleto}" (@${u.username}) copiadas al portapapeles.`);
    setTimeout(() => {
      setCopiedUserId(null);
    }, 3000);
  };

  const fallbackCopyTextToClipboard = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand("copy");
    } catch (err) {
      console.error("Fallback copy failed", err);
    }
    document.body.removeChild(textArea);
  };

  // Form states
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [fullNameInput, setFullNameInput] = useState("");
  const [statusInput, setStatusInput] = useState<"activo" | "inactivo">("activo");
  
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const toggleShowPassword = (userId: string) => {
    setShowPasswordMap(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setUsernameInput("");
    setPasswordInput("");
    setFullNameInput("");
    setStatusInput("activo");
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (u: AppUser) => {
    setEditingUser(u);
    setUsernameInput(u.username);
    setPasswordInput(u.password);
    setFullNameInput(u.nombreCompleto);
    setStatusInput(u.status);
    setFormError("");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const cleanUsername = usernameInput.toLowerCase().trim();
    if (!cleanUsername) {
      setFormError("Ingrese un nombre de usuario válido.");
      return;
    }

    if (!passwordInput.trim()) {
      setFormError("Ingrese una contraseña para el usuario.");
      return;
    }

    if (!fullNameInput.trim()) {
      setFormError("Ingrese el nombre completo o título del usuario.");
      return;
    }

    // Check duplicate username if creating new user or changing username
    const isDuplicate = users.some(u => 
      u.username.toLowerCase() === cleanUsername && 
      (!editingUser || editingUser.id !== u.id)
    );

    if (isDuplicate) {
      setFormError(`El nombre de usuario "${cleanUsername}" ya existe. Por favor elija otro.`);
      return;
    }

    setIsSaving(true);

    try {
      const userToSave: AppUser = {
        id: editingUser ? editingUser.id : `usr_${cleanUsername}_${Date.now()}`,
        username: cleanUsername,
        password: passwordInput,
        nombreCompleto: fullNameInput.trim(),
        rol: cleanUsername === "mbraschi" ? "admin" : "usuario",
        status: cleanUsername === "mbraschi" ? "activo" : statusInput,
        createdAt: editingUser?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await onSaveUser(userToSave);
      setIsModalOpen(false);
      setToastMessage(`Usuario "${userToSave.nombreCompleto}" guardado correctamente.`);
      await onRefreshUsers();
    } catch (err: any) {
      setFormError("Error al guardar el usuario en la base de datos.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleUserStatus = async (user: AppUser) => {
    if (user.username.toLowerCase() === "mbraschi") {
      setToastMessage("El usuario Administrador Principal (mbraschi) no puede desactivarse.");
      return;
    }

    const nextStatus: "activo" | "inactivo" = user.status === "activo" ? "inactivo" : "activo";
    const updated: AppUser = {
      ...user,
      status: nextStatus,
      updatedAt: new Date().toISOString()
    };

    await onSaveUser(updated);
    setToastMessage(`Acceso para ${user.nombreCompleto} ${nextStatus === "activo" ? "activado" : "desactivado"}.`);
    await onRefreshUsers();
  };

  const handlePromptDelete = (user: AppUser) => {
    if (user.username.toLowerCase() === "mbraschi") {
      setToastMessage("El usuario Administrador Principal (mbraschi) no se puede eliminar.");
      return;
    }
    setUserToDelete(user);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      await onDeleteUser(userToDelete.id, userToDelete.username);
      setToastMessage(`Usuario "${userToDelete.nombreCompleto}" (@${userToDelete.username}) eliminado exitosamente.`);
      setUserToDelete(null);
      await onRefreshUsers();
    } catch (err) {
      console.error("Error al eliminar usuario:", err);
      setToastMessage("Error al intentar eliminar el usuario. Intente de nuevo.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Toast notification banner */}
      {toastMessage && (
        <div className="p-4 bg-indigo-900 text-white rounded-2xl shadow-md border border-indigo-700 flex items-center justify-between gap-3 text-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-indigo-300 shrink-0" />
            <span className="font-medium">{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-indigo-300 hover:text-white px-2 py-0.5 rounded-lg hover:bg-indigo-800 transition-colors cursor-pointer text-xs font-bold"
          >
            Entendido
          </button>
        </div>
      )}

      {/* Banner / Header */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute -right-6 -bottom-6 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-indigo-600/30 border border-indigo-500/40 rounded-2xl text-indigo-300 shrink-0">
              <ShieldCheck className="h-7 w-7 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold font-sans">Gestión de Accesos a la App</h1>
                <span className="bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Panel Exclusivo mbraschi
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Cree, edite o elimine las credenciales de los usuarios con acceso a la aplicación. Todos los usuarios creados aquí tendrán acceso completo a la información médica y catálogos, pero <strong>no tendrán acceso a este panel de administración</strong>.
              </p>
            </div>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <UserPlus className="h-4 w-4" />
            <span>Crear Nuevo Acceso</span>
          </button>
        </div>
      </div>

      {/* Security Note Box */}
      <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-4 flex items-start gap-3 text-xs text-amber-900">
        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Política de Privacidad y Accesos:</span>
          <p className="mt-0.5 text-amber-800 leading-relaxed">
            El usuario principal <strong>mbraschi</strong> es el único con rango de Administrador. Los demás usuarios que registre ingresarán con su propio nombre de usuario y contraseña y no podrán ver la pestaña de Administrador en el menú principal.
          </p>
        </div>
      </div>

      {/* Users Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-slate-600" />
            <h2 className="font-bold text-slate-800 text-sm font-sans">Usuarios Registrados ({users.length})</h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 text-[10px]">
              <tr>
                <th className="px-6 py-3">Usuario (Login)</th>
                <th className="px-6 py-3">Nombre Completo / Médico</th>
                <th className="px-6 py-3">Contraseña</th>
                <th className="px-6 py-3">Rol / Permisos</th>
                <th className="px-6 py-3">Estado</th>
                <th className="px-6 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const isMasterAdmin = u.username.toLowerCase() === "mbraschi";
                const isPassVisible = !!showPasswordMap[u.id];

                return (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-3.5 font-mono font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        <span>{u.username}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 font-medium text-slate-800">
                      {u.nombreCompleto}
                    </td>
                    <td className="px-6 py-3.5 font-mono text-slate-600">
                      <div className="flex items-center gap-2">
                        <span>{isPassVisible ? u.password : "••••••••"}</span>
                        <button
                          type="button"
                          onClick={() => toggleShowPassword(u.id)}
                          className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5 rounded"
                          title={isPassVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
                        >
                          {isPassVisible ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      {isMasterAdmin ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                          <Lock className="h-3 w-3" />
                          Admin Principal
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          Usuario Estándar
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      {u.status === "activo" ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold text-[10px] border border-emerald-200/80">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full font-semibold text-[10px] border border-rose-200/80">
                          <XCircle className="h-3 w-3 text-rose-600" />
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-right space-x-2">
                      <button
                        onClick={() => handleCopyCredentials(u)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold border rounded-lg transition-all cursor-pointer ${
                          copiedUserId === u.id
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                            : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200 hover:border-indigo-300"
                        }`}
                        title="Copiar datos de acceso (Web, Usuario y Contraseña)"
                      >
                        {copiedUserId === u.id ? (
                          <>
                            <CopyCheck className="h-3.5 w-3.5 text-white" />
                            <span>¡Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 text-indigo-600" />
                            <span>Copiar Acceso</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleOpenEditModal(u)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:text-blue-700 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-lg transition-all cursor-pointer"
                        title="Editar credenciales"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>Editar</span>
                      </button>

                      {!isMasterAdmin && (
                        <>
                          <button
                            onClick={() => handleToggleUserStatus(u)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium border rounded-lg transition-all cursor-pointer ${
                              u.status === "activo"
                                ? "text-amber-700 hover:bg-amber-50 border-amber-200"
                                : "text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                            }`}
                            title={u.status === "activo" ? "Desactivar acceso" : "Activar acceso"}
                          >
                            <span>{u.status === "activo" ? "Desactivar" : "Activar"}</span>
                          </button>

                          <button
                            onClick={() => handlePromptDelete(u)}
                            className="inline-flex items-center gap-1 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                            title="Eliminar usuario"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal create / edit user */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-indigo-600" />
                <h3 className="font-bold text-slate-800 text-base font-sans">
                  {editingUser ? "Editar Usuario" : "Crear Nuevo Acceso"}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Usuario (Nombre de Login) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="ej. jperez, dr_mendoza"
                  disabled={editingUser?.username.toLowerCase() === "mbraschi"}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono text-slate-800 disabled:bg-slate-100"
                  required
                />
                <p className="text-[10px] text-slate-400 mt-0.5">Sin espacios ni caracteres especiales.</p>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Nombre Completo / Título <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullNameInput}
                  onChange={(e) => setFullNameInput(e.target.value)}
                  placeholder="ej. Dr. Juan Pérez"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Contraseña de Acceso <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Clave de ingreso"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono text-slate-800"
                  required
                />
              </div>

              {editingUser?.username.toLowerCase() !== "mbraschi" && (
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Estado del Acceso
                  </label>
                  <select
                    value={statusInput}
                    onChange={(e: any) => setStatusInput(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 font-medium bg-white"
                  >
                    <option value="activo">Activo (Puede ingresar a la app)</option>
                    <option value="inactivo">Inactivo (Acceso bloqueado)</option>
                  </select>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl font-medium transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? "Guardando..." : "Guardar Credenciales"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-2xl">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base font-sans">
                  Eliminar Acceso de Usuario
                </h3>
                <p className="text-xs text-slate-500">Esta acción revoca las credenciales inmediatamente.</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 text-xs text-slate-700 space-y-1">
              <p><span className="font-semibold text-slate-900">Usuario Login:</span> <span className="font-mono">@{userToDelete.username}</span></p>
              <p><span className="font-semibold text-slate-900">Nombre Completo:</span> {userToDelete.nombreCompleto}</p>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              ¿Está seguro de que desea eliminar permanentemente a este usuario? Ya no podrá ingresar a la aplicación con sus credenciales actuales.
            </p>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl font-medium text-xs transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-semibold text-xs transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
              >
                {isDeleting ? "Eliminando..." : "Sí, Eliminar Usuario"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
