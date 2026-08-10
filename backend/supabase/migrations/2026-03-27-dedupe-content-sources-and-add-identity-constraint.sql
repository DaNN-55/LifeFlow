with ranked_sources as (
  select
    user_id,
    id,
    row_number() over (
      partition by user_id, channel, type, url, parser_key
      order by created_at asc, id asc
    ) as row_num
  from public.content_sources
)
delete from public.content_sources target
using ranked_sources ranked
where target.user_id = ranked.user_id
  and target.id = ranked.id
  and ranked.row_num > 1;

create unique index if not exists uniq_content_sources_user_identity
  on public.content_sources (user_id, channel, type, url, parser_key);
