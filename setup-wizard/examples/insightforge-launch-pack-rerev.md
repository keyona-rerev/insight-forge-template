# Insight Forge launch pack: ReRev Labs

Status: TEST PACK for the fresh install test. Check it before you load it.

## Business
- Name: ReRev Labs
- Website: https://www.rerev.io/
- Location: Birmingham, AL
- Time zone: America/Chicago, post time 08:30

## Schedule (first 12 posts come from these slots)
- Monday 8:30 AM weekly: LinkedIn feed post, Build breakdown
- Wednesday 8:30 AM weekly: LinkedIn short take, Myth vs reality
- Friday 8:30 AM weekly: LinkedIn feed post, Problem-first story
- Tuesday 8:30 AM every other week: LinkedIn numbered list post, Own it vs rent it

## Sources
- 6 pages from rerev.io (your own words)
- 6 public articles on AI and startup operations

## Machine block (do not edit by hand)

```json
{
  "version": 1,
  "business": {
    "name": "ReRev Labs",
    "website": "https://www.rerev.io/",
    "location": "Birmingham, AL",
    "timezone": "America/Chicago",
    "post_time": "08:30",
    "description": "ReRev Labs (Birmingham, AL) helps early-stage startups automate before they hire. Founder Keyona Meeks builds AI-powered operations systems with Claude inside each client's own accounts: intake, reporting, outreach and follow-up that keep running after handover. Problem-first, tool-second. ReRev also offers fractional Chief of Staff support, custom customer discovery, 1:1 founder and career coaching, and hands-on AI and automation training for teams and accelerators.",
    "audience": "Early-stage founders and small teams (pre-seed to Series A) who run operations themselves and cannot yet hire for intake, reporting, outreach and follow-up.",
    "voice": "First-person founder voice (Keyona). Direct, plain-language and practical: short declarative sentences, concrete examples from real ops work, no jargon. Problem-first, tool-second. Confident but anti-hype: names what AI can and cannot do, and favors lean, cheap systems the client owns. Warm and encouraging toward founders in overlooked markets."
  },
  "audience": {
    "thesis": "Early-stage founders and small teams can get the ops work they can't yet hire for (intake, reporting, outreach, follow-up) done by AI systems that live in their own accounts, cheaply and now.",
    "fit_criteria": [
      "Early-stage startup founder or small team (pre-seed to Series A)",
      "Runs operations themselves or with a very lean team",
      "Already pays for Google Workspace and/or Claude",
      "Wants systems they own, not another subscription"
    ],
    "institution_type": "Early-stage startups and small businesses",
    "core_systems": "Google Workspace, Claude, Google Sheets, a CRM",
    "language_use": [
      "automate before you hire",
      "your own accounts",
      "problem-first, tool-second",
      "lean, flexible, cheap"
    ],
    "language_avoid": [
      "game-changer",
      "revolutionary",
      "unlock",
      "leverage",
      "delve",
      "supercharge",
      "10x"
    ],
    "channels": [
      "LinkedIn",
      "Substack newsletter"
    ],
    "discovery_topics": [
      "AI automation for early-stage startups",
      "founder operations without hiring",
      "Claude workflows for small business",
      "fractional chief of staff for startups",
      "customer discovery for early-stage founders",
      "AI training for accelerators and startup teams",
      "follow-up and outreach automation for founders",
      "lean systems the client owns"
    ]
  },
  "hard_rules": [
    "Never invent a client, a client result, a number or a quote. Use a figure only when an approved source card supports it, and name the source in the post.",
    "Never say AI replaces judgment. Say what the system does, and what the founder still decides.",
    "Do not use hype words: game-changer, revolutionary, unlock, leverage, delve, supercharge, 10x.",
    "Name a tool only when the post shows what the tool does in a real workflow step. No tool lists.",
    "Write as Keyona, first person. Do not write as a company (no 'we are thrilled').",
    "End with one plain next step or one question. No hashtags stacks. At most two hashtags."
  ],
  "lanes": [
    {
      "key": "founders",
      "name": "Early-stage founders",
      "is_wedge": true,
      "description": "Pre-seed to Series A founders who run ops themselves and want systems they own.",
      "vocabulary": [
        "automate before you hire",
        "your own accounts",
        "handover"
      ]
    },
    {
      "key": "teams_accelerators",
      "name": "Small teams and accelerators",
      "is_wedge": false,
      "description": "Lean teams and program leads who need practical AI and automation training their people can use the same week.",
      "vocabulary": [
        "hands-on training",
        "cohort",
        "playbook"
      ]
    }
  ],
  "readers": [
    {
      "key": "overloaded_founder",
      "role": "Overloaded founder",
      "who": "Pre-seed to Series A founder doing intake, reporting and follow-up by hand.",
      "side": "decision",
      "lane_scope": "founders",
      "questions": [
        "What part of my week can a system take over this month?",
        "What does it cost, and who owns it when it is done?",
        "What still needs me?"
      ]
    },
    {
      "key": "program_lead",
      "role": "Accelerator or program lead",
      "who": "Runs a cohort and wants founders to leave with working systems, not slides.",
      "side": "decision",
      "lane_scope": "teams_accelerators",
      "questions": [
        "What will founders build in the session?",
        "How do I know they can keep using it after?",
        "What tools and accounts do they need before day one?"
      ]
    }
  ],
  "formats": [
    {
      "key": "linkedin_feed_post",
      "name": "LinkedIn feed post",
      "platform": "linkedin",
      "definition": "A single text post for the LinkedIn feed. Open with the problem in one line. Give one concrete example. Close with a plain next step or a question.",
      "min_words": 120,
      "max_words": 250
    },
    {
      "key": "linkedin_short_take",
      "name": "LinkedIn short take",
      "platform": "linkedin",
      "definition": "A short post with one clear point. Two or three short paragraphs. No list. One sentence that a founder could repeat.",
      "min_words": 60,
      "max_words": 120
    },
    {
      "key": "linkedin_list_post",
      "name": "LinkedIn numbered list post",
      "platform": "linkedin",
      "definition": "A post with a one-line setup and three to five numbered steps or items. Each item is one sentence. End with one question.",
      "min_words": 110,
      "max_words": 220
    }
  ],
  "natures": [
    {
      "key": "build_breakdown",
      "name": "Build breakdown",
      "move": "Walk through how one real system works: the trigger, the steps, where the data lives, and what the founder still reviews.",
      "evidence_type": "First-party example from ReRev work",
      "fit": "high"
    },
    {
      "key": "problem_first_story",
      "name": "Problem-first story",
      "move": "Start with a specific ops problem a founder has this week. Show the cost of leaving it manual. Then show the smallest fix.",
      "evidence_type": "Founder experience and approved sources",
      "fit": "high"
    },
    {
      "key": "myth_vs_reality",
      "name": "Myth vs reality",
      "move": "Name one common belief about AI at work. Say what is true, what is not, and what a founder should do instead.",
      "evidence_type": "Approved source cards",
      "fit": "medium"
    },
    {
      "key": "own_vs_rent",
      "name": "Own it vs rent it",
      "move": "Compare a system that runs in your own accounts with another subscription. Use cost, control and handover as the points.",
      "evidence_type": "First-party view and approved sources",
      "fit": "medium"
    }
  ],
  "jobs": [
    {
      "key": "problem_awareness",
      "name": "Problem awareness",
      "description": "Help a founder see an ops problem they already have.",
      "funnel_stage": "tofu"
    },
    {
      "key": "build_proof",
      "name": "Build proof",
      "description": "Show how a system is built so a founder can judge if it fits.",
      "funnel_stage": "mofu"
    },
    {
      "key": "offer_bridge",
      "name": "Offer bridge",
      "description": "Connect one problem to one ReRev offer with a plain next step.",
      "funnel_stage": "bofu"
    }
  ],
  "schedule": [
    {
      "format": "linkedin_feed_post",
      "nature": "build_breakdown",
      "job": "build_proof",
      "lane": "founders",
      "reader": "overloaded_founder",
      "day_of_week": 1,
      "frequency": "weekly",
      "time": "08:30"
    },
    {
      "format": "linkedin_short_take",
      "nature": "myth_vs_reality",
      "job": "problem_awareness",
      "lane": "founders",
      "day_of_week": 3,
      "frequency": "weekly",
      "time": "08:30"
    },
    {
      "format": "linkedin_feed_post",
      "nature": "problem_first_story",
      "job": "problem_awareness",
      "lane": "founders",
      "reader": "overloaded_founder",
      "day_of_week": 5,
      "frequency": "weekly",
      "time": "08:30"
    },
    {
      "format": "linkedin_list_post",
      "nature": "own_vs_rent",
      "job": "offer_bridge",
      "day_of_week": 2,
      "frequency": "biweekly",
      "time": "08:30"
    }
  ],
  "seeds": [
    {
      "premise": "The Monday morning briefing: one email that pulls calendar, open tasks and unread threads into a short list, so a founder starts the week with a plan.",
      "category": "build",
      "nature": "build_breakdown"
    },
    {
      "premise": "The follow-up engine: after every meeting, a draft follow-up waits in your inbox. You read it, edit it and send it. Nothing sends itself.",
      "category": "build",
      "nature": "build_breakdown"
    },
    {
      "premise": "Intake that does not live in your head: a form, a sheet and a short routing rule so every new request lands in the same place.",
      "category": "build",
      "nature": "build_breakdown"
    },
    {
      "premise": "A weekly report that writes itself from the sheet you already keep. The founder checks the numbers and adds one line of judgment.",
      "category": "build",
      "nature": "build_breakdown"
    },
    {
      "premise": "The cost of a founder doing follow-up by hand: count the hours in one month and name what else that time could buy.",
      "category": "problem",
      "nature": "problem_first_story"
    },
    {
      "premise": "Why leads go quiet: most follow-up fails on day three, not day one. A simple reminder system fixes the gap.",
      "category": "problem",
      "nature": "problem_first_story"
    },
    {
      "premise": "The hire you cannot afford yet: list the five tasks you would hand to an ops hire, then see which a system can already do.",
      "category": "problem",
      "nature": "problem_first_story"
    },
    {
      "premise": "Myth: you need to learn to code to automate your ops. Reality: you need to describe the problem clearly and review the result.",
      "category": "myth",
      "nature": "myth_vs_reality"
    },
    {
      "premise": "Myth: AI will run your business for you. Reality: it drafts and sorts. You still decide who gets the email and what the price is.",
      "category": "myth",
      "nature": "myth_vs_reality"
    },
    {
      "premise": "Myth: automation means one more tool to pay for every month. Reality: a system in your own accounts can cost almost nothing to run.",
      "category": "myth",
      "nature": "myth_vs_reality"
    },
    {
      "premise": "A subscription you rent versus a system you own: what happens to each when you stop paying or the vendor changes the price.",
      "category": "own",
      "nature": "own_vs_rent"
    },
    {
      "premise": "What handover means: when the build ends, who holds the keys, where the instructions live, and how you change a step yourself.",
      "category": "own",
      "nature": "own_vs_rent"
    },
    {
      "premise": "Training a team in one session: what a cohort of founders can build in two hours when they bring their own real task.",
      "category": "training",
      "nature": "problem_first_story"
    },
    {
      "premise": "Customer discovery calls without the chaos: a short script, a shared sheet and a rule for what you write down after each call.",
      "category": "discovery",
      "nature": "problem_first_story"
    }
  ],
  "approve_sources": true,
  "sources": [
    {
      "url": "https://www.rerev.io/",
      "name": "ReRev Labs home",
      "first_party": true
    },
    {
      "url": "https://www.rerev.io/services",
      "name": "ReRev Labs services",
      "first_party": true
    },
    {
      "url": "https://www.rerev.io/about",
      "name": "ReRev Labs about",
      "first_party": true
    },
    {
      "url": "https://www.rerev.io/lab/insight-forge",
      "name": "Insight Forge (ReRev Labs)",
      "first_party": true
    },
    {
      "url": "https://www.rerev.io/blog/the-phoebe-daily-briefing",
      "name": "The Phoebe Daily Briefing (ReRev blog)",
      "first_party": true
    },
    {
      "url": "https://www.rerev.io/blog/the-follow-up-engine",
      "name": "The Follow-up Engine (ReRev blog)",
      "first_party": true
    },
    {
      "url": "https://claude.com/resources/guides/the-founders-playbook-building-an-ai-native-startup/what-it-means-to-be-a-founder-is-changing",
      "name": "Anthropic: The Founder's Playbook, what it means to be a founder is changing"
    },
    {
      "url": "https://mucker.com/blog/ai-automation-startup-operations/",
      "name": "Mucker: Practical uses of AI automation for startup operations"
    },
    {
      "url": "https://www.under30ceo.com/?p=127827",
      "name": "Under30CEO: What is workflow automation"
    },
    {
      "url": "https://www.entrepreneur.com/leadership/dont-manage-every-task-manually-heres-how-you-can-use/503141",
      "name": "Entrepreneur: Use AI to run startup tasks"
    },
    {
      "url": "https://www.lowcode.agency/blog/claude-for-small-business-explained",
      "name": "LowCode Agency: Claude for Small Business explained"
    },
    {
      "url": "https://blog.mean.ceo/?p=7084",
      "name": "MEAN CEO: 15 AI workflows for startups"
    }
  ]
}
```
