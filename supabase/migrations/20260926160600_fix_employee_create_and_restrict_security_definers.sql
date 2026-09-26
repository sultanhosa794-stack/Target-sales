-- Production-safe Target & Sales account creation and RPC exposure fix.
alter function public.admin_create_employee(text,text,text) security definer;
revoke all on function public.admin_create_employee(text,text,text) from public, anon;
grant execute on function public.admin_create_employee(text,text,text) to authenticated;

revoke all on function public.disable_my_push_tokens() from public, anon;
grant execute on function public.disable_my_push_tokens() to authenticated;
revoke all on function public.register_my_push_token(text,text,text) from public, anon;
grant execute on function public.register_my_push_token(text,text,text) to authenticated;

revoke all on function public.dispatch_notification_push() from public, anon, authenticated;
revoke all on function public.notify_system_admins_from_device() from public, anon, authenticated;
revoke all on function public.notify_system_admins_from_sales() from public, anon, authenticated;
revoke all on function public.notify_system_admins_from_shift() from public, anon, authenticated;
revoke all on function public.send_open_shift_0130_alert() from public, anon, authenticated;
