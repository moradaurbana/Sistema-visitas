import { useState, FormEvent } from "react";
import { Realtor } from "../types";
import { X, Trash2, Plus, Users, Pencil } from "lucide-react";

interface RealtorModalProps {
  isOpen: boolean;
  onClose: () => void;
  realtors: Realtor[];
  onSave: (realtor: Realtor | Omit<Realtor, "id">) => void;
  onDelete: (id: string) => void;
}

export function RealtorModal({ isOpen, onClose, realtors, onSave, onDelete }: RealtorModalProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  if (!isOpen) return null;

  const toggleForm = () => {
    setIsAdding(!isAdding);
    setEditingId(null);
    setName("");
    setPhone("");
    setEmail("");
  };

  const handleEdit = (realtor: Realtor) => {
    setIsAdding(true);
    setEditingId(realtor.id);
    setName(realtor.name);
    setPhone(realtor.phone || "");
    setEmail(realtor.email || "");
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave(editingId ? { id: editingId, name, phone, email } : { name, phone, email });
    setName("");
    setPhone("");
    setEmail("");
    setEditingId(null);
    setIsAdding(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
      <div className="w-full max-w-md bg-apple-card rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden scale-100 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-apple-border shrink-0">
          <button onClick={onClose} className="text-apple-text-muted hover:text-apple-text font-medium">
            Fechar
          </button>
          <h3 className="font-semibold text-[17px]">Corretores</h3>
          <button 
            onClick={toggleForm} 
            className="text-apple-blue hover:opacity-80 font-semibold"
          >
            {isAdding ? "Cancelar" : "Novo"}
          </button>
        </div>

        <div className="overflow-y-auto p-4 flex-1">
          {isAdding && (
            <form onSubmit={handleSubmit} className="mb-6 space-y-4 bg-apple-bg p-4 rounded-xl border border-apple-border">
              <h4 className="font-medium text-sm text-apple-text-muted uppercase tracking-wider mb-2">{editingId ? "Editar Corretor" : "Cadastrar Corretor"}</h4>
              <input
                type="text"
                placeholder="Nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white border border-apple-border outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue transition-all"
                autoFocus
              />
              <input
                type="tel"
                placeholder="Telefone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white border border-apple-border outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue transition-all"
              />
              <input
                type="email"
                placeholder="E-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white border border-apple-border outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue transition-all"
              />
              <button 
                type="submit"
                disabled={!name.trim()}
                className="w-full py-2 bg-apple-blue text-white rounded-lg font-medium disabled:opacity-50 hover:bg-apple-blue/90"
              >
                Salvar Corretor
              </button>
            </form>
          )}

          <div className="space-y-2">
            {realtors.length === 0 ? (
              <div className="text-center py-8 text-apple-text-muted flex flex-col items-center">
                <Users className="w-10 h-10 mb-2 opacity-20" />
                <p>Nenhum corretor cadastrado</p>
              </div>
            ) : (
              realtors.map((realtor) => (
                <div key={realtor.id} className="flex items-center justify-between p-3 bg-white border border-apple-border rounded-xl shadow-sm">
                  <div>
                    <h4 className="font-semibold text-apple-text">{realtor.name}</h4>
                    <p className="text-xs text-apple-text-muted">{realtor.phone} {realtor.phone && realtor.email && "•"} {realtor.email}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(realtor)}
                      className="p-2 text-apple-text-muted hover:text-apple-blue hover:bg-blue-50 rounded-full transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(realtor.id)}
                      className="p-2 text-apple-text-muted hover:text-apple-red hover:bg-red-50 rounded-full transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
