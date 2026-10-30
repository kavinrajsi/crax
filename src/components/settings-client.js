"use client"

import { PageShell, PageHeader } from "@/components/page"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PipelineSettings } from "@/components/pipeline-settings"
import { PipelineTagsSettings } from "@/components/pipeline-tags-settings"

export function SettingsClient({ pipelines, stages, contactCounts, sourceColors }) {
  return (
    <PageShell>
      <PageHeader title="Settings" description="Pipelines, stages and tag colours." />

      <Tabs defaultValue="pipelines">
        {/* Phone: two equal tabs across the full width. */}
        <TabsList className="grid w-full grid-cols-2 md:inline-flex md:w-auto">
          <TabsTrigger value="pipelines">Pipelines</TabsTrigger>
          <TabsTrigger value="tags">Pipeline tags</TabsTrigger>
        </TabsList>
        <div className="mt-4">
          <TabsContent value="pipelines">
            <PipelineSettings pipelines={pipelines} stages={stages} contactCounts={contactCounts} />
          </TabsContent>
          <TabsContent value="tags">
            <PipelineTagsSettings initialColors={sourceColors} />
          </TabsContent>
        </div>
      </Tabs>
    </PageShell>
  )
}
