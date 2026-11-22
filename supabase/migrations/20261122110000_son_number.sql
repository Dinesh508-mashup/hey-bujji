-- Demo: the other names Amma uses for her son, and a placeholder phone number.
-- Put the real number in the contacts table (Supabase → Table editor), not in code.
update public.contacts
set phone = '+919000000001',
    nicknames = array(select distinct unnest(nicknames || array['kumar', 'ravi kumar', 'sun', 'son', 'my son']))
where family_id = 'demo-1' and relation = 'son';
