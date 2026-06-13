-- Seed staff accounts
-- Run AFTER creating users manually in Supabase Auth dashboard
-- OR use Supabase Admin API to create users with these emails, then run this.

-- Example: update a user's role after they've registered
-- UPDATE public.profiles SET role = 'ict', full_name = 'ICT Officer' WHERE id = '<user-uuid>';
-- UPDATE public.profiles SET role = 'int', full_name = 'Intelligence Officer' WHERE id = '<user-uuid>';
-- UPDATE public.profiles SET role = 'admin', full_name = 'Admin Officer' WHERE id = '<user-uuid>';

-- To create staff accounts via SQL (replace UUIDs with actual Supabase Auth user IDs):
-- INSERT INTO public.profiles (id, role, full_name, phone) VALUES
--   ('ict-user-uuid-here',   'ict',   'ICT Officer',           '08012345678'),
--   ('int-user-uuid-here',   'int',   'Intelligence Officer',  '08023456789'),
--   ('admin-user-uuid-here', 'admin', 'Admin Officer',         '08034567890');
