import postgres from "postgres";

export type LeadStatus = "Новая" | "В работе" | "Закрыта";
export type PaymentStatus = "Не оплачено" | "Оплачено";
export type LeadSource = "NordCut" | "Valery's Coffee" | "Ручная заявка";

export type Lead = {
  id: number;
  archived: boolean;
  client: string;
  project: LeadSource;
  phone: string;
  service: string;
  status: LeadStatus;
  paymentStatus: PaymentStatus;
  budget: number;
  createdAt: string;
  createdAtDate: string;
  comment: string;
  nextAction: string;
  nextActionDate: string;
  nextActionTime: string;
};

export type LeadEvent = {
  id: number;
  leadId: number;
  title: string;
  description: string;
  createdAt: string;
};

export type IncomingLead = {
  client?: string;
  project?: LeadSource;
  phone?: string;
  service?: string;
  budget?: number;
  comment?: string;
};

export type LeadTaskPayload = {
  nextAction?: string;
  nextActionDate?: string;
  nextActionTime?: string;
};

export type LeadDetailsPayload = {
  budget?: number;
  client?: string;
  comment?: string;
  phone?: string;
  service?: string;
};

export type LeadNotePayload = {
  note?: string;
};

type DbLead = {
  id: number;
  archived: boolean;
  client: string;
  project: LeadSource;
  phone: string;
  service: string;
  status: LeadStatus;
  payment_status: PaymentStatus;
  budget: number;
  created_at: Date;
  comment: string;
  next_action: string | null;
  next_action_date: string | null;
  next_action_time: string | null;
};

type DbLeadEvent = {
  id: number;
  lead_id: number;
  title: string;
  description: string;
  created_at: Date;
};

const demoLeads: Lead[] = [
  {
    id: 2401,
    archived: false,
    client: "Тестовая заявка NordCut",
    project: "NordCut",
    phone: "+7 999 000-00-00",
    service: "Стрижка NordCut",
    status: "Новая",
    paymentStatus: "Не оплачено",
    budget: 3999,
    createdAt: "Демо",
    createdAtDate: "",
    comment: "Пример заявки с сайта барбершопа. Новые реальные заявки будут попадать сюда автоматически.",
    nextAction: "Позвонить клиенту и подтвердить время",
    nextActionDate: "",
    nextActionTime: "",
  },
  {
    id: 2402,
    archived: false,
    client: "Тестовый заказ Valery's Coffee",
    project: "Valery's Coffee",
    phone: "+7 999 111-22-33",
    service: "Заказ кофе и аксессуаров",
    status: "В работе",
    paymentStatus: "Не оплачено",
    budget: 3860,
    createdAt: "Демо",
    createdAtDate: "",
    comment: "Пример заказа из интернет-магазина кофе. Сумма попадает в выручку в работе.",
    nextAction: "Уточнить способ получения",
    nextActionDate: "",
    nextActionTime: "",
  },
];

const globalStore = globalThis as typeof globalThis & {
  leadflowLeads?: Lead[];
  leadflowEvents?: LeadEvent[];
  leadflowSql?: postgres.Sql;
  leadflowDbReady?: boolean;
};

if (!globalStore.leadflowLeads) {
  globalStore.leadflowLeads = demoLeads;
}

if (!globalStore.leadflowEvents) {
  globalStore.leadflowEvents = demoLeads.map((lead, index) => ({
    id: index + 1,
    leadId: lead.id,
    title: "Заявка создана",
    description: `Источник: ${lead.project}. Сумма: ${lead.budget} ₽.`,
    createdAt: lead.createdAt,
  }));
}

function getDatabaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL;
}

function getSql() {
  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) return null;

  if (!globalStore.leadflowSql) {
    globalStore.leadflowSql = postgres(databaseUrl, {
      max: 1,
      ssl: "require",
    });
  }

  return globalStore.leadflowSql;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Moscow",
  }).format(value);
}

function formatDateKey(value: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Moscow",
    year: "numeric",
  });
  const parts = formatter.formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";

  return `${year}-${month}-${day}`;
}

function mapDbLead(lead: DbLead): Lead {
  return {
    id: lead.id,
    archived: lead.archived,
    client: lead.client,
    project: lead.project,
    phone: lead.phone,
    service: lead.service,
    status: lead.status,
    paymentStatus: lead.payment_status,
    budget: Number(lead.budget),
    createdAt: formatDate(lead.created_at),
    createdAtDate: formatDateKey(lead.created_at),
    comment: lead.comment,
    nextAction: lead.next_action ?? "",
    nextActionDate: lead.next_action_date ?? "",
    nextActionTime: lead.next_action_time ?? "",
  };
}

function mapDbEvent(event: DbLeadEvent): LeadEvent {
  return {
    id: event.id,
    leadId: event.lead_id,
    title: event.title,
    description: event.description,
    createdAt: formatDate(event.created_at),
  };
}

async function ensureTable() {
  const sql = getSql();

  if (!sql || globalStore.leadflowDbReady) return sql;

  await sql`
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      archived BOOLEAN NOT NULL DEFAULT FALSE,
      client TEXT NOT NULL,
      project TEXT NOT NULL,
      phone TEXT NOT NULL,
      service TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Новая',
      payment_status TEXT NOT NULL DEFAULT 'Не оплачено',
      budget INTEGER NOT NULL DEFAULT 0,
      priority TEXT NOT NULL DEFAULT 'Средний',
      comment TEXT NOT NULL DEFAULT '',
      next_action TEXT NOT NULL DEFAULT '',
      next_action_date TEXT NOT NULL DEFAULT '',
      next_action_time TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS lead_events (
      id SERIAL PRIMARY KEY,
      lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'Не оплачено'
  `;

  await sql`
    ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE
  `;

  await sql`
    ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS next_action TEXT NOT NULL DEFAULT ''
  `;

  await sql`
    ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS next_action_date TEXT NOT NULL DEFAULT ''
  `;

  await sql`
    ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS next_action_time TEXT NOT NULL DEFAULT ''
  `;

  await sql`
    UPDATE leads
    SET status = 'В работе'
    WHERE status = 'Счет отправлен'
  `;

  globalStore.leadflowDbReady = true;
  return sql;
}

async function createEvent(leadId: number, title: string, description: string) {
  const sql = await ensureTable();

  if (!sql) {
    const events = globalStore.leadflowEvents ?? [];
    const event: LeadEvent = {
      id: Math.max(0, ...events.map((item) => item.id)) + 1,
      leadId,
      title,
      description,
      createdAt: formatDate(new Date()),
    };

    globalStore.leadflowEvents = [event, ...events];
    return event;
  }

  const [event] = await sql<DbLeadEvent[]>`
    INSERT INTO lead_events (lead_id, title, description)
    VALUES (${leadId}, ${title}, ${description})
    RETURNING id, lead_id, title, description, created_at
  `;

  return mapDbEvent(event);
}

function normalizeIncomingLead(payload: IncomingLead) {
  const budget = Math.max(0, Math.round(payload.budget ?? 0));

  return {
    client: payload.client?.trim() || "Новый клиент",
    project: payload.project ?? "Ручная заявка",
    phone: payload.phone?.trim() || "Не указан",
    service: payload.service?.trim() || "Заявка без услуги",
    budget,
    comment: payload.comment?.trim() || "Заявка получена из подключенного проекта.",
  };
}

export async function getLeads() {
  const sql = await ensureTable();

  if (!sql) return globalStore.leadflowLeads ?? demoLeads;

  const leads = await sql<DbLead[]>`
    SELECT id, archived, client, project, phone, service, status, payment_status, budget, created_at, comment, next_action, next_action_date, next_action_time
    FROM leads
    ORDER BY created_at DESC, id DESC
  `;

  return leads.map(mapDbLead);
}

export async function getLeadEvents() {
  const sql = await ensureTable();

  if (!sql) return globalStore.leadflowEvents ?? [];

  const events = await sql<DbLeadEvent[]>`
    SELECT id, lead_id, title, description, created_at
    FROM lead_events
    ORDER BY created_at DESC, id DESC
  `;

  return events.map(mapDbEvent);
}

export async function addLead(payload: IncomingLead) {
  const lead = normalizeIncomingLead(payload);
  const sql = await ensureTable();

  if (!sql) {
    const leads = globalStore.leadflowLeads ?? demoLeads;
    const memoryLead: Lead = {
      id: Math.max(2400, ...leads.map((item) => item.id)) + 1,
      archived: false,
      ...lead,
      status: "Новая",
      paymentStatus: "Не оплачено",
      createdAt: formatDate(new Date()),
      createdAtDate: formatDateKey(new Date()),
      nextAction: "",
      nextActionDate: "",
      nextActionTime: "",
    };

    globalStore.leadflowLeads = [memoryLead, ...leads];
    await createEvent(memoryLead.id, "Заявка создана", `Источник: ${memoryLead.project}. Сумма: ${memoryLead.budget} ₽.`);
    return memoryLead;
  }

  const [createdLead] = await sql<DbLead[]>`
    INSERT INTO leads (client, project, phone, service, budget, comment)
    VALUES (${lead.client}, ${lead.project}, ${lead.phone}, ${lead.service}, ${lead.budget}, ${lead.comment})
    RETURNING id, archived, client, project, phone, service, status, payment_status, budget, created_at, comment, next_action, next_action_date, next_action_time
  `;

  const mappedLead = mapDbLead(createdLead);
  await createEvent(mappedLead.id, "Заявка создана", `Источник: ${mappedLead.project}. Сумма: ${mappedLead.budget} ₽.`);

  return mappedLead;
}

export async function updateLeadStatus(id: number, status: LeadStatus) {
  const sql = await ensureTable();

  if (!sql) {
    const leads = globalStore.leadflowLeads ?? demoLeads;
    const previousLead = leads.find((lead) => lead.id === id);
    globalStore.leadflowLeads = leads.map((lead) => (lead.id === id ? { ...lead, status } : lead));
    const updatedLead = globalStore.leadflowLeads.find((lead) => lead.id === id);

    if (previousLead && previousLead.status !== status) {
      await createEvent(id, "Статус изменен", `${previousLead.status} → ${status}`);
    }

    return updatedLead;
  }

  const [previousLead] = await sql<DbLead[]>`
    SELECT id, archived, client, project, phone, service, status, payment_status, budget, created_at, comment, next_action, next_action_date, next_action_time
    FROM leads
    WHERE id = ${id}
  `;

  const [updatedLead] = await sql<DbLead[]>`
    UPDATE leads
    SET status = ${status}
    WHERE id = ${id}
    RETURNING id, archived, client, project, phone, service, status, payment_status, budget, created_at, comment, next_action, next_action_date, next_action_time
  `;

  if (previousLead && previousLead.status !== status) {
    await createEvent(id, "Статус изменен", `${previousLead.status} → ${status}`);
  }

  return updatedLead ? mapDbLead(updatedLead) : undefined;
}

export async function updateLeadPaymentStatus(id: number, paymentStatus: PaymentStatus) {
  const sql = await ensureTable();

  if (!sql) {
    const leads = globalStore.leadflowLeads ?? demoLeads;
    const previousLead = leads.find((lead) => lead.id === id);
    globalStore.leadflowLeads = leads.map((lead) => (lead.id === id ? { ...lead, paymentStatus } : lead));
    const updatedLead = globalStore.leadflowLeads.find((lead) => lead.id === id);

    if (previousLead && previousLead.paymentStatus !== paymentStatus) {
      await createEvent(id, "Оплата изменена", `${previousLead.paymentStatus} → ${paymentStatus}`);
    }

    return updatedLead;
  }

  const [previousLead] = await sql<DbLead[]>`
    SELECT id, archived, client, project, phone, service, status, payment_status, budget, created_at, comment, next_action, next_action_date, next_action_time
    FROM leads
    WHERE id = ${id}
  `;

  const [updatedLead] = await sql<DbLead[]>`
    UPDATE leads
    SET payment_status = ${paymentStatus}
    WHERE id = ${id}
    RETURNING id, archived, client, project, phone, service, status, payment_status, budget, created_at, comment, next_action, next_action_date, next_action_time
  `;

  if (previousLead && previousLead.payment_status !== paymentStatus) {
    await createEvent(id, "Оплата изменена", `${previousLead.payment_status} → ${paymentStatus}`);
  }

  return updatedLead ? mapDbLead(updatedLead) : undefined;
}

export async function updateLeadTask(id: number, task: LeadTaskPayload) {
  const nextAction = task.nextAction?.trim() ?? "";
  const nextActionDate = task.nextActionDate?.trim() ?? "";
  const nextActionTime = task.nextActionTime?.trim() ?? "";
  const sql = await ensureTable();

  if (!sql) {
    const leads = globalStore.leadflowLeads ?? demoLeads;
    globalStore.leadflowLeads = leads.map((lead) => (lead.id === id ? { ...lead, nextAction, nextActionDate, nextActionTime } : lead));
    const updatedLead = globalStore.leadflowLeads.find((lead) => lead.id === id);
    await createEvent(id, "Задача обновлена", nextAction ? `${nextAction}${nextActionDate ? ` · ${nextActionDate}` : ""}${nextActionTime ? ` · ${nextActionTime}` : ""}` : "Следующее действие очищено");

    return updatedLead;
  }

  const [updatedLead] = await sql<DbLead[]>`
    UPDATE leads
    SET next_action = ${nextAction}, next_action_date = ${nextActionDate}, next_action_time = ${nextActionTime}
    WHERE id = ${id}
    RETURNING id, archived, client, project, phone, service, status, payment_status, budget, created_at, comment, next_action, next_action_date, next_action_time
  `;

  if (updatedLead) {
    await createEvent(id, "Задача обновлена", nextAction ? `${nextAction}${nextActionDate ? ` · ${nextActionDate}` : ""}${nextActionTime ? ` · ${nextActionTime}` : ""}` : "Следующее действие очищено");
  }

  return updatedLead ? mapDbLead(updatedLead) : undefined;
}

export async function updateLeadDetails(id: number, details: LeadDetailsPayload) {
  const sql = await ensureTable();
  const budget = Math.max(0, Math.round(details.budget ?? 0));
  const client = details.client?.trim() || "Новый клиент";
  const phone = details.phone?.trim() || "Не указан";
  const service = details.service?.trim() || "Заявка без услуги";
  const comment = details.comment?.trim() || "Детали заявки не указаны.";

  if (!sql) {
    const leads = globalStore.leadflowLeads ?? demoLeads;
    globalStore.leadflowLeads = leads.map((lead) => (lead.id === id ? { ...lead, budget, client, comment, phone, service } : lead));
    const updatedLead = globalStore.leadflowLeads.find((lead) => lead.id === id);

    if (updatedLead) {
      await createEvent(id, "Заявка отредактирована", `Обновлены клиент, телефон, услуга, сумма или комментарий. Сумма: ${budget} ₽.`);
    }

    return updatedLead;
  }

  const [updatedLead] = await sql<DbLead[]>`
    UPDATE leads
    SET client = ${client}, phone = ${phone}, service = ${service}, budget = ${budget}, comment = ${comment}
    WHERE id = ${id}
    RETURNING id, archived, client, project, phone, service, status, payment_status, budget, created_at, comment, next_action, next_action_date, next_action_time
  `;

  if (updatedLead) {
    await createEvent(id, "Заявка отредактирована", `Обновлены клиент, телефон, услуга, сумма или комментарий. Сумма: ${budget} ₽.`);
  }

  return updatedLead ? mapDbLead(updatedLead) : undefined;
}

export async function addLeadNote(id: number, payload: LeadNotePayload) {
  const note = payload.note?.trim();
  const leads = await getLeads();
  const lead = leads.find((item) => item.id === id);

  if (!lead || !note) return undefined;

  await createEvent(id, "Заметка менеджера", note);

  return lead;
}

export async function archiveLead(id: number) {
  const sql = await ensureTable();

  if (!sql) {
    const leads = globalStore.leadflowLeads ?? demoLeads;
    const lead = leads.find((item) => item.id === id);

    if (!lead) return undefined;

    globalStore.leadflowLeads = leads.map((item) => (item.id === id ? { ...item, archived: true } : item));
    await createEvent(id, "Заявка отправлена в архив", "Заявка скрыта из активной воронки, но сохранена в базе CRM.");

    return { ...lead, archived: true };
  }

  const [archivedLead] = await sql<DbLead[]>`
    UPDATE leads
    SET archived = TRUE
    WHERE id = ${id}
    RETURNING id, archived, client, project, phone, service, status, payment_status, budget, created_at, comment, next_action, next_action_date, next_action_time
  `;

  if (archivedLead) {
    await createEvent(id, "Заявка отправлена в архив", "Заявка скрыта из активной воронки, но сохранена в базе CRM.");
  }

  return archivedLead ? mapDbLead(archivedLead) : undefined;
}
