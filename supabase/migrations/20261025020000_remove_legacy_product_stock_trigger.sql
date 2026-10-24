do $$
declare
  legacy_function regprocedure := to_regprocedure(
    'public.track_product_stock_change()'
  );
  legacy_trigger record;
begin
  if legacy_function is null then
    return;
  end if;

  for legacy_trigger in
    select trigger_row.tgname, trigger_row.tgrelid::regclass as relation_name
    from pg_trigger as trigger_row
    where trigger_row.tgfoid = legacy_function
      and not trigger_row.tgisinternal
  loop
    execute format(
      'drop trigger %I on %s',
      legacy_trigger.tgname,
      legacy_trigger.relation_name
    );
  end loop;

  execute 'drop function public.track_product_stock_change()';
end;
$$;
