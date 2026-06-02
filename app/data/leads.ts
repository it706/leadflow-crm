import postgres from "postgres";

export type LeadStatus = "Новая" | "В работе" | "Счет отправлен" | "Закрыта";
export type LeadSource = "NordCut" | "Valery's Coffee" | "Ручная заявка";

export type Lead = {
  id: number;
  client: string;
  project: LeadSource;
  phone: string;
  service: string;
  status: LeadStatus;
  budget: number;
  createdAt: string;
  priority: "Высокий" | "Средний" | "Низкий";
  comment: string;
};

export type IncomingLead = {
  client?: string;
  project?: LeadSource;
  phone?: string;
  service?: string;
  budget?: number;
  comment?: string;
};

type DbLead = {
  id: number;
  client: string;
  project: LeadSource;
  phone: string;
  service: string;
  status: LeadStatus;
  budget: number;
  created_at: Date;
  priority: "Высокий" | "Средний" | "Низкий";
  comment: string;
};

const demoLeads: Lead[] = [
  {
    id: 2401,
    client: "Тестовая заявка NordCut",
    project: "NordCut",
    phone: "+7 999 000-00-00",
    service: "Стрижка NordCut",
    status: "Новая",
    budget: 3999,
    createdAt: "Демо",
    priority: "Средний",
    comment: "Пример заявки с сайта барбершопа. Новые реальные заявки будут попадать сюда автоматически.",
  },
  {
    id: 2402,
    client: "Тестовый заказ Valery's Coffee",
    project: "Valery's Coffee",
    phone: "+7 999 111-22-33",
    service: "Заказ кофе и аксессуаров",
    status: "В работе",
    budget: 3860,
    createdAt: "Демо",
    priority: "Средний",
    comment: "Пример заказа из интернет-магазина кофе. Сумма попадает в выручку в работе.",
  },
];

const globalStore = globalThis as typeof globalThis & {
  leadflowLeads?: Lead[];
  leadflowSql?: postgres.Sql;
  leadflowDbReady?: boolean;
};

if (!globalStore.leadflowLeads) {
  globalStore.leadflowLeads = demoLeads;
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

function mapDbLead(lead: DbLead): Lead {
  return {
    id: lead.id,
    client: lead.client,
    project: lead.project,
    phone: lead.phone,
    service: lead.service,
    status: lead.status,
    budget: Number(lead.budget),
    createdAt: formatDate(lead.created_at),
    priority: lead.priority,
    comment: lead.comment,
  };
}

async function ensureTable() {
  const sql = getSql();

  if (!sql || globalStore.leadflowDbReady) return sql;

  await sql`
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      client TEXT NOT NULL,
      project TEXT NOT NULL,
      phone TEXT NOT NULL,
      service TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Новая',
      budget INTEGER NOT NULL DEFAULT 0,
      priority TEXT NOT NULL DEFAULT 'Средний',
      comment TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  globalStore.leadflowDbReady = true;
  return sql;
}

function normalizeIncomingLead(payload: IncomingLead) {
  const budget = Math.max(0, Math.round(payload.budget ?? 0));
  const priority: Lead["priority"] = budget >= 10000 ? "Высокий" : "Средний";

  return {
    client: payload.client?.trim() || "Новый клиент",
    project: payload.project ?? "Ручная заявка",
    phone: payload.phone?.trim() || "Не указан",
    service: payload.service?.trim() || "Заявка без услуги",
    budget,
    priority,
    comment: payload.comment?.trim() || "Заявка получена из подключенного проекта.",
  };
}

export async function getLeads() {
  const sql = await ensureTable();

  if (!sql) return globalStore.leadflowLeads ?? demoLeads;

  const leads = await sql<DbLead[]>`
    SELECT id, client, project, phone, service, status, budget, created_at, priority, comment
    FROM leads
    ORDER BY created_at DESC, id DESC
  `;

  return leads.map(mapDbLead);
}

export async function addLead(payload: IncomingLead) {
  const lead = normalizeIncomingLead(payload);
  const sql = await ensureTable();

  if (!sql) {
    const leads = globalStore.leadflowLeads ?? demoLeads;
    const memoryLead: Lead = {
      id: Math.max(2400, ...leads.map((item) => item.id)) + 1,
      ...lead,
      status: "Новая",
      createdAt: formatDate(new Date()),
    };

    globalStore.leadflowLeads = [memoryLead, ...leads];
    return memoryLead;
  }

  const [createdLead] = await sql<DbLead[]>`
    INSERT INTO leads (client, project, phone, service, budget, priority, comment)
    VALUES (${lead.client}, ${lead.project}, ${lead.phone}, ${lead.service}, ${lead.budget}, ${lead.priority}, ${lead.comment})
    RETURNING id, client, project, phone, service, status, budget, created_at, priority, comment
  `;

  return mapDbLead(createdLead);
}

export async function updateLeadStatus(id: number, status: LeadStatus) {
  const sql = await ensureTable();

  if (!sql) {
    const leads = globalStore.leadflowLeads ?? demoLeads;
    globalStore.leadflowLeads = leads.map((lead) => (lead.id === id ? { ...lead, status } : lead));
    return globalStore.leadflowLeads.find((lead) => lead.id === id);
  }

  const [updatedLead] = await sql<DbLead[]>`
    UPDATE leads
    SET status = ${status}
    WHERE id = ${id}
    RETURNING id, client, project, phone, service, status, budget, created_at, priority, comment
  `;

  return updatedLead ? mapDbLead(updatedLead) : undefined;
}
