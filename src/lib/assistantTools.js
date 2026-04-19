// ── AI ASISTAN: Tool tanımları ve executor ──────────────────────────────────
import { supabase } from './supabase';
import {
  listTasklists as gtListTasklists,
  listTasks as gtListTasks,
  createTask as gtCreateTask,
  updateTask as gtUpdateTask,
  completeTask as gtCompleteTask,
  deleteTask as gtDeleteTask,
  createTasklist as gtCreateTasklist,
} from './googleTasks';

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL TANIMLARI — Claude API'ye gönderilir
// ═══════════════════════════════════════════════════════════════════════════════
export const ASSISTANT_TOOLS = [
  // ── GÜNDEMLER ────────────────────────────────────────────────────────────────
  {
    name: 'search_agendas',
    description: 'Gündemleri arar. Başlık, birim, durum veya atanan kişiye göre filtreleyebilir.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Başlıkta aranacak terim' },
        status: { type: 'string', description: 'Durum: aktif, devam, tamamlandi, arsiv' },
        unit: { type: 'string', description: 'Birim adı ile filtrele' },
        limit: { type: 'number', description: 'Max sonuç (varsayılan 10)' },
      },
      required: [],
    },
  },
  {
    name: 'create_agenda',
    description: 'Yeni gündem oluşturur.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Gündem başlığı' },
        description: { type: 'string', description: 'Açıklama' },
        type_name: { type: 'string', description: 'Tür: Etkinlik, Misafir, Proje, Eğitim, İşbirliği, Saha Ziyareti, İş Geliştirme' },
        status: { type: 'string', description: 'Durum: aktif (varsayılan), devam, tamamlandi, arsiv' },
        is_personal: { type: 'boolean', description: 'Kişisel gündem mi? Varsayılan false' },
        assigned_to_name: { type: 'string', description: 'Atanacak kişinin adı' },
        date: { type: 'string', description: 'Tarih (YYYY-MM-DD)' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_agenda',
    description: 'Mevcut bir gündemi günceller (başlık, durum, açıklama vb.).',
    input_schema: {
      type: 'object',
      properties: {
        agenda_title: { type: 'string', description: 'Gündem başlığı (kısmi eşleşme ile bulunur)' },
        new_title: { type: 'string', description: 'Yeni başlık' },
        status: { type: 'string', description: 'Yeni durum: aktif, devam, tamamlandi, arsiv' },
        description: { type: 'string', description: 'Yeni açıklama' },
        assigned_to_name: { type: 'string', description: 'Atanacak kişi adı' },
      },
      required: ['agenda_title'],
    },
  },

  // ── GÖREVLER ─────────────────────────────────────────────────────────────────
  {
    name: 'create_task',
    description: 'Bir gündem altına yeni görev ekler.',
    input_schema: {
      type: 'object',
      properties: {
        agenda_title: { type: 'string', description: 'Görevin ekleneceği gündem başlığı' },
        title: { type: 'string', description: 'Görev başlığı' },
        assigned_to_name: { type: 'string', description: 'Atanacak kişi adı' },
        priority: { type: 'string', description: 'Öncelik: yuksek, orta, dusuk' },
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
    description: 'Görevleri listeler — gündem veya kişi bazında.',
    input_schema: {
      type: 'object',
      properties: {
        agenda_title: { type: 'string', description: 'Gündem başlığı' },
        assigned_to_name: { type: 'string', description: 'Kişi adı ile filtrele' },
        status: { type: 'string', description: 'Durum filtresi: bekliyor, devam, tamamlandi' },
      },
      required: [],
    },
  },

  // ── İŞ KAYITLARI (DAILY LOG) ────────────────────────────────────────────────
  {
    name: 'get_daily_log',
    description: 'Belirli bir kullanıcının belirli bir tarihteki iş kaydını getirir.',
    input_schema: {
      type: 'object',
      properties: {
        user_name: { type: 'string', description: 'Kullanıcı adı (boş bırakılırsa mevcut kullanıcı)' },
        date: { type: 'string', description: 'Tarih (YYYY-MM-DD, boş = bugün)' },
      },
      required: [],
    },
  },
  {
    name: 'create_daily_log',
    description: 'Kullanıcı için günlük iş kaydı oluşturur veya günceller. İş kalemleri, çalışma durumu ve notları kaydeder.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Tarih (YYYY-MM-DD, boş = bugün)' },
        work_status: { type: 'string', description: 'Çalışma durumu: ofis, ev, saha, saglik_izni, egitim_izni, yillik_izin, calismiyor' },
        day_period: { type: 'string', description: 'Gün periyodu: tam_gun, ogleden_once, ogleden_sonra' },
        work_items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              category: { type: 'string', description: 'Kategori: Toplantı, Rapor & Dokümantasyon, Saha Ziyareti, Koordinasyon, Proje Çalışması, Eğitim & Gelişim, İdari İşler, Donör İletişimi, Stratejik Planlama, Diğer' },
              description: { type: 'string', description: 'Ne yapıldığının açıklaması' },
              start_time: { type: 'string', description: 'Başlangıç saati (HH:MM)' },
              end_time: { type: 'string', description: 'Bitiş saati (HH:MM)' },
              all_day: { type: 'boolean', description: 'Tüm gün mü?' },
            },
          },
          description: 'İş kalemleri listesi',
        },
        notes: { type: 'string', description: 'Günlük notlar' },
        submit: { type: 'boolean', description: 'true ise kaydı gönder/onayla' },
      },
      required: ['work_items'],
    },
  },
  {
    name: 'get_work_logs_summary',
    description: 'Belirli bir tarih aralığı veya kullanıcı için iş kayıtları özetini getirir.',
    input_schema: {
      type: 'object',
      properties: {
        user_name: { type: 'string', description: 'Kullanıcı adı (boş = tüm personel)' },
        start_date: { type: 'string', description: 'Başlangıç tarihi (YYYY-MM-DD)' },
        end_date: { type: 'string', description: 'Bitiş tarihi (YYYY-MM-DD)' },
      },
      required: ['start_date', 'end_date'],
    },
  },

  // ── DONÖRLER ─────────────────────────────────────────────────────────────────
  {
    name: 'search_donors',
    description: 'Donörleri arar veya listeler.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Donör adı ile ara' },
      },
      required: [],
    },
  },
  {
    name: 'create_donor',
    description: 'Yeni donör kaydı oluşturur.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Donör adı' },
        account_manager: { type: 'string', description: 'Hesap yöneticisi adı' },
        health: { type: 'string', description: 'İlişki sağlığı: 🟢 Strong, 🟡 Developing, 🔴 At Risk' },
        reporting_deadline: { type: 'string', description: 'Raporlama son tarihi (YYYY-MM-DD)' },
        next_followup: { type: 'string', description: 'Sonraki takip tarihi (YYYY-MM-DD)' },
        notes: { type: 'string', description: 'Notlar' },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_donor',
    description: 'Mevcut bir donör kaydını günceller.',
    input_schema: {
      type: 'object',
      properties: {
        donor_name: { type: 'string', description: 'Donör adı (kısmi eşleşme)' },
        health: { type: 'string', description: 'Yeni sağlık durumu' },
        notes: { type: 'string', description: 'Notlar' },
        next_followup: { type: 'string', description: 'Sonraki takip (YYYY-MM-DD)' },
        reporting_deadline: { type: 'string', description: 'Raporlama son tarih (YYYY-MM-DD)' },
      },
      required: ['donor_name'],
    },
  },

  // ── DEADLINES ────────────────────────────────────────────────────────────────
  {
    name: 'search_deadlines',
    description: 'Deadline\'ları listeler veya filtreler.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Durum filtresi' },
        unit: { type: 'string', description: 'Birim filtresi' },
      },
      required: [],
    },
  },
  {
    name: 'create_deadline',
    description: 'Yeni deadline oluşturur.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Deadline başlığı' },
        due_date: { type: 'string', description: 'Son tarih (YYYY-MM-DD)' },
        owner: { type: 'string', description: 'Sorumlu kişi' },
        unit: { type: 'string', description: 'Birim' },
        status: { type: 'string', description: 'Durum' },
        priority: { type: 'string', description: 'Öncelik' },
      },
      required: ['title', 'due_date'],
    },
  },

  // ── TOPLANTI AKSİYONLARI ────────────────────────────────────────────────────
  {
    name: 'search_meeting_actions',
    description: 'Toplantı aksiyonlarını listeler veya arar.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Durum filtresi' },
        owner: { type: 'string', description: 'Sorumlu kişi' },
      },
      required: [],
    },
  },
  {
    name: 'create_meeting_action',
    description: 'Yeni toplantı aksiyonu oluşturur.',
    input_schema: {
      type: 'object',
      properties: {
        action_item: { type: 'string', description: 'Aksiyon açıklaması' },
        owner: { type: 'string', description: 'Sorumlu kişi' },
        due_date: { type: 'string', description: 'Son tarih (YYYY-MM-DD)' },
        meeting_type: { type: 'string', description: 'Toplantı türü' },
        status: { type: 'string', description: 'Durum' },
      },
      required: ['action_item', 'owner'],
    },
  },
  {
    name: 'update_meeting_action',
    description: 'Mevcut toplantı aksiyonunu günceller.',
    input_schema: {
      type: 'object',
      properties: {
        action_text: { type: 'string', description: 'Aksiyon metni (kısmi eşleşme)' },
        status: { type: 'string', description: 'Yeni durum' },
        notes: { type: 'string', description: 'Notlar' },
      },
      required: ['action_text'],
    },
  },

  // ── BİLDİRİMLER ──────────────────────────────────────────────────────────────
  {
    name: 'send_notification',
    description: 'Bir kullanıcıya bildirim gönderir.',
    input_schema: {
      type: 'object',
      properties: {
        recipient_name: { type: 'string', description: 'Alıcı kişi adı' },
        title: { type: 'string', description: 'Bildirim başlığı' },
        body: { type: 'string', description: 'Bildirim içeriği' },
        type: { type: 'string', description: 'Tür: task_assigned, agenda_assigned, task_status, comment_added, mention' },
      },
      required: ['recipient_name', 'title'],
    },
  },

  // ── NETWORK KİŞİLER / KURUMLAR ──────────────────────────────────────────────
  {
    name: 'search_contacts',
    description: 'Network kişilerini arar.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'İsim, kurum, ülke veya pozisyonla ara' },
        limit: { type: 'number', description: 'Max sonuç (varsayılan 10)' },
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
    name: 'create_contact',
    description: 'Network modülüne yeni kişi ekler.',
    input_schema: {
      type: 'object',
      properties: {
        full_name: { type: 'string', description: 'Tam adı' },
        position: { type: 'string', description: 'Pozisyon' },
        email: { type: 'string', description: 'E-posta' },
        phone: { type: 'string', description: 'Telefon' },
        organization_name: { type: 'string', description: 'Kurum adı (otomatik eşleştirilir/oluşturulur)' },
        country: { type: 'string', description: 'Ülke' },
        city: { type: 'string', description: 'Şehir' },
        linkedin: { type: 'string', description: 'LinkedIn URL' },
        notes: { type: 'string', description: 'Notlar' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Etiketler' },
        priority: { type: 'string', description: 'Öncelik: Kritik, Yüksek, Orta, Düşük' },
        process_stage: { type: 'string', description: 'Aşama: İlk Temas, İletişim Geliştirme, İşbirliği Görüşmesi, Aktif İşbirliği, Pasif / Beklemede' },
        auto_create_org: { type: 'boolean', description: 'Kurum yoksa otomatik oluştur? (varsayılan true)' },
      },
      required: ['full_name'],
    },
  },
  {
    name: 'create_organization',
    description: 'Network modülüne yeni kurum ekler.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Kurum adı' },
        org_type: { type: 'string', description: 'Tür: ngo, donor, government, un_agency, private, academic, media, other' },
        website: { type: 'string', description: 'Web sitesi' },
        description: { type: 'string', description: 'Açıklama' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Etiketler' },
      },
      required: ['name'],
    },
  },

  // ── ETKİNLİKLER ──────────────────────────────────────────────────────────────
  {
    name: 'create_main_event',
    description: 'Etkinlikler modülüne etkinlik ekler. "etkinlik ekle", "takvime ekle" dediğinde kullanılır.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Etkinlik başlığı' },
        event_type: { type: 'string', description: 'Tür: konferans, forum, toplanti, egitim, ziyaret, webinar, diger' },
        status: { type: 'string', description: 'Durum: planned, ongoing, completed, cancelled' },
        start_date: { type: 'string', description: 'Başlangıç (YYYY-MM-DD)' },
        end_date: { type: 'string', description: 'Bitiş (YYYY-MM-DD)' },
        start_time: { type: 'string', description: 'Başlangıç saati (HH:MM)' },
        end_time: { type: 'string', description: 'Bitiş saati (HH:MM)' },
        location_name: { type: 'string', description: 'Mekan' },
        location_type: { type: 'string', description: 'physical, online, hybrid' },
        city: { type: 'string', description: 'Şehir' },
        country: { type: 'string', description: 'Ülke' },
        description: { type: 'string', description: 'Açıklama' },
        objectives: { type: 'string', description: 'Hedefler' },
        website_url: { type: 'string', description: 'Etkinlik web sitesi' },
        registration_link: { type: 'string', description: 'Kayıt linki' },
      },
      required: ['title', 'start_date'],
    },
  },
  {
    name: 'search_main_events',
    description: 'Etkinlikleri arar/listeler.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Başlıkta aranacak terim' },
        status: { type: 'string', description: 'Durum filtresi' },
        limit: { type: 'number', description: 'Max sonuç (varsayılan 10)' },
      },
      required: [],
    },
  },

  // ── FON FIRSATLARI ───────────────────────────────────────────────────────────
  {
    name: 'search_funds',
    description: 'Fon fırsatlarını arar/listeler.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Başlıkta aranacak terim' },
      },
      required: [],
    },
  },
  {
    name: 'create_fund',
    description: 'Yeni fon fırsatı kaydı oluşturur.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Fon başlığı' },
        donor_name: { type: 'string', description: 'Donör/fon kuruluşu adı' },
        amount: { type: 'string', description: 'Tutar' },
        currency: { type: 'string', description: 'Para birimi (USD, EUR, TRY vb.)' },
        deadline: { type: 'string', description: 'Başvuru son tarihi (YYYY-MM-DD)' },
        status: { type: 'string', description: 'Durum: identified, applying, submitted, awarded, rejected' },
        description: { type: 'string', description: 'Açıklama' },
        url: { type: 'string', description: 'Başvuru/bilgi linki' },
      },
      required: ['title'],
    },
  },

  // ── PERSONEL & GENEL ─────────────────────────────────────────────────────────
  {
    name: 'list_profiles',
    description: 'Sistemdeki personel/kullanıcı listesini getirir.',
    input_schema: {
      type: 'object',
      properties: {
        unit: { type: 'string', description: 'Birime göre filtrele' },
        role: { type: 'string', description: 'Role göre filtrele: direktor, koordinator, personel' },
      },
      required: [],
    },
  },
  {
    name: 'get_summary',
    description: 'Genel sistem özeti: gündem, görev, kişi, kurum, etkinlik sayıları.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  // ── GÖRSEL YÜKLEME ───────────────────────────────────────────────────────────
  {
    name: 'upload_image_to_entity',
    description: 'Kullanıcının chat\'e yüklediği görseli bir etkinliğe, kişiye veya kuruma profil resmi/logo/kapak görseli olarak ekler. Kullanıcı bir görsel gönderip "bunu X etkinliğine ekle" veya "bu kişinin fotoğrafı" dediğinde kullan.',
    input_schema: {
      type: 'object',
      properties: {
        entity_type: { type: 'string', description: 'Hedef varlık türü: event, contact, organization', enum: ['event', 'contact', 'organization'] },
        entity_name: { type: 'string', description: 'Hedef varlığın adı (kısmi eşleşme ile bulunur)' },
      },
      required: ['entity_type', 'entity_name'],
    },
  },
  {
    name: 'add_image_from_url',
    description: 'URL\'den görsel indirip bir etkinliğe, kişiye veya kuruma ekler. Kullanıcı bir görsel URL\'si paylaştığında kullan.',
    input_schema: {
      type: 'object',
      properties: {
        image_url: { type: 'string', description: 'Görselin URL\'si' },
        entity_type: { type: 'string', description: 'Hedef varlık türü: event, contact, organization', enum: ['event', 'contact', 'organization'] },
        entity_name: { type: 'string', description: 'Hedef varlığın adı (kısmi eşleşme ile bulunur)' },
      },
      required: ['image_url', 'entity_type', 'entity_name'],
    },
  },

  // ── DİREKTÖR GÜNDEMLERİ (director_agendas) ─────────────────────────────────
  {
    name: 'list_director_agendas',
    description: 'Direktör gündemlerini listeler. Bölüm (section) veya durum filtrelenebilir. Bölüm id\'leri: direktor_takip, asistan_takip, genel_sekreter, yonetim_kurulu, mutevelli.',
    input_schema: {
      type: 'object',
      properties: {
        section: { type: 'string', description: 'Bölüm id: direktor_takip | asistan_takip | genel_sekreter | yonetim_kurulu | mutevelli (boş = hepsi)' },
        status: { type: 'string', description: 'Durum: aktif | bekliyor | tamamlandi' },
        priority: { type: 'string', description: 'Öncelik: yuksek | normal | dusuk' },
        only_open: { type: 'boolean', description: 'True ise sadece tamamlanmamış gündemleri getirir' },
        limit: { type: 'number', description: 'Max sonuç (varsayılan 30)' },
      },
      required: [],
    },
  },
  {
    name: 'create_director_agenda',
    description: 'Direktör gündemleri modülüne yeni gündem maddesi ekler. Bölüm seçimi zorunludur. Örn: "yönetim kuruluna X konusunu ekle" → section=yonetim_kurulu.',
    input_schema: {
      type: 'object',
      properties: {
        section: { type: 'string', description: 'Bölüm: direktor_takip | asistan_takip | genel_sekreter | yonetim_kurulu | mutevelli', enum: ['direktor_takip','asistan_takip','genel_sekreter','yonetim_kurulu','mutevelli'] },
        title: { type: 'string', description: 'Gündem başlığı' },
        notes: { type: 'string', description: 'Ek notlar (opsiyonel)' },
        status: { type: 'string', description: 'Durum: aktif (varsayılan) | bekliyor | tamamlandi' },
        priority: { type: 'string', description: 'Öncelik: yuksek | normal (varsayılan) | dusuk' },
        due_date: { type: 'string', description: 'Bitiş tarihi (YYYY-MM-DD, opsiyonel)' },
      },
      required: ['section', 'title'],
    },
  },
  {
    name: 'update_director_agenda',
    description: 'Direktör gündemleri modülündeki bir gündemi günceller (durum, öncelik, başlık, not, tarih).',
    input_schema: {
      type: 'object',
      properties: {
        agenda_title: { type: 'string', description: 'Hedef gündemin başlığı (kısmi eşleşme)' },
        new_title: { type: 'string', description: 'Yeni başlık' },
        notes: { type: 'string', description: 'Yeni notlar' },
        status: { type: 'string', description: 'Yeni durum: aktif | bekliyor | tamamlandi' },
        priority: { type: 'string', description: 'Yeni öncelik: yuksek | normal | dusuk' },
        due_date: { type: 'string', description: 'Yeni bitiş tarihi (YYYY-MM-DD)' },
        section: { type: 'string', description: 'Farklı bölüme taşı' },
      },
      required: ['agenda_title'],
    },
  },
  {
    name: 'delete_director_agenda',
    description: 'Direktör gündemleri modülünden bir gündemi siler.',
    input_schema: {
      type: 'object',
      properties: {
        agenda_title: { type: 'string', description: 'Silinecek gündemin başlığı (kısmi eşleşme)' },
      },
      required: ['agenda_title'],
    },
  },

  // ── GOOGLE TASKS (kişisel OAuth) ────────────────────────────────────────────
  {
    name: 'list_google_tasklists',
    description: "Kullanıcının Google Tasks hesabındaki tüm listeleri getirir. Task eklemeden önce liste ID'sini bulmak için kullan.",
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'list_google_tasks',
    description: 'Belirli bir Google Tasks listesindeki taskları getirir. list_name verilirse tam eşleşme aranır, yoksa ilk liste kullanılır.',
    input_schema: {
      type: 'object',
      properties: {
        list_name: { type: 'string', description: 'Liste adı (örn: "My Tasks"). Boş bırakılırsa ilk liste kullanılır.' },
        include_completed: { type: 'boolean', description: 'Tamamlananları da getir (default true)' },
        max_results: { type: 'number', description: 'Max sonuç (default 50)' },
      },
      required: [],
    },
  },
  {
    name: 'create_google_task',
    description: 'Google Tasks\'a yeni bir task ekler. Kullanıcı "yarına X eklе", "bugün Y\'yi yap" gibi konuştuğunda kullanılır.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task başlığı (zorunlu)' },
        notes: { type: 'string', description: 'Detay notları (opsiyonel)' },
        due_date: { type: 'string', description: 'Son tarih YYYY-MM-DD (opsiyonel)' },
        list_name: { type: 'string', description: 'Hedef liste adı (boş = ilk liste)' },
      },
      required: ['title'],
    },
  },
  {
    name: 'complete_google_task',
    description: 'Bir Google Task\'ı tamamlanmış olarak işaretler. task_title kısmi eşleşme ile aranır.',
    input_schema: {
      type: 'object',
      properties: {
        task_title: { type: 'string', description: 'Task başlığı (kısmi eşleşme)' },
        list_name: { type: 'string', description: 'Arama yapılacak liste (boş = tüm listeler)' },
      },
      required: ['task_title'],
    },
  },
  {
    name: 'update_google_task',
    description: 'Bir Google Task\'ın başlık, notlar veya son tarihini günceller.',
    input_schema: {
      type: 'object',
      properties: {
        task_title: { type: 'string', description: 'Mevcut task başlığı (kısmi eşleşme)' },
        new_title: { type: 'string', description: 'Yeni başlık' },
        notes:     { type: 'string', description: 'Yeni notlar' },
        due_date:  { type: 'string', description: 'Yeni son tarih (YYYY-MM-DD) veya "none" temizle' },
        list_name: { type: 'string', description: 'Arama yapılacak liste (boş = tüm listeler)' },
      },
      required: ['task_title'],
    },
  },
  {
    name: 'delete_google_task',
    description: 'Bir Google Task\'ı kalıcı olarak siler.',
    input_schema: {
      type: 'object',
      properties: {
        task_title: { type: 'string', description: 'Task başlığı (kısmi eşleşme)' },
        list_name: { type: 'string', description: 'Arama yapılacak liste (boş = tüm listeler)' },
      },
      required: ['task_title'],
    },
  },
  {
    name: 'create_google_tasklist',
    description: 'Google Tasks\'ta yeni bir liste oluşturur.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Liste adı' },
      },
      required: ['title'],
    },
  },

  // ── NOTLAR ───────────────────────────────────────────────────────────────────
  {
    name: 'search_notes',
    description: 'Kullanıcının notlarını arar.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Başlık veya içerikte aranacak terim' },
      },
      required: [],
    },
  },
  {
    name: 'create_note',
    description: 'Yeni not oluşturur.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Not başlığı' },
        content: { type: 'string', description: 'Not içeriği (markdown destekler)' },
        is_pinned: { type: 'boolean', description: 'Sabitle?' },
      },
      required: ['title', 'content'],
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL EXECUTOR — Her aracı çalıştırır
// ═══════════════════════════════════════════════════════════════════════════════
export async function executeTool(toolName, toolInput, context) {
  const { userId, userName, userUnit } = context;

  // Yardımcı: Kişi adından user_id bul
  const findUser = async (name) => {
    if (!name) return null;
    const { data } = await supabase.from('user_profiles').select('user_id, full_name');
    return data?.find(p => p.full_name?.toLowerCase().includes(name.toLowerCase())) || null;
  };

  const nullIfEmpty = (v) => (!v || v === '' ? null : v);

  // Yardımcı: Varlık adından entity bul (event, contact, organization)
  const findEntity = async (entityType, name) => {
    if (!name) return null;
    if (entityType === 'event') {
      const { data } = await supabase.from('events').select('id, title').ilike('title', `%${name}%`).limit(1);
      return data?.[0] ? { id: data[0].id, title: data[0].title, name: data[0].title } : null;
    } else if (entityType === 'contact') {
      const { data } = await supabase.from('network_contacts').select('id, full_name').ilike('full_name', `%${name}%`).limit(1);
      return data?.[0] ? { id: data[0].id, name: data[0].full_name } : null;
    } else if (entityType === 'organization') {
      const { data } = await supabase.from('network_organizations').select('id, name').ilike('name', `%${name}%`).limit(1);
      return data?.[0] ? { id: data[0].id, name: data[0].name } : null;
    }
    return null;
  };

  switch (toolName) {

    // ── GÜNDEMLER ──────────────────────────────────────────────────────────────
    case 'search_agendas': {
      let query = supabase.from('agendas').select('id, title, status, unit, description, date, is_personal, assigned_to_name, created_by_name').order('created_at', { ascending: false }).limit(toolInput.limit || 10);
      if (toolInput.query) query = query.ilike('title', `%${toolInput.query}%`);
      if (toolInput.status) query = query.eq('status', toolInput.status);
      if (toolInput.unit) query = query.eq('unit', toolInput.unit);
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { agendas: data, count: data?.length || 0 };
    }

    case 'create_agenda': {
      let typeId = null;
      if (toolInput.type_name) {
        const { data: types } = await supabase.from('agenda_types').select('id, name');
        const match = types?.find(t => t.name.toLowerCase().includes(toolInput.type_name.toLowerCase()));
        typeId = match?.id || null;
      }
      let assignedTo = null, assignedToName = null;
      if (toolInput.assigned_to_name) {
        const u = await findUser(toolInput.assigned_to_name);
        if (u) { assignedTo = u.user_id; assignedToName = u.full_name; }
      }
      const isPersonal = toolInput.is_personal || false;
      const { data, error } = await supabase.from('agendas').insert({
        title: toolInput.title, description: toolInput.description || null, type_id: typeId,
        status: toolInput.status || 'aktif', created_by: userId, created_by_name: userName,
        unit: isPersonal ? null : userUnit, is_personal: isPersonal,
        assigned_to: assignedTo, assigned_to_name: assignedToName, date: toolInput.date || null,
      }).select().single();
      if (error) return { error: error.message };
      return { success: true, agenda: { id: data.id, title: data.title, status: data.status } };
    }

    case 'update_agenda': {
      const { data: ags } = await supabase.from('agendas').select('id, title').ilike('title', `%${toolInput.agenda_title}%`).limit(1);
      if (!ags?.length) return { error: `"${toolInput.agenda_title}" gündem bulunamadı.` };
      const updates = {};
      if (toolInput.new_title) updates.title = toolInput.new_title;
      if (toolInput.status) updates.status = toolInput.status;
      if (toolInput.description) updates.description = toolInput.description;
      if (toolInput.assigned_to_name) {
        const u = await findUser(toolInput.assigned_to_name);
        if (u) { updates.assigned_to = u.user_id; updates.assigned_to_name = u.full_name; }
      }
      const { error } = await supabase.from('agendas').update(updates).eq('id', ags[0].id);
      if (error) return { error: error.message };
      return { success: true, message: `"${ags[0].title}" güncellendi.` };
    }

    // ── GÖREVLER ───────────────────────────────────────────────────────────────
    case 'create_task': {
      const { data: agendas } = await supabase.from('agendas').select('id, title').ilike('title', `%${toolInput.agenda_title}%`).limit(1);
      if (!agendas?.length) return { error: `"${toolInput.agenda_title}" gündem bulunamadı.` };
      let assignedTo = null, assignedToName = null;
      if (toolInput.assigned_to_name) {
        const u = await findUser(toolInput.assigned_to_name);
        if (u) { assignedTo = u.user_id; assignedToName = u.full_name; }
      }
      const { data, error } = await supabase.from('agenda_tasks').insert({
        agenda_id: agendas[0].id, title: toolInput.title, assigned_to: assignedTo,
        assigned_to_name: assignedToName, priority: toolInput.priority || 'orta',
        status: 'bekliyor', completion_status: 'pending', due_date: toolInput.due_date || null, created_by: userId,
      }).select().single();
      if (error) return { error: error.message };
      return { success: true, task: { id: data.id, title: data.title, agenda: agendas[0].title, assigned_to_name: assignedToName } };
    }

    case 'update_task_status': {
      let taskQuery = supabase.from('agenda_tasks').select('id, title, agenda_id').ilike('title', `%${toolInput.task_title}%`);
      if (toolInput.agenda_title) {
        const { data: ag } = await supabase.from('agendas').select('id').ilike('title', `%${toolInput.agenda_title}%`).limit(1);
        if (ag?.length) taskQuery = taskQuery.eq('agenda_id', ag[0].id);
      }
      const { data: tasks } = await taskQuery.limit(1);
      if (!tasks?.length) return { error: `"${toolInput.task_title}" görevi bulunamadı.` };
      const { error } = await supabase.from('agenda_tasks').update({ status: toolInput.status }).eq('id', tasks[0].id);
      if (error) return { error: error.message };
      return { success: true, task: { id: tasks[0].id, title: tasks[0].title, new_status: toolInput.status } };
    }

    case 'list_tasks': {
      let query = supabase.from('agenda_tasks').select('id, title, status, priority, assigned_to_name, due_date, completion_status, agenda_id');
      if (toolInput.agenda_title) {
        const { data: ag } = await supabase.from('agendas').select('id').ilike('title', `%${toolInput.agenda_title}%`).limit(1);
        if (ag?.length) query = query.eq('agenda_id', ag[0].id);
        else return { error: `"${toolInput.agenda_title}" gündem bulunamadı.` };
      }
      if (toolInput.assigned_to_name) query = query.ilike('assigned_to_name', `%${toolInput.assigned_to_name}%`);
      if (toolInput.status) query = query.eq('status', toolInput.status);
      const { data, error } = await query.order('created_at', { ascending: false }).limit(20);
      if (error) return { error: error.message };
      return { tasks: data, count: data?.length || 0 };
    }

    // ── İŞ KAYITLARI ──────────────────────────────────────────────────────────
    case 'get_daily_log': {
      let targetUserId = userId;
      if (toolInput.user_name) {
        const u = await findUser(toolInput.user_name);
        if (u) targetUserId = u.user_id;
      }
      const date = toolInput.date || new Date().toISOString().split('T')[0];
      const { data, error } = await supabase.from('daily_logs').select('*').eq('user_id', targetUserId).eq('log_date', date).maybeSingle();
      if (error) return { error: error.message };
      if (!data) return { message: `${date} tarihinde iş kaydı bulunamadı.` };
      return {
        log: {
          date: data.log_date, work_status: data.work_status, day_period: data.day_period,
          submitted: data.submitted, total_minutes: data.total_minutes, notes: data.notes,
          work_items: (data.work_items || []).map(i => ({ category: i.category, description: i.description, start_time: i.start_time, end_time: i.end_time, all_day: i.all_day })),
          overtime_items: (data.overtime_items || []).map(i => ({ category: i.category, description: i.description, start_time: i.start_time, end_time: i.end_time })),
        },
      };
    }

    case 'create_daily_log': {
      const date = toolInput.date || new Date().toISOString().split('T')[0];
      const workItems = (toolInput.work_items || []).map((item, i) => ({
        id: Date.now() + i, category: item.category || 'Diğer', description: item.description || '',
        start_time: item.start_time || '', end_time: item.end_time || '', all_day: item.all_day || false, agenda_item_id: null,
      }));
      const calcMins = (item) => {
        if (item.all_day) return 480;
        if (!item.start_time || !item.end_time) return 0;
        const [sh, sm] = item.start_time.split(':').map(Number);
        const [eh, em] = item.end_time.split(':').map(Number);
        return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
      };
      const totalMin = workItems.reduce((s, i) => s + calcMins(i), 0);
      const payload = {
        user_id: userId, log_date: date, work_status: toolInput.work_status || 'ofis',
        day_period: toolInput.day_period || 'tam_gun', work_items: workItems, overtime_items: [],
        total_minutes: totalMin, notes: toolInput.notes || '', submitted: toolInput.submit || false,
      };
      const { error } = await supabase.from('daily_logs').upsert(payload, { onConflict: 'user_id,log_date' });
      if (error) return { error: error.message };
      const h = Math.floor(totalMin / 60), m = totalMin % 60;
      return { success: true, date, items_count: workItems.length, total: `${h}s ${m}dk`, submitted: payload.submitted };
    }

    case 'get_work_logs_summary': {
      let query = supabase.from('daily_logs')
        .select('user_id, log_date, work_status, total_minutes, submitted, work_items')
        .gte('log_date', toolInput.start_date).lte('log_date', toolInput.end_date).eq('submitted', true);
      if (toolInput.user_name) {
        const u = await findUser(toolInput.user_name);
        if (u) query = query.eq('user_id', u.user_id);
      }
      const { data, error } = await query;
      if (error) return { error: error.message };
      // Kişi adlarını çek
      const userIds = [...new Set((data || []).map(l => l.user_id))];
      const { data: profiles } = await supabase.from('user_profiles').select('user_id, full_name, unit').in('user_id', userIds);
      const profileMap = {};
      (profiles || []).forEach(p => { profileMap[p.user_id] = p; });
      const perPerson = {};
      (data || []).forEach(l => {
        const p = profileMap[l.user_id];
        const name = p?.full_name || l.user_id.slice(0,8);
        if (!perPerson[name]) perPerson[name] = { unit: p?.unit, days: 0, totalMins: 0 };
        perPerson[name].days++;
        perPerson[name].totalMins += l.total_minutes || 0;
      });
      return {
        period: `${toolInput.start_date} — ${toolInput.end_date}`,
        total_logs: data?.length || 0,
        per_person: Object.entries(perPerson).map(([name, v]) => ({
          name, unit: v.unit, days: v.days,
          total_hours: `${Math.floor(v.totalMins / 60)}s ${v.totalMins % 60}dk`,
          avg_daily: `${Math.floor(v.totalMins / v.days / 60)}s ${Math.round(v.totalMins / v.days % 60)}dk`,
        })),
      };
    }

    // ── DONÖRLER ───────────────────────────────────────────────────────────────
    case 'search_donors': {
      let query = supabase.from('donors').select('*').order('name');
      if (toolInput.query) query = query.ilike('name', `%${toolInput.query}%`);
      const { data, error } = await query.limit(20);
      if (error) return { error: error.message };
      return { donors: data, count: data?.length || 0 };
    }

    case 'create_donor': {
      const { data, error } = await supabase.from('donors').insert({
        name: toolInput.name, account_manager: toolInput.account_manager || null,
        health: toolInput.health || '🟡 Developing', reporting_deadline: nullIfEmpty(toolInput.reporting_deadline),
        next_followup: nullIfEmpty(toolInput.next_followup), notes: toolInput.notes || null, created_by: userId,
      }).select().single();
      if (error) return { error: error.message };
      return { success: true, donor: { id: data.id, name: data.name } };
    }

    case 'update_donor': {
      const { data: donors } = await supabase.from('donors').select('id, name').ilike('name', `%${toolInput.donor_name}%`).limit(1);
      if (!donors?.length) return { error: `"${toolInput.donor_name}" donörü bulunamadı.` };
      const updates = {};
      if (toolInput.health) updates.health = toolInput.health;
      if (toolInput.notes) updates.notes = toolInput.notes;
      if (toolInput.next_followup) updates.next_followup = toolInput.next_followup;
      if (toolInput.reporting_deadline) updates.reporting_deadline = toolInput.reporting_deadline;
      const { error } = await supabase.from('donors').update(updates).eq('id', donors[0].id);
      if (error) return { error: error.message };
      return { success: true, message: `"${donors[0].name}" güncellendi.` };
    }

    // ── DEADLINES ──────────────────────────────────────────────────────────────
    case 'search_deadlines': {
      let query = supabase.from('deadlines').select('*').order('due_date', { ascending: true });
      if (toolInput.status) query = query.eq('status', toolInput.status);
      if (toolInput.unit) query = query.eq('unit', toolInput.unit);
      const { data, error } = await query.limit(20);
      if (error) return { error: error.message };
      return { deadlines: data, count: data?.length || 0 };
    }

    case 'create_deadline': {
      const { data, error } = await supabase.from('deadlines').insert({
        title: toolInput.title, due_date: toolInput.due_date, owner: toolInput.owner || userName,
        unit: toolInput.unit || userUnit, status: toolInput.status || '⚪ Not Started',
        priority: toolInput.priority || 'Medium', created_by: userId,
      }).select().single();
      if (error) return { error: error.message };
      return { success: true, deadline: { id: data.id, title: data.title, due_date: data.due_date } };
    }

    // ── TOPLANTI AKSİYONLARI ──────────────────────────────────────────────────
    case 'search_meeting_actions': {
      let query = supabase.from('meeting_actions').select('*').order('due_date', { ascending: true });
      if (toolInput.status) query = query.eq('status', toolInput.status);
      if (toolInput.owner) query = query.ilike('owner', `%${toolInput.owner}%`);
      const { data, error } = await query.limit(20);
      if (error) return { error: error.message };
      return { actions: data, count: data?.length || 0 };
    }

    case 'create_meeting_action': {
      const { data, error } = await supabase.from('meeting_actions').insert({
        action_item: toolInput.action_item, owner: toolInput.owner,
        due_date: toolInput.due_date || null, meeting_type: toolInput.meeting_type || 'Genel',
        status: toolInput.status || '⚪ Not Started', created_by: userId,
      }).select().single();
      if (error) return { error: error.message };
      return { success: true, action: { id: data.id, action_item: data.action_item, owner: data.owner } };
    }

    case 'update_meeting_action': {
      const { data: actions } = await supabase.from('meeting_actions').select('id, action_item').ilike('action_item', `%${toolInput.action_text}%`).limit(1);
      if (!actions?.length) return { error: `"${toolInput.action_text}" aksiyonu bulunamadı.` };
      const updates = {};
      if (toolInput.status) updates.status = toolInput.status;
      if (toolInput.notes) updates.notes = toolInput.notes;
      const { error } = await supabase.from('meeting_actions').update(updates).eq('id', actions[0].id);
      if (error) return { error: error.message };
      return { success: true, message: `Aksiyon güncellendi.` };
    }

    // ── BİLDİRİMLER ────────────────────────────────────────────────────────────
    case 'send_notification': {
      const u = await findUser(toolInput.recipient_name);
      if (!u) return { error: `"${toolInput.recipient_name}" kullanıcısı bulunamadı.` };
      const { error } = await supabase.rpc('create_notification', {
        p_user_id: u.user_id, p_type: toolInput.type || 'task_status',
        p_title: toolInput.title, p_body: toolInput.body || null,
        p_link_type: null, p_link_id: null, p_created_by: userId, p_created_by_name: userName,
      });
      if (error) return { error: error.message };
      return { success: true, message: `${u.full_name} kişisine bildirim gönderildi.` };
    }

    // ── NETWORK ────────────────────────────────────────────────────────────────
    case 'search_contacts': {
      const q = toolInput.query;
      const { data, error } = await supabase.from('network_contacts').select('id, full_name, position, email, phone, country, city, organization_id, process_stage, priority')
        .or(`full_name.ilike.%${q}%,position.ilike.%${q}%,country.ilike.%${q}%,email.ilike.%${q}%`).limit(toolInput.limit || 10);
      if (error) return { error: error.message };
      return { contacts: data, count: data?.length || 0 };
    }

    case 'search_organizations': {
      const { data, error } = await supabase.from('network_organizations').select('id, name, org_type, website, email, phone')
        .ilike('name', `%${toolInput.query}%`).limit(10);
      if (error) return { error: error.message };
      return { organizations: data, count: data?.length || 0 };
    }

    case 'create_contact': {
      let organizationId = null, orgCreated = false, orgName = toolInput.organization_name || null;
      if (orgName) {
        const { data: orgs } = await supabase.from('network_organizations').select('id, name').ilike('name', `%${orgName}%`).limit(1);
        if (orgs?.length) { organizationId = orgs[0].id; orgName = orgs[0].name; }
        else if (toolInput.auto_create_org !== false) {
          const { data: newOrg } = await supabase.from('network_organizations').insert({ name: orgName, org_type: 'other', tags: [], unit: userUnit, created_by: userId }).select().single();
          if (newOrg) { organizationId = newOrg.id; orgCreated = true; }
        }
      }
      const { data, error } = await supabase.from('network_contacts').insert({
        full_name: toolInput.full_name, position: toolInput.position || null, email: toolInput.email || null,
        phone: toolInput.phone || null, linkedin: toolInput.linkedin || null, notes: toolInput.notes || null,
        organization_id: organizationId, country: toolInput.country || null, city: toolInput.city || null,
        tags: toolInput.tags || [], priority: toolInput.priority || 'Orta',
        process_stage: toolInput.process_stage || 'İlk Temas', unit: userUnit, created_by: userId,
      }).select().single();
      if (error) return { error: error.message };
      return { success: true, contact: { id: data.id, full_name: data.full_name, organization: orgName }, organization_created: orgCreated };
    }

    case 'create_organization': {
      const { data, error } = await supabase.from('network_organizations').insert({
        name: toolInput.name, org_type: toolInput.org_type || 'other', website: toolInput.website || null,
        description: toolInput.description || null, tags: toolInput.tags || [], unit: userUnit, created_by: userId,
      }).select().single();
      if (error) return { error: error.message };
      return { success: true, organization: { id: data.id, name: data.name } };
    }

    // ── ETKİNLİKLER ────────────────────────────────────────────────────────────
    case 'create_main_event': {
      const { data, error } = await supabase.from('events').insert({
        title: toolInput.title, event_type: toolInput.event_type || 'diger',
        status: toolInput.status || 'planned', start_date: toolInput.start_date,
        end_date: nullIfEmpty(toolInput.end_date), start_time: nullIfEmpty(toolInput.start_time),
        end_time: nullIfEmpty(toolInput.end_time), location_name: nullIfEmpty(toolInput.location_name),
        location_type: nullIfEmpty(toolInput.location_type), city: nullIfEmpty(toolInput.city),
        country: nullIfEmpty(toolInput.country), description: nullIfEmpty(toolInput.description),
        objectives: nullIfEmpty(toolInput.objectives), website_url: nullIfEmpty(toolInput.website_url),
        registration_link: nullIfEmpty(toolInput.registration_link),
        unit: userUnit, owner_id: userId, created_by: userId,
      }).select().single();
      if (error) return { error: error.message };
      return { success: true, event: { id: data.id, title: data.title, start_date: data.start_date } };
    }

    case 'search_main_events': {
      let query = supabase.from('events').select('id, title, event_type, status, start_date, end_date, location_name, city, country')
        .order('start_date', { ascending: true }).limit(toolInput.limit || 10);
      if (toolInput.query) query = query.ilike('title', `%${toolInput.query}%`);
      if (toolInput.status) query = query.eq('status', toolInput.status);
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { events: data, count: data?.length || 0 };
    }

    // ── FON FIRSATLARI ─────────────────────────────────────────────────────────
    case 'search_funds': {
      let query = supabase.from('fund_opportunities').select('*').order('created_at', { ascending: false }).limit(20);
      if (toolInput.query) query = query.ilike('title', `%${toolInput.query}%`);
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { funds: data, count: data?.length || 0 };
    }

    case 'create_fund': {
      const { data, error } = await supabase.from('fund_opportunities').insert({
        title: toolInput.title, donor_name: toolInput.donor_name || null,
        amount: toolInput.amount || null, currency: toolInput.currency || 'USD',
        deadline: nullIfEmpty(toolInput.deadline), status: toolInput.status || 'identified',
        description: toolInput.description || null, url: toolInput.url || null, created_by: userId,
      }).select().single();
      if (error) return { error: error.message };
      return { success: true, fund: { id: data.id, title: data.title } };
    }

    // ── PERSONEL & GENEL ───────────────────────────────────────────────────────
    case 'list_profiles': {
      let query = supabase.from('user_profiles').select('user_id, full_name, role, unit, email');
      if (toolInput.unit) query = query.eq('unit', toolInput.unit);
      if (toolInput.role) query = query.eq('role', toolInput.role);
      const { data, error } = await query.order('full_name');
      if (error) return { error: error.message };
      return { profiles: data, count: data?.length || 0 };
    }

    case 'get_summary': {
      const [ag, tasks, contacts, orgs, events, funds] = await Promise.all([
        supabase.from('agendas').select('id, status', { count: 'exact', head: false }),
        supabase.from('agenda_tasks').select('id, status, completion_status', { count: 'exact', head: false }),
        supabase.from('network_contacts').select('id', { count: 'exact', head: true }),
        supabase.from('network_organizations').select('id', { count: 'exact', head: true }),
        supabase.from('events').select('id', { count: 'exact', head: true }),
        supabase.from('fund_opportunities').select('id', { count: 'exact', head: true }),
      ]);
      const agendas = ag.data || [];
      const allTasks = tasks.data || [];
      return {
        agendas: { total: agendas.length, aktif: agendas.filter(a => a.status === 'aktif').length, tamamlandi: agendas.filter(a => a.status === 'tamamlandi').length },
        tasks: { total: allTasks.length, bekliyor: allTasks.filter(t => t.status === 'bekliyor').length, onay_bekleyen: allTasks.filter(t => t.completion_status === 'pending_review').length, tamamlandi: allTasks.filter(t => t.completion_status === 'approved').length },
        network: { contacts: contacts.count || 0, organizations: orgs.count || 0, events: events.count || 0 },
        funds: funds.count || 0,
      };
    }

    // ── NOTLAR ─────────────────────────────────────────────────────────────────
    case 'search_notes': {
      let query = supabase.from('notes').select('id, title, content, is_pinned, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(20);
      if (toolInput.query) query = query.or(`title.ilike.%${toolInput.query}%,content.ilike.%${toolInput.query}%`);
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { notes: (data || []).map(n => ({ id: n.id, title: n.title, preview: n.content?.slice(0, 100), pinned: n.is_pinned, created_at: n.created_at })), count: data?.length || 0 };
    }

    case 'create_note': {
      const { data, error } = await supabase.from('notes').insert({
        title: toolInput.title, content: toolInput.content, user_id: userId, is_pinned: toolInput.is_pinned || false,
      }).select().single();
      if (error) return { error: error.message };
      return { success: true, note: { id: data.id, title: data.title } };
    }

    // ── GÖRSEL YÜKLEME ──────────────────────────────────────────────────────────
    case 'upload_image_to_entity': {
      // pendingImage context üzerinden gelir: { base64, mediaType }
      const img = context.pendingImage;
      if (!img || !img.base64) return { error: 'Görsel bulunamadı. Lütfen önce bir görsel yükleyin veya yapıştırın.' };

      // Hedef varlığı bul
      const entity = await findEntity(toolInput.entity_type, toolInput.entity_name);
      if (!entity) return { error: `"${toolInput.entity_name}" adlı ${toolInput.entity_type === 'event' ? 'etkinlik' : toolInput.entity_type === 'contact' ? 'kişi' : 'kurum'} bulunamadı.` };

      // Base64'ü Blob'a dönüştür
      const byteChars = atob(img.base64);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
      const ext = img.mediaType.includes('png') ? 'png' : img.mediaType.includes('webp') ? 'webp' : 'jpg';
      const blob = new Blob([byteArray], { type: img.mediaType });

      // Bucket ve alan seçimi
      let publicUrl;
      if (toolInput.entity_type === 'event') {
        const path = `${entity.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('event-covers').upload(path, blob, { upsert: true, contentType: img.mediaType });
        if (upErr) return { error: `Yükleme hatası: ${upErr.message}` };
        const { data: urlData } = supabase.storage.from('event-covers').getPublicUrl(path);
        publicUrl = urlData.publicUrl + '?t=' + Date.now();
        await supabase.from('events').update({ cover_image_url: publicUrl }).eq('id', entity.id);
      } else {
        const entType = toolInput.entity_type === 'contact' ? 'contact' : 'organization';
        const path = `${userId}/${entType}_${entity.id}.${ext}`;
        await supabase.storage.from('network-media').remove([path]);
        const { error: upErr } = await supabase.storage.from('network-media').upload(path, blob, { upsert: true, contentType: img.mediaType });
        if (upErr) return { error: `Yükleme hatası: ${upErr.message}` };
        const { data: urlData } = supabase.storage.from('network-media').getPublicUrl(path);
        publicUrl = urlData.publicUrl + '?t=' + Date.now();
        const table = toolInput.entity_type === 'contact' ? 'network_contacts' : 'network_organizations';
        const field = toolInput.entity_type === 'contact' ? 'avatar_url' : 'logo_url';
        await supabase.from(table).update({ [field]: publicUrl }).eq('id', entity.id);
      }

      return { success: true, message: `Görsel "${entity.name || entity.title}" için başarıyla yüklendi.`, url: publicUrl };
    }

    case 'add_image_from_url': {
      // URL'den görseli çek
      let blob, ext = 'jpg', contentType = 'image/jpeg';
      try {
        const resp = await fetch(toolInput.image_url);
        if (!resp.ok) return { error: `Görsel indirilemedi (HTTP ${resp.status}).` };
        contentType = resp.headers.get('content-type') || 'image/jpeg';
        ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
        blob = await resp.blob();
      } catch (e) {
        return { error: `URL'den görsel alınamadı: ${e.message}` };
      }

      // Hedef varlığı bul
      const entityUrl = await findEntity(toolInput.entity_type, toolInput.entity_name);
      if (!entityUrl) return { error: `"${toolInput.entity_name}" adlı ${toolInput.entity_type === 'event' ? 'etkinlik' : toolInput.entity_type === 'contact' ? 'kişi' : 'kurum'} bulunamadı.` };

      let publicUrl;
      if (toolInput.entity_type === 'event') {
        const path = `${entityUrl.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('event-covers').upload(path, blob, { upsert: true, contentType });
        if (upErr) return { error: `Yükleme hatası: ${upErr.message}` };
        const { data: urlData } = supabase.storage.from('event-covers').getPublicUrl(path);
        publicUrl = urlData.publicUrl + '?t=' + Date.now();
        await supabase.from('events').update({ cover_image_url: publicUrl }).eq('id', entityUrl.id);
      } else {
        const entType = toolInput.entity_type === 'contact' ? 'contact' : 'organization';
        const path = `${userId}/${entType}_${entityUrl.id}.${ext}`;
        await supabase.storage.from('network-media').remove([path]);
        const { error: upErr } = await supabase.storage.from('network-media').upload(path, blob, { upsert: true, contentType });
        if (upErr) return { error: `Yükleme hatası: ${upErr.message}` };
        const { data: urlData } = supabase.storage.from('network-media').getPublicUrl(path);
        publicUrl = urlData.publicUrl + '?t=' + Date.now();
        const table = toolInput.entity_type === 'contact' ? 'network_contacts' : 'network_organizations';
        const field = toolInput.entity_type === 'contact' ? 'avatar_url' : 'logo_url';
        await supabase.from(table).update({ [field]: publicUrl }).eq('id', entityUrl.id);
      }

      return { success: true, message: `Görsel "${entityUrl.name || entityUrl.title}" için başarıyla yüklendi.`, url: publicUrl };
    }

    // ── DİREKTÖR GÜNDEMLERİ ────────────────────────────────────────────────
    case 'list_director_agendas': {
      const DA_SECTIONS = { direktor_takip: 'Direktörün Takibi', asistan_takip: 'Asistan Takibi', genel_sekreter: 'Genel Sekreter', yonetim_kurulu: 'Yönetim Kurulu', mutevelli: 'Mütevelli' };
      let query = supabase
        .from('director_agendas')
        .select('id, title, notes, section, status, priority, due_date, created_by_name, created_at')
        .order('section')
        .order('created_at', { ascending: false });
      if (toolInput.section) query = query.eq('section', toolInput.section);
      if (toolInput.status) query = query.eq('status', toolInput.status);
      if (toolInput.priority) query = query.eq('priority', toolInput.priority);
      if (toolInput.only_open) query = query.neq('status', 'tamamlandi');
      query = query.limit(Math.min(Math.max(parseInt(toolInput.limit || 30, 10) || 30, 1), 100));
      const { data, error } = await query;
      if (error) return { error: error.message };
      const byCount = data.reduce((acc, r) => { acc[r.section] = (acc[r.section] || 0) + 1; return acc; }, {});
      return {
        count: data.length,
        by_section: Object.fromEntries(Object.entries(byCount).map(([k, v]) => [DA_SECTIONS[k] || k, v])),
        agendas: data.map((r) => ({
          id: r.id, title: r.title, notes: r.notes,
          section: DA_SECTIONS[r.section] || r.section, section_id: r.section,
          status: r.status, priority: r.priority,
          due_date: r.due_date || null,
          created_by: r.created_by_name || null,
        })),
      };
    }

    case 'create_director_agenda': {
      const VALID_SECTIONS = ['direktor_takip','asistan_takip','genel_sekreter','yonetim_kurulu','mutevelli'];
      if (!toolInput.section || !VALID_SECTIONS.includes(toolInput.section)) {
        return { error: `Geçersiz bölüm. Geçerli değerler: ${VALID_SECTIONS.join(', ')}` };
      }
      if (!toolInput.title?.trim()) return { error: 'Başlık zorunludur.' };
      const { data: profile } = await supabase.from('user_profiles').select('full_name').eq('user_id', userId).single();
      const { data, error } = await supabase.from('director_agendas').insert({
        section: toolInput.section,
        title: toolInput.title.trim(),
        notes: toolInput.notes || null,
        status: toolInput.status || 'aktif',
        priority: toolInput.priority || 'normal',
        due_date: nullIfEmpty(toolInput.due_date),
        created_by: userId,
        created_by_name: profile?.full_name || userName || null,
      }).select().single();
      if (error) return { error: error.message };
      return { success: true, agenda: { id: data.id, title: data.title, section: data.section, status: data.status, priority: data.priority } };
    }

    case 'update_director_agenda': {
      if (!toolInput.agenda_title?.trim()) return { error: 'Hedef gündemin başlığı zorunludur.' };
      const { data: matches } = await supabase
        .from('director_agendas').select('id, title, section')
        .ilike('title', `%${toolInput.agenda_title}%`).limit(1);
      if (!matches?.length) return { error: `"${toolInput.agenda_title}" başlıklı direktör gündemi bulunamadı.` };
      const updates = {};
      if (toolInput.new_title !== undefined) updates.title = toolInput.new_title;
      if (toolInput.notes !== undefined) updates.notes = toolInput.notes;
      if (toolInput.status !== undefined) updates.status = toolInput.status;
      if (toolInput.priority !== undefined) updates.priority = toolInput.priority;
      if (toolInput.due_date !== undefined) updates.due_date = nullIfEmpty(toolInput.due_date);
      if (toolInput.section !== undefined) updates.section = toolInput.section;
      if (Object.keys(updates).length === 0) return { error: 'Güncellenecek alan verilmedi.' };
      updates.updated_at = new Date().toISOString();
      const { error } = await supabase.from('director_agendas').update(updates).eq('id', matches[0].id);
      if (error) return { error: error.message };
      return { success: true, updated: matches[0].title, changes: updates };
    }

    case 'delete_director_agenda': {
      if (!toolInput.agenda_title?.trim()) return { error: 'Silinecek gündemin başlığı zorunludur.' };
      const { data: matches } = await supabase
        .from('director_agendas').select('id, title')
        .ilike('title', `%${toolInput.agenda_title}%`).limit(1);
      if (!matches?.length) return { error: `"${toolInput.agenda_title}" başlıklı direktör gündemi bulunamadı.` };
      const { error } = await supabase.from('director_agendas').delete().eq('id', matches[0].id);
      if (error) return { error: error.message };
      return { success: true, deleted: matches[0].title };
    }

    // ── GOOGLE TASKS ────────────────────────────────────────────────────────
    case 'list_google_tasklists': {
      try {
        const lists = await gtListTasklists();
        return { count: lists.length, lists: lists.map(l => ({ id: l.id, title: l.title, updated: l.updated })) };
      } catch (e) {
        if (e.status === 409) return { error: 'Google Tasks bağlı değil. Kullanıcının /#google_tasks sayfasından "Bağlan" butonuna basması gerekir.' };
        return { error: e.message };
      }
    }

    case 'list_google_tasks': {
      try {
        const lists = await gtListTasklists();
        if (!lists.length) return { error: 'Hiç Google Tasks listesi yok.' };
        const target = toolInput.list_name
          ? lists.find(l => l.title?.toLowerCase().includes(toolInput.list_name.toLowerCase()))
          : lists[0];
        if (!target) return { error: `"${toolInput.list_name}" adlı liste bulunamadı. Mevcut: ${lists.map(l => l.title).join(', ')}` };
        const items = await gtListTasks(target.id, {
          show_completed: toolInput.include_completed !== false,
          max_results: Math.min(toolInput.max_results || 50, 100),
        });
        return {
          list: target.title,
          count: items.length,
          tasks: items.map(t => ({
            id: t.id,
            title: t.title,
            notes: t.notes,
            status: t.status,
            due: t.due,
            completed: t.completed,
          })),
        };
      } catch (e) {
        if (e.status === 409) return { error: 'Google Tasks bağlı değil.' };
        return { error: e.message };
      }
    }

    case 'create_google_task': {
      if (!toolInput.title?.trim()) return { error: 'Task başlığı zorunludur.' };
      try {
        const lists = await gtListTasklists();
        if (!lists.length) return { error: 'Önce bir Google Tasks listesi oluşturmanız gerekir.' };
        const target = toolInput.list_name
          ? lists.find(l => l.title?.toLowerCase().includes(toolInput.list_name.toLowerCase()))
          : lists[0];
        if (!target) return { error: `"${toolInput.list_name}" adlı liste bulunamadı.` };
        const payload = { title: toolInput.title.trim() };
        if (toolInput.notes) payload.notes = toolInput.notes;
        if (toolInput.due_date) payload.due = new Date(toolInput.due_date + 'T00:00:00.000Z').toISOString();
        const created = await gtCreateTask(target.id, payload);
        return { success: true, task_id: created.id, title: created.title, list: target.title };
      } catch (e) {
        if (e.status === 409) return { error: 'Google Tasks bağlı değil.' };
        return { error: e.message };
      }
    }

    case 'complete_google_task': {
      if (!toolInput.task_title?.trim()) return { error: 'Task başlığı zorunludur.' };
      try {
        const lists = await gtListTasklists();
        const candidates = toolInput.list_name
          ? lists.filter(l => l.title?.toLowerCase().includes(toolInput.list_name.toLowerCase()))
          : lists;
        for (const list of candidates) {
          const items = await gtListTasks(list.id, { show_completed: false });
          const match = items.find(t => t.title?.toLowerCase().includes(toolInput.task_title.toLowerCase()));
          if (match) {
            await gtCompleteTask(list.id, match.id);
            return { success: true, completed: match.title, list: list.title };
          }
        }
        return { error: `"${toolInput.task_title}" başlıklı bir task bulunamadı.` };
      } catch (e) {
        if (e.status === 409) return { error: 'Google Tasks bağlı değil.' };
        return { error: e.message };
      }
    }

    case 'update_google_task': {
      if (!toolInput.task_title?.trim()) return { error: 'Task başlığı zorunludur.' };
      try {
        const lists = await gtListTasklists();
        const candidates = toolInput.list_name
          ? lists.filter(l => l.title?.toLowerCase().includes(toolInput.list_name.toLowerCase()))
          : lists;
        for (const list of candidates) {
          const items = await gtListTasks(list.id, { show_completed: true });
          const match = items.find(t => t.title?.toLowerCase().includes(toolInput.task_title.toLowerCase()));
          if (match) {
            const patch = {};
            if (toolInput.new_title) patch.title = toolInput.new_title;
            if (toolInput.notes !== undefined) patch.notes = toolInput.notes || null;
            if (toolInput.due_date) {
              if (toolInput.due_date === 'none') patch.due = null;
              else patch.due = new Date(toolInput.due_date + 'T00:00:00.000Z').toISOString();
            }
            if (Object.keys(patch).length === 0) return { error: 'Güncellenecek alan verilmedi.' };
            const updated = await gtUpdateTask(list.id, match.id, patch);
            return { success: true, updated: updated.title, list: list.title, changes: patch };
          }
        }
        return { error: `"${toolInput.task_title}" başlıklı bir task bulunamadı.` };
      } catch (e) {
        if (e.status === 409) return { error: 'Google Tasks bağlı değil.' };
        return { error: e.message };
      }
    }

    case 'delete_google_task': {
      if (!toolInput.task_title?.trim()) return { error: 'Task başlığı zorunludur.' };
      try {
        const lists = await gtListTasklists();
        const candidates = toolInput.list_name
          ? lists.filter(l => l.title?.toLowerCase().includes(toolInput.list_name.toLowerCase()))
          : lists;
        for (const list of candidates) {
          const items = await gtListTasks(list.id, { show_completed: true });
          const match = items.find(t => t.title?.toLowerCase().includes(toolInput.task_title.toLowerCase()));
          if (match) {
            await gtDeleteTask(list.id, match.id);
            return { success: true, deleted: match.title, list: list.title };
          }
        }
        return { error: `"${toolInput.task_title}" başlıklı bir task bulunamadı.` };
      } catch (e) {
        if (e.status === 409) return { error: 'Google Tasks bağlı değil.' };
        return { error: e.message };
      }
    }

    case 'create_google_tasklist': {
      if (!toolInput.title?.trim()) return { error: 'Liste adı zorunludur.' };
      try {
        const created = await gtCreateTasklist(toolInput.title.trim());
        return { success: true, list_id: created.id, title: created.title };
      } catch (e) {
        if (e.status === 409) return { error: 'Google Tasks bağlı değil.' };
        return { error: e.message };
      }
    }

    default:
      return { error: `Bilinmeyen araç: ${toolName}` };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ═══════════════════════════════════════════════════════════════════════════════
export const ASSISTANT_SYSTEM_PROMPT = `Sen "COS Asistan" adlı bir AI asistansın. Uluslararası bir insani yardım kuruluşunun yönetim platformunda çalışıyorsun.

## GÖREV
Sistemdeki TÜM modüllere erişimin var ve her türlü görevi yapabilirsin. Kullanıcının rolüne göre uygun şekilde davran.

## KULLANILABILIR ARAÇLAR VE YETENEKLERİN

### 📋 Gündem Yönetimi
- Gündem arama, oluşturma, güncelleme
- Görev ekleme, atama, durum güncelleme, listeleme
- Birim veya kişi bazında filtreleme

### 🗂 Direktör Gündemleri (Özel Modül)
- 5 bölüm: Direktörün Takibi, Asistan Takibi, Genel Sekreter, Yönetim Kurulu, Mütevelli
- list_director_agendas, create_director_agenda, update_director_agenda, delete_director_agenda
- "Yönetim kuruluna X gündemi ekle" → section=yonetim_kurulu
- "Mütevelliye sunulacaklara ekle" → section=mutevelli
- "Asistanın takibine al" → section=asistan_takip
- Durumu "bekliyor" veya "tamamlandı" yapma istenirse update_director_agenda kullan

### 🗓 İş Kayıtları
- Günlük iş kaydı oluşturma ve sorgulama
- Çalışma analizi ve özet raporlar
- Tarih aralığına göre iş kaydı istatistikleri

### 🤝 Donör CRM
- Donör arama, oluşturma, güncelleme
- İlişki sağlığı takibi
- Raporlama deadline yönetimi

### 📅 Etkinlikler
- Etkinlik oluşturma, arama, güncelleme
- Konferans, forum, toplantı, eğitim vb.

### 🕸️ Network Yönetimi
- Kişi ekleme/arama (LinkedIn profil desteği)
- Kurum ekleme/arama
- Otomatik kurum eşleştirme

### ⏰ Deadline & Toplantı Aksiyonları
- Deadline oluşturma ve takibi
- Toplantı aksiyonu oluşturma/güncelleme

### 🔔 Bildirimler
- Herhangi bir kullanıcıya bildirim gönderme

### 💰 Fon Fırsatları
- Fon fırsatı arama/oluşturma

### 📝 Notlar
- Not oluşturma ve arama

### ✅ Google Tasks (Kişisel OAuth)
- Her kullanıcının KENDİ Google hesabındaki Tasks listeleri ve taskları
- IRDP sunucusunda not saklanmaz — sadece Google'a proxy
- list_google_tasklists, list_google_tasks, create_google_task, complete_google_task, update_google_task, delete_google_task, create_google_tasklist
- "yarına X ekle", "bugün Y yap" → create_google_task (due_date: YYYY-MM-DD)
- "Z görevini tamamlandı yap" → complete_google_task
- Kullanıcı "Google Tasks bağlı değil" hatası alırsa /#google_tasks sayfasından Bağlan butonuna basmasını söyle
- Hangi liste varsayılan — list_name vermezsen ilk liste kullanılır

### 🖼️ Görsel Yönetimi
- Kullanıcının yüklediği görseli etkinlik, kişi veya kuruma ekleyebilirsin
- URL'den görsel indirip ilgili kayda ekleyebilirsin
- Etkinliklere kapak görseli, kişilere profil fotoğrafı, kurumlara logo eklenebilir
- Kullanıcı bir görsel gönderip "bunu X'e ekle" derse upload_image_to_entity tool'unu kullan
- Kullanıcı bir görsel URL'si paylaşırsa add_image_from_url tool'unu kullan

### 👥 Personel
- Kullanıcı listesi (birim/rol bazında)
- Genel sistem istatistikleri

## KURALLAR
- Türkçe konuş, kısa ve net cevaplar ver
- Bir işlem yaptıktan sonra kısa onay mesajı ver
- Tool çağrısından önce kullanıcıya ne yapacağını bildirme — direkt yap
- Eğer bilgi eksikse, önce soru sor
- Tarih formatı: YYYY-MM-DD
- Emoji kullanarak cevaplarını renklendir
- Markdown formatı kullan

## ÖNEMLİ DAVRANIŞLAR
- Kullanıcı "bu hafta ne yapmalıyım?" derse: görevlerini, deadline'ları ve açık aksiyonları listele
- "İş kaydımı oluştur" derse: bugünün tarihiyle iş kaydı oluştur
- LinkedIn ekran görüntüsü gelirse: bilgileri çıkar ve network'e ekle
- Etkinlik linki/görseli gelirse: etkinlik bilgilerini çıkar ve takvime ekle
- Görsel yüklenip "bunu şu etkinliğe/kişiye/kuruma ekle" denirse: upload_image_to_entity ile yükle
- Görsel URL'si paylaşılıp bir varlığa eklenmesi istenirse: add_image_from_url ile yükle
- "X kişisine bildir/haber ver" derse: bildirim gönder
- Sorgulamalarda önce tool kullan, sonuçları özetle`;
