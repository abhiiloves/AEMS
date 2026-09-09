-- =====================================================================
-- AEMS v2 — keep assets.status in sync with the Damaged/Scrap lifecycle
-- approved  -> asset permanently scrapped
-- resolved  -> repaired, back in service
-- rejected  -> false report, back in service
-- reported / under_review -> no asset-level change yet
-- =====================================================================

create or replace function sync_asset_on_scrap_status()
returns trigger language plpgsql as $$
begin
  if new.status = 'approved' and (old.status is distinct from new.status) then
    update assets set status = 'scrapped' where id = new.asset_id;
  elsif new.status in ('resolved', 'rejected') and (old.status is distinct from new.status) then
    update assets set status = 'available' where id = new.asset_id and status != 'scrapped';
  end if;
  return new;
end;
$$;

create trigger trg_sync_scrap_status
  after update on damaged_scrap_records
  for each row execute function sync_asset_on_scrap_status();
