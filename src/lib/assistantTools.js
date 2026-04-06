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
        avatar_url: { type: 'string', description: 'Profil fotoğrafı URL (LinkedIn vb.)' },
        notes: { type: 'string', description: 'Notlar' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Etiketler listesi' },
        priority: { type: 'string', description: 'Öncelik: Kritik, Yüksek, Orta, Düşük (varsayılan Orta)' },
        process_stage: { type: 'string', description: 'Süreç aşaması: İlk Temas, İletişim Geliştirme, İşbirliği Görüşmesi, Aktif İşbirliği, Pasif / Beklemede' },
        auto_create_org: { type: 'boolean', description: 'Kurum bulunamazsa otomatik oluşturulsun mu? (varsayılan true)' },
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
  {
    name: 'create_main_event',
    description: 'Etkinlikler modülüne (ana etkinlik takvimi) yeni bir etkinlik ekler. Kullanıcı "etkinlik ekle", "etkinliğe ekle", "etkinlikler modülüne", "takvime ekle" dediğinde veya bir konferans/forum/toplantı linki ya da görseli paylaşıp eklenmesini istediğinde bu tool kullanılır.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Etkinlik başlığı' },
        event_type: { type: 'string', description: 'Tür: konferans, forum, toplanti, egitim, ziyaret, webinar, diger' },
        status: { type: 'string', description: 'Durum: planned (varsayılan), ongoing, completed, cancelled' },
        start_date: { type: 'string', description: 'Başlangıç tarihi (YYYY-MM-DD)' },
        end_date: { type: 'string', description: 'Bitiş tarihi (YYYY-MM-DD)' },
        start_time: { type: 'string', description: 'Başlangıç saati (HH:MM)' },
        end_time: { type: 'string', description: 'Bitiş saati (HH:MM)' },
        location_name: { type: 'string', description: 'Mekan adı veya adresi' },
        location_type: { type: 'string', description: 'Konum türü: physical, online, hybrid' },
        city: { type: 'string', description: 'Şehir' },
        country: { type: 'string', description: 'Ülke' },
        description: { type: 'string', description: 'Etkinlik açıklaması' },
        objectives: { type: 'string', description: 'Hedefler' },
        website_url: { type: 'string', description: 'Etkinlik web sitesi URL' },
        registration_link: { type: 'string', description: 'Kayıt linki' },
        registration_deadline: { type: 'string', description: 'Son kayıt tarihi (YYYY-MM-DD)' },
      },
      required: ['title', 'start_date'],
    },
  },
  {
    name: 'search_main_events',
    description: 'Etkinlikler modülündeki etkinlikleri arar veya listeler.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Başlıkta aranacak terim (opsiyonel)' },
        status: { type: 'string', description: 'Durum filtresi: planned, ongoing, completed, cancelled' },
        limit: { type: 'number', description: 'Max sonuç sayısı (varsayılan 10)' },
      },
      required: [],
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
      // Kurum eşleştir — bulamazsa otomatik oluştur
      let organizationId = null;
      let orgCreated = false;
      let orgName = toolInput.organization_name || null;
      if (orgName) {
        const { data: orgs } = await supabase.from('network_organizations').select('id, name').ilike('name', `%${orgName}%`).limit(1);
        if (orgs?.length) {
          organizationId = orgs[0].id;
          orgName = orgs[0].name;
        } else if (toolInput.auto_create_org !== false) {
          // Kurum bulunamadı → otomatik oluştur
          const { data: newOrg, error: orgErr } = await supabase.from('network_organizations').insert({
            name: orgName,
            org_type: 'other',
            tags: [],
            unit: userUnit,
            created_by: userId,
          }).select().single();
          if (!orgErr && newOrg) {
            organizationId = newOrg.id;
            orgCreated = true;
          }
        }
      }
      const { data, error } = await supabase.from('network_contacts').insert({
        full_name: toolInput.full_name,
        position: toolInput.position || null,
        email: toolInput.email || null,
        phone: toolInput.phone || null,
        linkedin: toolInput.linkedin || null,
        avatar_url: toolInput.avatar_url || null,
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
      return { success: true, contact: { id: data.id, full_name: data.full_name, organization: orgName }, organization_created: orgCreated };
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
        created_by: userId,
      }).select().single();
      if (error) return { error: error.message };
      return { success: true, organization: { id: data.id, name: data.name, org_type: data.org_type } };
    }

    case 'create_event': {
      // Network etkinliği artık ana events tablosuna yazılıyor
      const nullIfEmpty = (v) => (!v || v === '' ? null : v);
      const { data, error } = await supabase.from('events').insert({
        title:         toolInput.name,
        event_type:    toolInput.event_type || 'diger',
        status:        'planned',
        start_date:    nullIfEmpty(toolInput.event_date) || new Date().toISOString().split('T')[0],
        end_date:      nullIfEmpty(toolInput.end_date),
        location_name: nullIfEmpty(toolInput.location),
        description:   nullIfEmpty(toolInput.description),
        unit:          userUnit,
        owner_id:      userId,
        created_by:    userId,
      }).select().single();
      if (error) return { error: error.message };
      return { success: true, event: { id: data.id, name: data.title, event_date: data.start_date } };
    }

    case 'create_main_event': {
      const nullIfEmpty = (v) => (!v || v === '' ? null : v);
      const { data, error } = await supabase.from('events').insert({
        title: toolInput.title,
        event_type: toolInput.event_type || 'diger',
        status: toolInput.status || 'planned',
        start_date: toolInput.start_date,
        end_date: nullIfEmpty(toolInput.end_date),
        start_time: nullIfEmpty(toolInput.start_time),
        end_time: nullIfEmpty(toolInput.end_time),
        location_name: nullIfEmpty(toolInput.location_name),
        location_type: nullIfEmpty(toolInput.location_type),
        city: nullIfEmpty(toolInput.city),
        country: nullIfEmpty(toolInput.country),
        description: nullIfEmpty(toolInput.description),
        objectives: nullIfEmpty(toolInput.objectives),
        website_url: nullIfEmpty(toolInput.website_url),
        registration_link: nullIfEmpty(toolInput.registration_link),
        registration_deadline: nullIfEmpty(toolInput.registration_deadline),
        unit: userUnit,
        owner_id: userId,
        created_by: userId,
      }).select().single();
      if (error) return { error: error.message };
      return { success: true, event: { id: data.id, title: data.title, start_date: data.start_date, status: data.status } };
    }

    case 'search_main_events': {
      let query = supabase.from('events')
        .select('id, title, event_type, status, start_date, end_date, location_name, city, country, website_url')
        .order('start_date', { ascending: true })
        .limit(toolInput.limit || 10);
      if (toolInput.query) query = query.ilike('title', `%${toolInput.query}%`);
      if (toolInput.status) query = query.eq('status', toolInput.status);
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { events: data, count: data?.length || 0 };
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
- Network kişi ekleme, kurum ekleme, ağ etkinliği ekleme
- 🗓️ Etkinlikler modülüne etkinlik ekleme ve arama (ana etkinlik takvimi)
- Kişi arama, kurum arama, gündem arama
- Personel listesi, genel özet istatistikler
- 📷 Ekran görüntüsü veya link paylaşılırsa etkinlik bilgilerini çıkarıp ekleme
- 📷 Ekran görüntülerinden (özellikle LinkedIn) kişi bilgilerini çıkarma ve network'e ekleme

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
- Emoji kullanarak cevaplarını renklendir.

🗓️ Etkinlikler Modülü:
"Etkinlikler modülüne ekle", "etkinliğe ekle", "takvime ekle" gibi ifadelerde veya kullanıcı bir etkinlik linki/görseli paylaşıp eklenmesini istediğinde create_main_event kullanılır.
- Ekran görüntüsünden veya linkten etkinlik adı, tarih, konum, website URL gibi bilgileri çıkar.
- start_date zorunlu; bilgi yoksa kullanıcıya sor.
- event_type değerleri: konferans, forum, toplanti, egitim, ziyaret, webinar, diger
- Ekledikten sonra "Etkinlikler modülünde görüntüleyebilirsiniz" de.

📷 Ekran Görüntüsü / LinkedIn Profili İşleme:
Kullanıcı bir ekran görüntüsü (özellikle LinkedIn profili) gönderdiğinde:
1. Görseldeki tüm bilgileri dikkatle oku: isim, unvan/pozisyon, şirket/kurum, konum (şehir/ülke), profil fotoğrafı URL vb.
2. Çıkardığın bilgileri kullanıcıya kısaca özetle.
3. Kullanıcı "ekle" derse veya mesajında "ekle" geçerse, hemen create_contact tool'unu çağır. Eğer kullanıcı görselle birlikte "bu kişiyi ekle" gibi bir mesaj gönderdiyse, onay sormadan direkt ekle.
4. ÖNEMLİ — Kurum işleme: create_contact'ta organization_name alanını doldur. Tool otomatik olarak kurumu arayacak, bulamazsa yeni kurum oluşturacak. Ayrı bir create_organization çağrısı yapmana gerek yok.
5. LinkedIn URL'sini linkedin alanına kaydet.
6. Konum bilgisinden ülke ve şehir ayrıştır (örn: "Istanbul, Turkey" → country: "Türkiye", city: "İstanbul").
7. Profil fotoğrafı: LinkedIn ekran görüntüsünde profil fotoğrafı doğrudan URL olarak erişilemez. Ancak görselden fotoğraf URL'si çıkarabilirsen avatar_url alanına kaydet.`;
