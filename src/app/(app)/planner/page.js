import { sql } from "@/lib/db"
import { KanbanBoard } from "@/components/kanban-board"
import { ContactsKanban } from "@/components/contacts-kanban"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { requireUser } from "@/lib/dal"
import { CONTACT_STATUSES } from "@/lib/contact-statuses"

export const dynamic = "force-dynamic"

/* Column order is the vocabulary's own order, from src/lib/contact-statuses.js.
   This list used to be maintained here by hand alongside four other copies —
   a status added to the CHECK but forgotten here would simply have no column,
   so its contacts would vanish from the board with nothing reporting it. */
const STATUS_COLUMNS = CONTACT_STATUSES

export default async function PlannerPage() {
  await requireUser()

  const [boards, columns, cards, contacts] = await Promise.all([
    sql`SELECT * FROM public.kanban_boards ORDER BY created_at`,
    sql`SELECT * FROM public.kanban_columns ORDER BY position`,
    sql`SELECT * FROM public.kanban_cards ORDER BY position`,
    sql`SELECT id, name, email, phone, company, source_url, status, needs, created_at
        FROM public.contact_us
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
