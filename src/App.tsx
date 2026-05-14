import { useState } from "react";
import { format, isSameDay, isToday, isTomorrow, isYesterday, addDays, subDays, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Calendar as CalendarIcon, Clock, Trash2, Users, LayoutDashboard, CheckCircle2, XCircle, Pencil, LogOut, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, List, CalendarDays, Grid3X3 } from "lucide-react";
import { MiniCalendar } from "./components/MiniCalendar";
import { EventModal } from "./components/EventModal";
import { RealtorModal } from "./components/RealtorModal";
import { Dashboard } from "./components/Dashboard";
import { WeekView } from "./components/WeekView";
import { MonthView } from "./components/MonthView";
import { CalendarEvent, Realtor, EventStatus } from "./types";
import { cn } from "./lib/utils";
import { useAuth } from "./lib/useAuth";
import { useFirestoreData } from "./lib/useFirestore";

export default function App() {
  const { user, loginWithGoogle, logout, loading: authLoading } = useAuth();
  const { events, realtors, loading: dataLoading, saveEvent, deleteEvent, saveRealtor, deleteRealtor, updateEventStatus } = useFirestoreData(user);

  const [currentView, setCurrentView] = useState<'agenda' | 'dashboard'>('agenda');
  const [calendarView, setCalendarView] = useState<'day' | 'week' | 'month'>('day');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentDisplayMonth, setCurrentDisplayMonth] = useState(new Date());
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRealtorModalOpen, setIsRealtorModalOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  if (authLoading) {
    return <div className="h-screen w-full flex items-center justify-center bg-apple-bg text-apple-text-muted">Carregando...</div>;
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-apple-bg">
        <div className="bg-white p-8 rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.08)] text-center max-w-sm w-full border border-apple-border">
          <div className="mx-auto mb-6 flex justify-center">
            {/* Logo em SVG aproximado (já que imagens do chat não viram arquivos magicamente). 
                Para usar o PNG exato, arraste-o para o File Explorer lado esquerdo, 
                e remova as tags <svg> deixando o <img src="/logo.png" /> */}
            <svg viewBox="0 0 100 100" className="w-16 h-16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="100" height="100" rx="24" fill="#1C2331"/>
              <path d="M 28 62 V 42 L 42 52 L 48 48 H 54" stroke="#F97316" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M 54 42 V 54 C 54 62 72 62 72 54 V 42" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold bg-clip-text text-apple-text mb-2 tracking-tight">Sistema de visitas</h1>
          <p className="text-sm text-apple-text-muted mb-8">Faça login para gerenciar suas visitas e corretores.</p>
          <button 
            onClick={loginWithGoogle}
            className="w-full bg-apple-blue hover:bg-apple-blue/90 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
          >
            Entrar com Google
          </button>
        </div>
      </div>
    );
  }

  const handleSaveEvent = async (eventData: CalendarEvent | Omit<CalendarEvent, "id">) => {
    await saveEvent(eventData);
  };

  const handleUpdateEventStatus = async (id: string, status: EventStatus) => {
    await updateEventStatus(id, status);
  };

  const handleDeleteEvent = async (id: string) => {
    await deleteEvent(id);
  };

  const handleSaveRealtor = async (realtor: Realtor | Omit<Realtor, "id">) => {
    await saveRealtor(realtor);
  };

  const handleDeleteRealtor = async (id: string) => {
    await deleteRealtor(id);
  };

  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
  const dayEvents = events
    .filter((e) => e.date === selectedDateStr)
    .sort((a, b) => {
      // Sort by start time, events without time go to top
      if (!a.startTime && !b.startTime) return 0;
      if (!a.startTime) return -1;
      if (!b.startTime) return 1;
      return a.startTime.localeCompare(b.startTime);
    });

  const eventsByDate = events.reduce((acc, event) => {
    if (!acc[event.date]) acc[event.date] = [];
    acc[event.date].push(event);
    return acc;
  }, {} as Record<string, CalendarEvent[]>);

  const getDayHeader = (date: Date) => {
    if (calendarView === 'month') return format(currentDisplayMonth, "MMMM yyyy", { locale: ptBR });
    if (calendarView === 'week') return "Semana";
    if (isToday(date)) return "Hoje";
    if (isTomorrow(date)) return "Amanhã";
    if (isYesterday(date)) return "Ontem";
    return format(date, "EEEE", { locale: ptBR });
  };

  const handleNext = () => {
    if (calendarView === 'day') setSelectedDate(addDays(selectedDate, 1));
    else if (calendarView === 'week') setSelectedDate(addDays(selectedDate, 7));
    else setCurrentDisplayMonth(addMonths(currentDisplayMonth, 1));
  };

  const handlePrev = () => {
    if (calendarView === 'day') setSelectedDate(subDays(selectedDate, 1));
    else if (calendarView === 'week') setSelectedDate(subDays(selectedDate, 7));
    else setCurrentDisplayMonth(subMonths(currentDisplayMonth, 1));
  };

  const handleEditEventFromView = (event: CalendarEvent) => {
    setEditEvent(event);
    setIsModalOpen(true);
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-apple-bg overflow-hidden antialiased">
      {/* Sidebar */}
      <aside className="w-full md:w-80 lg:w-96 bg-apple-sidebar border-r border-apple-border flex flex-col md:h-screen shrink-0 relative z-10">
        <div className="p-6 pb-2">
          <div className="flex items-center gap-3 mb-8 text-black">
            <svg viewBox="0 0 100 100" className="w-8 h-8" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="100" height="100" rx="24" fill="#1C2331"/>
              <path d="M 28 62 V 42 L 42 52 L 48 48 H 54" stroke="#F97316" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M 54 42 V 54 C 54 62 72 62 72 54 V 42" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h1 className="text-xl font-semibold tracking-tight">Sistema de visitas</h1>
          </div>

          <div className="flex gap-2 mb-8 bg-apple-border/30 p-1 rounded-xl">
            <button
              onClick={() => setCurrentView('agenda')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all shadow-sm",
                currentView === 'agenda' ? "bg-white text-apple-text shadow-[0_1px_3px_rgba(0,0,0,0.1)]" : "text-apple-text-muted hover:text-apple-text"
              )}
            >
              <CalendarIcon className="w-4 h-4" /> Agenda
            </button>
            <button
              onClick={() => setCurrentView('dashboard')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all shadow-sm",
                currentView === 'dashboard' ? "bg-white text-apple-text shadow-[0_1px_3px_rgba(0,0,0,0.1)]" : "text-apple-text-muted hover:text-apple-text"
              )}
            >
              <LayoutDashboard className="w-4 h-4" /> Resumo
            </button>
          </div>
          
          <MiniCalendar
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            currentDisplayMonth={currentDisplayMonth}
            onMonthChange={setCurrentDisplayMonth}
            eventsByDate={eventsByDate}
          />
          
          <button
            onClick={() => setIsRealtorModalOpen(true)}
            className="mt-6 flex items-center justify-between w-full p-4 bg-white rounded-xl shadow-sm border border-apple-border hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className="bg-apple-blue/10 text-apple-blue p-2 rounded-lg">
                <Users className="w-5 h-5" />
              </div>
              <span className="font-semibold text-apple-text">Corretores</span>
            </div>
            <div className="bg-apple-bg px-2 py-0.5 rounded-full text-xs font-bold text-apple-text-muted">
              {realtors.length}
            </div>
          </button>
        </div>

        {/* Quick actions or extra info could go here in a real app */}
        <div className="px-6 py-4 mt-auto border-t border-apple-border/50 hidden md:flex items-center justify-between">
           <p className="text-xs text-apple-text-muted">
             {events.length} Lembretes
           </p>
           <button onClick={logout} className="text-apple-text-muted hover:text-apple-red transition-colors flex items-center gap-1.5 text-xs font-medium">
             <LogOut className="w-3.5 h-3.5" /> Sair
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full bg-apple-bg overflow-hidden translate-y-0 transition-transform">
        {currentView === 'dashboard' ? (
          <Dashboard events={events} realtors={realtors} />
        ) : (
        <>
          {/* Header */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-apple-border px-8 flex items-center justify-between shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
               <div className="flex bg-apple-bg rounded-lg p-1 border border-apple-border/50">
                  <button onClick={handlePrev} className="p-1 hover:bg-white rounded transition-colors text-apple-text-muted hover:text-apple-blue">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button onClick={handleNext} className="p-1 hover:bg-white rounded transition-colors text-apple-text-muted hover:text-apple-blue">
                    <ChevronRight className="w-5 h-5" />
                  </button>
               </div>
               <h1 className="text-xl font-semibold text-apple-text capitalize min-w-[120px]">
                 {getDayHeader(selectedDate)}
               </h1>
            </div>

            <div className="hidden lg:flex bg-apple-bg rounded-xl p-1 border border-apple-border/50">
               <button 
                 onClick={() => setCalendarView('day')}
                 className={cn(
                   "px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                   calendarView === 'day' ? "bg-white text-apple-blue shadow-sm" : "text-apple-text-muted hover:text-apple-text"
                 )}
               >
                 <List className="w-3.5 h-3.5" /> Dia
               </button>
               <button 
                 onClick={() => setCalendarView('week')}
                 className={cn(
                   "px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                   calendarView === 'week' ? "bg-white text-apple-blue shadow-sm" : "text-apple-text-muted hover:text-apple-text"
                 )}
               >
                 <CalendarDays className="w-3.5 h-3.5" /> Semana
               </button>
               <button 
                 onClick={() => setCalendarView('month')}
                 className={cn(
                   "px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                   calendarView === 'month' ? "bg-white text-apple-blue shadow-sm" : "text-apple-text-muted hover:text-apple-text"
                 )}
               >
                 <Grid3X3 className="w-3.5 h-3.5" /> Mês
               </button>
            </div>
            
            <div className="hidden sm:flex bg-white rounded-lg px-3 py-1.5 border border-apple-border/50 shadow-sm text-xs font-medium text-apple-text-muted">
              {calendarView === 'month' ? format(currentDisplayMonth, "MMMM yyyy", { locale: ptBR }) : format(selectedDate, "d 'de' MMMM yyyy", { locale: ptBR })}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsRealtorModalOpen(true)}
              className="md:hidden w-10 h-10 bg-white hover:bg-apple-bg text-apple-blue rounded-full flex items-center justify-center shadow-sm border border-apple-border transition-colors group"
              aria-label="Corretores"
            >
              <Users className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>
            <button
              onClick={logout}
              className="md:hidden w-10 h-10 bg-white hover:bg-red-50 text-apple-red rounded-full flex items-center justify-center shadow-sm border border-apple-border transition-colors group"
              aria-label="Sair"
            >
              <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>
            <button
              onClick={() => {
                setEditEvent(null);
                setIsModalOpen(true);
              }}
              className="w-10 h-10 bg-apple-blue hover:bg-apple-blue/90 text-white rounded-full flex items-center justify-center shadow-sm transition-transform hover:scale-105 active:scale-95"
              aria-label="Adicionar Lemebrete"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Events Schedule / Full Views */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {calendarView === 'week' ? (
            <WeekView 
              selectedDate={selectedDate} 
              onSelectDate={setSelectedDate} 
              events={events} 
              realtors={realtors} 
              onEditEvent={handleEditEventFromView}
            />
          ) : calendarView === 'month' ? (
            <MonthView 
              currentDisplayMonth={currentDisplayMonth}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              events={events}
            />
          ) : (
            <div className="flex-1 overflow-y-auto px-8 py-6 hidden-scrollbar">
              {dayEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-apple-text-muted space-y-4">
                  <div className="w-16 h-16 rounded-full bg-apple-bg flex items-center justify-center mb-4">
                    <CalendarIcon className="w-8 h-8 text-black/20" />
                  </div>
                  <p className="text-lg font-medium">Nenhum evento neste dia</p>
                  <button 
                    onClick={() => {
                      setEditEvent(null);
                      setIsModalOpen(true);
                    }}
                    className="text-apple-blue font-semibold hover:underline"
                  >
                    Criar uma visita
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {dayEvents.map((event) => {
                const realtor = realtors.find(r => r.id === event.realtorId);
                const isExpanded = expandedEventId === event.id;
                
                return (
                <div
                  key={event.id}
                  onClick={() => setExpandedEventId(isExpanded ? null : event.id)}
                  className={cn(
                    "group relative p-4 rounded shadow-sm hover:shadow-md transition-all border-l-4 cursor-pointer",
                    event.status === 'completed' ? "bg-green-50/50 grayscale-[0.3] opacity-70 border-green-500" :
                    event.status === 'canceled' ? "bg-red-50/50 grayscale-[0.3] opacity-60 border-apple-red" :
                    "bg-blue-50 border-apple-blue"
                  )}
                >
                  <div className="flex gap-4">
                    {/* Time Column */}
                    <div className="w-20 shrink-0 flex flex-col justify-start">
                      {event.startTime ? (
                         <div className={cn(
                           "flex flex-col text-xs font-semibold tracking-tight",
                           event.status === 'completed' ? "text-green-700" :
                           event.status === 'canceled' ? "text-red-700" :
                           "text-blue-700"
                         )}>
                           <span>{event.startTime}</span>
                           {event.endTime && <span>- {event.endTime}</span>}
                         </div>
                      ) : (
                         <div className={cn(
                           "text-xs font-semibold uppercase tracking-wider",
                           event.status === 'completed' ? "text-green-700" :
                           event.status === 'canceled' ? "text-red-700" :
                           "text-blue-700"
                         )}>Lemb.</div>
                      )}
                    </div>

                    {/* Content Column */}
                    <div className="flex-1 min-w-0 pr-12">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-1 gap-2">
                        <h3 className={cn("text-sm font-bold", event.status === 'canceled' && "line-through")}>Cliente: {event.client?.name || (event as any).title || "Não informado"}</h3>
                        <span className={cn(
                          "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full whitespace-nowrap",
                           event.status === 'completed' ? "bg-green-100 text-green-700" :
                           event.status === 'canceled' ? "bg-red-100 text-red-700" :
                           "bg-blue-100 text-apple-blue"
                        )}>
                          {realtor ? realtor.name : "Sem Corretor"}
                        </span>
                      </div>
                      
                      <div className="flex items-center text-xs mt-1">
                        {event.status === 'completed' && <span className="text-green-600 font-medium">✓ Visita Realizada</span>}
                        {event.status === 'canceled' && <span className="text-apple-red font-medium">✕ Visita Cancelada</span>}
                        {!event.status || event.status === 'scheduled' ? <span className="text-blue-600 font-medium opacity-80">Agendado</span> : null}
                      </div>
                      
                      {isExpanded && (
                        <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="text-xs text-apple-text-muted space-y-1.5 p-3 bg-white/60 rounded-lg border border-black/5">
                            <p className="flex justify-between items-center bg-black/5 p-1.5 rounded -mx-1.5 mb-2 font-medium">
                              <span className="text-apple-text uppercase tracking-wider text-[10px]">Dados do Cliente</span>
                            </p>
                            <p className="flex items-center gap-2"><span>👤</span> {event.client?.name || (event as any).title || "Nome não informado"}</p>
                            {event.client?.phone && <p className="flex items-center gap-2"><span>📞</span> {event.client.phone}</p>}
                            {event.client?.email && <p className="flex items-center gap-2"><span>✉️</span> {event.client.email}</p>}
                            
                            <p className="flex justify-between items-center bg-black/5 p-1.5 rounded -mx-1.5 mb-2 mt-3 font-medium">
                              <span className="text-apple-text uppercase tracking-wider text-[10px]">Detalhes da Visita</span>
                            </p>
                            <p className="flex items-center gap-2"><span>⏰</span> {event.startTime} {event.endTime ? `às ${event.endTime}` : ''}</p>
                            <p className="flex items-center gap-2"><span>📍</span> {event.location || "Sem local informado"}</p>
                            
                            <p className="flex justify-between items-center bg-black/5 p-1.5 rounded -mx-1.5 mb-2 mt-3 font-medium">
                              <span className="text-apple-text uppercase tracking-wider text-[10px]">Corretor Responsável</span>
                            </p>
                            {realtor && <p className="flex items-center gap-2"><span>👔</span> {realtor.name}</p>}
                            {realtor && realtor.phone && <p className="flex items-center gap-2"><span>📱</span> {realtor.phone}</p>}
                            {realtor && realtor.email && <p className="flex items-center gap-2"><span>✉️</span> {realtor.email}</p>}
                          </div>
                          
                          {event.notes && (
                            <div className={cn(
                              "mt-3 text-xs bg-white/50 p-3 rounded-lg border",
                              event.status === 'completed' ? "border-green-100" :
                              event.status === 'canceled' ? "border-red-100" :
                              "border-blue-100"
                            )}>
                              <p className="font-semibold text-apple-text mb-1">Anotações:</p>
                              <p className="text-apple-text-muted break-words leading-relaxed">{event.notes}</p>
                            </div>
                          )}

                          {/* Quick Actions inside expanded view */}
                          {(!event.status || event.status === 'scheduled') && (
                            <div className="mt-4 flex gap-2">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateEventStatus(event.id, 'completed');
                                }}
                                className="bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
                              >
                                <CheckCircle2 className="w-4 h-4" /> Realizada
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateEventStatus(event.id, 'canceled');
                                }}
                                className="bg-red-100 text-apple-red hover:bg-red-200 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
                              >
                                <XCircle className="w-4 h-4" /> Cancelada
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Top-right Toggle Icon */}
                  <div className="absolute top-4 right-4 text-apple-text-muted">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity" />}
                  </div>

                  {/* Actions - only visible when expanded to avoid mis-clicks */}
                  {isExpanded && (
                    <div className="absolute top-12 right-3 flex flex-col gap-1 opacity-0 animate-in fade-in duration-200 group-hover:opacity-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditEvent(event);
                          setIsModalOpen(true);
                        }}
                        className="p-2 text-apple-text-muted hover:text-apple-blue hover:bg-apple-blue/10 rounded-full transition-all active:scale-95 bg-white shadow-sm"
                        aria-label="Editar evento"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteEvent(event.id);
                        }}
                        className="p-2 text-apple-text-muted hover:text-apple-red hover:bg-apple-red/10 rounded-full transition-all active:scale-95 bg-white shadow-sm mt-1"
                        aria-label="Deletar evento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  </>
)}
</main>

      <EventModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditEvent(null);
        }}
        onSave={handleSaveEvent}
        selectedDate={selectedDate}
        realtors={realtors}
        events={events}
        editEvent={editEvent}
      />

      <RealtorModal
        isOpen={isRealtorModalOpen}
        onClose={() => setIsRealtorModalOpen(false)}
        realtors={realtors}
        onSave={handleSaveRealtor}
        onDelete={handleDeleteRealtor}
      />
    </div>
  );
}
