// ==========================================================================
// WEBCARE ISSUES - SUPABASE CONFIGURATION & CLIENT HELPER
// ==========================================================================

// 1. Your Supabase Project Credentials
// Replace the values below with your actual Supabase URL & Anon Public Key:
// Or set them dynamically via the Admin Settings modal in the dashboard!
const SUPABASE_DEFAULT_URL = 'https://yaxehrysnvvzulswcvpp.supabase.co';
const SUPABASE_DEFAULT_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlheGVocnlzbnZ2enVsc3djdnBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyNjUxMzAsImV4cCI6MjEwNjg0MTEzMH0.dFQW6ZEXUq82AKRdG2oDjuser_d9wj2ZPufMh8BRkN8';

let supabaseClient = null;

// Get active configuration (Stored in localStorage or fallback to default constants)
function getSupabaseCredentials() {
  const customUrl = localStorage.getItem('webcare_supabase_url');
  const customKey = localStorage.getItem('webcare_supabase_anon_key');

  const url = (customUrl && customUrl.trim()) ? customUrl.trim() : SUPABASE_DEFAULT_URL;
  const anonKey = (customKey && customKey.trim()) ? customKey.trim() : SUPABASE_DEFAULT_ANON_KEY;

  return { url, anonKey };
}

// Check if Supabase credentials have been provided
function isSupabaseConfigured() {
  const { url, anonKey } = getSupabaseCredentials();
  return Boolean(
    url &&
    url.length > 8 &&
    url.startsWith('https://') &&
    anonKey &&
    anonKey.length > 20
  );
}

// Initialize / Get Supabase Client Instance
function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;

  if (!isSupabaseConfigured()) {
    return null;
  }

  const { url, anonKey } = getSupabaseCredentials();

  try {
    if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
      supabaseClient = window.supabase.createClient(url, anonKey, {
        auth: { persistSession: false },
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      });
      return supabaseClient;
    }
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
  }
  return null;
}

// Save credentials from Admin UI
function setSupabaseCredentials(url, anonKey) {
  if (url) localStorage.setItem('webcare_supabase_url', url.trim());
  if (anonKey) localStorage.setItem('webcare_supabase_anon_key', anonKey.trim());
  supabaseClient = null; // reset client to re-initialize
  return isSupabaseConfigured();
}

// Clear custom Supabase credentials
function clearSupabaseCredentials() {
  localStorage.removeItem('webcare_supabase_url');
  localStorage.removeItem('webcare_supabase_anon_key');
  supabaseClient = null;
}

// ==========================================================================
// CRUD OPERATIONS (SUPABASE DATABASE)
// ==========================================================================

// Fetch all tickets ordered by created_at DESC
async function fetchTicketsFromSupabase() {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetch error:', error);
      return null;
    }

    // Map DB fields to application model
    return (data || []).map(row => ({
      id: row.id,
      reporter: row.reporter,
      email: row.email,
      phone: row.phone || '',
      website: row.website || '',
      details: row.details || '',
      fileCount: row.file_count || (row.files ? row.files.length : 0),
      files: row.files || [],
      status: row.status || 'pending',
      createdAt: row.created_at,
      completedAt: row.completed_at || null,
      timeStr: row.created_at ? new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recently'
    }));
  } catch (err) {
    console.error('Supabase fetch exception:', err);
    return null;
  }
}

// Insert new ticket to Supabase
async function insertTicketToSupabase(ticket) {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const payload = {
      id: ticket.id,
      reporter: ticket.reporter,
      email: ticket.email,
      phone: ticket.phone || null,
      website: ticket.website || null,
      details: ticket.details,
      file_count: ticket.fileCount || (ticket.files ? ticket.files.length : 0),
      files: ticket.files || [],
      status: ticket.status || 'pending',
      created_at: ticket.createdAt || new Date().toISOString(),
      completed_at: ticket.completedAt || null
    };

    const { data, error } = await client
      .from('tickets')
      .insert([payload]);

    if (error) {
      console.error('Supabase insert error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Supabase insert exception:', err);
    return false;
  }
}

// Update ticket status in Supabase
async function updateTicketStatusInSupabase(ticketId, newStatus) {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const updates = {
      status: newStatus,
    };
    if (newStatus === 'done') {
      updates.completed_at = new Date().toISOString();
    }

    const { error } = await client
      .from('tickets')
      .update(updates)
      .eq('id', ticketId);

    if (error) {
      console.error('Supabase update status error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Supabase update status exception:', err);
    return false;
  }
}

// Delete all tickets (Clear Queue)
async function clearTicketsInSupabase() {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client
      .from('tickets')
      .delete()
      .neq('id', 'EMPTY_MATCH_ALL'); // Delete all rows

    if (error) {
      console.error('Supabase clear queue error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Supabase clear queue exception:', err);
    return false;
  }
}

// Subscribe to Realtime Postgres Changes
function subscribeToSupabaseTickets(onInsert, onUpdate, onDelete) {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const channel = client
      .channel('public:tickets')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tickets' }, payload => {
        if (onInsert) {
          const row = payload.new;
          onInsert({
            id: row.id,
            reporter: row.reporter,
            email: row.email,
            phone: row.phone || '',
            website: row.website || '',
            details: row.details || '',
            fileCount: row.file_count || 0,
            files: row.files || [],
            status: row.status,
            createdAt: row.created_at,
            completedAt: row.completed_at,
            timeStr: 'Just now'
          });
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tickets' }, payload => {
        if (onUpdate) onUpdate(payload.new);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tickets' }, payload => {
        if (onDelete) onDelete(payload.old);
      })
      .subscribe();

    return channel;
  } catch (err) {
    console.error('Supabase subscription error:', err);
    return null;
  }
}

// Upload file to Supabase Storage Bucket ('ticket-attachments')
async function uploadAttachmentToSupabase(fileObj, ticketId) {
  const client = getSupabaseClient();
  if (!client || !fileObj || !fileObj.blob) return null;

  try {
    const fileExt = fileObj.name.split('.').pop();
    const cleanFileName = fileObj.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${ticketId}/${Date.now()}_${cleanFileName}`;

    const { data, error } = await client.storage
      .from('ticket-attachments')
      .upload(filePath, fileObj.blob, {
        cacheControl: '3600',
        upsert: true,
        contentType: fileObj.type || 'application/octet-stream'
      });

    if (error) {
      console.warn('Storage upload error:', error);
      return null;
    }

    const { data: publicUrlData } = client.storage
      .from('ticket-attachments')
      .getPublicUrl(filePath);

    return publicUrlData ? publicUrlData.publicUrl : null;
  } catch (err) {
    console.error('Storage upload exception:', err);
    return null;
  }
}

// Expose on window object
window.WebCareSupabase = {
  isConfigured: isSupabaseConfigured,
  getCredentials: getSupabaseCredentials,
  setCredentials: setSupabaseCredentials,
  clearCredentials: clearSupabaseCredentials,
  getClient: getSupabaseClient,
  fetchTickets: fetchTicketsFromSupabase,
  insertTicket: insertTicketToSupabase,
  updateStatus: updateTicketStatusInSupabase,
  clearQueue: clearTicketsInSupabase,
  subscribe: subscribeToSupabaseTickets,
  uploadAttachment: uploadAttachmentToSupabase
};
