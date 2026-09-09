import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// RLS (users_update policy) already restricts PATCH to it_admin only —
// mirrored here for a clean error message. Matches the old system's
// "canEditUser -> isItAdminRole only" rule, and users_delete similarly
// blocks anyone but it_admin (or admin-on-non-it_admin-targets) from
// touching an IT Admin account.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const body = await req.json();

  const { data: before } = await supabase.from("users").select("*").eq("id", params.id).single();
  const { data, error } = await supabase.from("users").update(body).eq("id", params.id).select().single();

  if (error) {
    const status = error.code === "42501" ? 403 : 400;
    return NextResponse.json(
      { error: status === 403 ? "Only IT Admin can edit user accounts" : error.message },
      { status }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: actor } = await supabase.from("users").select("id, email, role").eq("auth_id", user?.id).single();

  await supabase.from("audit_logs").insert({
    user_id: actor?.id,
    user_email: actor?.email,
    user_role: actor?.role,
    event_category: "data_change",
    event_type: "update_user",
    table_name: "users",
    record_id: params.id,
    old_value: before,
    new_value: data,
  });

  return NextResponse.json({ data });
}

// Soft-disable, not a hard delete — same principle as assets.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase();

  const { data: before } = await supabase.from("users").select("*").eq("id", params.id).single();
  const { data, error } = await supabase
    .from("users")
    .update({ is_active: false })
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    const status = error.code === "42501" ? 403 : 400;
    return NextResponse.json(
      { error: status === 403 ? "You are not permitted to remove this user" : error.message },
      { status }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: actor } = await supabase.from("users").select("id, email, role").eq("auth_id", user?.id).single();

  await supabase.from("audit_logs").insert({
    user_id: actor?.id,
    user_email: actor?.email,
    user_role: actor?.role,
    event_category: "data_change",
    event_type: "deactivate_user",
    table_name: "users",
    record_id: params.id,
    old_value: before,
    new_value: data,
  });

  return NextResponse.json({ data });
}
