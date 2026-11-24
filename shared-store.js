import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./shared-config.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

function mapRecord(row) {
  return {
    id: row.client_id, consecutive: row.id, createdAt: row.created_at,
    label: row.label, source: row.source, medium: row.medium,
    campaign: row.campaign, term: row.term, content: row.content,
    destinationUrl: row.destination_url, generatedUrl: row.generated_url,
    shortUrl: row.short_url || ""
  };
}
function toRecord(item) {
  return {
    client_id: String(item.id), created_at: item.createdAt,
    label: item.label || "", source: item.source, medium: item.medium,
    campaign: item.campaign, term: item.term || "", content: item.content || "",
    destination_url: item.destinationUrl, generated_url: item.generatedUrl,
    short_url: item.shortUrl || ""
  };
}
export async function openSharedStore() {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Falta configurar la base de datos compartida en shared-config.js.");
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  async function requireAccess() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!session) {
      const email = window.prompt("Ingresa tu correo autorizado para acceder a la bitácora compartida:");
      if (!email) return false;
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin + window.location.pathname }
      });
      if (otpError) throw otpError;
      window.alert("Enviamos un enlace de acceso a tu correo. Ábrelo para continuar.");
      return false;
    }
    const { data, error: membershipError } = await supabase.rpc("utm_membership");
    if (membershipError) throw membershipError;
    if (data !== true) throw new Error("Tu correo no está autorizado para esta bitácora.");
    return true;
  }
  async function getAll() {
    const all = [];
    const pageSize = 500;
    for (let start = 0; ; start += pageSize) {
      const { data, error } = await supabase.from("utm_links")
        .select("*").order("id", { ascending: false })
        .range(start, start + pageSize - 1);
      if (error) throw error;
      all.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }
    return all.map(mapRecord);
  }
  async function add(item) {
    const { data, error } = await supabase.from("utm_links")
      .insert(toRecord(item)).select("*").single();
    if (error) throw error;
    return mapRecord(data);
  }
  async function updateShort(clientId, shortUrl) {
    const { error } = await supabase.from("utm_links")
      .update({ short_url: shortUrl }).eq("client_id", clientId);
    if (error) throw error;
  }
  async function remove(clientId) {
    const { error } = await supabase.from("utm_links").delete().eq("client_id", clientId);
    if (error) throw error;
  }
  async function clearAll() {
    const { error } = await supabase.from("utm_links").delete().gt("id", 0);
    if (error) throw error;
  }
  async function migrateLegacy(legacyItems) {
    const marker = "utm_shared_import_v1";
    if (localStorage.getItem(marker) === "done") return;
    if (!legacyItems.length) { localStorage.setItem(marker, "done"); return; }
    const items = [...legacyItems].reverse().map(toRecord);
    for (let i = 0; i < items.length; i += 100) {
      const { error } = await supabase.from("utm_links")
        .upsert(items.slice(i, i + 100), { onConflict: "client_id", ignoreDuplicates: true });
      if (error) throw error;
    }
    localStorage.setItem(marker, "done");
  }
  function watch(onChange) {
    const channel = supabase.channel("utm-shared-history")
      .on("postgres_changes", { event: "*", schema: "public", table: "utm_links" }, () => onChange())
      .subscribe();
    const interval = setInterval(() => { if (!document.hidden) onChange(); }, 30000);
    const visible = () => { if (!document.hidden) onChange(); };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", visible);
      supabase.removeChannel(channel);
    };
  }
  return { requireAccess, getAll, add, updateShort, remove, clearAll, migrateLegacy, watch };
}
