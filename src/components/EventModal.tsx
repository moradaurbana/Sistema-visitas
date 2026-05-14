import { useState, FormEvent, useEffect } from "react";
import { CalendarEvent, Realtor } from "../types";
import { X } from "lucide-react";
import { format } from "date-fns";

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: Omit<CalendarEvent, "id"> | CalendarEvent) => void;
  selectedDate: Date;
  realtors: Realtor[];
  events: CalendarEvent[];
  editEvent?: CalendarEvent | null;
}

export function EventModal({ isOpen, onClose, onSave, selectedDate, realtors, events, editEvent }: EventModalProps) {
  const [realtorId, setRealtorId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notes, setNotes] = useState("");
  const [conflictError, setConflictError] = useState<string | null>(null);

  const selectedRealtor = realtors.find(r => r.id === realtorId);

  useEffect(() => {
    if (isOpen && editEvent) {
      setRealtorId(editEvent.realtorId || "");
      setClientName(editEvent.client?.name || (editEvent as any).title || "");
      setClientPhone(editEvent.client?.phone || "");
      setClientEmail(editEvent.client?.email || "");
      setLocation(editEvent.location || "");
      setDate(editEvent.date || "");
      setStartTime(editEvent.startTime || "");
      setEndTime(editEvent.endTime || "");
      setNotes(editEvent.notes || "");
    } else if (isOpen) {
      setDate(format(selectedDate, "yyyy-MM-dd"));
    } else if (!isOpen) {
      setRealtorId("");
      setClientName("");
      setClientPhone("");
      setClientEmail("");
      setLocation("");
      setDate("");
      setStartTime("");
      setEndTime("");
      setNotes("");
      setConflictError(null);
    }
  }, [isOpen, editEvent, selectedDate]);

  // Check for conflict dynamically as user types
  useEffect(() => {
    if (realtorId && date && startTime) {
      const hasConflict = events.some(e => 
        e.realtorId === realtorId &&
        e.date === date &&
        e.startTime === startTime &&
        e.id !== editEvent?.id &&
        e.status !== 'canceled'
      );
      if (hasConflict) {
        setConflictError("Este corretor já possui uma visita agendada neste horário.");
      } else {
        setConflictError(null);
      }
    } else {
      setConflictError(null);
    }
  }, [realtorId, date, startTime, events, editEvent]);

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!realtorId || !clientName.trim() || !location.trim() || !date || !startTime || conflictError) return;

    const eventData = {
      date: date,
      startTime: startTime,
      endTime: endTime || undefined,
      location,
      realtorId,
      client: {
        name: clientName,
        phone: clientPhone,
        email: clientEmail,
      },
      notes: notes || undefined,
      status: editEvent?.status || 'scheduled' as const,
    };

    if (editEvent) {
      onSave({ ...eventData, id: editEvent.id });
    } else {
      onSave(eventData);
    }
    
    onClose();
  };

  const isFormValid = realtorId && clientName.trim() && location.trim() && date && startTime && !conflictError;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-end md:justify-center p-0 md:p-4 bg-black/20 backdrop-blur-sm">
      <div 
        className="w-full max-w-lg bg-apple-bg md:rounded-2xl rounded-t-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom md:zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-apple-border bg-white shrink-0">
          <button onClick={onClose} className="text-apple-blue hover:opacity-80 font-medium">
            Cancelar
          </button>
          <h3 className="font-semibold text-[17px]">{editEvent ? "Editar Visita" : "Nova Visita"}</h3>
          <button 
            onClick={handleSubmit} 
            className="text-apple-blue hover:opacity-80 font-semibold disabled:opacity-50"
            disabled={!isFormValid}
          >
            {editEvent ? "Salvar" : "Adicionar"}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto hidden-scrollbar p-4 space-y-6">
          {conflictError && (
            <div className="mx-4 p-3 rounded-xl bg-apple-red/10 text-apple-red text-sm font-medium border border-apple-red/20 shadow-sm animate-in fade-in zoom-in duration-200">
              ⚠️ {conflictError}
            </div>
          )}

          {/* Corretor Section */}
          <div>
            <span className="text-xs font-bold text-apple-text-muted uppercase tracking-wider ml-4 mb-2 block">Corretor</span>
            <div className="bg-white rounded-xl border border-apple-border overflow-hidden">
              <select
                value={realtorId}
                onChange={(e) => setRealtorId(e.target.value)}
                className="w-full px-4 py-3 bg-transparent outline-none appearance-none text-apple-text"
              >
                <option value="" disabled>Selecionar Corretor...</option>
                {realtors.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            
            {/* Display Realtor Details */}
            {selectedRealtor && (
              <div className="ml-4 mt-2 text-xs text-apple-text-muted space-y-0.5">
                {selectedRealtor.phone && <p>📞 {selectedRealtor.phone}</p>}
                {selectedRealtor.email && <p>✉️ {selectedRealtor.email}</p>}
              </div>
            )}
            
            {!selectedRealtor && realtors.length === 0 && (
               <p className="ml-4 mt-2 text-xs text-apple-red">Nenhum corretor cadastrado. Cadastre no menu lateral.</p>
            )}
          </div>

          {/* Client Section */}
          <div>
            <span className="text-xs font-bold text-apple-text-muted uppercase tracking-wider ml-4 mb-2 block">Cliente</span>
            <div className="bg-white rounded-xl border border-apple-border overflow-hidden divide-y divide-apple-border">
              <input
                type="text"
                placeholder="Nome do Cliente"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-4 py-3 bg-transparent outline-none focus:bg-blue-50/50 transition-colors"
              />
              <input
                type="tel"
                placeholder="Telefone do Cliente"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="w-full px-4 py-3 bg-transparent outline-none focus:bg-blue-50/50 transition-colors"
              />
              <input
                type="email"
                placeholder="E-mail do Cliente"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="w-full px-4 py-3 bg-transparent outline-none focus:bg-blue-50/50 transition-colors"
              />
            </div>
          </div>

          {/* Details Section */}
          <div>
            <span className="text-xs font-bold text-apple-text-muted uppercase tracking-wider ml-4 mb-2 block">Detalhes da Visita</span>
            <div className="bg-white rounded-xl border border-apple-border overflow-hidden divide-y divide-apple-border">
              <input
                type="text"
                placeholder="Local / Endereço"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-4 py-3 bg-transparent outline-none focus:bg-blue-50/50 transition-colors"
              />
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-apple-text">Data</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-transparent text-apple-blue outline-none"
                />
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-apple-text">Horário</span>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="bg-transparent text-apple-blue outline-none"
                />
              </div>
            </div>
          </div>

          {/* Notes Section */}
          <div>
            <span className="text-xs font-bold text-apple-text-muted uppercase tracking-wider ml-4 mb-2 block">Anotações</span>
            <div className="bg-white rounded-xl border border-apple-border overflow-hidden">
              <textarea
                placeholder="Observações adicionais..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-3 bg-transparent outline-none min-h-[100px] resize-none focus:bg-blue-50/50 transition-colors"
              />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
