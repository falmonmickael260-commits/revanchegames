begin;
create function public.report_player_lookup(p_query text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare me uuid:=auth.uid(); term text:=lower(btrim(coalesce(p_query,''))); result jsonb;
begin
 if me is null or not exists(select 1 from auth.users where id=me and email_confirmed_at is not null and not coalesce(is_anonymous,false)) then raise exception 'compte confirmé requis' using errcode='42501'; end if;
 if char_length(term)<2 or char_length(term)>120 then raise exception 'recherche invalide' using errcode='22023'; end if;
 select coalesce(jsonb_agg(to_jsonb(p)),'[]') into result from (
  select id,username,player_tag from public.profiles
  where id<>me and (id::text=term or lower(player_tag)=regexp_replace(term,'^rg-','') or lower(username)=term
    or (profile_visible and position(term in lower(username))>0))
  order by case when lower(player_tag)=regexp_replace(term,'^rg-','') then 0 else 1 end,username,id limit 10
 ) p;
 return result;
end $$;
revoke all on function public.report_player_lookup(text) from public,anon,authenticated;
grant execute on function public.report_player_lookup(text) to authenticated;
create table public.report_attachments (
 report_id uuid not null references public.reports(id),
 position integer not null check(position between 0 and 2),
 storage_path text not null unique,
 created_at timestamptz not null default now(),
 primary key(report_id,position)
);
alter table public.report_attachments enable row level security;
revoke all on public.report_attachments from public,anon,authenticated;
grant select on public.report_attachments to authenticated;
grant all on public.report_attachments to service_role;
create policy report_attachments_staff_read on public.report_attachments for select to authenticated using(public.admin_allowed('moderate'));
create policy report_additional_captures_download on storage.objects for select to authenticated using(
 bucket_id='report-evidence' and public.admin_allowed('moderate') and exists(select 1 from public.report_attachments a where a.storage_path=name)
);
commit;
