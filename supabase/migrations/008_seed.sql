-- =====================================================================
-- AEMS v2 — Baseline seed data
-- Categories match the previous reference system's list, so nothing
-- in Settings needs to be re-typed on day one.
-- =====================================================================

insert into asset_categories (name, is_functional_module, code_prefix) values
  ('IT Assets', false, 'IT'),
  ('Camera/NVR', false, 'CAM'),
  ('Quality Assets', false, 'QA'),
  ('Electrical Assets', false, 'ELEC'),
  ('Production Assets', false, 'PROD'),
  ('Safety Assets', false, 'SAF'),
  ('Vehicle Assets', false, 'VEH'),
  ('Furniture Assets', false, 'FUR'),
  ('Software/License Assets', false, 'SW'),
  ('Maintenance Assets', false, 'MNT'),
  ('Prevention (PM)', true, 'PM'),
  ('HR Operations', true, 'HR')
on conflict (name) do nothing;

-- Example custom fields for IT Assets / Camera-NVR, admin-editable afterwards
insert into category_form_fields (category_id, field_name, field_label, field_type, display_order)
select id, 'mac_address', 'MAC address', 'text', 1 from asset_categories where name = 'IT Assets'
union all
select id, 'ip_address', 'IP address', 'ip', 2 from asset_categories where name = 'IT Assets'
union all
select id, 'mac_address', 'MAC address', 'text', 1 from asset_categories where name = 'Camera/NVR'
union all
select id, 'ip_address', 'IP address', 'ip', 2 from asset_categories where name = 'Camera/NVR'
union all
select id, 'channel_no', 'Channel number', 'number', 3 from asset_categories where name = 'Camera/NVR'
on conflict (category_id, field_name) do nothing;
