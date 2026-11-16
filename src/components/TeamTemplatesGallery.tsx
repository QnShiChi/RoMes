import { useState } from "react";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { MausAvatar } from "./Avatar";
import { addTemplate } from "@/lib/template-add";
import { matchesTeamTemplate, TEAM_TEMPLATES, type TeamTemplate } from "@/lib/team-templates";
import { cn } from "@/lib/cn";
import { api, useStore } from "@/state/store";

export function TeamTemplatesGallery({
  search,
  onAdded,
}: {
  search: string;
  onAdded: () => void;
}) {
  const { state, dispatch } = useStore();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const activeBySection = new Map<string, typeof state.bots>();
  for (const bot of state.bots) {
    if (bot.hidden || !bot.section) continue;
    const key = bot.section.trim().toLowerCase();
    const list = activeBySection.get(key) ?? [];
    list.push(bot);
    activeBySection.set(key, list);
  }

  const visible = TEAM_TEMPLATES.filter((tpl) => matchesTeamTemplate(tpl, search));
  if (search.trim() && visible.length === 0) return null;

  const installTemplate = async (template: TeamTemplate) => {
    setBusyId(template.id);
    setError("");
    try {
      const added = await addTemplate(template.manifest, dispatch);
      const leadName = template.members.find((m) => m.chiefOfStaff)?.name.toLowerCase();
      const leadBot = added.bots.find((b) => b.name.trim().toLowerCase() === leadName) ?? added.bots[0];
      if (leadBot) {
        if (!leadBot.chiefOfStaff) {
          dispatch({ type: "updateBot", botId: leadBot.id, patch: { chiefOfStaff: true } });
          await api(`/api/bots/${encodeURIComponent(leadBot.id)}`, {
            method: "PATCH",
            body: JSON.stringify({ chiefOfStaff: true }),
          }).catch(() => {});
        }
        const orderedIds = [leadBot.id, ...added.bots.filter((b) => b.id !== leadBot.id).map((b) => b.id)];
        dispatch({ type: "botsOrdered", botIds: orderedIds });
        await api("/api/bots/order", {
          method: "PUT",
          body: JSON.stringify({ botIds: orderedIds }),
        }).catch(() => {});
        dispatch({ type: "select", id: leadBot.id });
      }
      onAdded();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyId(null);
    }
  };

  const removeTemplate = async (template: TeamTemplate) => {
    setBusyId(template.id);
    setError("");
    try {
      const botsInSection = activeBySection.get(template.sectionName.toLowerCase()) ?? [];
      for (const bot of botsInSection) {
        dispatch({ type: "deleteBot", botId: bot.id });
      }
      try {
        const res = (await api(`/api/sidebar-sections?section=${encodeURIComponent(template.sectionName)}`, {
          method: "DELETE",
        })) as { sections?: string[] };
        if (Array.isArray(res?.sections)) {
          dispatch({ type: "sections", sections: res.sections });
        }
      } catch {
        // Section may already be removed once its bots are deleted.
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="mb-8" aria-labelledby="team-templates-title">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="team-templates-title" className="text-[12px] font-medium text-ink-secondary">
          Team templates
        </h3>
        <p className="text-[12px] text-ink-tertiary">
          Prebuilt multi-agent teams with a dedicated Lead — add or remove in one click
        </p>
      </div>
      {error && (
        <p className="mb-3 rounded-xl bg-danger/10 px-3 py-2 text-[12px] text-danger">{error}</p>
      )}
      <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
        {visible.map((template) => {
          const isActive = activeBySection.has(template.sectionName.toLowerCase());
          const isBusy = busyId === template.id;
          return (
            <article
              key={template.id}
              data-team-template={template.id}
              className={cn(
                "flex flex-col rounded-2xl border bg-card p-4",
                template.isLive ? "border-emerald-500/35" : "border-hairline/40",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-[14px] font-semibold text-ink">{template.name}</h4>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-medium",
                        template.isLive
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : "bg-raised text-ink-secondary",
                      )}
                    >
                      {template.badge}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-[1.45] text-ink-secondary">
                    {template.description}
                  </p>
                </div>
                {isActive ? (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="inline-flex h-8 items-center gap-1 rounded-full bg-raised/80 px-2.5 text-[12px] font-medium text-ink-secondary">
                      <Check size={13} aria-hidden="true" />
                      Active
                    </span>
                    {!template.isLive && (
                      <button
                        type="button"
                        disabled={busyId !== null}
                        onClick={() => void removeTemplate(template)}
                        aria-label={`Remove ${template.name}`}
                        title={`Delete ${template.name}`}
                        className="flex h-8 items-center gap-1 rounded-full bg-danger/10 px-2.5 text-[12px] font-medium text-danger hover:bg-danger/20 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent"
                      >
                        {isBusy ? (
                          <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                        ) : (
                          <Trash2 size={13} aria-hidden="true" />
                        )}
                        Remove
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => void installTemplate(template)}
                    aria-label={`Add ${template.name}`}
                    className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-raised px-3 text-[12.5px] font-medium text-ink hover:bg-raised-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    {isBusy ? (
                      <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Plus size={14} aria-hidden="true" />
                    )}
                    Add Team
                  </button>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {template.members.map((member) => (
                  <span
                    key={member.key}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11.5px] text-ink",
                      member.chiefOfStaff
                        ? "border-accent/40 bg-accent/10"
                        : "border-hairline/40 bg-raised/50",
                    )}
                  >
                    <MausAvatar
                      color={member.color}
                      bodyId={member.mascotBody}
                      size={18}
                      animated={false}
                      label={member.name}
                    />
                    <strong className="font-semibold">{member.name}</strong>
                    <span className="text-ink-tertiary">{member.role}</span>
                  </span>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
