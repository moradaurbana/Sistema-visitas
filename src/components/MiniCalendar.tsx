import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "../lib/utils";

interface MiniCalendarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  currentDisplayMonth: Date;
  onMonthChange: (date: Date) => void;
  eventsByDate: Record<string, any[]>;
}

export function MiniCalendar({
  selectedDate,
  onSelectDate,
  currentDisplayMonth,
  onMonthChange,
  eventsByDate,
}: MiniCalendarProps) {
  const monthStart = startOfMonth(currentDisplayMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const nextMonth = () => onMonthChange(addMonths(currentDisplayMonth, 1));
  const prevMonth = () => onMonthChange(subMonths(currentDisplayMonth, 1));

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4 px-2">
        <h2 className="text-xl font-semibold capitalize tracking-tight">
          {format(currentDisplayMonth, "MMMM yyyy", { locale: ptBR })}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={prevMonth}
            className="p-1 rounded-full hover:bg-black/5 transition-colors text-apple-blue"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={nextMonth}
            className="p-1 rounded-full hover:bg-black/5 transition-colors text-apple-blue"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-apple-text-muted mb-2">
        {["D", "S", "T", "Q", "Q", "S", "S"].map((day, i) => (
          <div key={i} className="h-8 flex items-center justify-center">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day, dayIdx) => {
          const isSelected = isSameDay(day, selectedDate);
          const isCurrentMonth = isSameMonth(day, currentDisplayMonth);
          const isToday = isSameDay(day, new Date());
          const dateStr = format(day, "yyyy-MM-dd");
          const hasEvents = eventsByDate[dateStr] && eventsByDate[dateStr].length > 0;

          return (
            <div
              key={day.toString()}
              className="flex items-center justify-center h-10"
            >
              <button
                onClick={() => onSelectDate(day)}
                className={cn(
                  "w-9 h-9 rounded-full flex flex-col items-center justify-center relative transition-all text-sm",
                  !isCurrentMonth && "text-apple-text-muted/40",
                  isCurrentMonth && !isSelected && !isToday && "hover:bg-black/5",
                  isToday && !isSelected && "text-apple-blue font-semibold",
                  isSelected && "bg-apple-blue text-white font-semibold shadow-sm",
                )}
              >
                <span>{format(day, "d")}</span>
                {hasEvents && (
                  <div
                    className={cn(
                      "absolute bottom-1 w-1 h-1 rounded-full",
                      isSelected ? "bg-white" : "bg-apple-text-muted"
                    )}
                  />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
