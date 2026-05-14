import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameDay, 
  isSameMonth 
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarEvent } from "../types";
import { cn } from "../lib/utils";

interface MonthViewProps {
  currentDisplayMonth: Date;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  events: CalendarEvent[];
}

export function MonthView({ currentDisplayMonth, selectedDate, onSelectDate, events }: MonthViewProps) {
  const monthStart = startOfMonth(currentDisplayMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const getEventsForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return events.filter(e => e.date === dateStr);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">
      <div className="grid grid-cols-7 border-b border-apple-border">
        {["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"].map((day) => (
          <div key={day} className="py-3 text-center text-[10px] font-bold text-apple-text-muted uppercase tracking-wider bg-apple-sidebar/30 border-r border-apple-border last:border-r-0">
            {day}
          </div>
        ))}
      </div>
      
      <div className="flex-1 grid grid-cols-7 grid-rows-6 divide-x divide-y divide-apple-border border-b border-apple-border">
        {days.map((day) => {
          const isSelected = isSameDay(day, selectedDate);
          const isMonth = isSameMonth(day, monthStart);
          const isToday = isSameDay(day, new Date());
          const dayEvents = getEventsForDate(day);

          return (
            <div 
              key={day.toString()}
              onClick={() => onSelectDate(day)}
              className={cn(
                "p-2 flex flex-col gap-1 transition-colors cursor-pointer min-h-[100px]",
                !isMonth ? "bg-apple-bg/30 text-apple-text-muted/40" : "bg-white",
                isSelected ? "bg-apple-blue/5" : "hover:bg-black/5"
              )}
            >
              <div className="flex justify-between items-center mb-1">
                <span className={cn(
                  "text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full transition-all",
                  isToday && !isSelected && "text-apple-blue font-bold",
                  isSelected && "bg-apple-blue text-white shadow-sm"
                )}>
                  {format(day, "d")}
                </span>
                {dayEvents.length > 0 && (
                  <span className="text-[10px] font-bold text-apple-text-muted bg-apple-bg px-1.5 rounded-full">
                    {dayEvents.length}
                  </span>
                )}
              </div>
              
              <div className="flex flex-col gap-1 overflow-hidden">
                {dayEvents.slice(0, 3).map(event => (
                  <div 
                    key={event.id}
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[9px] font-medium truncate border",
                      event.status === 'completed' ? "bg-green-50 border-green-100 text-green-700" :
                      event.status === 'canceled' ? "bg-red-50 border-red-100 text-red-700" :
                      "bg-blue-50 border-blue-100 text-blue-700"
                    )}
                  >
                    {event.startTime && <span>{event.startTime} </span>}
                    {event.client?.name || (event as any).title || "Visita"}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[9px] text-apple-text-muted font-bold ml-1">
                    + {dayEvents.length - 3} mais...
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
