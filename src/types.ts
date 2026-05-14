export interface Realtor {
  id: string;
  name: string;
  phone: string;
  email: string;
}

export interface Client {
  name: string;
  phone: string;
  email: string;
}

export type EventStatus = 'scheduled' | 'completed' | 'canceled';

export interface CalendarEvent {
  id: string;
  date: string; // Formato YYYY-MM-DD
  startTime: string; // Formato HH:MM
  endTime?: string; // Formato HH:MM
  location: string;
  realtorId: string;
  client: Client;
  notes?: string;
  status?: EventStatus;
}
