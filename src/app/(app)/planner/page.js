import { sql } from "@/lib/db"
import { KanbanBoard } from "@/components/kanban-board"
import { ContactsKanban } from "@/components/contacts-kanban"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { requireUser } from "@/lib/dal"

export const dynamic = "force-dynamic"

// Fixed column order for contact statuses
const STATUS_COLUMNS = [
  { key: "New",       label: "New",       color: "#3b82f6" },
  { key: "follow-up", label: "Follow-up", color: "#f97316" },
  { key: "win",       label: "Win",       color: "#22c55e" },
  { key: "closed",    label: "Closed",    color: "#64748b" },
  { key: "rejected",  label: "Rejected",  color: "#ef4444" },
  { key: "fake",      label: "Fake",      color: "#a855f7" },
  { key: "test",      label: "Test",      color: "#14b8a6" },
]

export default async function PlannerPage() {
  await requireUser()

  const [boards, columns, cards, contacts] = await Promise.all([
    sql`SELECT * FROM public.kanban_boards ORDER BY created_at`,
    sql`SELECT * FROM public.kanban_columns ORDER BY position`,
    sql`SELECT * FROM public.kanban_cards ORDER BY position`,
    sql`SELECT id, name, email, phone, company, source_url, status, needs, created_at
        FROM public.visible_contacts
        ORDER BY created_at DESC`,
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Planner</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your work and leads with kanban boards.
        </p>
      </div>

      <Tabs defaultValue="contacts">
        <TabsList>
          <TabsTrigger value="contacts">
            Contacts CRM
            <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {contacts.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="boards">Custom Boards</TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <TabsContent value="contacts">
            <ContactsKanban contacts={contacts} statusColumns={STATUS_COLUMNS} />
          </TabsContent>
          <TabsContent value="boards">
            <KanbanBoard boards={boards} columns={columns} cards={cards} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
