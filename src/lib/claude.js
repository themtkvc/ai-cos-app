// ═══════════════════════════════════════════════════
// CLAUDE AI SERVICE
// Handles all communication with the Anthropic API
// ═══════════════════════════════════════════════════

// API key artık tarayıcıda değil — /api/claude proxy üzerinden gidiyor
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

// ── SYSTEM PROMPT ──
// This is what makes Claude act as the AI Chief of Staff
const buildSystemPrompt = (context) => `You are the AI Chief of Staff for a Director of an international humanitarian organization. You are deeply familiar with this organization and act as a trusted, senior advisor.

## YOUR ROLE
You are not a generic assistant. You are THIS Director's Chief of Staff. You know everything about their department and act proactively to help them lead effectively.

## ORGANIZATION CONTEXT
- Director leads a department of 50 staff across 6 units
- Units and Coordinators:
  1. Partnerships — Hatice
  2. Humanitarian Affairs — Gülsüm  
  3. Traditional Donors — Murat
  4. Grants — Yasir
  5. Accreditations — Yavuz
  6. Policy & Governance — Sezgin
- Key Donors: WFP, OCHA, Habitat for Humanity, Good Neighbors
- Primary email: Outlook
- Weekly meetings: Coordinators Meeting (all units), Board Meeting (Tuesdays — Director is board member), 1:1s with Deputy and Coordinators on demand

## LIVE DATA CONTEXT
${context ? `Current data from the Director's systems:
${context}` : 'No live data loaded — answer based on organizational context above.'}

## YOUR CAPABILITIES
1. **Briefing & Synthesis** — Summarize unit reports, donor status, deadlines into clear executive briefs
2. **Drafting** — Write emails, meeting agendas, donor reports, board notes, policy briefs, grant narratives
3. **Decision Support** — Flag what needs the Director's attention, recommend priorities
4. **Meeting Preparation** — Generate agendas, pre-meeting briefs, post-meeting action logs
5. **Donor Relations** — Draft donor communications, prepare for calls, summarize relationship status
6. **Strategic Thinking** — Help think through complex decisions, stakeholder management, organizational challenges

## YOUR COMMUNICATION STYLE
- Direct, concise, no filler
- Senior professional tone — you speak as a peer to the Director, not subordinate
- Always flag urgency clearly
- Proactively suggest what the Director should do next
- When drafting documents, produce ready-to-use text (not outlines)
- Use the Director's actual coordinator names and donor names naturally

## WHAT YOU NEVER DO
- Give generic advice that ignores organizational context
- Be vague about priorities — always say what needs to happen TODAY vs later
- Produce long preambles — get to the point immediately
- Forget that this is a humanitarian organization — tone and values matter

## FORMAT RULES
- Use markdown formatting for structure
- Bold key names and deadlines
- Use tables for comparative information
- Keep responses tight — quality over quantity
- For drafts, produce the actual text between clear markers like "---DRAFT START---" and "---DRAFT END---"`;

// ── MAIN CHAT FUNCTION ──
export const sendMessage = async (messages, contextData = null) => {
  const systemPrompt = buildSystemPrompt(contextData);

  try {
    const response = await fetch('/api/claude', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      // If the proxy isn't configured (no API key), fall back to demo mode
      if (response.status === 500 && err.error?.includes('not configured')) {
        return getDemoResponse(messages[messages.length - 1]?.content || '');
      }
      throw new Error(err.error || 'API hatası');
    }

    const data = await response.json();
    return data.content[0]?.text || 'Yanıt alınamadı.';
  } catch (error) {
    // Network error — likely local dev without proxy, use demo mode
    if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
      return getDemoResponse(messages[messages.length - 1]?.content || '');
    }
    console.error('Claude API hatası:', error);
    throw error;
  }
};

// ── CONTEXT BUILDER ──
// Formats live data from Supabase into a readable context string for Claude
export const buildContext = (deadlines, donors, meetingActions, unitReports) => {
  const parts = [];

  if (deadlines?.length > 0) {
    const overdue = deadlines.filter(d => {
      const days = Math.ceil((new Date(d.due_date) - new Date()) / (1000*60*60*24));
      return days < 0 && d.status !== '✅ Completed';
    });
    const urgent = deadlines.filter(d => {
      const days = Math.ceil((new Date(d.due_date) - new Date()) / (1000*60*60*24));
      return days >= 0 && days <= 7 && d.status !== '✅ Completed';
    });

    parts.push(`### DEADLINES
Total active: ${deadlines.filter(d => d.status !== '✅ Completed').length}
Overdue: ${overdue.length}
Due this week: ${urgent.length}

${overdue.length > 0 ? `OVERDUE:\n${overdue.map(d => `- ${d.title} (${d.owner}) — ${d.due_date}`).join('\n')}` : ''}
${urgent.length > 0 ? `\nDUE THIS WEEK:\n${urgent.map(d => `- ${d.title} (${d.owner}) — ${d.due_date}`).join('\n')}` : ''}`);
  }

  if (donors?.length > 0) {
    parts.push(`### DONORS
${donors.map(d => `- ${d.name}: Health=${d.health}, Manager=${d.account_manager}, Next follow-up=${d.next_followup || 'not set'}, Reporting deadline=${d.reporting_deadline || 'not set'}`).join('\n')}`);
  }

  if (meetingActions?.length > 0) {
    const open = meetingActions.filter(a => a.status !== '✅ Completed');
    parts.push(`### OPEN MEETING ACTIONS (${open.length} total)
${open.slice(0, 10).map(a => `- ${a.action_item} → ${a.owner} by ${a.due_date} [${a.status}]`).join('\n')}`);
  }

  if (unitReports?.length > 0) {
    const latest = {};
    unitReports.forEach(r => {
      if (!latest[r.unit] || r.submitted_at > latest[r.unit].submitted_at) latest[r.unit] = r;
    });
    parts.push(`### LATEST UNIT REPORTS
${Object.values(latest).map(r => `- ${r.unit} (${r.coordinator}): Status=${r.overall_status}, Achievement=${r.key_achievement?.slice(0,80)}..., Challenge=${r.main_challenge?.slice(0,60)}...`).join('\n')}`);
  }

  return parts.join('\n\n') || null;
};

// ── DEMO RESPONSES ──
const getDemoResponse = (message) => {
  const lower = message.toLowerCase();

  if (lower.includes('gündem') || lower.includes('agenda') || lower.includes('toplantı')) {
    return `## 📋 Koordinatörler Toplantısı Gündem Taslağı

**Tarih:** ${new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}
**Süre:** 60 dakika

---

**1. Geçen Haftadan Kalan Aksiyonlar** (10 dk)
- Hatice: Partnership pipeline güncellemesi — durum?
- Yasir: Good Neighbors grant narrative — Director onayı bekliyor
- Yavuz: OCHA akreditasyon checklist — iki haftadır açık

**2. Birim Round Table** (30 dk — her birim 5 dk)
- 🤝 Partnerships (Hatice)
- 🌍 Humanitarian Affairs (Gülsüm)
- 💰 Traditional Donors (Murat)
- 📝 Grants (Yasir)
- ✅ Accreditations (Yavuz)
- ⚖️ Policy & Governance (Sezgin)

**3. Acil Flaglar** (10 dk)
- 🔴 WFP Q1 raporu — 5 gün kaldı, Murat sunum yapacak
- 🔴 WFP saha ziyareti tarihleri — Direktör kararı gerekli
- 🟠 Good Neighbors grant — Direktör imzası bekliyor

**4. Kapanış & Aksiyonlar** (10 dk)

---
*Bu gündem Master Tracker verilerinden otomatik oluşturulmuştur.*`;
  }

  if (lower.includes('wfp') || lower.includes('donor') || lower.includes('donör')) {
    return `## 🌾 WFP Durum Özeti

**İlişki Sağlığı:** 🟢 Güçlü
**Hesap Yöneticisi:** Murat

### Acil Aksiyonlar
1. 🔴 **Q1 2026 Raporu** — **5 gün içinde** teslim edilmeli
   - Murat: Narratif taslağı %90 hazır
   - Direktör: Göndermeden önce onaylamalı
   
2. 🔴 **Saha Ziyareti Tarihleri** — WFP yanıt bekliyor
   - Direktör müsait tarihlerini Murat'a bildirmeli
   - Bu hafta içinde yapılması gerekiyor

### Son Etkileşim
15 gün önce üç aylık değerlendirme toplantısı — WFP program sunumundan memnun, saha ziyareti talep etti.

### Öneri
**Bugün:** WFP raporunu Murat'tan alın, gözden geçirin ve saha ziyareti tarihlerini onaylayın. Her ikisi de Murat'ı engelliyor.`;
  }

  if (lower.includes('brief') || lower.includes('özet') || lower.includes('hafta')) {
    return `## 📋 Haftalık Direktör Brifing

**${new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}**

---

### 🔴 Bu Hafta Direktörden Karar Gereken 3 Madde

1. **Good Neighbors Grant Narrative** → Yasir onayı bekliyor, gönderim engellenmiş
2. **WFP Saha Ziyareti Tarihleri** → Murat cevap veremez, Direktör tarih belirlememeli
3. **HfH MOU** → Hukuki incelemeye göndermek için Direktör onayı

---

### 📊 Birim Durumu

| Birim | Koordinatör | Durum |
|-------|-------------|-------|
| Partnerships | Hatice | 🟢 On Track |
| Humanitarian Affairs | Gülsüm | 🟢 On Track |
| Traditional Donors | Murat | 🟡 Bekliyor |
| Grants | Yasir | 🔴 Direktör Onayı |
| Accreditations | Yavuz | 🟢 On Track |
| Policy & Governance | Sezgin | 🟡 Board Prep |

---

### 🤝 Donör Pulse
- **WFP:** Rapor 5 günde teslim — kritik
- **OCHA:** Brief 12 günde — devam ediyor
- **HfH:** MOU süreci başlatılmadı — acele
- **GN:** Grant onay bekliyor — Direktör aksiyon`;
  }

  return `Merhaba! Ben AI Chief of Staff'ınızım. 

Şu an **demo modunda** çalışıyorum — gerçek verilerinize erişmek için Supabase ve Claude API key'inizi ayarlamamız gerekiyor.

Size şu konularda yardımcı olabilirim:

- 📋 **Toplantı gündemleri** hazırlamak
- 📧 **Email taslakları** yazmak (donörlere, partnerlerine, board'a)
- 📊 **Haftalık brifing** oluşturmak
- 🤝 **Donör durumu** özetlemek (WFP, OCHA, HfH, GN)
- ⚡ **Bu hafta ne yapmalıyım?** sorusunu yanıtlamak

Ne yapmamı istersiniz?`;
};
