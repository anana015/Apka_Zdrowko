// @ts-check
/**
 * Tryb offline i stan synchronizacji w górnym pasku:
 * „Zapisano lokalnie” (zmiany czekają) albo „Zsynchronizowano” (serwer ma wszystko).
 */
import * as db from './db.js';
import { $, h } from './utils.js';
import { skonfigurowano } from './auth.js';
import { zdarzeniaSync, stanSynchronizacji, synchronizuj } from './synchronizacja.js';
import { hhmm } from './obliczenia.js';

export function zainicjujOffline() {
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Service Worker niedostępny:', e.message));
  }
  window.addEventListener('online', odswiezStatus);
  window.addEventListener('offline', odswiezStatus);
  db.zdarzenia.addEventListener('zmiana', odswiezStatus);
  zdarzeniaSync.addEventListener('stan', odswiezStatus);
  odswiezStatus();
}

async function odswiezStatus() {
  const status = $('#status-sync');
  const tekst = $('#status-tekst');
  const opis = $('#status-opis');
  const oczekujace = await db.liczbaOczekujacych().catch(() => 0);
  const online = navigator.onLine;
  const s = stanSynchronizacji();
  status.dataset.stan = !online ? 'offline' : oczekujace ? 'lokalnie' : 'ok';

  if (!skonfigurowano) {
    tekst.textContent = 'Zapisano lokalnie';
    opis.replaceChildren(h('p', { text: 'Serwer nie jest skonfigurowany: dane są tylko na tym urządzeniu.' }));
    return;
  }
  if (!online) tekst.textContent = 'Offline, zapisano lokalnie';
  else if (s.stan === 'trwa') tekst.textContent = 'Synchronizuję…';
  else if (s.stan === 'blad') tekst.textContent = 'Błąd synchronizacji';
  else if (oczekujace) tekst.textContent = 'Zapisano lokalnie';
  else tekst.textContent = 'Zsynchronizowano';

  const przycisk = h('button', { type: 'button', class: 'btn btn-drugorzedny btn-maly', text: 'Synchronizuj teraz', on: { click: () => synchronizuj() } });
  opis.replaceChildren(
    h('p', { text: 'Wszystko, co zapiszesz, trafia najpierw do pamięci tego urządzenia (działa też bez internetu), a potem na Twoje konto.' }),
    h('p', { text: oczekujace ? `Zmiany czekające na wysłanie: ${oczekujace}.` : 'Wszystkie zmiany są na serwerze.' }),
    s.czas ? h('p', { text: `Ostatnia synchronizacja: ${hhmm(s.czas)}.` }) : null,
    s.stan === 'blad' ? h('p', { class: 'blad', text: `Ostatnia próba nie powiodła się: ${s.blad}` }) : null,
    online ? przycisk : null,
  );
}
