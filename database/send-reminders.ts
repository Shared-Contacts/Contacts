// ============================================================
// send-reminders
//
// Paste this into the Supabase dashboard: Edge Functions > Deploy
// a new function > name it exactly  send-reminders
//
// Turn OFF "Verify JWT" for this function — the schedule calls it
// without a user login. It is protected by REMINDER_SECRET instead.
//
// Secrets it needs (Edge Functions > Secrets):
//   VAPID_PRIVATE_KEY   the private JWK from vapid-keys.txt, one line
//   VAPID_SUBJECT       mailto:YOUR-EMAIL-HERE
//   REMINDER_SECRET     the secret from vapid-keys.txt
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { buildPushHTTPRequest } from "npm:@pushforge/builder";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function whenText(it: any) {
  const iso = it.kind === "appointment" ? it.starts_at : it.due_at;
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/London",
  });
}

Deno.serve(async (req) => {
  // Only our own schedule may trigger this
  if (req.headers.get("x-reminder-secret") !== Deno.env.get("REMINDER_SECRET")) {
    return new Response("no", { status: 401 });
  }

  const privateJWK = JSON.parse(Deno.env.get("VAPID_PRIVATE_KEY")!);
  const adminContact = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";

  // Anything due in the last six hours that has not been sent yet.
  // The six-hour window stops a backlog firing after an outage.
  const now = new Date();
  const since = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();

  const { data: due, error } = await admin
    .from("items")
    .select("*")
    .is("done_at", null)
    .is("pushed_at", null)
    .lte("remind_at", now.toISOString())
    .gte("remind_at", since);

  if (error) {
    console.error("items", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  if (!due?.length) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  let sent = 0, failed = 0;

  for (const it of due) {
    // The owner, plus anyone it is shared with
    const { data: shares } = await admin
      .from("item_shares").select("user_id").eq("item_id", it.id);
    const people = [...new Set([it.created_by, ...(shares ?? []).map((s) => s.user_id)])];

    // Who is it about, if anyone
    let about = "";
    if (it.contact_id) {
      const { data: c } = await admin
        .from("contacts")
        .select("first_name,last_name,company,is_organisation")
        .eq("id", it.contact_id).maybeSingle();
      if (c) {
        about = c.is_organisation && c.company
          ? c.company
          : [c.first_name, c.last_name].filter(Boolean).join(" ");
      }
    }

    const payload = {
      title: it.title,
      body: [whenText(it), about].filter(Boolean).join(" · "),
      tag: "item" + it.id,
      itemId: it.id,
      url: "/Contacts/",
    };

    const { data: subs } = await admin
      .from("push_subscriptions").select("*").in("user_id", people);

    for (const sub of subs ?? []) {
      try {
        const { endpoint, headers, body } = await buildPushHTTPRequest({
          privateJWK,
          subscription: { endpoint: sub.endpoint, keys: sub.keys },
          message: {
            payload,
            adminContact,
            options: { ttl: 6 * 60 * 60, urgency: "high", topic: "item" + it.id },
          },
        });

        const res = await fetch(endpoint, { method: "POST", headers, body });

        if (res.status === 404 || res.status === 410) {
          // The browser has thrown this subscription away; stop trying it
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        } else if (res.ok) {
          sent++;
          await admin.from("push_subscriptions")
            .update({ last_ok_at: new Date().toISOString() }).eq("id", sub.id);
        } else {
          failed++;
          console.error("push failed", res.status, await res.text());
        }
      } catch (e) {
        failed++;
        console.error("push threw", e);
      }
    }

    // Mark it done either way, so a broken device cannot cause a loop
    await admin.from("items")
      .update({ pushed_at: new Date().toISOString() }).eq("id", it.id);
  }

  return new Response(JSON.stringify({ items: due.length, sent, failed }), {
    headers: { "Content-Type": "application/json" },
  });
});
