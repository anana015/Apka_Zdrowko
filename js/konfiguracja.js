// @ts-check
/**
 * Połączenie z Supabase. Plik generuje skrypt: npm run ustaw-supabase -- --url <adres> --klucz <sb_publishable_…>
 * Klucz publikowalny jest jawny z założenia (trafia do przeglądarki); dane chronią RLS i obowiązkowe MFA.
 * Nigdy nie wpisuj tu klucza sekretnego (sb_secret_…) ani hasła do bazy.
 * Puste wartości = aplikacja działa tylko lokalnie (stan szkicu 0.1).
 */
export const SUPABASE_URL = "https://yklgotbmiwzubyvqxept.supabase.co";
export const SUPABASE_KLUCZ_PUBLIKOWALNY = "sb_publishable_fTKcpz9Y91-kETLD0Eqnng_6w3N_dRC";
