import { supabase, db as databaseWrapper } from './supabaseClients'

// Re-export the database wrapper as db
export const db = databaseWrapper
export { supabase }
export * from './supabaseClients'
