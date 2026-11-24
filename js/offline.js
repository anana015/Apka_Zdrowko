// @ts-check
/**
 * Tryb offline: rejestracja Service Workera, stan sieci i kolejki zmian.
 * Synchronizacja z Supabase (etap 0) dojdzie tutaj: odczyt „outbox”, wysyłka upsertów
 * z identyfikatorami klienta, rozwiązywanie konfliktów po updated_at (ostatni zapis wygrywa).
 */
import * as db from './db.js';
import { $, h } from './utils.js';

/** Czy serwer jest skonfigurowany. W szkicu: nie. */
export const SERWER_SKONFIGUROWANY = false;

export function zainicjujOffline() {
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Service Worker niedostępny:', e.message));
  }
  window.addEventListener('online', odswiezStatus);
  window.addEventListener('offline', odswiezStatus);
  db.zdarzenia.addEventListener('zmiana', odswiezStatus);
  odswiezStatus();
}

async function odswiezStatus() {
  const status = $('#status-sync');
  const tekst = $('#status-tekst');
  const opis = $('#status-opis');
  const oczekujace = await db.liczbaOczekujacych().catch(() => 0);
  const online = navigator.onLine;
  status.dataset.stan = online ? 'online' : 'offline';
  tekst.textContent = online ? 'Zapisano lokalnie' : 'Offline, zapisano lokalnie';
  opis.replaceChildren(
    h('p', { text: 'Wszystko, co zapiszesz, jest od razu w pamięci tego urządzenia, także bez internetu.' }),
    h('p', {
      text: SERWER_SKONFIGUROWANY
        ? `Zmiany czekające na wysłanie: ${oczekujace}.`
        : `Synchronizacja między urządzeniami pojawi się po podłączeniu serwera. Zmiany przygotowane do wysłania: ${oczekujace}.`,
    }),
  );
}
