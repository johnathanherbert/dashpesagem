import { supabase } from "./supabase"

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (!error) {
    window.location.href = "/"
  }
  return { error }
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
