import type { MascotBodyId } from "../../shared/mascot-bodies";
import type { MausColor } from "../../shared/wire";

export interface TeamTemplateMember {
  key: string;
  name: string;
  role: string;
  color: MausColor;
  mascotBody: MascotBodyId;
  chiefOfStaff?: boolean;
  soul: string;
}

export interface TeamTemplate {
  id: string;
  name: string;
  sectionName: string;
  badge: string;
  isLive?: boolean;
  description: string;
  members: TeamTemplateMember[];
  manifest: {
    format: "openmaus.team";
    version: 2;
    team: {
      name: string;
      context: string;
      leader?: string;
      members: Array<{
        key: string;
        name: string;
        role: string;
        chiefOfStaff?: boolean;
        manages?: string[];
        soul: string;
        appearance: { color: MausColor; mascotBody: MascotBodyId };
      }>;
    };
  };
}

function buildTeamTemplate(config: Omit<TeamTemplate, "manifest"> & { context: string }): TeamTemplate {
  const leaderKey = config.members.find((m) => m.chiefOfStaff)?.key;
  return {
    id: config.id,
    name: config.name,
    sectionName: config.sectionName,
    badge: config.badge,
    isLive: config.isLive,
    description: config.description,
    members: config.members,
    manifest: {
      format: "openmaus.team",
      version: 2,
      team: {
        name: config.sectionName,
        context: config.context,
        ...(leaderKey ? { leader: leaderKey } : {}),
        members: config.members.map((member) => ({
          key: member.key,
          name: member.name,
          role: member.role,
          ...(member.chiefOfStaff ? { chiefOfStaff: true, manages: [config.sectionName] } : {}),
          soul: member.soul,
          appearance: { color: member.color, mascotBody: member.mascotBody },
        })),
      },
    },
  };
}

export const TEAM_TEMPLATES: TeamTemplate[] = [
  buildTeamTemplate({
    id: "marketing-team",
    name: "Marketing Team",
    sectionName: "Marketing",
    badge: "Live · Full Pipeline",
    isLive: true,
    description: "End-to-end briefs, scripts, AI visuals, CPU Remotion video & auto-publish.",
    context: "Marketing Swarm template coordinating RoMes, Poppy, Finch, and Momo with 4 approval gates.",
    members: [
      {
        key: "romes",
        name: "RoMes",
        role: "Lead",
        color: "orange",
        mascotBody: "shield",
        chiefOfStaff: true,
        soul: "You are RoMes, Team Lead for Marketing. You are the user's primary point of contact: interview users, build campaign briefs, enforce approval gates, and coordinate Poppy, Finch, and Momo.",
      },
      {
        key: "poppy",
        name: "Poppy",
        role: "Script",
        color: "teal",
        mascotBody: "circle",
        soul: "You are Poppy, Senior Copywriter. Turn approved campaign briefs into social posts or bilingual voiceover scripts split into ~3-second beats.",
      },
      {
        key: "finch",
        name: "Finch",
        role: "Visuals",
        color: "blue",
        mascotBody: "star",
        soul: "You are Finch, Visual Director. Convert beat descriptions into 5-layer commercial prompts and validate visual assets.",
      },
      {
        key: "momo",
        name: "Momo",
        role: "Video",
        color: "red",
        mascotBody: "diamond",
        soul: "You are Momo, Video Producer. Synthesize voiceovers, mix background music, and render 9:16/16:9 videos.",
      },
    ],
  }),
  buildTeamTemplate({
    id: "software-dev-team",
    name: "Software Dev Team",
    sectionName: "Software Dev",
    badge: "Template",
    description: "Prebuilt roles led by Atlas for technical specs, implementation & QA review.",
    context: "Software Dev team template. Users talk primarily to Atlas (Tech Lead), who coordinates Dev and QA.",
    members: [
      {
        key: "atlas",
        name: "Atlas",
        role: "Tech Lead",
        color: "blue",
        mascotBody: "hexagon",
        chiefOfStaff: true,
        soul: "You are Atlas, Tech Lead of the Software Dev team and the user's primary point of contact. Clarify requirements, draft architecture specs, coordinate Dev and QA via coordinate_bots, and summarize results clearly for user approval.",
      },
      {
        key: "dev",
        name: "Dev",
        role: "Engineer",
        color: "cyan",
        mascotBody: "cursor",
        soul: "You are Dev, Full-Stack Software Engineer working under Atlas. Propose clean, modular implementation plans, code diffs, and technical trade-offs.",
      },
      {
        key: "qa",
        name: "QA",
        role: "Reviewer",
        color: "green",
        mascotBody: "shield",
        soul: "You are QA, Quality Assurance Reviewer working under Atlas. Design edge-case test checklists, verification steps, and risk reviews before shipping.",
      },
    ],
  }),
  buildTeamTemplate({
    id: "operations-team",
    name: "Operations Team",
    sectionName: "Operations",
    badge: "Template",
    description: "Prebuilt roles led by Ops for daily SOPs, task coordination & operational reports.",
    context: "Operations team template. Users talk primarily to Ops (Ops Lead), who coordinates Analyst.",
    members: [
      {
        key: "ops",
        name: "Ops",
        role: "Ops Lead",
        color: "yellow",
        mascotBody: "squircle",
        chiefOfStaff: true,
        soul: "You are Ops, Operations Lead and the user's primary point of contact. Structure recurring workflows, coordinate Analyst via coordinate_bots, and present clear action plans for approval.",
      },
      {
        key: "analyst",
        name: "Analyst",
        role: "SOP & Data",
        color: "teal",
        mascotBody: "capsule",
        soul: "You are Analyst, Operations & SOP Specialist working under Ops. Summarize operational data, draft clean SOP checklists, and highlight bottlenecks.",
      },
    ],
  }),
  buildTeamTemplate({
    id: "sales-support-team",
    name: "Sales & Support Team",
    sectionName: "Sales & Support",
    badge: "Template",
    description: "Prebuilt roles led by Vera for lead qualification, outreach & customer care.",
    context: "Sales & Support team template. Users talk primarily to Vera (Sales Lead), who coordinates Support.",
    members: [
      {
        key: "vera",
        name: "Vera",
        role: "Sales Lead",
        color: "purple",
        mascotBody: "star",
        chiefOfStaff: true,
        soul: "You are Vera, Sales Lead and the user's primary point of contact. Qualify leads, draft tailored outreach proposals, coordinate Support via coordinate_bots, and ask for approval before sending.",
      },
      {
        key: "support",
        name: "Support",
        role: "Customer Care",
        color: "pink",
        mascotBody: "drop",
        soul: "You are Support, Customer Care Specialist working under Vera. Draft clear, empathetic customer responses, FAQs, and escalation summaries for human review.",
      },
    ],
  }),
];

export function matchesTeamTemplate(template: TeamTemplate, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  if (template.name.toLowerCase().includes(needle)) return true;
  if (template.description.toLowerCase().includes(needle)) return true;
  return template.members.some(
    (m) => m.name.toLowerCase().includes(needle) || m.role.toLowerCase().includes(needle),
  );
}
