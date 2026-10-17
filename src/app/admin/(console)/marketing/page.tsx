import { notFound } from "next/navigation";
import { adminCtx } from "@/lib/admin";
import { getEnv } from "@/lib/env";
import { getSiteConfig } from "@/domains/site-content";
import { PageHead, Panel } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function MarketingAdminPage() {
  const { actor, db } = await adminCtx();
  const siteConfig = await getSiteConfig(db);
  if (!actor.grants.some((grant) => grant.permissions.has("content.write"))) notFound();
  const workspaceUrl = getEnv().MARKETING_AI_URL;

  return (
    <div>
      <PageHead title="AI Marketing" sub="Create, review and publish brand marketing content through the reusable Marketing AI workspace." />
      <Panel title="Marketing workspace">
        {workspaceUrl ? (
          <>
            <p className="max-w-2xl text-sm leading-6 text-muted">
              Open the connected Marketing AI workspace to manage brand projects, analyze the public website, generate captions and creative, review drafts, and manage approved publishing. The workspace keeps its own account and social-platform connections.
            </p>
            <a href={workspaceUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-11 items-center rounded border border-line px-4 py-3 text-sm hover:bg-surface">
              Open Marketing AI <span aria-hidden="true" className="ml-2">↗</span>
            </a>
          </>
        ) : (
          <>
            <p className="max-w-2xl text-sm leading-6 text-muted">
              The Marketing AI service exists as a separate application, but this deployment does not have its workspace URL configured yet. Set <code>MARKETING_AI_URL</code> to the deployed HTTPS workspace URL in the deployment environment, then redeploy.
            </p>
            <p className="mt-4 text-sm text-muted">
              Once connected, configure projects for the active brands inside Marketing AI. Website analysis, social-account authorization and publishing approvals still happen in that workspace; this entry point does not bypass its approval workflow.
            </p>
          </>
        )}
      </Panel>
      <Panel title="Workflow">
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-6">
          <li>Analyze the public storefront in each brand&apos;s Marketing AI project.</li>
          <li>Generate platform-specific captions and creative from the saved brand context.</li>
          <li>Review and edit every draft before approval.</li>
          <li>Publish or schedule approved posts only after the relevant social account is connected.</li>
          <li>Campaign attribution is implemented in VÉRANE. Use Analytics to review recorded storefront activity and paid-order sales metrics; totals respect the viewer&apos;s brand permissions.</li>
        </ol>
      </Panel>
    </div>
  );
}
