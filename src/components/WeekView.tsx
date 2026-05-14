import { format, startOfWeek, addDays, eachDayOfInterval, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarEvent, Realtor } from "../types";
import { cn } from "../lib/utils";

interface WeekViewProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  events: CalendarEvent[];
  realtors: Realtor[];
  onEditEvent: (event: CalendarEvent) => void;
}

export function WeekView({ selectedDate, onSelectDate, events, realtors, onEditEvent }: WeekViewProps) {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
  const weekEnd = addDays(weekStart, 6);
  
  const weekDays = eachDayOfInterval({
    start: weekStart,
    end: weekEnd
  });

  const getEventsForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return events
      .filter(e => e.date === dateStr)
      .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">
      <div className="grid grid-cols-7 border-b border-apple-border bg-apple-sidebar/50">
        {weekDays.map((day) => (
          <div 
            key={day.toString()} 
            className={cn(
              "py-4 px-2 text-center border-r border-apple-border last:border-r-0 flex flex-col items-center gap-1",
              isSameDay(day, new Date()) && "bg-apple-blue/5"
            )}
          >
            <span className="text-[10px] font-bold text-apple-text-muted uppercase tracking-widest">
              {format(day, "EEE", { locale: ptBR })}
            </span>
            <button 
              onClick={() => onSelectDate(day)}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center text-lg font-semibold transition-all",
                isSameDay(day, selectedDate) ? "bg-apple-blue text-white shadow-sm" : 
                isSameDay(day, new Date()) ? "text-apple-blue" : "text-apple-text"
              )}
            >
              {format(day, "d")}
            </button>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto grid grid-cols-7 divide-x divide-apple-border">
        {weekDays.map((day) => {
          const dayEvents = getEventsForDate(day);
          return (
            <div key={day.toString()} className="min-h-full p-2 space-y-2 bg-apple-bg/30">
              {dayEvents.map(event => {
                const realtor = realtors.find(r => r.id === event.realtorId);
                return (
                  <div 
                    key={event.id}
                    onClick={() => onEditEvent(event)}
                    className={cn(
                      "p-2 rounded-lg border shadow-sm cursor-pointer transition-all hover:scale-[1.02] active:scale-95 group",
                      event.status === 'completed' ? "bg-green-50 border-green-200" :
                      event.status === 'canceled' ? "bg-red-50 border-red-200" :
                      "bg-white border-apple-border"
                    )}
                  >
                    <div className="text-[10px] font-bold text-apple-text-muted mb-1 flex justify-between">
                      <span>{event.startTime || "Lemb."}</span>
                      {event.status === 'completed' && <span className="text-green-600">✓</span>}
                    </div>
                    <p className="text-[11px] font-bold text-apple-text leading-tight mb-1 line-clamp-2">
                       {event.client?.name || (event as any).title || "Sem nome"}
                    </p>
                    <p className="text-[9px] text-apple-text-muted truncate">
                      {realtor?.name || "Sem corretor"}
                    </p>
                  </div>
                );
              })}
              {dayEvents.length === 0 && (
                <div className="h-20 border-2 border-dashed border-black/5 rounded-xl flex items-center justify-center">
                  <span className="text-[10px] text-black/10 font-bold uppercase italic">Vazio</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
