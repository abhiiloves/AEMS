-- =====================================================================
-- AEMS v2 — Triggers
-- =====================================================================

-- Auto-generate asset_code as <PREFIX>-<YEAR>-<sequence>, e.g. IT-2026-00001
create sequence if not exists asset_code_seq;

create or replace function set_asset_code()
returns trigger language plpgsql as $$
declare
  prefix text;
  yr text := to_char(now(), 'YYYY');
begin
  if new.asset_code is null then
    select code_prefix into prefix from asset_categories where id = new.category_id;
    new.asset_code := prefix || '-' || yr || '-' || lpad(nextval('asset_code_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

create trigger trg_asset_code before insert on assets
  for each row execute function set_asset_code();

-- Generic updated_at bump
create or replace function bump_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_assets_updated before update on assets
  for each row execute function bump_updated_at();
create trigger trg_users_updated before update on users
  for each row execute function bump_updated_at();
create trigger trg_employees_updated before update on employees
  for each row execute function bump_updated_at();
create trigger trg_scrap_updated before update on damaged_scrap_records
  for each row execute function bump_updated_at();
create trigger trg_maint_machines_updated before update on maintenance_machines
  for each row execute function bump_updated_at();

-- Keep assets.status / assigned_to / current_assignment_id in sync with
-- asset_assignment_history, instead of letting the client edit them
-- directly (see project notes: "assigned_to kabhi directly update mat
-- karo, hamesha assignment action ke through jao").
create or replace function sync_asset_on_assignment()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'INSERT' then
    update assets
      set status = 'assigned', assigned_to = new.employee_id, current_assignment_id = new.id
      where id = new.asset_id;
  elsif TG_OP = 'UPDATE' and new.returned_on is not null and old.returned_on is null then
    update assets
      set status = 'available', assigned_to = null, current_assignment_id = null
      where id = new.asset_id;
  end if;
  return new;
end;
$$;

create trigger trg_sync_assignment
  after insert or update on asset_assignment_history
  for each row execute function sync_asset_on_assignment();

-- Department transfer just updates the asset's department_id (no
-- approval step, per project decision) and leaves a row in
-- asset_department_transfers for history — done here so the app layer
-- can insert a single transfer row instead of two writes.
create or replace function sync_asset_on_transfer()
returns trigger language plpgsql as $$
begin
  update assets set department_id = new.to_department_id where id = new.asset_id;
  return new;
end;
$$;

create trigger trg_sync_transfer
  after insert on asset_department_transfers
  for each row execute function sync_asset_on_transfer();
