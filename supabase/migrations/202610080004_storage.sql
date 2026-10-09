-- Supabase Storage is managed by Supabase; apply after the public schema migrations.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('study-resources','study-resources',false,5242880,array['application/pdf','text/plain'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['application/pdf','text/plain'];
create policy "Students upload in their own folder" on storage.objects for insert to authenticated with check(bucket_id='study-resources' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Students read only their own files" on storage.objects for select to authenticated using(bucket_id='study-resources' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Students remove only their own files" on storage.objects for delete to authenticated using(bucket_id='study-resources' and (storage.foldername(name))[1]=(select auth.uid())::text);
