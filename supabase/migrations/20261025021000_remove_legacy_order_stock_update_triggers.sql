do $$
declare
  order_trigger record;
begin
  for order_trigger in
    select trigger_row.tgname
    from pg_trigger as trigger_row
    where trigger_row.tgrelid = 'public.orders'::regclass
      and not trigger_row.tgisinternal
      and (trigger_row.tgtype & 16) = 16
      and trigger_row.tgname not in (
        'on_cancelled_order_stock_return',
        'on_order_created'
      )
      and (
        pg_get_functiondef(trigger_row.tgfoid) ilike '%inventory_transactions%'
        or pg_get_functiondef(trigger_row.tgfoid) ilike '%products%'
        or pg_get_functiondef(trigger_row.tgfoid) ilike '%stock%'
      )
  loop
    raise notice 'Removing legacy order stock trigger: %', order_trigger.tgname;
    execute format(
      'drop trigger %I on public.orders',
      order_trigger.tgname
    );
  end loop;
end;
$$;
