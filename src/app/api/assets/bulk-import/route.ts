import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { createServerSupabase } from "@/lib/supabase/server";

// Per project decisions: bulk import is admin/it_admin only, AND
// per-user toggleable via users.can_bulk_import (IT Admin can turn it
// off for a specific Admin — see 001_core_schema.sql). Inserts are
// chunked at 500 rows so a 5000-row file doesn't time out or lock the
// table for the whole request, matching the plan's "chunked batches"
// note from early in the project.
const CHUNK_SIZE = 500;

interface ImportRow {
  category_name?: string;
  brand?: string;
  model?: string;
  serial_no?: string;
  department_name?: string;
  location_name?: string;
  plant_name?: string;
  purchase_cost?: string;
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: actor } = await supabase
    .from("users")
    .select("id, email, role, can_bulk_import")
    .eq("auth_id", user?.id)
    .single();

  if (!actor || !["admin", "it_admin"].includes(actor.role)) {
    return NextResponse.json({ error: "Only Admin/IT Admin can bulk import" }, { status: 403 });
  }
  if (!actor.can_bulk_import) {
    return NextResponse.json({ error: "Bulk import has been disabled for your account by IT Admin" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  const text = await file.text();
  const parsed = Papa.parse<ImportRow>(text, { header: true, skipEmptyLines: true });
  if (parsed.errors.length > 0) {
    return NextResponse.json({ error: "Could not parse CSV", details: parsed.errors }, { status: 400 });
  }

  // Resolve lookup names -> ids once, up front, instead of a query per row.
  const [{ data: categories }, { data: departments }, { data: locations }, { data: plants }] = await Promise.all([
    supabase.from("asset_categories").select("id, name"),
    supabase.from("departments").select("id, name"),
    supabase.from("locations").select("id, name"),
    supabase.from("plants").select("id, name"),
  ]);
  const byName = (rows: { id: string; name: string }[] | null) =>
    new Map((rows ?? []).map((r) => [r.name.toLowerCase(), r.id]));
  const categoryMap = byName(categories);
  const departmentMap = byName(departments);
  const locationMap = byName(locations);
  const plantMap = byName(plants);

  const validRows: Record<string, unknown>[] = [];
  const rowErrors: { row: number; error: string }[] = [];

  parsed.data.forEach((row, i) => {
    const categoryId = row.category_name ? categoryMap.get(row.category_name.toLowerCase()) : undefined;
    if (!categoryId) {
      rowErrors.push({ row: i + 2, error: `Unknown category: ${row.category_name ?? "(blank)"}` }); // +2: header + 1-index
      return;
    }
    if (!row.serial_no) {
      rowErrors.push({ row: i + 2, error: "serial_no is required" });
      return;
    }
    validRows.push({
      category_id: categoryId,
      brand: row.brand ?? null,
      model: row.model ?? null,
      serial_no: row.serial_no,
      department_id: row.department_name ? departmentMap.get(row.department_name.toLowerCase()) ?? null : null,
      location_id: row.location_name ? locationMap.get(row.location_name.toLowerCase()) ?? null : null,
      plant_id: row.plant_name ? plantMap.get(row.plant_name.toLowerCase()) ?? null : null,
      purchase_cost: row.purchase_cost ? Number(row.purchase_cost) : null,
      created_by: actor.id,
    });
  });

  let inserted = 0;
  const insertErrors: { chunkStart: number; error: string }[] = [];

  for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
    const chunk = validRows.slice(i, i + CHUNK_SIZE);
    // duplicate serial_no within the same file/table surfaces as a
    // unique-constraint violation here — the whole chunk's error is
    // reported rather than silently dropping rows, so nothing goes
    // missing without the person knowing.
    const { error, count } = await supabase.from("assets").insert(chunk, { count: "exact" });
    if (error) {
      insertErrors.push({ chunkStart: i, error: error.message });
    } else {
      inserted += count ?? chunk.length;
    }
  }

  await supabase.from("audit_logs").insert({
    user_id: actor.id,
    user_email: actor.email,
    user_role: actor.role,
    event_category: "data_change",
    event_type: "bulk_import",
    table_name: "assets",
    new_value: { fileName: file.name, totalRows: parsed.data.length, inserted, rowErrorCount: rowErrors.length },
  });

  return NextResponse.json({
    totalRows: parsed.data.length,
    inserted,
    rowErrors,
    insertErrors,
  });
}
