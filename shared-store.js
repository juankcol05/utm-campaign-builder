import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./shared-config.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.2/+esm";

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
  async function requireAccess(requestEmail = false) {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!session) {
      if (!requestEmail) return false;
      const email = window.prompt("Ingresa el correo de la única cuenta autorizada:");
      if (!email) return false;
      const trimmed = email.trim();
      if (!/^[^ @]+@[^ @]+[.][^ @]+$/.test(trimmed)) {
        throw new Error("El formato del correo no es válido.");
      }
      const lastRequest = Number(localStorage.getItem("utm_last_magic_link_attempt") || "0");
      if (Date.now() - lastRequest < 60 * 60 * 1000) {
        throw new Error("Ya solicitaste acceso durante la última hora. Revisa el último correo recibido y evita solicitar nuevos enlaces. Supabase tiene un límite de 2 correos por hora.");
      }
      // Registrar el intento ANTES de contactar el proveedor: también evita repetir 429.
      localStorage.setItem("utm_last_magic_link_attempt", String(Date.now()));
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          emailRedirectTo: "https://juankcol05.github.io/utm-campaign-builder/",
          shouldCreateUser: false
        }
      });
      if (otpError) {
        if (otpError.status === 429 || /rate.limit|over_email_send_rate_limit/i.test(otpError.message || "")) {
          throw new Error("Supabase rechazó el envío por límite de correos (429). Debes dejar de solicitar enlaces hasta que se libere el cupo.");
        }
        throw otpError;
      }
      window.alert("Enlace solicitado. Revisa tu correo y abre UNA sola vez el enlace nuevo. Si te envía a localhost:3000, debes corregir Site URL y Redirect URLs en Supabase.");
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
    let beforeId = null;
    // Cursor de ID: evita registros omitidos o repetidos ante inserciones concurrentes.
    for (;;) {
      let query = supabase.from("utm_links")
        .select("*").order("id", { ascending: false }).limit(pageSize);
      if (beforeId !== null) query = query.lt("id", beforeId);
      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) break;
      all.push(...data);
      beforeId = data[data.length - 1].id;
      if (data.length < pageSize) break;
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
    const { data, error } = await supabase.from("utm_links").delete().eq("client_id", clientId).select("id");
    if (error) throw error;
    if (!data || data.length === 0) throw new Error("No tienes permisos para eliminar este registro.");
  }
  async function clearAll() {
    const { data, error } = await supabase.from("utm_links").delete().gt("id", 0).select("id");
    if (error) throw error;
    if (!data || data.length === 0) throw new Error("No tienes permisos para borrar el inventario compartido o ya estaba vacío.");
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
      .on("postgres_changes", { event: "*", schema: "public", table: "utm_links" }, (payload) => {
        if (payload.eventType === "DELETE" && payload.old?.id) {
          onChange({ type: "DELETE", consecutive: payload.old.id });
        } else if (payload.new?.id) {
          onChange({ type: payload.eventType, record: mapRecord(payload.new) });
        } else {
          onChange(null);
        }
      })
      .subscribe();
    // Respaldo periódico; el flujo Realtime actualiza filas sin descargar toda la tabla.
    const interval = setInterval(() => { if (!document.hidden) onChange(null); }, 300000);
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
