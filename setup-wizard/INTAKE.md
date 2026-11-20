# Business Onboarding Intake

Send the client the intake template (`intake_template.txt`). When their
answers come back, run the converter:

    python3 intake_to_wizard.py intake_filled.txt

It prints a block of `key=value` lines. The setup wizard no longer has an
import box, so the block goes to Claude instead:

1. In the wizard, enter the business website and name on the business screen.
2. Collect the keys and save the keys file.
3. Copy the installation brief and paste it into the Claude Code chat.
4. Paste the intake block into the same chat, right after the brief. Its first
   line tells Claude to use these answers over its own research.

Claude uses these answers in the brand, schedule and strategy steps, so the
client is not asked for them again.

## What the intake collects, and where each answer goes

| Intake answer | Key | Used in |
| --- | --- | --- |
| Business name | `business_name` | Whole install (app, brand, emails) |
| Public logo link | `logo_url` | Brand step + Visual Studio |
| Brand colors (4) | `color_background`, `color_accent`, `color_highlight`, `color_sparing_accent` | Brand step |
| Font names | `font_names` | Brand step |
| Display font | `display_font` | Visual Studio (exact Google Fonts `Name:weight`) |
| Body font | `body_font` | Visual Studio (exact Google Fonts `Name:weights`) |
| Posting time zone | `posting_timezone` | Brand step |
| Posting time | `posting_time` | Brand step |
| Posting cadence | `posting_cadence` | Brand step |
| Business description | `description` | Strategy, through the launch pack |
| Audience | `audience` | Strategy, through the launch pack |
| Tone | `tone` | Strategy, through the launch pack |
| Words to avoid | `words_to_avoid` | Strategy, through the launch pack |

The converter carries the four long Strategy fields as comment lines. Claude
reads them from the chat and puts them into the launch pack.

## Not intake

Account names, Supabase values, app URLs, email addresses and the worker repo
are made during installation, not collected from the client. The keys page and
Claude collect them. The intake never asks for passwords, keys or
tokens.
