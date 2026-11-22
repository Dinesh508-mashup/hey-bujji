-- Demo: Ravi's (the son's) real phone number, and the other names Amma uses for him.
update public.contacts
set phone = '+919000000001',
    nicknames = array(select distinct unnest(nicknames || array['kumar', 'ravi kumar', 'sun', 'son', 'my son']))
where family_id = 'demo-1' and relation = 'son';
