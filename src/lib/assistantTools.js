// ── AI ASISTAN: Tool tanımları ve executor ──────────────────────────────────
import { supabase } from './supabase';

// Claude API'ye gönderilecek tool tanımları
export const ASSISTANT_TOOLS = [
  {
    name: 'search_agendas',
    description: 'Gündemleri arar. Başlık, birim veya duruma göre filtreleyebilir.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Arama terimi (başlıkta aranır)' },
        status: { type: 'string', description: 'Durum filtresi: aktif, devam, tamamlandi, arsiv' },
        limit: { type: 'number', description: 'Max sonuç sayısı (varsayılan 10)' },
      },
      required: [],
    },
  },
  {
    name: 'create_agenda',
    description: 'Yeni bir gündem oluşturur.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Gündem başlığı' },
        description: { type: 'string', description: 'Gündem açıklaması' },
        type_name: { type: 'string', description: 'Tür adı: Etkinlik, Misafir, Proje, Eğitim, İşbirliği, Saha Ziyareti, İş Geliştirme' },
        status: { type: 'string', description: 'Durum: aktif (varsayılan), devam, tamamlandi, arsiv' },
        is_personal: { type: 'boolean', description: 'Kişisel gündem mi (Gündemlerim sekmesi)? Varsayılan false' },
        assigned_to_name: { type: 'string', description: 'Atanacak kişinin adı (opsiyonel)' },
        date: { type: 'string', description: 'Tarih (YYYY-MM-DD formatında, opsiyonel)' },
      },
      required: ['title'],
    },
  },
  {
    name: 'create_task',
    description: 'Bir gündem altına yeni görev ekler.',
    input_schema: {
      type: 'object',
      properties: {
        agenda_title: { type: 'string', description: 'Görevin ekleneceği gündem başlığı (kısmi eşleşme)' },
        title: { type: 'string', description: 'Görev başlığı' },
        assigned_to_name: { type: 'string', description: 'Görevin atanacağı kişinin adı' },
        priority: { type: 'string', description: 'Öncelik: kritik, yuksek, orta, dusuk (varsayılan orta)' },
        due_date: { type: 'string', description: 'Bitiş tarihi (YYYY-MM-DD)' },
      },
      required: ['agenda_title', 'title'],
    },
  },
  {
    name: 'update_task_status',
    description: 'Bir görevin durumunu günceller.',
    input_schema: {
      type: 'object',
      properties: {
        agenda_title: { type: 'string', description: 'Gündem başlığı' },
        task_title: { type: 'string', description: 'Görev başlığı (kısmi eşleşme)' },
        status: { type: 'string', description: 'Yeni durum: bekliyor, devam, tamamlandi' },
      },
      required: ['task_title', 'status'],
    },
  },
  {
    name: 'list_tasks',
    description: 'Bir gündemdeki görevleri listeler veya bir kişiye atanmış görevleri gösterir.',
    input_schema: {
      type: 'object',
      properties: {
        agenda_title: { type: 'string', description: 'Gündem başlığı (kısmi eşleşme)' },
        assigned_to_name: { type: 'string', description: 'Atanan kişi adı ile filtrele' },
      },
      required: [],
    },
  },
  {
    name: 'search_contacts',
    description: 'Network kişilerini arar.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'İsim, kurum, ülke veya pozisyonla ara' },
        limit: { type: 'number', description: 'Max sonuç sayısı (varsayılan 10)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_organizations',
    description: 'Network kurumlarını arar.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Kurum adı ile ara' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_summary',
    description: 'Genel özet bilgi verir: toplam gündem, görev, kişi, kurum, etkinlik sayıları ve bekleyen görevler.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'list_profiles',
    description: 'Sistemdeki personel/kullanıcı listesini getirir.',
    input_schema: {
      type: 'object',
      properties: {
        unit: { type: 'string', description: 'Birime göre filtrele (opsiyonel)' },
      },
      required: [],
    },
  },
  {
    name: 'create_contact',
    description: 'Network modülüne yeni bir kişi ekler.',
    input_schema: {
      type: 'object',
      properties: {
        full_name: { type: 'string', description: 'Kişinin tam adı' },
        position: { type: 'string', description: 'Pozisyon/unvan' },
        email: { type: 'string', description: 'E-posta adresi' },
        phone: { type: 'string', description: 'Telefon numarası' },
        organization_name: { type: 'string', description: 'Bağlı olduğu kurum adı (varsa eşleştirilir)' },
        country: { type: 'string', description: 'Ülke (Türkçe, örn: Türkiye, ABD, Almanya)' },
        city: { type: 'string', description: 'Şehir' },
        linkedin: { type: 'string', description: 'LinkedIn profil URL' },
        notes: { type: 'string', description: 'Notlar' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Etiketler listesi' },
        priority: { type: 'string', description: 'Öncelik: Kritik, Yüksek, Orta, Düşük (varsayılan Orta)' },
        process_stage: { type: 'string', description: 'Süreç aşaması: İlk Temas, İletişim Geliştirme, İşbirliği Görüşmesi, Aktif İşbirliği, Pasif / Beklemede' },
      },
      required: ['full_name'],
    },
  },
  {
    name: 'create_organization',
    description: 'Network modülüne yeni bir kurum/organizasyon ekler.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Kurum adı' },
        org_type: { type: 'string', description: 'Tür: ngo, donor, government, un_agency, private, academic, media, other' },
        website: { type: 'string', description: 'Web sitesi URL' },
        email: { type: 'string', description: 'E-posta' },
        phone: { type: 'string', description: 'Telefon' },
        address: { type: 'string', description: 'Adres' },
        description: { type: 'string', description: 'Kurum açıklaması' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Etiketler' },
      },
      required: ['name'],
    },
  },
  {
    name: 'create_event',
    description: 'Network modülüne yeni bir etkinlik ekler.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Etkinlik adı' },
        event_type: { type: 'string', description: 'Tür: conference, meeting, workshop, training, forum, visit, other' },
        event_date: { type: 'string', description: 'Etkinlik tarihi (YYYY-MM-DD)' },
        end_date: { type: 'string', description: 'Bitiş tarihi (YYYY-MM-DD)' },
        location: { type: 'string', description: 'Konum (Şehir, Ülke)' },
        description: { type: 'string', description: 'Açıklama' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Etiketler' },
      },
      required: ['name'],
    },
  },
];

// ── Tool executor: Her tool çağrısını Supabase ile çalıştırır ──────────────
export async function executeTool(toolName, toolInput, context) {
  const { userId, userName, userUnit } = context;

  switch (toolName) {
    case 'search_agendas': {
      let query = supabase.from('agendas').select('id, title, status, unit, description, date, is_personal, assigned_to_name, created_by_name').order('created_at', { ascending: false }).limit(toolInput.limit || 10);
      if (toolInput.query) query = query.ilike('title', `%${toolInput.query}%`);
      if (toolInput.status) query = query.eq('status', toolInput.status);
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { agendas: data, count: data?.length || 0 };
    }

    case 'create_agenda': {
      // Tür ID'sini bul
      let typeId = null;
      if (toolInput.type_name) {
        const { data: types } = await supabase.from('agenda_types').select('id, name');
        const match = types?.find(t => t.name.toLowerCase().includes(toolInput.type_name.toLowerCase()));
        typeId = match?.id || null;
      }
      // Atanacak kişiyi bul
      let assignedTo = null;
      let assignedToName = null;
      if (toolInput.assigned_to_name) {
        const { data: profiles } = await supabase.from('user_profiles').select('user_id, full_name');
        const match = profiles?.find(p => p.full_name.toLowerCase().includes(toolInput.assigned_to_name.toLowerCase()));
        if (match) { assignedTo = match.user_id; assignedToName = match.full_name; }
      }
      const isPersonal = toolInput.is_personal || false;
      const { data, error } = await supabase.from('agendas').insert({
        title: toolInput.title,
        description: toolInput.description || null,
        type_id: typeId,
        status: toolInput.status || 'aktif',
        created_by: userId,
        created_by_name: userName,
        unit: isPersonal ? null : userUnit,
        is_personal: isPersonal,
        assigned_to: assignedTo,
        assigned_to_name: assignedToName,
        date: toolInput.date || null,
      }).select().single();
      if (error) return { error: error.message };
      return { success: true, agenda: { id: data.id, title: data.title, status: data.status } };
    }

    case 'create_task': {
      // Gündem bul
      const { data: agendas } = await supabase.from('agendas').select('id, title').ilike('title', `%${toolInput.agenda_title}%`).limit(1);
      if (!agendas?.length) return { error: `"${toolInput.agenda_title}" başlıklı gündem bulunamadı.` };
      const agenda = agendas[0];
      // Atanacak kişiyi bul
      let assignedTo = null;
      let assignedToName = null;
      if (toolInput.assigned_to_name) {
        const { data: profiles } = await supabase.from('user_profiles').select('user_id, full_name');
        const match = profiles?.find(p => p.full_name.toLowerCase().includes(toolInput.assigned_to_name.toLowerCase()));
        if (match) { assignedTo = match.user_id; assignedToName = match.full_name; }
      }
      const { data, error } = await supabase.from('agenda_tasks').insert({
        agenda_id: agenda.id,
        title: toolInput.title,
        assigned_to: assignedTo,
        assigned_to_name: assignedToName,
        priority: toolInput.priority || 'orta',
        status: 'bekliyor',
        completion_status: 'pending',
        due_date: toolInput.due_date || null,
        created_by: userId,
      }).select().single();
      if (error) return { error: error.message };
      return { success: true, task: { id: data.id, title: data.title, agenda: agenda.title, assigned_to_name: assignedToName } };
    }

    case 'update_task_status': {
      let taskQuery = supabase.from('agenda_tasks').select('id, title, agenda_id').ilike('title', `%${toolInput.task_title}%`);
      if (toolInput.agenda_title) {
        const { data: ag } = await supabase.from('agendas').select('id').ilike('title', `%${toolInput.agenda_title}%`).limit(1);
        if (ag?.length) taskQuery = taskQuery.eq('agenda_id', ag[0].id);
      }
      const { data: tasks } = await taskQuery.limit(1);
      if (!tasks?.length) return { error: `"${toolInput.task_title}" görevi bulunamadı.` };
      const task = tasks[0];
      const { error } = await supabase.from('agenda_tasks').update({ status: toolInput.status }).eq('id', task.id);
      if (error) return { error: error.message };
      return { success: true, task: { id: task.id, title: task.title, new_status: toolInput.status } };
    }

    case 'list_tasks': {
      let query = supabase.from('agenda_tasks').select('id, title, status, priority, assigned_to_name, due_date, completion_status, agenda_id');
      if (toolInput.agenda_title) {
        const { data: ag } = await supabase.from('agendas').select('id').ilike('title', `%${toolInput.agenda_title}%`).limit(1);
        if (ag?.length) query = query.eq('agenda_id', ag[0].id);
        else return { error: `"${toolInput.agenda_title}" gündem bulunamadı.` };
      }
      if (toolInput.assigned_to_name) query = query.ilike('assigned_to_name', `%${toolInput.assigned_to_name}%`);
      const { data, error } = await query.order('created_at', { ascending: false }).limit(20);
      if (error) return { error: error.message };
      return { tasks: data, count: data?.length || 0 };
    }

    case 'search_contacts': {
      const q = toolInput.query;
      const { data, error } = await supabase.from('network_contacts').select('id, full_name, position, email, phone, country, city, organization_id, process_stage, priority')
        .or(`full_name.ilike.%${q}%,position.ilike.%${q}%,country.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(toolInput.limit || 10);
      if (error) return { error: error.message };
      return { contacts: data, count: data?.length || 0 };
    }

    case 'search_organizations': {
      const { data, error } = await supabase.from('network_organizations').select('id, name, org_type, website, email, phone')
        .ilike('name', `%${toolInput.query}%`).limit(10);
      if (error) return { error: error.message };
      return { organizations: data, count: data?.length || 0 };
    }

    case 'get_summary': {
      const [ag, tasks, contacts, orgs, events] = await Promise.all([
        supabase.from('agendas').select('id, status', { count: 'exact', head: false }),
        supabase.from('agenda_tasks').select('id, status, completion_status', { count: 'exact', head: false }),
        supabase.from('network_contacts').select('id', { count: 'exact', head: true }),
        supabase.from('network_organizations').select('id', { count: 'exact', head: true }),
        supabase.from('network_events').select('id', { count: 'exact', head: true }),
      ]);
      const agendas = ag.data || [];
      const allTasks = tasks.data || [];
      return {
        agendas: { total: agendas.length, aktif: agendas.filter(a => a.status === 'aktif').length, tamamlandi: agendas.filter(a => a.status === 'tamamlandi').length },
        tasks: { total: allTasks.length, bekliyor: allTasks.filter(t => t.status === 'bekliyor').length, onay_bekleyen: allTasks.filter(t => t.completion_status === 'pending_review').length, tamamlandi: allTasks.filter(t => t.completion_status === 'approved').length },
        network: { contacts: contacts.count || 0, organizations: orgs.count || 0, events: events.count || 0 },
      };
    }

    case 'list_profiles': {
      let query = supabase.from('user_profiles').select('user_id, full_name, role, unit, email');
      if (toolInput.unit) query = query.eq('unit', toolInput.unit);
      const { data, error } = await query.order('full_name');
      if (error) return { error: error.message };
      return { profiles: data, count: data?.length || 0 };
    }

    case 'create_contact': {
      // Kurum eşleştir
      let organizationId = null;
      if (toolInput.organization_name) {
        const { data: orgs } = await supabase.from('network_organizations').select('id, name').ilike('name', `%${toolInput.organization_name}%`).limit(1);
        if (orgs?.length) organizationId = orgs[0].id;
      }
      const { data, error } = await supabase.from('network_contacts').insert({
        full_name: toolInput.full_name,
        position: toolInput.position || null,
        email: toolInput.email || null,
        phone: toolInput.phone || null,
        linkedin: toolInput.linkedin || null,
        notes: toolInput.notes || null,
        organization_id: organizationId,
        country: toolInput.country || null,
        city: toolInput.city || null,
        tags: toolInput.tags || [],
        priority: toolInput.priority || 'Orta',
        process_stage: toolInput.process_stage || 'İlk Temas',
        unit: userUnit,
        created_by: userId,
      }).select().single();
      if (error) return { error: error.message };
      return { success: true, contact: { id: data.id, full_name: data.full_name, organization: toolInput.organization_name || null } };
    }

    case 'create_organization': {
      const { data, error } = await supabase.from('network_organizations').insert({
        name: toolInput.name,
        org_type: toolInput.org_type || 'other',
        website: toolInput.website || null,
        email: toolInput.email || null,
        phone: toolInput.phone || null,
        address: toolInput.address || null,
        description: toolInput.description || null,
        tags: toolInput.tags || [],
        unit: userUnit,
      }).select().single();
      if (error) return { error: error.message };
      return { success: true, organization: { id: data.id, name: data.name, org_type: data.org_type } };
    }

    case 'create_event': {
      const { data, error } = await supabase.from('network_events').insert({
        name: toolInput.name,
        event_type: toolInput.event_type || 'other',
        event_date: toolInput.event_date || null,
        end_date: toolInput.end_date || null,
        location: toolInput.location || null,
        description: toolInput.description || null,
        tags: toolInput.tags || [],
        unit: userUnit,
      }).select().single();
      if (error) return { error: error.message };
      return { success: true, event: { id: data.id, name: data.name, event_date: data.event_date } };
    }

    default:
      return { error: `Bilinmeyen araç: ${toolName}` };
  }
}

// ── System prompt ────────────────────────────────────────────────────────────
export const ASSISTANT_SYSTEM_PROMPT = `Sen bir STK (sivil toplum kuruluşu) yönetim platformunun AI asistanısın. Adın "COS Asistan".
Kullanıcılara gündem oluşturma, görev atama, network kişileri arama gibi konularda yardımcı oluyorsun.

Yeteneklerin:
- Gündem oluşturma, görev ekleme/atama/durum güncelleme
- Network kişi ekleme, kurum ekleme, etkinlik ekleme
- Kişi arama, kurum arama, gündem arama
- Personel listesi, genel özet istatistikler

Kurallar:
- Türkçe konuş, kısa ve net cevaplar ver.
- Tarih formatı: YYYY-MM-DD
- Öncelik değerleri: kritik, yuksek, orta, dusuk
- Gündem durumları: aktif, devam, tamamlandi, arsiv
- Görev durumları: bekliyor, devam, tamamlandi
- Gündem türleri: Etkinlik, Misafir, Proje, Eğitim, İşbirliği, Saha Ziyareti, İş Geliştirme
- Kişisel gündem oluşturulurken is_personal: true gönder.
- Bir işlem yaptıktan sonra kısa bir onay mesajı ver.
- Belirsiz durumlarda önce soru sor.
- Emoji kullanarak cevaplarını renklendir.`;
