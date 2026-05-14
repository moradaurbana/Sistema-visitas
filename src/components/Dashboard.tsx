import { CalendarEvent, Realtor } from "../types";
import { CheckCircle2, XCircle, CalendarClock, BarChart3, TrendingUp } from "lucide-react";

interface DashboardProps {
  events: CalendarEvent[];
  realtors: Realtor[];
}

export function Dashboard({ events, realtors }: DashboardProps) {
  const completedEvents = events.filter(e => e.status === 'completed');
  const canceledEvents = events.filter(e => e.status === 'canceled');
  const scheduledEvents = events.filter(e => !e.status || e.status === 'scheduled');

  const realtorStats = realtors.map(realtor => {
    const realtorEvents = events.filter(e => e.realtorId === realtor.id);
    return {
      ...realtor,
      total: realtorEvents.length,
      completed: realtorEvents.filter(e => e.status === 'completed').length,
      canceled: realtorEvents.filter(e => e.status === 'canceled').length,
      scheduled: realtorEvents.filter(e => !e.status || e.status === 'scheduled').length,
    };
  }).sort((a, b) => b.completed - a.completed);

  return (
    <div className="flex-1 overflow-y-auto hidden-scrollbar px-8 py-6 bg-apple-bg">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Overview Cards */}
        <div>
          <h2 className="text-sm font-bold text-apple-text-muted uppercase tracking-wider mb-4">Visão Geral</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-apple-border shadow-sm flex items-start gap-4">
              <div className="bg-blue-50 text-apple-blue p-3 rounded-xl">
                <CalendarClock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-apple-text-muted">Agendadas</p>
                <p className="text-2xl font-bold text-apple-text">{scheduledEvents.length}</p>
              </div>
            </div>
            
            <div className="bg-white p-5 rounded-2xl border border-apple-border shadow-sm flex items-start gap-4">
              <div className="bg-green-50 text-green-600 p-3 rounded-xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-apple-text-muted">Realizadas</p>
                <p className="text-2xl font-bold text-apple-text">{completedEvents.length}</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-apple-border shadow-sm flex items-start gap-4">
              <div className="bg-red-50 text-apple-red p-3 rounded-xl">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-apple-text-muted">Canceladas</p>
                <p className="text-2xl font-bold text-apple-text">{canceledEvents.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Realtor Performance */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-apple-text-muted" />
            <h2 className="text-sm font-bold text-apple-text-muted uppercase tracking-wider">Desempenho por Corretor</h2>
          </div>
          
          <div className="bg-white rounded-2xl border border-apple-border overflow-hidden shadow-sm">
            <div className="overflow-x-auto hidden-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-apple-bg/50 border-b border-apple-border">
                    <th className="px-6 py-4 text-xs font-semibold text-apple-text-muted uppercase tracking-wider">Corretor</th>
                    <th className="px-6 py-4 text-xs font-semibold text-apple-text-muted uppercase tracking-wider">Agendadas</th>
                    <th className="px-6 py-4 text-xs font-semibold text-apple-text-muted uppercase tracking-wider">Realizadas</th>
                    <th className="px-6 py-4 text-xs font-semibold text-apple-text-muted uppercase tracking-wider">Canceladas</th>
                    <th className="px-6 py-4 text-xs font-semibold text-apple-text-muted uppercase tracking-wider">Taxa de Sucesso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-apple-border">
                  {realtorStats.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-apple-text-muted">Nenhum dado disponível.</td>
                    </tr>
                  ) : (
                    realtorStats.map(stat => {
                      const totalResolved = stat.completed + stat.canceled;
                      const successRate = totalResolved > 0 ? Math.round((stat.completed / totalResolved) * 100) : 0;
                      return (
                        <tr key={stat.id} className="hover:bg-black/[0.01] transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-apple-text">{stat.name}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-medium text-apple-blue">{stat.scheduled}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-medium text-green-600">{stat.completed}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-medium text-apple-red">{stat.canceled}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-full max-w-[100px] h-2 bg-apple-bg rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-green-500 rounded-full" 
                                  style={{ width: `${successRate}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium text-apple-text-muted">{successRate}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
