-- Demo: placeholder phone number for Ravi (the son). Set the real one in the contacts table, not in code.
update public.contacts set phone = '+919000000001' where family_id = 'demo-1' and relation = 'son';
