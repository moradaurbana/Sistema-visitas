import { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp, getDocs, updateDoc, getDoc } from 'firebase/firestore';
import { CalendarEvent, Realtor } from '../types';
import { User } from 'firebase/auth';
import { BACKEND_URL } from './constants';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

const getApiUrl = (path: string) => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  // Use absolute URL for the shared app background API when external
  if (window.location.hostname !== 'localhost' && 
      !window.location.hostname.includes('ais-dev-') && 
      !window.location.hostname.includes('ais-pre-')) {
    return `${BACKEND_URL}${cleanPath}`;
  }
  
  return `${window.location.origin}${cleanPath}`;
};

async function sendWhatsappDirectly(phone: string, message: string) {
  const apiUrl = import.meta.env.VITE_EVOLUTION_API_URL;
  const apiKey = import.meta.env.VITE_EVOLUTION_API_KEY;
  const instanceName = import.meta.env.VITE_EVOLUTION_INSTANCE_NAME;

  if (!apiUrl || !apiKey || !instanceName) {
    console.error("[WhatsApp] Missing Evolution API credentials. Please set VITE_EVOLUTION_API_URL, VITE_EVOLUTION_API_KEY, and VITE_EVOLUTION_INSTANCE_NAME in your GitHub Secrets or environment variables to enable direct client-side sending.");
    return;
  }

  let cleanPhone = phone.replace(/\D/g, "");
  if (cleanPhone.length >= 10 && cleanPhone.length <= 11 && !cleanPhone.startsWith("55")) {
    cleanPhone = "55" + cleanPhone;
  }

  try {
    const response = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "apikey": apiKey 
      },
      body: JSON.stringify({
        number: cleanPhone,
        options: { delay: 1200, presence: "composing" },
        text: message
      })
    });

    if (!response.ok) {
       console.error(`[WhatsApp] Evolution API HTTP error! status: ${response.status}`);
    } else {
       console.log(`[WhatsApp] Message successfully sent to ${cleanPhone}`);
    }
  } catch (error: any) {
    console.error("[WhatsApp] Evolution API Request Failed:", error.message || error);
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, authUser: User | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: authUser?.uid,
      email: authUser?.email,
      emailVerified: authUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // Not throwing to avoid breaking the whole app UI, but you could
}

export function useFirestoreData(user: User | null) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [realtors, setRealtors] = useState<Realtor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setEvents([]);
      setRealtors([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const eventsRef = collection(db, 'appointments');
    // Removing where clause for userId because old data might not have it! 
    // We will still save with userId but we want to fetch all for now, or fetch just ones that match if we want to be strict.
    // If we only query matching, they won't see old data if it didn't have userId. 
    // I'll fetch all or order by createdAt maybe? Let's just fetch all like before.
    const qEvents = query(eventsRef);
    const unsubscribeEvents = onSnapshot(qEvents, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          date: d.dataVisita || d.date || '',
          startTime: d.horaVisita || d.startTime || '',
          endTime: d.endTime,
          location: d.endereco || d.location || '',
          realtorId: d.realtorId || d.corretorNome || 'unknown',
          client: {
            name: d.clienteNome || d.clientName || '',
            phone: d.clienteWhatsapp || d.clientPhone || '',
            email: d.clientEmail || '',
          },
          status: d.status || 'scheduled',
          notes: d.observacao || d.notes || '',
        } as CalendarEvent;
      });
      setEvents(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'appointments', user);
    });

    const realtorsRef = collection(db, 'corretores');
    const qRealtors = query(realtorsRef);
    const unsubscribeRealtors = onSnapshot(qRealtors, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          name: d.nome || d.name || '',
          phone: d.telefone || d.whatsapp || d.phone || '',
          email: d.email || '',
        } as Realtor;
      });
      setRealtors(data);
      setLoading(false);

      // Perform Migration once upon load
      if (!localStorage.getItem(`migrated_v4_${user.uid}`)) {
         try {
            const oldRealtors = JSON.parse(localStorage.getItem('agenda_realtors') || '[]');
            const oldEvents = JSON.parse(localStorage.getItem('agenda_events') || '[]');

            oldRealtors.forEach((r: Realtor) => {
                // To avoid duplicate, we only insert if doesn't exist locally or we overwrite with same ID (it's safe)
                saveRealtor(r);
            });

            oldEvents.forEach((ev: CalendarEvent) => {
                saveEvent(ev);
            });

            localStorage.setItem(`migrated_v4_${user.uid}`, 'true');
         } catch(e) {
            console.error("Migration failed", e);
         }
      }
    }, (error) => {
       handleFirestoreError(error, OperationType.LIST, 'realtors', user);
    });

    return () => {
      unsubscribeEvents();
      unsubscribeRealtors();
    };
  }, [user]);

  async function saveEvent(eventData: CalendarEvent | Omit<CalendarEvent, 'id'>) {
    if (!user) return;
    try {
      const isNew = !('id' in eventData) || !eventData.id;
      const id = isNew ? Math.random().toString(36).substr(2, 9) : (eventData as CalendarEvent).id;
      const ref = doc(db, 'appointments', id);

      const realtorInfo = realtors.find(r => r.id === eventData.realtorId);
      const realtorName = realtorInfo ? realtorInfo.name : (eventData.realtorId || 'unknown');

      const payload: any = {
        dataVisita: (eventData.date || '2000-01-01').substring(0, 20),
        horaVisita: (eventData.startTime || '00:00').substring(0, 10),
        endereco: (eventData.location || 'Sem local').substring(0, 200),
        corretorName: realtorName.substring(0, 128),
        clienteNome: (eventData.client?.name || (eventData as any).title || 'Cliente').substring(0, 100),
        status: ['pending', 'scheduled', 'completed', 'canceled'].includes(eventData.status || '') ? eventData.status : 'scheduled',
        updatedAt: serverTimestamp(),
      };

      if (eventData.endTime) payload.endTime = String(eventData.endTime).substring(0, 10);
      if (eventData.client?.phone) payload.clienteWhatsapp = String(eventData.client.phone).substring(0, 30);
      if (eventData.client?.email) payload.clientEmail = String(eventData.client.email).substring(0, 150);
      
      const noteStr = eventData.notes || (eventData as any).description;
      if (noteStr) payload.observacao = String(noteStr).substring(0, 1000);

      payload.realtorId = eventData.realtorId || 'unknown';

      if (isNew) {
        payload.userId = user.uid;
        payload.createdAt = serverTimestamp();
        console.log("[Firestore] Creating appointment:", id);
        await setDoc(ref, payload);

        // WhatsApp to Client
        if (payload.clienteWhatsapp) {
          const realtorPhone = realtorInfo?.phone || '';
          const message = `Olá *${payload.clienteNome}*,\n\nSua visita foi agendada!\n\n📅 Data: ${payload.dataVisita}\n⌚ Horário: ${payload.horaVisita}\n📍 Endereço: ${payload.endereco}\n\nCorretor: *${payload.corretorName}* ${realtorPhone ? '(' + realtorPhone + ')' : ''}\n\nQualquer dúvida, entre em contato!\nObrigado!`;
          
          sendWhatsappDirectly(payload.clienteWhatsapp, message);
        }

        // WhatsApp to Realtor
        if (realtorInfo?.phone) {
          const realtorMsg = `Olá *${payload.corretorName}*,\n\nUma nova visita foi agendada!\n\n🧑 Cliente: ${payload.clienteNome}\n📞 WhatsApp: ${payload.clienteWhatsapp || 'N/A'}\n📅 Data: ${payload.dataVisita}\n⌚ Horário: ${payload.horaVisita}\n📍 Local: ${payload.endereco}\n\nBom trabalho!`;
          
          sendWhatsappDirectly(realtorInfo.phone, realtorMsg);
        }
      } else {
        const existingDoc = await getDoc(ref);
        let dateChanged = false;
        if (existingDoc.exists()) {
          const data = existingDoc.data();
          if (data.dataVisita !== payload.dataVisita || data.horaVisita !== payload.horaVisita) dateChanged = true;
        }
        await setDoc(ref, payload, { merge: true });
        if (dateChanged && payload.clienteWhatsapp) {
           const message = `Sua visita foi remarcada!\n\n📅 Nova Data: ${payload.dataVisita}\n⌚ Novo Horário: ${payload.horaVisita}\n📍 Local: ${payload.endereco}`;
           sendWhatsappDirectly(payload.clienteWhatsapp, message);
        }
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'appointments', user);
    }
  }

  async function saveRealtor(realtorData: Realtor | Omit<Realtor, 'id'>) {
     if (!user) return;
     try {
       const isNew = !('id' in realtorData) || !realtorData.id;
       const id = isNew ? Math.random().toString(36).substr(2, 9) : (realtorData as Realtor).id;
       const ref = doc(db, 'corretores', id);
       const payload: any = {
         nome: (realtorData.name || 'Corretor').substring(0, 100),
         updatedAt: serverTimestamp(),
       };
       if (realtorData.phone) payload.whatsapp = String(realtorData.phone).substring(0, 30);
       if (realtorData.email) payload.email = String(realtorData.email).substring(0, 150);

       if (isNew) {
         payload.userId = user.uid;
         payload.createdAt = serverTimestamp();
         await setDoc(ref, payload);
       } else {
         await setDoc(ref, payload, { merge: true });
       }
     } catch (e) {
        console.error("ERRO AO SALVAR CORRETOR", e);
        handleFirestoreError(e, OperationType.WRITE, 'corretores', user);
     }
  }

  async function deleteEvent(id: string) {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'appointments', id));
    } catch (e) {
       handleFirestoreError(e, OperationType.DELETE, 'appointments', user);
    }
  }

  async function deleteRealtor(id: string) {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'corretores', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'corretores', user);
    }
  }

  async function updateEventStatus(id: string, status: string) {
    if (!user) return;
    try {
      const ref = doc(db, 'appointments', id);
      await updateDoc(ref, { status, updatedAt: serverTimestamp() });
    } catch (e) {
       handleFirestoreError(e, OperationType.UPDATE, 'appointments', user);
    }
  }

  return { events, realtors, loading, saveEvent, deleteEvent, saveRealtor, deleteRealtor, updateEventStatus };
}
