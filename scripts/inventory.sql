-- Read-only parity inventory. Run on source and target and diff the output.
-- Do not paste results publicly: table names are harmless, user counts may be sensitive.

select 'auth.users' as object_name, count(*)::bigint as row_count from auth.users
union all
select schemaname || '.' || relname, n_live_tup::bigint
from pg_stat_user_tables
where schemaname in ('public', 'storage')
order by 1;

select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

select n.nspname as schema_name, p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname, arguments;

select extname, extversion from pg_extension order by extname;

select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
order by id;

select bucket_id, count(*)::bigint as object_count,
       coalesce(sum((metadata->>'size')::bigint), 0) as total_bytes
from storage.objects
group by bucket_id
order by bucket_id;

select jobid, schedule, command, active
from cron.job
order by jobid;
